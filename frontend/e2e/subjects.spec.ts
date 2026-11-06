import { expect, request as apiRequest, test } from '@playwright/test'
import { admin, seedDirectory, seedSector, signIn, unique, userPassword } from './fixtures'

type Response = { ok(): boolean; json(): Promise<unknown> }

const json = async <T>(response: Response) => {
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as T
}

const adminApi = async (baseURL: string) => {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  return api
}

// Nomes da lista de assuntos do setor, lida como administrador.
async function subjectNames(baseURL: string, sectorId: number) {
  const api = await adminApi(baseURL)
  const subjects = await json<{ name: string }[]>(
    await api.get(`/api/sectors/${sectorId}/subjects`),
  )
  await api.dispose()
  return subjects.map((subject) => subject.name)
}

// Soluções da lista de cada assunto do setor, lidas como administrador.
async function solutionBodies(baseURL: string, sectorId: number) {
  const api = await adminApi(baseURL)
  const subjects = await json<{ name: string; solutions: { body: string }[] }[]>(
    await api.get(`/api/sectors/${sectorId}/subjects`),
  )
  await api.dispose()
  return Object.fromEntries(
    subjects.map((subject) => [subject.name, subject.solutions.map((solution) => solution.body)]),
  )
}

// Acrescenta soluções a um assunto do setor, pela API.
async function addSolutions(baseURL: string, sectorId: number, subject: string, bodies: string[]) {
  const api = await adminApi(baseURL)
  const subjects = await json<{ id: number; name: string }[]>(
    await api.get(`/api/sectors/${sectorId}/subjects`),
  )
  const id = subjects.find((item) => item.name === subject)!.id
  for (const body of bodies) {
    expect(
      (
        await api.post(`/api/sectors/${sectorId}/subjects/${id}/solutions`, { data: { body } })
      ).ok(),
    ).toBeTruthy()
  }
  await api.dispose()
}

// Setor com número ligado, um módulo, os assuntos dados e um chamado por contato
// cadastrado, já assumido pelo atendente. Devolve os nomes dos contatos.
async function prepare(baseURL: string, subjects: string[], tickets: number) {
  const { sector, agent, supervisor } = await seedSector(baseURL)
  const { id } = unique()
  const contacts = Array.from({ length: tickets }, (_, i) => ({
    name: `Cliente ${i + 1} ${id}`,
    phone: `${unique().phone.slice(0, -1)}${i}`,
  }))
  await seedDirectory(
    baseURL,
    [{ name: `Prefeitura ${id}` }],
    contacts.map((contact) => ({ ...contact, organization: 0, sector: sector.id })),
  )
  const api = await adminApi(baseURL)
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  expect((await api.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  expect(
    (await api.post(`/api/sectors/${sector.id}/modules`, { data: { name: 'Folha' } })).ok(),
  ).toBeTruthy()
  for (const name of subjects) {
    expect(
      (await api.post(`/api/sectors/${sector.id}/subjects`, { data: { name } })).ok(),
    ).toBeTruthy()
  }
  for (const contact of contacts) {
    expect(
      (
        await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
          data: {
            externalMessageId: `E2E-${unique().id}`,
            phone: contact.phone,
            contactName: contact.name,
            body: 'Preciso de ajuda',
          },
        })
      ).ok(),
    ).toBeTruthy()
  }
  await api.dispose()

  const agentApi = await apiRequest.newContext({ baseURL })
  expect(
    (
      await agentApi.post('/api/auth/login', { data: { email: agent, password: userPassword } })
    ).ok(),
  ).toBeTruthy()
  const queue = await json<{ id: number }[]>(
    await agentApi.get(`/api/sectors/${sector.id}/tickets`),
  )
  for (const ticket of queue) {
    expect((await agentApi.post(`/api/tickets/${ticket.id}/assign`)).ok()).toBeTruthy()
  }
  await agentApi.dispose()
  return { sector, agent, supervisor, contacts: contacts.map((contact) => contact.name) }
}

