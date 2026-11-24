import { expect, request as apiRequest, test } from '@playwright/test'
import { format } from 'date-fns'
import {
  admin,
  defaultMunicipality,
  municipalityId,
  seedSector,
  signIn,
  unique,
  userPassword,
  chooseAction,
  openQueued,
  login,
  recordToasts,
} from './fixtures'

// Liga o número do setor pelo adaptador falso e cadastra um órgão e os módulos do setor.
async function prepare(baseURL: string, sectorId: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sectorId}/connection`)).ok()).toBeTruthy()
  expect((await api.post(`/api/test/messaging/sectors/${sectorId}/pair`)).ok()).toBeTruthy()
  const { id } = unique()
  const organization = `Prefeitura ${id}`
  expect(
    (
      await api.post('/api/organizations', {
        data: { name: organization, municipalityId: await municipalityId(api) },
      })
    ).ok(),
  ).toBeTruthy()
  for (const name of ['Folha', 'Patrimônio']) {
    expect(
      (await api.post(`/api/sectors/${sectorId}/modules`, { data: { name } })).ok(),
    ).toBeTruthy()
  }
  await api.dispose()
  return { organization }
}

test('encerramento exige o formulário completo e o cadastro do contato', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const { organization } = await prepare(baseURL!, sector.id)
  const { phone } = unique()
  const receive = (body: string) =>
    request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: 'Paulo Cliente', body },
    })
  expect((await receive('Preciso do contracheque')).ok()).toBeTruthy()

  // O supervisor acompanha os Atendimentos do setor em outra janela.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await login(other, supervisor, userPassword)
  await expect(other).not.toHaveURL(/\/login$/)
  await other.goto('/atendimentos')
  await expect(other.getByText('Nenhum chamado encontrado.')).toBeVisible()

  await signIn(page, agent, userPassword)
  await openQueued(page, 'Paulo Cliente')
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  // Número desconhecido: o formulário pede o cadastro e não encerra com campos vazios.
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await expect(sheet).toContainText('Contato não cadastrado')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(sheet).toContainText('Informe o assunto.')
  await expect(sheet).toContainText('Informe a resolução.')
  await expect(sheet).toContainText('Selecione ao menos um módulo.')
  await expect(sheet).toContainText('Selecione o órgão do atendimento.')

  // Preenchido, mas com o contato ainda sem cadastro, o backend recusa.
  await sheet.getByLabel('Assunto').fill('Contracheque')
  await sheet.getByLabel('Resolução').fill('Enviada a segunda via.')
  await sheet.getByRole('checkbox', { name: 'Folha' }).click()
  await sheet.getByRole('checkbox', { name: 'Patrimônio' }).click()
  await sheet.getByLabel('Órgão').fill(organization)
  await page.getByRole('option', { name: organization }).click()
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  // O assunto não está na lista do setor: a janela pergunta antes de gravar.
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(sheet).toContainText('Cadastre o contato e vincule-o a um órgão antes de encerrar.')

  // Cadastra o contato pelo próprio formulário e encerra.
  await sheet.getByRole('button', { name: 'Cadastrar contato' }).click()
  const contactSheet = page.getByRole('dialog', { name: 'Editar contato' })
  await contactSheet.getByLabel('Órgão').fill(organization)
  await page.getByRole('option', { name: organization }).click()
  await contactSheet.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Contato salvo')).toBeVisible()
  await expect(sheet).not.toContainText('Contato não cadastrado')
  // O cadastro já dá ao chamado o órgão do contato.
  const ticketId = page.url().split('/').pop()
  const detail = await page.request.get(`/api/tickets/${ticketId}`)
  expect(((await detail.json()) as { organization: { name: string } }).organization.name).toBe(
    organization,
  )

  // O fim não pode ficar antes do início.
  await sheet.getByLabel('Fim').fill('2000-01-01T10:00')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(sheet).toContainText('O fim precisa ser depois do início.')
  // Corrige o início e o fim para horários passados.
  const local = (minutesAgo: number) =>
    format(new Date(Date.now() - minutesAgo * 60_000), "yyyy-MM-dd'T'HH:mm")
  await sheet.getByLabel('Início').fill(local(120))
  await sheet.getByLabel('Fim').fill(local(60))
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  // O assunto não está na lista do setor: a janela pergunta antes de gravar.
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()

  // Volta a Chamados sem chamado aberto; Atendimentos guarda o chamado encerrado.
  await expect(page).toHaveURL(/\/chamados$/)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toHaveCount(0)
  await page.goto('/atendimentos')
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  const doneRow = page.getByRole('row', { name: /Paulo Cliente/ })
  await expect(doneRow).toContainText(agentName)
  await expect(doneRow).toContainText('Encerrado')

  // Quem já estava na lista vê o atendimento sem recarregar, com o nome do atendente.
  const otherRow = other.getByRole('row', { name: /Paulo Cliente/ })
  await expect(otherRow).toContainText(agentName)
  await expect(otherRow).toContainText('Encerrado')
  await otherContext.close()

  // A linha reabre o chamado: o registro aparece nos detalhes e ninguém mais responde.
  await doneRow.getByRole('cell', { name: 'Encerrado' }).click({ force: true })
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(page.getByRole('status', { name: 'Só leitura' })).toContainText('Encerrado em')
  await expect(
    conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
      hasText: `${agentName} encerrou o chamado`,
    }),
  ).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Encerrar' })).toHaveCount(0)
  const details = page.getByRole('region', { name: 'Atendimento', exact: true })
  await expect(details).toContainText('Encerrado')
  await expect(details).toContainText('Contracheque')
  await expect(details).toContainText('Enviada a segunda via.')
  await expect(details).toContainText('Folha')
  await expect(details).toContainText('Patrimônio')
  await expect(details).toContainText(`${organization} — ${defaultMunicipality}`)

  // Nova mensagem do cliente abre outro chamado, na fila.
  expect((await receive('Agora é sobre férias')).ok()).toBeTruthy()
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  const queue = page.getByRole('region', { name: 'Fila e assuntos' })
  await expect(queue.getByRole('button', { name: 'Assumir chamado de Paulo Cliente' })).toHaveCount(
    1,
  )
  await expect(queue).toContainText('Agora é sobre férias')
})

test('cancelamento tem motivo opcional, dispensa o cadastro e fica identificado', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await prepare(baseURL!, sector.id)
  const { phone } = unique()
  const receive = (body: string) =>
    request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: 'Paula Golpe', body },
    })
  expect((await receive('Seu boleto venceu')).ok()).toBeTruthy()

  // Na fila, o atendente cancela sem assumir, sem cadastrar o contato e sem motivo (#395).
  await signIn(page, agent, userPassword)
  await openQueued(page, 'Paula Golpe')
  await chooseAction(page, 'Cancelar chamado')
  const sheet = page.getByRole('dialog', { name: 'Cancelar chamado' })
  await expect(sheet.getByLabel('Motivo (opcional)')).toHaveValue('')
  await expect(sheet).toContainText('Sem o motivo, a conversa mostra só quem cancelou e quando.')
  await sheet.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(page.getByText('Chamado cancelado', { exact: true })).toBeVisible()

  // Volta a Chamados sem chamado aberto; Atendimentos guarda o chamado cancelado.
  await expect(page).toHaveURL(/\/chamados$/)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toHaveCount(0)
  await page.goto('/atendimentos')
  const doneRow = page.getByRole('row', { name: /Paula Golpe/ })
  await expect(doneRow).toContainText(agent.replace(/^agent\.(\d+)@.*$/, 'agent $1'))
  await expect(doneRow).toContainText('Cancelado')

  // A conversa mostra quem cancelou e quando, sem a linha "Motivo:"; não há
  // correção nem nova ação.
  await doneRow.getByRole('cell', { name: 'Cancelado' }).click({ force: true })
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(page.getByRole('status', { name: 'Só leitura' })).toContainText('Cancelado em')
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  const entry = conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
    hasText: `${agentName} cancelou o chamado`,
  })
  await expect(entry).toBeVisible()
  await expect(entry).not.toContainText('Motivo:')
  const details = page.getByRole('region', { name: 'Atendimento', exact: true })
  await expect(details).toContainText('Cancelado')
  await expect(details).toContainText('Cancelado em')
  await expect(details).not.toContainText('Histórico de alterações')
  await expect(details).not.toContainText('Assunto')
  for (const name of ['Corrigir', 'Cancelar chamado', 'Assumir']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
  await details.getByRole('tab', { name: 'Histórico' }).click()
  await expect(details.getByRole('list', { name: 'Chamados do contato' })).toContainText(
    'Cancelado',
  )

  // Nova mensagem do mesmo número abre outro chamado, na fila.
  expect((await receive('Última chance')).ok()).toBeTruthy()
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  const queue = page.getByRole('region', { name: 'Fila e assuntos' })
  await expect(queue.getByRole('button', { name: 'Assumir chamado de Paula Golpe' })).toHaveCount(1)
  await expect(queue).toContainText('Última chance')

  // Em atendimento, outro atendente não vê a ação; o supervisor cancela.
  await openQueued(page, 'Paula Golpe')
  const url = page.url()
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  // No celular, as ações do responsável cabem na tela sem rolagem lateral.
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByRole('button', { name: 'Mais ações' })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeInViewport()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()

  const api = await apiRequest.newContext({ baseURL })
  await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
  const colleague = `colega.${unique().id}@e2e.test`
  expect(
    (
      await api.post('/api/users', {
        data: {
          name: 'Colega',
          email: colleague,
          role: 'agent',
          sectorId: sector.id,
          password: userPassword,
        },
      })
    ).ok(),
  ).toBeTruthy()
  await api.dispose()
  const colleagueContext = await browser.newContext()
  const colleaguePage = await colleagueContext.newPage()
  await signIn(colleaguePage, colleague, userPassword)
  await colleaguePage.goto(url)
  await expect(colleaguePage.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Peça a transferência',
  )
  await expect(colleaguePage.getByRole('button', { name: 'Mais ações' })).toHaveCount(0)
  await colleagueContext.close()

  const supervisorContext = await browser.newContext()
  const supervisorPage = await supervisorContext.newPage()
  await signIn(supervisorPage, supervisor, userPassword)
  await supervisorPage.goto(url)
  await chooseAction(supervisorPage, 'Cancelar chamado')
  const supervisorSheet = supervisorPage.getByRole('dialog', { name: 'Cancelar chamado' })
  await supervisorSheet.getByLabel('Motivo (opcional)').fill('Número bloqueado.')
  await supervisorSheet.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(supervisorPage.getByText('Chamado cancelado', { exact: true })).toBeVisible()
  // Com motivo, o registro continua mostrando a linha "Motivo:".
  await supervisorPage.goto(url.replace('/chamados/', '/atendimentos/'))
  await expect(supervisorPage.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Motivo: Número bloqueado.',
  )
  await supervisorContext.close()
})

test('os módulos do contato vêm marcados no encerramento e podem ser alterados', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const organization = `Prefeitura ${id}`
  const api = await apiRequest.newContext({ baseURL })
  await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
  await api.post(`/api/sectors/${sector.id}/connection`)
  await api.post(`/api/test/messaging/sectors/${sector.id}/pair`)
  const org = (await (
    await api.post('/api/organizations', {
      data: { name: organization, municipalityId: await municipalityId(api) },
    })
  ).json()) as { id: number }
  const moduleIds: number[] = []
  for (const name of ['Folha', 'Patrimônio']) {
    const created = await api.post(`/api/sectors/${sector.id}/modules`, { data: { name } })
    moduleIds.push(((await created.json()) as { id: number }).id)
  }
  const contact = await api.post('/api/contacts', {
    data: {
      name: `Vera ${id}`,
      phone,
      organizationId: org.id,
      sectorIds: [sector.id],
      moduleIds: [moduleIds[0]],
    },
  })
  expect(contact.ok()).toBeTruthy()
  await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
    data: { externalMessageId: `E2E-${id}`, phone, contactName: `Vera ${id}`, body: 'Bom dia' },
  })
  await api.dispose()

  await signIn(page, agent, userPassword)
  await openQueued(page, `Vera ${id}`)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await expect(sheet.getByRole('checkbox', { name: 'Folha' })).toBeChecked()
  await expect(sheet.getByRole('checkbox', { name: 'Patrimônio' })).not.toBeChecked()

  await sheet.getByRole('checkbox', { name: 'Folha' }).click()
  await sheet.getByRole('checkbox', { name: 'Patrimônio' }).click()
  await sheet.getByLabel('Assunto').fill('Consulta')
  await sheet.getByLabel('Resolução').fill('Respondida.')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  // O assunto não está na lista do setor: a janela pergunta antes de gravar.
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
})

test('cadastra o contato durante o atendimento, só com o nome ou por inteiro', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const { organization } = await prepare(baseURL!, sector.id)
  const { id, phone } = unique()
  const profile = `Perfil ${id}`
  const saved = `Roberta ${id}`
  const receive = (contactName: string, body: string) =>
    request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${unique().id}`, phone, contactName, body },
    })
  expect((await receive(profile, 'Bom dia')).ok()).toBeTruthy()

  // O supervisor acompanha o painel e a lista de contatos em outras janelas.
  const otherContext = await browser.newContext()
  const otherPanel = await otherContext.newPage()
  await signIn(otherPanel, supervisor, userPassword)
  const otherQueue = otherPanel.getByRole('region', { name: 'Fila e assuntos' })
  await expect(
    otherQueue.getByRole('button', { name: `Assumir chamado de ${profile}` }),
  ).toBeVisible()
  const otherContacts = await otherContext.newPage()
  await otherContacts.goto('/atendimentos')
  await otherContacts.getByRole('link', { name: 'Contatos' }).click()
  await expect(otherContacts.getByRole('row', { name: new RegExp(profile) })).toBeVisible()

  // Na fila, sem assumir, o atendente vê o aviso e o botão junto do contato.
  await signIn(page, agent, userPassword)
  await openQueued(page, profile)
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText('Contato não cadastrado')
  await conversation.getByRole('button', { name: 'Cadastrar contato' }).click()

  // Sem órgão, o formulário deixa claro que só o nome é salvo e dispensa os demais campos.
  const sheet = page.getByRole('dialog', { name: 'Cadastrar contato' })
  await expect(sheet).toContainText('somente o nome é salvo')
  await expect(sheet.getByLabel('Nome')).toHaveValue(profile)
  await sheet.getByLabel('Nome').fill(' ')
  await sheet.getByRole('button', { name: 'Salvar nome' }).click()
  await expect(sheet).toContainText('Informe o nome do contato.')
  await sheet.getByLabel('Nome').fill(saved)
  await sheet.getByLabel('Telefone').fill('')
  await sheet.getByRole('button', { name: 'Salvar nome' }).click()
  await expect(page.getByText('Nome salvo')).toBeVisible()
  await expect(sheet).toBeHidden()

  // O nome aparece na conversa e no painel lateral, e o aviso continua.
  await expect(page.getByRole('heading', { name: saved })).toBeVisible()
  await expect(conversation).toContainText('Contato não cadastrado')
  await expect(page.getByRole('button', { name: 'Assumir', exact: true })).toBeVisible()

  // Quem já estava nas outras telas vê o nome sem recarregar.
  await expect(
    otherQueue.getByRole('button', { name: `Assumir chamado de ${saved}` }),
  ).toBeVisible()
  await expect(otherContacts.getByRole('row', { name: new RegExp(saved) })).toBeVisible()
  await otherContext.close()

  // Nova mensagem recebida não troca o nome salvo.
  expect((await receive(profile, 'Alguém me atende?')).ok()).toBeTruthy()
  await expect(conversation).toContainText('Alguém me atende?')
  await expect(page.getByRole('heading', { name: saved })).toBeVisible()

  // Só com o nome, o encerramento ainda pede o órgão.
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const closing = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await expect(closing).toContainText('Contato não cadastrado')
  await expect(closing).toContainText(saved)
  await closing.getByRole('button', { name: 'Cancelar' }).click()
  await expect(closing).toBeHidden()

  // Com órgão, pelo aviso da conversa, vale o cadastro completo, com o telefone conferido.
  await conversation.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(sheet.getByLabel('Nome')).toHaveValue(saved)
  await expect(sheet.getByLabel('Telefone')).toHaveValue(phone)
  await sheet.getByLabel('Órgão').fill(organization)
  await page.getByRole('option', { name: organization }).click()
  await sheet.getByLabel('Telefone').fill('')
  await sheet.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(sheet).toContainText('Informe o telefone com DDI e DDD.')
  await sheet.getByLabel('Telefone').fill(phone)
  await sheet.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(page.getByText('Contato salvo')).toBeVisible()

  // O aviso e o botão somem, e o chamado aberto recebe o órgão.
  await expect(conversation).not.toContainText('Contato não cadastrado')
  await expect(page.getByRole('button', { name: 'Cadastrar contato' })).toHaveCount(0)
  const ticket = await page.request.get(`/api/tickets/${page.url().split('/').pop()}`)
  expect(((await ticket.json()) as { organization: { name: string } }).organization.name).toBe(
    organization,
  )
})

