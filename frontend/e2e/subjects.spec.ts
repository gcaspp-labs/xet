import { expect, request as apiRequest, test } from '@playwright/test'
import {
  admin,
  clearSession,
  expectClosableDialog,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

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

test('o responsável consulta soluções durante o atendimento', async ({ page, baseURL }) => {
  const { sector, agent, contacts } = await prepare(baseURL!, ['Folha de pagamento'], 1)
  await addSolutions(baseURL!, sector.id, 'Folha de pagamento', ['Confira o contracheque.'])
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: contacts[0] }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  const card = page.getByRole('region', { name: 'Chamado', exact: true })
  await card.getByRole('tab', { name: 'Assuntos' }).click()
  await expect(card).toContainText('Confira o contracheque.')
})

test('busca e copia soluções sem interromper a conversa', async ({ page, context, baseURL }) => {
  const { sector, agent, contacts } = await prepare(baseURL!, ['Férias', 'Admissão'], 2)
  const long = `Período confirmado. ${'x'.repeat(9980)}`
  await addSolutions(baseURL!, sector.id, 'Férias', ['Agendadas pelo portal.', long])
  await addSolutions(baseURL!, sector.id, 'Admissão', ['Documentos conferidos.'])
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: contacts[0] }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  const card = page.getByRole('region', { name: 'Chamado', exact: true })
  await card.getByRole('tab', { name: 'Assuntos' }).click()
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Mensagem durante a consulta')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Mensagem durante a consulta',
  )
  const search = card.getByRole('searchbox', { name: 'Buscar assuntos e soluções' })
  await search.fill('FERIAS')
  await expect(card).toContainText('Agendadas pelo portal.')
  await expect(card).toContainText('Período confirmado.')
  await expect(card).not.toContainText('Documentos conferidos.')
  await search.fill('periodo')
  await expect(card).not.toContainText('Agendadas pelo portal.')
  await card.getByRole('button', { name: 'Copiar' }).click()
  await expect(page.getByText('Solução copiada')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(long)
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('')
  await page.getByRole('link', { name: contacts[1] }).click()
  await expect(card.getByRole('tab', { name: 'Detalhes' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('link', { name: contacts[0] }).click()
  await expect(card.getByRole('tab', { name: 'Assuntos' })).toHaveAttribute('aria-selected', 'true')
  await expect(search).toHaveValue('periodo')
  await search.fill('inexistente')
  await expect(card).toContainText('Nenhum assunto ou solução encontrado.')
})

test('a aba e a busca não passam para outra pessoa depois de sair', async ({ page, baseURL }) => {
  const { agent, supervisor, contacts } = await prepare(baseURL!, ['Férias'], 1)
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: contacts[0] }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  const card = page.getByRole('region', { name: 'Chamado', exact: true })
  await card.getByRole('tab', { name: 'Assuntos' }).click()
  await card.getByRole('searchbox', { name: 'Buscar assuntos e soluções' }).fill('ferias')

  await page.getByRole('button', { name: 'Transferir' }).click()
  const sheet = page.getByRole('dialog', { name: 'Transferir chamado' })
  await sheet.getByRole('combobox', { name: 'Transferir para' }).click()
  await page.getByRole('option', { name: /Supervisor/ }).click()
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(page.getByText('Chamado transferido')).toBeVisible()
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('E-mail').fill(supervisor)
  await page.getByLabel('Senha').fill(userPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.getByRole('link', { name: contacts[0] }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  await expect(card.getByRole('tab', { name: 'Detalhes' })).toHaveAttribute('aria-selected', 'true')
  await card.getByRole('tab', { name: 'Assuntos' }).click()
  await expect(card.getByRole('searchbox', { name: 'Buscar assuntos e soluções' })).toHaveValue('')
})

test('aba respeita responsável, setor e tela estreita', async ({ page, browser, baseURL }) => {
  const first = await prepare(baseURL!, ['Folha'], 1)
  const second = await prepare(baseURL!, [], 1)
  await addSolutions(baseURL!, first.sector.id, 'Folha', ['Solução exclusiva do primeiro setor.'])
  await signIn(page, first.agent, userPassword)
  await page.getByRole('link', { name: first.contacts[0] }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  const firstUrl = page.url()
  const card = page.getByRole('region', { name: 'Chamado', exact: true })
  await card.getByRole('tab', { name: 'Assuntos' }).click()
  await expect(card).toContainText('Solução exclusiva do primeiro setor.')
  await page.setViewportSize({ width: 375, height: 812 })
  const chatBox = await page.getByRole('region', { name: 'Conversa', exact: true }).boundingBox()
  const cardBox = await card.boundingBox()
  expect(cardBox!.y).toBeGreaterThan(chatBox!.y + chatBox!.height - 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, first.supervisor, userPassword)
  await other.goto(firstUrl)
  await expect(other.getByRole('tab', { name: 'Assuntos' })).toHaveCount(0)
  await otherContext.close()
  await clearSession(page)
  await signIn(page, second.agent, userPassword)
  await page.getByRole('link', { name: second.contacts[0] }).click()
  await page.getByRole('tab', { name: 'Assuntos' }).click()
  await expect(page.getByText('Este setor ainda não tem assuntos cadastrados.')).toBeVisible()
  await expect(page.getByText('Solução exclusiva do primeiro setor.')).toHaveCount(0)
})

test('supervisor e administrador consultam quando são responsáveis', async ({ page, baseURL }) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  const api = await adminApi(baseURL!)
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  expect((await api.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  expect(
    (await api.post(`/api/sectors/${sector.id}/subjects`, { data: { name: 'Orientações' } })).ok(),
  ).toBeTruthy()
  for (const name of ['Cliente Supervisor', 'Cliente Administrador']) {
    expect(
      (
        await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
          data: {
            externalMessageId: `E2E-${unique().id}`,
            phone: unique().phone,
            contactName: name,
            body: 'Ajuda',
          },
        })
      ).ok(),
    ).toBeTruthy()
  }
  await api.dispose()
  await addSolutions(baseURL!, sector.id, 'Orientações', ['Resposta do setor.'])
  await signIn(page, supervisor, userPassword)
  const adminTicketUrl = await page
    .getByRole('link', { name: 'Cliente Administrador' })
    .getAttribute('href')
  expect(adminTicketUrl).toBeTruthy()
  await page.getByRole('link', { name: 'Cliente Supervisor' }).click()
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await page.getByRole('tab', { name: 'Assuntos' }).click()
  await expect(page.getByText('Resposta do setor.')).toBeVisible()
  await clearSession(page)
  await signIn(page, admin.email, admin.password)
  await page.goto(adminTicketUrl!)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await page.getByRole('tab', { name: 'Assuntos' }).click()
  await expect(page.getByText('Resposta do setor.')).toBeVisible()
})

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
  await page.getByRole('link', { name: 'Ver chamado' }).click()
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

// Setor com os assuntos dados, cada um com as suas soluções, criados pela API.
async function seedSubjects(baseURL: string, sectorId: number, list: Record<string, string[]>) {
  const api = await adminApi(baseURL)
  for (const name of Object.keys(list)) {
    expect(
      (await api.post(`/api/sectors/${sectorId}/subjects`, { data: { name } })).ok(),
    ).toBeTruthy()
  }
  await api.dispose()
  for (const [name, bodies] of Object.entries(list)) {
    await addSolutions(baseURL, sectorId, name, bodies)
  }
}

// Textos da tabela na ordem: assunto em uma linha, soluções nas seguintes.
async function tableRows(page: import('@playwright/test').Page) {
  return page
    .getByRole('table')
    .locator('tbody tr')
    .evaluateAll((rows) =>
      rows.map((row) =>
        row.hasAttribute('data-subject')
          ? `# ${row.getAttribute('data-subject')}`
          : (row.querySelector('p')?.textContent ?? ''),
      ),
    )
}

test('o supervisor adiciona, edita e exclui uma solução, e a repetida é recusada no formulário', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await seedSubjects(baseURL!, sector.id, { Contracheque: [] })
  await signIn(page, supervisor, userPassword)
  await page.goto('/assuntos')
  await expect(page.getByRole('table')).toContainText('Nenhuma solução')

  const sheet = page.getByRole('dialog', { name: 'Nova solução' })
  // Janela de fechamento normal: X, Esc e clique fora fecham.
  await expectClosableDialog(page, sheet, () =>
    page.getByRole('button', { name: 'Nova solução para Contracheque' }).click(),
  )
  await page.getByRole('button', { name: 'Nova solução para Contracheque' }).click()
  await expect(sheet).toContainText('Assunto: Contracheque')
  await sheet.getByRole('button', { name: 'Cadastrar solução' }).click()
  await expect(sheet).toContainText('Informe a solução.')
  await sheet.getByLabel('Solução').fill('Enviada a segunda via.')
  await sheet.getByRole('button', { name: 'Cadastrar solução' }).click()
  await expect(page.getByText('Solução salva')).toBeVisible()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('table')).toContainText('1 solução')

  // Repetida, com outras maiúsculas e espaços, é recusada com aviso no formulário.
  await page.getByRole('button', { name: 'Nova solução para Contracheque' }).click()
  await sheet.getByLabel('Solução').fill('  ENVIADA A SEGUNDA VIA. ')
  await sheet.getByRole('button', { name: 'Cadastrar solução' }).click()
  await expect(sheet).toContainText('Esta solução já está na lista deste assunto.')
  await sheet.getByLabel('Solução').fill('Orientado a consultar o portal.')
  await sheet.getByRole('button', { name: 'Cadastrar solução' }).click()
  await expect(sheet).toHaveCount(0)

  // Editar mostra o texto inteiro e grava a troca.
  await page
    .getByRole('button', { name: 'Editar solução: Orientado a consultar o portal.' })
    .click()
  const edit = page.getByRole('dialog', { name: 'Editar solução' })
  await expect(edit.getByLabel('Solução')).toHaveValue('Orientado a consultar o portal.')
  // Trocar para o texto de outra solução do assunto também é recusado.
  await edit.getByLabel('Solução').fill('enviada a segunda via.')
  await edit.getByRole('button', { name: 'Salvar' }).click()
  await expect(edit).toContainText('Esta solução já está na lista deste assunto.')
  await edit.getByLabel('Solução').fill('Orientado a consultar o portal do servidor.')
  await edit.getByRole('button', { name: 'Salvar' }).click()
  await expect(edit).toHaveCount(0)
  await expect(page.getByRole('table')).toContainText('Orientado a consultar o portal do servidor.')

  // Excluir pede confirmação; Cancelar mantém a solução.
  const confirm = page.getByRole('dialog', { name: 'Excluir solução' })
  await page.getByRole('button', { name: 'Excluir solução: Enviada a segunda via.' }).click()
  await expect(confirm).toContainText('A exclusão não pode ser desfeita')
  await expect(confirm).toContainText('Enviada a segunda via.')
  await confirm.getByRole('button', { name: 'Cancelar' }).click()
  await expect(confirm).toBeHidden()
  await page.getByRole('button', { name: 'Excluir solução: Enviada a segunda via.' }).click()
  await confirm.getByRole('button', { name: 'Excluir solução' }).click()
  await expect(page.getByText('Solução excluída')).toBeVisible()
  await expect(page.getByRole('table')).not.toContainText('Enviada a segunda via.')

  expect(await solutionBodies(baseURL!, sector.id)).toEqual({
    Contracheque: ['Orientado a consultar o portal do servidor.'],
  })
})

test('a busca filtra assuntos e soluções sem diferenciar acentos nem maiúsculas', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await seedSubjects(baseURL!, sector.id, {
    Contracheque: ['Enviada a segunda via.', 'Orientado a consultar o portal.'],
    Férias: ['Agendadas pelo portal.', 'Período confirmado.'],
    Admissão: ['Documentos conferidos.'],
  })
  await signIn(page, supervisor, userPassword)
  await page.goto('/assuntos')
  const search = page.getByRole('searchbox', { name: 'Buscar assuntos' })
  await expect(page.getByRole('table')).toContainText('Documentos conferidos.')

  // Pelo nome, sem acento e em maiúsculas: o assunto vem com todas as soluções.
  await search.fill('FERIAS')
  await expect
    .poll(() => tableRows(page))
    .toEqual(['# Férias', 'Agendadas pelo portal.', 'Período confirmado.'])

  // Por uma solução: só as soluções que batem, em cada assunto encontrado.
  await search.fill('PORTAL')
  await expect
    .poll(() => tableRows(page))
    .toEqual([
      '# Contracheque',
      'Orientado a consultar o portal.',
      '# Férias',
      'Agendadas pelo portal.',
    ])
  // A contagem do assunto continua a da lista inteira.
  await expect(page.locator('[data-subject=Contracheque]')).toContainText('2 soluções')

  // Acento na busca encontra o texto sem acento, e o contrário.
  await search.fill('periodo')
  await expect.poll(() => tableRows(page)).toEqual(['# Férias', 'Período confirmado.'])
  await search.fill('admissao')
  await expect.poll(() => tableRows(page)).toEqual(['# Admissão', 'Documentos conferidos.'])

  // Sem resultado: EmptyState.
  await search.fill('rescisão')
  await expect(page.getByRole('table')).toHaveCount(0)
  await expect(page.getByText('Nenhum assunto encontrado.')).toBeVisible()

  await search.fill('')
  await expect.poll(() => tableRows(page)).toHaveLength(8)
})