test('o campo Assunto sugere a lista do setor, sem nenhum marcado, e um assunto da lista não tem a pergunta do assunto', async ({
  page,
  baseURL,
}) => {
  const { sector, agent, contacts } = await prepare(
    baseURL!,
    ['Contracheque', 'Férias', 'Contrato de estágio'],
    1,
  )
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: contacts[0] }).click()
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  const subject = sheet.getByLabel('Assunto')

  // Nenhum assunto vem marcado.
  await expect(subject).toHaveValue('')

  // Enquanto digita, sugere os assuntos que contêm o texto, sem diferenciar maiúsculas.
  await subject.fill('contr')
  const options = page.getByRole('option')
  await expect(options).toHaveText(['Contracheque', 'Contrato de estágio'])
  // Esc fecha só a lista: o texto e a janela continuam; outro Esc também não apaga o texto.
  await page.keyboard.press('Escape')
  await expect(options).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeVisible()
  await expect(subject).toHaveValue('contr')
  // Texto sem nenhum assunto parecido não abre lista vazia por cima do formulário.
  await subject.fill('xyz')
  await expect(options).toHaveCount(0)
  await subject.fill('contr')
  await expect(options).toHaveText(['Contracheque', 'Contrato de estágio'])
  await page.getByRole('option', { name: 'Contracheque' }).click()
  await expect(subject).toHaveValue('Contracheque')

  await sheet.getByLabel('Resolução').fill('Enviada a segunda via.')
  await sheet.getByRole('checkbox', { name: 'Folha' }).click()
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  // Da lista, não pergunta sobre o assunto; só sobre a resolução, que não está
  // na lista do assunto (ainda sem soluções).
  await expect(sheet).not.toContainText('Este assunto não está na lista do setor.')
  await expect(sheet).toContainText('Esta resolução não está na lista de soluções do assunto')
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
  await expect(sheet).toHaveCount(0)
  expect(await subjectNames(baseURL!, sector.id)).toEqual([
    'Contracheque',
    'Contrato de estágio',
    'Férias',
  ])
})

test('assunto fora da lista: voltar não salva, adicionar e não adicionar salvam o chamado', async ({
  page,
  baseURL,
}) => {
  const { sector, agent, contacts } = await prepare(baseURL!, ['Contracheque'], 2)
  await signIn(page, agent, userPassword)

  const fill = async (contact: string, subject: string) => {
    await page.goto('/')
    await page.getByRole('link', { name: contact }).click()
    await page.getByRole('button', { name: 'Encerrar' }).click()
    const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
    await sheet.getByLabel('Assunto').fill(subject)
    await sheet.getByLabel('Resolução').fill('Orientado por telefone.')
    await sheet.getByRole('checkbox', { name: 'Folha' }).click()
    await sheet.getByRole('button', { name: 'Encerrar' }).click()
    return sheet
  }

  // A pergunta aparece na mesma janela, com o texto em questão.
  const sheet = await fill(contacts[0], '  Férias vencidas ')
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(sheet).toContainText('Este assunto não está na lista do setor. Deseja adicioná-lo?')
  await expect(sheet).toContainText('Férias vencidas')
  await expect(sheet.getByLabel('Resolução')).toBeHidden()

  // Voltar retorna ao formulário com tudo preenchido, sem salvar nada.
  await sheet.getByRole('button', { name: 'Voltar' }).click()
  await expect(sheet.getByLabel('Assunto')).toHaveValue('  Férias vencidas ')
  await expect(sheet.getByLabel('Resolução')).toHaveValue('Orientado por telefone.')
  await expect(sheet.getByRole('checkbox', { name: 'Folha' })).toBeChecked()
  expect(await subjectNames(baseURL!, sector.id)).toEqual(['Contracheque'])

  // Adicionar salva o chamado e põe o assunto na lista, sem os espaços das pontas.
  // Antes de salvar, vem a pergunta da solução, aqui sem adicioná-la.
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await sheet.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(sheet).toContainText('Esta resolução não está na lista de soluções do assunto')
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
  expect(await subjectNames(baseURL!, sector.id)).toEqual(['Contracheque', 'Férias vencidas'])

  // Não adicionar salva o chamado e deixa a lista como está.
  const second = await fill(contacts[1], 'Rescisão')
  await second.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
  await expect(second).toHaveCount(0)
  expect(await subjectNames(baseURL!, sector.id)).toEqual(['Contracheque', 'Férias vencidas'])
})