test('o aviso sobre o botão não bloqueia o clique nem espera o cursor sair', async ({
  page,
  request,
  baseURL,
}) => {
  // Tela baixa: a janela ocupa toda a altura e o rodapé fica no mesmo lugar do aviso.
  await page.setViewportSize({ width: 1280, height: 560 })
  const { sector, agent } = await seedSector(baseURL!)
  const { organization } = await prepare(baseURL!, sector.id)
  const { id, phone } = unique()
  const name = `Aviso ${id}`
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: { externalMessageId: `E2E-${id}`, phone, contactName: name, body: 'Bom dia' },
      })
    ).ok(),
  ).toBeTruthy()

  await signIn(page, agent, userPassword)
  await openQueued(page, name)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await sheet.getByLabel('Assunto').fill('Contracheque')
  await sheet.getByLabel('Resolução').fill('Enviada a segunda via.')
  await sheet.getByRole('checkbox', { name: 'Folha' }).click()
  await sheet.getByLabel('Órgão').fill(organization)
  await page.getByRole('option', { name: organization }).click()

  await sheet.getByRole('button', { name: 'Cadastrar contato' }).click()
  const contactSheet = page.getByRole('dialog', { name: 'Editar contato' })
  await contactSheet.getByLabel('Órgão').fill(organization)
  await page.getByRole('option', { name: organization }).click()
  await contactSheet.getByRole('button', { name: 'Salvar' }).click()
  const notice = page.locator('[data-sonner-toast]', { hasText: 'Contato salvo' })
  await expect(notice).toBeVisible()
  await expect(contactSheet).toBeHidden()
  await expect(sheet).not.toContainText('Contato não cadastrado')

  // Ponto em que o aviso cobre o botão: é ali que a pessoa tenta clicar.
  const close = sheet.getByRole('button', { name: 'Encerrar' })
  const overlap = async () => {
    const [a, b] = [await close.boundingBox(), await notice.boundingBox()]
    if (!a || !b) return null
    const [left, right] = [Math.max(a.x, b.x), Math.min(a.x + a.width, b.x + b.width)]
    const [top, bottom] = [Math.max(a.y, b.y), Math.min(a.y + a.height, b.y + b.height)]
    return right > left && bottom > top ? { x: (left + right) / 2, y: (top + bottom) / 2 } : null
  }
  await expect
    .poll(overlap, { message: 'o aviso precisa estar sobre o botão para o teste valer' })
    .not.toBeNull()
  const point = await overlap()
  expect(point).not.toBeNull()

  await page.mouse.move(point!.x, point!.y)
  await page.mouse.click(point!.x, point!.y)
  // O assunto não está na lista do setor: a janela pergunta antes de gravar.
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()

  // Com o cursor parado no mesmo lugar, o aviso some no tempo normal.
  await expect(notice).toBeHidden()
})