test('o supervisor vê só o próprio setor, e o administrador troca de setor e vê a lista dele com as soluções', async ({
  page,
  baseURL,
}) => {
  const first = await seedSector(baseURL!)
  const second = await seedSector(baseURL!)
  await seedSubjects(baseURL!, first.sector.id, { 'Assunto do primeiro': ['Solução do primeiro.'] })
  await seedSubjects(baseURL!, second.sector.id, { 'Assunto do segundo': ['Solução do segundo.'] })

  await signIn(page, first.supervisor, userPassword)
  await page.goto('/assuntos')
  await expect
    .poll(() => tableRows(page))
    .toEqual(['# Assunto do primeiro', 'Solução do primeiro.'])
  await expect(page.getByLabel('Setor')).toHaveCount(0)
  await page.getByRole('searchbox', { name: 'Buscar assuntos' }).fill('segundo')
  await expect(page.getByText('Nenhum assunto encontrado.')).toBeVisible()

  await clearSession(page)
  await signIn(page, admin.email, admin.password)
  await page.goto('/assuntos')
  await page.getByLabel('Setor').click()
  await page.getByRole('option', { name: first.sector.name }).click()
  await expect
    .poll(() => tableRows(page))
    .toEqual(['# Assunto do primeiro', 'Solução do primeiro.'])
  await page.getByLabel('Setor').click()
  await page.getByRole('option', { name: second.sector.name }).click()
  await expect(page.getByRole('table')).toContainText('Solução do segundo.')
  await expect.poll(() => tableRows(page)).toEqual(['# Assunto do segundo', 'Solução do segundo.'])

  // Nova solução entra no assunto do setor escolhido.
  await page.getByRole('button', { name: 'Nova solução para Assunto do segundo' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nova solução' })
  await sheet.getByLabel('Solução').fill('Outra do segundo.')
  await sheet.getByRole('button', { name: 'Cadastrar solução' }).click()
  await expect(sheet).toHaveCount(0)
  expect(await solutionBodies(baseURL!, second.sector.id)).toEqual({
    'Assunto do segundo': ['Outra do segundo.', 'Solução do segundo.'],
  })
  expect(await solutionBodies(baseURL!, first.sector.id)).toEqual({
    'Assunto do primeiro': ['Solução do primeiro.'],
  })
})

// Solução com texto longo, com e sem espaços, não alarga a tabela nem a tela; o
// texto inteiro aparece ao editar. Capturas para a revisão visual.
for (const theme of ['light', 'dark'] as const) {
  for (const [device, width, height] of [
    ['desktop', 1280, 800],
    ['celular', 375, 667],
  ] as const) {
    test(`solução longa sem quebrar a tabela, tema ${theme}, ${device}`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      const { sector, supervisor } = await seedSector(baseURL!)
      const long = `Orientado sobre o procedimento completo. ${'Conferidos os dados do cadastro e enviada a orientação por escrito. '.repeat(60)}Fim do texto.`
      const unbroken = `Protocolo${'0123456789'.repeat(30)}`
      await seedSubjects(baseURL!, sector.id, {
        'Contracheque e informe de rendimentos do exercício anterior': [
          'Enviada a segunda via.',
          long,
          unbroken,
        ],
        Férias: ['Agendadas pelo portal.'],
      })
      const context = await browser.newContext({ viewport: { width, height } })
      const page = await context.newPage()
      await page.addInitScript((stored) => localStorage.setItem('theme', stored), theme)
      await signIn(page, supervisor, userPassword)
      await page.goto('/assuntos')
      const table = page.getByRole('table')
      await expect(table).toContainText('Fim do texto.')
      const name = `${theme === 'light' ? 'claro' : 'escuro'}-${device}`

      const overflow = () =>
        page.evaluate(() => {
          const container = document.querySelector('[data-slot=table-container]')!
          return [
            document.documentElement.scrollWidth - document.documentElement.clientWidth,
            container.scrollWidth - container.clientWidth,
          ]
        })
      expect(await overflow()).toEqual([0, 0])
      // O texto longo fica em poucas linhas na tabela.
      const cell = table.locator('p', { hasText: 'Fim do texto.' })
      expect((await cell.boundingBox())!.height).toBeLessThan(100)
      await page.screenshot({ path: testInfo.outputPath(`assuntos-${name}.png`), fullPage: true })

      await page.getByRole('searchbox', { name: 'Buscar assuntos' }).fill('PROCEDIMENTO')
      await expect
        .poll(() => tableRows(page))
        .toEqual(['# Contracheque e informe de rendimentos do exercício anterior', long])
      expect(await overflow()).toEqual([0, 0])
      await page.screenshot({ path: testInfo.outputPath(`busca-${name}.png`) })

      await page.getByRole('button', { name: /^Editar solução: Orientado sobre/ }).click()
      const edit = page.getByRole('dialog', { name: 'Editar solução' })
      await expect(edit.getByLabel('Solução')).toHaveValue(long)
      await page.waitForTimeout(300)
      await page.screenshot({ path: testInfo.outputPath(`editar-${name}.png`) })
      await page.keyboard.press('Escape')
      await expect(edit).toBeHidden()

      await page.getByRole('searchbox', { name: 'Buscar assuntos' }).fill('xyz')
      await expect(page.getByText('Nenhum assunto encontrado.')).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath(`vazia-${name}.png`) })
      await context.close()
    })
  }
}