test('a correção só pergunta quando o assunto é alterado', async ({ page, baseURL }) => {
  const { sector, agent, contacts } = await prepare(baseURL!, [], 1)
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: contacts[0] }).click()
  const ticketUrl = page.url()
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const closing = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await closing.getByLabel('Assunto').fill('Contracheque')
  await closing.getByLabel('Resolução').fill('Enviada a segunda via.')
  await closing.getByRole('checkbox', { name: 'Folha' }).click()
  await closing.getByRole('button', { name: 'Encerrar' }).click()
  await closing.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()

  // Chamado antigo com assunto fora da lista: corrigir outro campo não pergunta.
  await page.goto(ticketUrl)
  await page.getByRole('button', { name: 'Corrigir' }).click()
  const sheet = page.getByRole('dialog', { name: 'Corrigir atendimento' })
  await sheet.getByLabel('Falou com').fill('Rita, filha')
  await sheet.getByLabel('Motivo da correção').fill('Faltou quem atendeu.')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await expect(page.getByText('Atendimento corrigido')).toBeVisible()
  await expect(sheet).toHaveCount(0)
  expect(await subjectNames(baseURL!, sector.id)).toEqual([])

  // Alterando o assunto, pergunta.
  await page.getByRole('button', { name: 'Corrigir' }).click()
  await sheet.getByLabel('Assunto').fill('Segunda via do contracheque')
  await sheet.getByLabel('Motivo da correção').fill('Assunto registrado errado.')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await expect(sheet).toContainText('Este assunto não está na lista do setor. Deseja adicioná-lo?')
  await sheet.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('Atendimento corrigido')).toBeVisible()
  expect(await subjectNames(baseURL!, sector.id)).toEqual(['Segunda via do contracheque'])
})