test('o link do aviso não troca de chamado com a janela aberta', async ({
  page,
  request,
  baseURL,
}) => {
  // Tela baixa: a janela ocupa toda a altura e o rodapé fica no mesmo lugar do aviso.
  await page.setViewportSize({ width: 1280, height: 560 })
  // O registro dos avisos diz que um aviso chegou a aparecer, mesmo que ele suma antes da conferência
  // (os avisos duram 2,5 s e a máquina pode parar por mais que isso).
  const toasts = await recordToasts(page)
  const { sector, agent } = await seedSector(baseURL!)
  await prepare(baseURL!, sector.id)
  const receive = async (name: string) => {
    const { id, phone } = unique()
    expect(
      (
        await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
          data: { externalMessageId: `E2E-${id}`, phone, contactName: name, body: 'Bom dia' },
        })
      ).ok(),
    ).toBeTruthy()
  }
  const first = `Primeiro ${unique().id}`
  const second = `Segundo ${unique().id}`
  await receive(first)
  await signIn(page, agent, userPassword)
  await openQueued(page, first)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeVisible()
  const firstUrl = page.url()
  // O aviso de assumir o primeiro sai antes: o segundo fica sozinho, no lugar de sempre. Primeiro
  // confirma que ele apareceu: esperar zero avisos logo depois do clique pode passar antes de o
  // primeiro ser desenhado (a tela mostra Encerrar antes de o aviso entrar no DOM), e aí os dois
  // avisos de "Chamado assumido" se sobrepõem e o localizador do aviso do sino fica ambíguo.
  await expect
    .poll(async () => (await toasts()).some((text) => text.includes('Chamado assumido')), {
      message: 'o aviso de assumir o primeiro precisa ter aparecido',
      timeout: 15_000,
    })
    .toBe(true)
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0)
  await receive(second)

  const bell = page.getByRole('banner').getByRole('button', { name: /^Notificações/ })
  await expect(bell).toHaveAccessibleName('Notificações, 1 pendente')
  await bell.click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: `Assumir chamado de ${second}` })
    .click()
  // O aviso do sino é o único de "Chamado assumido" com o link "Abrir chamado": o localizador aponta
  // para ele mesmo que outro aviso igual ainda esteja na tela.
  const notice = page.locator('[data-sonner-toast]', {
    hasText: 'Chamado assumido',
    has: page.locator('a', { hasText: 'Abrir chamado' }),
  })
  const link = notice.getByRole('link', { name: 'Abrir chamado', exact: true })
  // Sem janela aberta, o link do aviso continua disponível.
  await expect(link).toBeVisible()
  await bell.click()

  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await sheet.getByLabel('Assunto').fill('Contracheque')

  // Ponto em que o link fica sobre o botão: é ali que a pessoa tenta clicar.
  const close = sheet.getByRole('button', { name: 'Encerrar' })
  // Busca pelo elemento, não pelo papel: o link oculto segue no lugar, mas sai da árvore de acessibilidade.
  const linkElement = notice.locator('a', { hasText: 'Abrir chamado' })
  const overlap = async () => {
    const [a, b] = [await close.boundingBox(), await linkElement.boundingBox()]
    if (!a || !b) return null
    const [left, right] = [Math.max(a.x, b.x), Math.min(a.x + a.width, b.x + b.width)]
    const [top, bottom] = [Math.max(a.y, b.y), Math.min(a.y + a.height, b.y + b.height)]
    return right > left && bottom > top ? { x: (left + right) / 2, y: (top + bottom) / 2 } : null
  }
  await expect
    .poll(overlap, { message: 'o link precisa estar sobre o botão para o teste valer' })
    .not.toBeNull()
  const point = (await overlap())!

  await page.mouse.move(point.x, point.y)
  await expect(notice).toBeVisible()
  await page.mouse.click(point.x, point.y)

  // O clique chegou ao Encerrar, que recusou o formulário incompleto; nada mudou de chamado.
  await expect(sheet).toContainText('Informe a resolução.')
  expect(page.url()).toBe(firstUrl)
  await expect(sheet).toContainText(first)
  await expect(sheet.getByLabel('Assunto')).toHaveValue('Contracheque')

  // Com o cursor parado no mesmo lugar, o aviso some no tempo normal.
  await expect(notice).toBeHidden()
})

test('chamado encerrado não mostra o aviso de cadastro', async ({ page, request, baseURL }) => {
  const { sector, agent } = await seedSector(baseURL!)
  await prepare(baseURL!, sector.id)
  const { id, phone } = unique()
  const name = `Sem cadastro ${id}`
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: { externalMessageId: `E2E-${id}`, phone, contactName: name, body: 'Bom dia' },
      })
    ).ok(),
  ).toBeTruthy()

  // O cancelamento dispensa o cadastro: o contato continua sem cadastro, e o chamado sem aviso.
  await signIn(page, agent, userPassword)
  await openQueued(page, name)
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText('Contato não cadastrado')
  await chooseAction(page, 'Cancelar chamado')
  const sheet = page.getByRole('dialog', { name: 'Cancelar chamado' })
  await sheet.getByLabel('Motivo').fill('Engano.')
  await sheet.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(page.getByText('Chamado cancelado', { exact: true })).toBeVisible()

  await expect(page).toHaveURL(/\/chamados$/)
  await page.goto('/atendimentos')
  const row = page.getByRole('row', { name })
  await row.getByRole('cell', { name: 'Cancelado' }).click({ force: true })
  await expect(page.getByRole('status', { name: 'Só leitura' })).toContainText('Cancelado em')
  await expect(conversation).not.toContainText('Contato não cadastrado')
  await expect(page.getByRole('button', { name: 'Cadastrar contato' })).toHaveCount(0)
})