test('o supervisor cadastra, edita e exclui assuntos do setor, e o repetido é recusado', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Assuntos' }).click()
  await expect(page.getByRole('heading', { name: 'Assuntos' })).toBeVisible()
  await expect(page.getByText('Nenhum assunto cadastrado.')).toBeVisible()
  // O supervisor não escolhe o setor: vê só o próprio.
  await expect(page.getByLabel('Setor')).toHaveCount(0)

  await page.getByRole('button', { name: 'Novo assunto' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo assunto' })
  await sheet.getByLabel('Nome').fill('Contracheque')
  await sheet.getByRole('button', { name: 'Cadastrar assunto' }).click()
  await expect(page.getByText('Assunto salvo')).toBeVisible()
  const table = page.getByRole('table')
  await expect(table).toContainText('Contracheque')

  // Repetido, com outras maiúsculas, é recusado com aviso no formulário.
  await page.getByRole('button', { name: 'Novo assunto' }).click()
  await sheet.getByLabel('Nome').fill('CONTRACHEQUE ')
  await sheet.getByRole('button', { name: 'Cadastrar assunto' }).click()
  await expect(sheet).toContainText('Já existe um assunto com este nome neste setor.')
  await sheet.getByLabel('Nome').fill('Férias')
  await sheet.getByRole('button', { name: 'Cadastrar assunto' }).click()
  await expect(sheet).toHaveCount(0)

  await page.getByRole('button', { name: 'Editar Férias' }).click()
  const edit = page.getByRole('dialog', { name: 'Editar assunto' })
  await expect(edit.getByLabel('Nome')).toHaveValue('Férias')
  await edit.getByLabel('Nome').fill('Férias e licenças')
  await edit.getByRole('button', { name: 'Salvar' }).click()
  await expect(edit).toHaveCount(0)
  await expect(table).toContainText('Férias e licenças')

  // Excluir pede confirmação; Cancelar mantém o assunto.
  await page.getByRole('button', { name: 'Excluir Contracheque' }).click()
  const confirm = page.getByRole('dialog', { name: 'Excluir assunto' })
  await expect(confirm).toContainText('A exclusão não pode ser desfeita')
  await confirm.getByRole('button', { name: 'Cancelar' }).click()
  await expect(confirm).toBeHidden()
  await expect(table).toContainText('Contracheque')

  await page.getByRole('button', { name: 'Excluir Contracheque' }).click()
  await confirm.getByRole('button', { name: 'Excluir assunto' }).click()
  await expect(page.getByText('Assunto excluído')).toBeVisible()
  await expect(table).not.toContainText('Contracheque')
  expect(await subjectNames(baseURL!, sector.id)).toEqual(['Férias e licenças'])
})

test('o administrador escolhe o setor na tela Assuntos', async ({ page, baseURL }) => {
  const first = await seedSector(baseURL!)
  const second = await seedSector(baseURL!)
  const api = await adminApi(baseURL!)
  for (const [sector, name] of [
    [first.sector, 'Assunto do primeiro'],
    [second.sector, 'Assunto do segundo'],
  ] as const) {
    expect(
      (await api.post(`/api/sectors/${sector.id}/subjects`, { data: { name } })).ok(),
    ).toBeTruthy()
  }
  await api.dispose()

  await signIn(page, admin.email, admin.password)
  await page.goto('/assuntos')
  const table = page.locator('[data-slot=sidebar-inset]')
  await page.getByLabel('Setor').click()
  await page.getByRole('option', { name: first.sector.name }).click()
  await expect(table).toContainText('Assunto do primeiro')
  await expect(table).not.toContainText('Assunto do segundo')

  await page.getByLabel('Setor').click()
  await page.getByRole('option', { name: second.sector.name }).click()
  await expect(table).toContainText('Assunto do segundo')
  await expect(table).not.toContainText('Assunto do primeiro')

  // Novo assunto entra no setor escolhido.
  await page.getByRole('button', { name: 'Novo assunto' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo assunto' })
  await sheet.getByLabel('Nome').fill('Outro do segundo')
  await sheet.getByRole('button', { name: 'Cadastrar assunto' }).click()
  await expect(sheet).toHaveCount(0)
  expect(await subjectNames(baseURL!, second.sector.id)).toEqual([
    'Assunto do segundo',
    'Outro do segundo',
  ])
  expect(await subjectNames(baseURL!, first.sector.id)).toEqual(['Assunto do primeiro'])
})

test('o atendente não abre a tela Assuntos', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await expect(page.getByRole('link', { name: 'Assuntos' })).toHaveCount(0)
  await page.goto('/assuntos')
  await expect(page).toHaveURL(/\/$/)
})

test('a confirmação de exclusão do assunto diz quantas soluções serão apagadas', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  const api = await adminApi(baseURL!)
  for (const name of ['Contracheque', 'Férias', 'Admissão']) {
    expect(
      (await api.post(`/api/sectors/${sector.id}/subjects`, { data: { name } })).ok(),
    ).toBeTruthy()
  }
  await api.dispose()
  await addSolutions(baseURL!, sector.id, 'Contracheque', ['Enviada a segunda via.', 'Orientado.'])
  await addSolutions(baseURL!, sector.id, 'Férias', ['Agendadas.'])

  await signIn(page, supervisor, userPassword)
  await page.goto('/assuntos')
  const confirm = page.getByRole('dialog', { name: 'Excluir assunto' })

  await page.getByRole('button', { name: 'Excluir Contracheque' }).click()
  await expect(confirm).toContainText('As 2 soluções dele também serão apagadas.')
  await confirm.getByRole('button', { name: 'Excluir assunto' }).click()
  await expect(page.getByText('Assunto excluído')).toBeVisible()

  await page.getByRole('button', { name: 'Excluir Férias' }).click()
  await expect(confirm).toContainText('A solução dele também será apagada.')
  await confirm.getByRole('button', { name: 'Cancelar' }).click()
  await expect(confirm).toBeHidden()

  // Sem soluções, a confirmação não fala delas.
  await page.getByRole('button', { name: 'Excluir Admissão' }).click()
  await expect(confirm).toContainText('A exclusão não pode ser desfeita')
  await expect(confirm).not.toContainText('soluç')
  await confirm.getByRole('button', { name: 'Cancelar' }).click()

  expect(await solutionBodies(baseURL!, sector.id)).toEqual({
    Admissão: [],
    Férias: ['Agendadas.'],
  })
})

// Abre o encerramento do chamado do contato e preenche o módulo.
async function openClosing(page: import('@playwright/test').Page, contact: string) {
  await page.goto('/')
  await page.getByRole('link', { name: contact }).click()
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await sheet.getByRole('checkbox', { name: 'Folha' }).click()
  return sheet
}

test('Soluções sugeridas aparecem só em assunto com soluções e preenchem a Resolução, que continua editável', async ({
  page,
  baseURL,
}) => {
  const { sector, agent, contacts } = await prepare(baseURL!, ['Contracheque', 'Férias'], 1)
  await addSolutions(baseURL!, sector.id, 'Contracheque', [
    'Enviada a segunda via.',
    'Orientado a acessar o portal.',
  ])
  await signIn(page, agent, userPassword)
  const sheet = await openClosing(page, contacts[0])
  const suggested = sheet.getByLabel('Soluções sugeridas')
  const resolution = sheet.getByLabel('Resolução')

  // Sem assunto, ou com assunto sem soluções, não aparece.
  await expect(suggested).toHaveCount(0)
  await sheet.getByLabel('Assunto').fill('Férias')
  await expect(suggested).toHaveCount(0)

  // Assunto da lista com soluções, mesmo com outras maiúsculas.
  await sheet.getByLabel('Assunto').fill('contracheque')
  await page.keyboard.press('Escape')
  await suggested.click()
  await expect(page.getByRole('option')).toHaveText([
    'Enviada a segunda via.',
    'Orientado a acessar o portal.',
  ])
  await page.getByRole('option', { name: 'Orientado a acessar o portal.' }).click()
  await expect(resolution).toHaveValue('Orientado a acessar o portal.')

  // Escolher outra substitui o texto, que continua editável.
  await resolution.fill('Texto digitado antes.')
  await suggested.click()
  await page.getByRole('option', { name: 'Enviada a segunda via.' }).click()
  await expect(resolution).toHaveValue('Enviada a segunda via.')
  await resolution.fill('Enviada a segunda via por e-mail.')
  await expect(resolution).toHaveValue('Enviada a segunda via por e-mail.')

  // Trocar de assunto não apaga a Resolução.
  await sheet.getByLabel('Assunto').fill('Férias')
  await expect(suggested).toHaveCount(0)
  await expect(resolution).toHaveValue('Enviada a segunda via por e-mail.')
})

test('solução da lista sem alteração salva sem pergunta; texto alterado pergunta, com as três respostas', async ({
  page,
  baseURL,
}) => {
  const { sector, agent, contacts } = await prepare(baseURL!, ['Contracheque'], 3)
  await addSolutions(baseURL!, sector.id, 'Contracheque', ['Enviada a segunda via.'])
  await signIn(page, agent, userPassword)

  // Da lista, sem alterar o texto: salva direto.
  let sheet = await openClosing(page, contacts[0])
  await sheet.getByLabel('Assunto').fill('Contracheque')
  await page.keyboard.press('Escape')
  await sheet.getByLabel('Soluções sugeridas').click()
  await page.getByRole('option', { name: 'Enviada a segunda via.' }).click()
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
  await expect(sheet).toHaveCount(0)

  // Texto da lista alterado: pergunta na mesma janela, com o texto em questão.
  sheet = await openClosing(page, contacts[1])
  await sheet.getByLabel('Assunto').fill('Contracheque')
  await page.keyboard.press('Escape')
  await sheet.getByLabel('Soluções sugeridas').click()
  await page.getByRole('option', { name: 'Enviada a segunda via.' }).click()
  await sheet.getByLabel('Resolução').fill('Enviada a segunda via pelo correio.')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(sheet).toContainText(
    'Esta resolução não está na lista de soluções do assunto Contracheque. Deseja adicioná-la?',
  )
  await expect(sheet).toContainText('Enviada a segunda via pelo correio.')
  await expect(sheet).not.toContainText('Este assunto não está na lista do setor.')

  // Voltar retorna ao formulário com tudo preenchido, sem salvar nada.
  await sheet.getByRole('button', { name: 'Voltar' }).click()
  await expect(sheet.getByLabel('Resolução')).toHaveValue('Enviada a segunda via pelo correio.')
  await expect(sheet.getByLabel('Assunto')).toHaveValue('Contracheque')
  expect(await solutionBodies(baseURL!, sector.id)).toEqual({
    Contracheque: ['Enviada a segunda via.'],
  })

  // Adicionar salva o chamado e põe a solução na lista.
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await sheet.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
  expect(await solutionBodies(baseURL!, sector.id)).toEqual({
    Contracheque: ['Enviada a segunda via pelo correio.', 'Enviada a segunda via.'],
  })

  // Texto novo, Não adicionar: salva o chamado e deixa a lista como está.
  sheet = await openClosing(page, contacts[2])
  await sheet.getByLabel('Assunto').fill('Contracheque')
  await sheet.getByLabel('Resolução').fill('  Orientado por telefone. ')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(sheet).toContainText('Orientado por telefone.')
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
  await expect(sheet).toHaveCount(0)
  expect(await solutionBodies(baseURL!, sector.id)).toEqual({
    Contracheque: ['Enviada a segunda via pelo correio.', 'Enviada a segunda via.'],
  })
})

test('assunto não adicionado não tem pergunta da solução; adicionado, as duas vêm em sequência', async ({
  page,
  baseURL,
}) => {
  const { sector, agent, contacts } = await prepare(baseURL!, [], 2)
  await signIn(page, agent, userPassword)

  // Não adicionar o assunto salva sem perguntar sobre a solução.
  let sheet = await openClosing(page, contacts[0])
  await sheet.getByLabel('Assunto').fill('Rescisão')
  await sheet.getByLabel('Resolução').fill('Calculada a rescisão.')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(sheet).toContainText('Este assunto não está na lista do setor.')
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
  await expect(sheet).toHaveCount(0)
  expect(await solutionBodies(baseURL!, sector.id)).toEqual({})

  // Adicionar o assunto leva à pergunta da solução; Voltar ainda não salva nada.
  sheet = await openClosing(page, contacts[1])
  await sheet.getByLabel('Assunto').fill('Férias vencidas')
  await sheet.getByLabel('Resolução').fill('Agendadas para março.')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await sheet.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(sheet).toContainText(
    'Esta resolução não está na lista de soluções do assunto Férias vencidas. Deseja adicioná-la?',
  )
  await expect(sheet.locator('[data-slot=form-question]')).toBeFocused()
  await sheet.getByRole('button', { name: 'Voltar' }).click()
  await expect(sheet.getByLabel('Resolução')).toHaveValue('Agendadas para março.')
  expect(await subjectNames(baseURL!, sector.id)).toEqual([])

  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await sheet.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await sheet.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
  expect(await solutionBodies(baseURL!, sector.id)).toEqual({
    'Férias vencidas': ['Agendadas para março.'],
  })
})

test('a correção só pergunta sobre a solução quando a resolução é alterada', async ({
  page,
  baseURL,
}) => {
  const { sector, agent, contacts } = await prepare(baseURL!, ['Contracheque'], 1)
  await signIn(page, agent, userPassword)
  const closing = await openClosing(page, contacts[0])
  const ticketUrl = page.url()
  await closing.getByLabel('Assunto').fill('Contracheque')
  await closing.getByLabel('Resolução').fill('Enviada a segunda via.')
  await closing.getByRole('button', { name: 'Encerrar' }).click()
  await closing.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()

  // Resolução fora da lista, mas sem alteração: corrigir outro campo não pergunta.
  await page.goto(ticketUrl)
  await page.getByRole('button', { name: 'Corrigir' }).click()
  const sheet = page.getByRole('dialog', { name: 'Corrigir atendimento' })
  await sheet.getByLabel('Falou com').fill('Rita, filha')
  await sheet.getByLabel('Motivo da correção').fill('Faltou quem atendeu.')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await expect(page.getByText('Atendimento corrigido')).toBeVisible()
  await expect(sheet).toHaveCount(0)
  expect(await solutionBodies(baseURL!, sector.id)).toEqual({ Contracheque: [] })

  // Alterando a resolução, pergunta.
  await page.getByRole('button', { name: 'Corrigir' }).click()
  await sheet.getByLabel('Resolução').fill('Enviada a segunda via por e-mail.')
  await sheet.getByLabel('Motivo da correção').fill('Resolução incompleta.')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await expect(sheet).toContainText('Esta resolução não está na lista de soluções do assunto')
  await sheet.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('Atendimento corrigido')).toBeVisible()
  expect(await solutionBodies(baseURL!, sector.id)).toEqual({
    Contracheque: ['Enviada a segunda via por e-mail.'],
  })
})