test('a janela de cancelamento mostra o erro do servidor quando o chamado já foi cancelado', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await prepare(baseURL!, sector.id)
  const { phone } = unique()
  const name = `Golpe Tardio ${unique().id}`
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${unique().id}`,
          phone,
          contactName: name,
          body: 'Pague agora',
        },
      })
    ).ok(),
  ).toBeTruthy()

  // O atendente abre a janela do cancelamento.
  await signIn(page, agent, userPassword)
  await openQueued(page, name)
  await chooseAction(page, 'Cancelar chamado')
  const sheet = page.getByRole('dialog', { name: 'Cancelar chamado' })
  const url = page.url()

  // Antes de confirmar, a supervisão cancela o mesmo chamado.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await openQueued(other, name)
  await chooseAction(other, 'Cancelar chamado')
  await other
    .getByRole('dialog', { name: 'Cancelar chamado' })
    .getByRole('button', { name: 'Cancelar chamado' })
    .click()
  await expect(other.getByText('Chamado cancelado', { exact: true })).toBeVisible()
  await otherContext.close()

  // A janela continua aberta e mostra o erro do servidor, sem cancelar de novo.
  await sheet.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(sheet).toContainText('Este chamado já foi encerrado.')
  await expect(page).toHaveURL(url)
  await sheet.getByRole('button', { name: 'Voltar' }).click()
})
