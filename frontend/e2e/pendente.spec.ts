import { expect, request as apiRequest, test, type Page } from '@playwright/test'
import {
  admin,
  chooseAction,
  openQueued,
  queuedTicketId,
  recordToasts,
  seedClosedTicket,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

// Setor conectado ao adaptador falso, para as mensagens do cliente abrirem chamados.
async function connectedSector(baseURL: string) {
  const seed = await seedSector(baseURL)
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${seed.sector.id}/connection`)).ok()).toBeTruthy()
  expect((await api.post(`/api/test/messaging/sectors/${seed.sector.id}/pair`)).ok()).toBeTruthy()
  await api.dispose()
  return seed
}

// Mensagem do cliente: com um telefone já usado no setor, é o mesmo contato (e o chamado novo do
// pendente); sem telefone, um contato novo.
async function receive(
  baseURL: string,
  sectorId: number,
  contact: string,
  body = 'Preciso de ajuda com o alvará',
  phone = unique().phone,
) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
        data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: contact, body },
      })
    ).ok(),
  ).toBeTruthy()
  await api.dispose()
  return phone
}

// Segundo atendente do setor, para abrir o pendente e retomá-lo.
async function addAgent(baseURL: string, sectorId: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  const { id } = unique()
  const email = `agent2.${id}@e2e.test`
  expect(
    (
      await api.post('/api/users', {
        data: {
          name: `agent2 ${id}`,
          email,
          role: 'agent',
          sectorId,
          password: userPassword,
        },
      })
    ).ok(),
  ).toBeTruthy()
  await api.dispose()
  return email
}

// Nome de exibição criado por seedSector/addAgent: agent.<id>@e2e.test → "agent <id>".
const agentNameOf = (email: string) => {
  const match = /^(agent2?)\.(\d+)@/.exec(email)
  return match ? `${match[1]} ${match[2]}` : email
}

const pendingTab = (page: Page) => page.getByRole('region', { name: 'Fila, assuntos e pendentes' })

const pendingRow = (page: Page, contact: string) =>
  pendingTab(page).getByRole('listitem').filter({ hasText: contact })

// Abre o chamado da fila, assume e o coloca como pendente pela janela do menu ⋯.
async function markPending(page: Page, contact: string, reason: string) {
  await openQueued(page, contact)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeVisible()
  await chooseAction(page, 'Colocar como pendente')
  const dialog = page.getByRole('dialog', { name: 'Colocar como pendente' })
  await dialog.getByLabel('Motivo').fill(reason)
  await dialog.getByRole('button', { name: 'Colocar como pendente' }).click()
  await expect(page.getByText('Chamado marcado como pendente')).toBeVisible()
  await expect(page).toHaveURL(/\/chamados$/)
}

async function protocolOf(page: Page, ticketId: number) {
  const ticket = (await (await page.request.get(`/api/tickets/${ticketId}`)).json()) as {
    protocol: string
  }
  return ticket.protocol
}

test('o responsável marca como pendente e o chamado sai de Meus chamados para a aba Pendentes', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!)
  const contact = `Maria ${unique().id}`
  await receive(baseURL!, sector.id, contact)
  const agentName = agentNameOf(agent)

  await signIn(page, agent, userPassword)
  const ticketId = await queuedTicketId(page, contact)
  const protocol = await protocolOf(page, ticketId)
  const reason = 'Aguardando retorno do desenvolvimento sobre o erro no anexo'

  // Na fila, a ação não aparece; assumido, aparece no menu junto de Devolver à fila.
  await markPending(page, contact, reason)

  // Volta a Chamados sem chamado selecionado, e o chamado não está mais em Meus chamados.
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Meus chamados' })).toHaveCount(0)

  // A aba Pendentes traz contato, órgão, protocolo, motivo, quem marcou e há quanto tempo.
  await pendingTab(page)
    .getByRole('tab', { name: /^Pendentes/ })
    .click()
  const row = pendingRow(page, contact)
  await expect(row).toBeVisible()
  await expect(row).toContainText('Não cadastrado')
  await expect(row).toContainText(protocol)
  await expect(row).toContainText(reason)
  await expect(row).toContainText(`por ${agentName}`)
  // Marcado agora, a linha mostra "agora"; o formato do protótipo é "há 9 h", "há 12 min".
  await expect(row).toContainText('agora')
  await expect(row.getByRole('button', { name: `Retomar chamado de ${contact}` })).toBeVisible()
})

test('sem motivo a janela avisa; cancelar não muda nada, e quem não é o responsável não vê a ação', async ({
  page,
  browser,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!)
  const colleague = await addAgent(baseURL!, sector.id)
  const contact = `Bruno ${unique().id}`
  await receive(baseURL!, sector.id, contact)

  await signIn(page, agent, userPassword)
  await openQueued(page, contact)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeVisible()
  const url = page.url()

  // Motivo vazio é avisado no próprio campo, e a janela continua aberta.
  await chooseAction(page, 'Colocar como pendente')
  const dialog = page.getByRole('dialog', { name: 'Colocar como pendente' })
  await dialog.getByRole('button', { name: 'Colocar como pendente' }).click()
  await expect(dialog.getByText('Informe o motivo do pendente.')).toBeVisible()
  await expect(dialog.getByLabel('Motivo')).toHaveAttribute('aria-invalid', 'true')

  // Cancelar não muda nada: o chamado continua em atendimento com o responsável.
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeVisible()

  // O colega do setor abre o chamado em atendimento e não vê a ação, nem as do chamado.
  const context = await browser.newContext()
  const other = await context.newPage()
  await signIn(other, colleague, userPassword)
  await other.goto(url)
  await expect(other.getByRole('heading', { name: contact })).toBeVisible()
  await expect(other.getByRole('button', { name: 'Mais ações' })).toHaveCount(0)
  await expect(other.getByRole('button', { name: 'Encerrar' })).toHaveCount(0)
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await context.close()
})

test('outro atendente abre o pendente só leitura e o retoma, e o chamado abre em Meus chamados dele', async ({
  page,
  browser,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!)
  const colleague = await addAgent(baseURL!, sector.id)
  const contact = `Carla ${unique().id}`
  await receive(baseURL!, sector.id, contact)
  const reason = 'Depende da liberação de acesso ao sistema pelo órgão'

  await signIn(page, agent, userPassword)
  const ticketId = await queuedTicketId(page, contact)
  await markPending(page, contact, reason)

  const context = await browser.newContext()
  const other = await context.newPage()
  await signIn(other, colleague, userPassword)
  await other.goto(`/chamados/${ticketId}`)
  await expect(other.getByRole('heading', { name: contact })).toBeVisible()

  // Faixa do pendente e conversa só leitura: sem campo de mensagem nem ações.
  await expect(other.getByText(`Pendente: ${reason}`)).toBeVisible()
  await expect(
    other.getByText('Somente leitura. Retome o chamado para responder ao contato.'),
  ).toBeVisible()
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await expect(other.getByRole('button', { name: 'Mais ações' })).toHaveCount(0)
  for (const action of ['Encerrar', 'Devolver à fila', 'Transferir', 'Outro setor']) {
    await expect(other.getByRole('button', { name: action, exact: true })).toHaveCount(0)
  }

  // Retomar no topo devolve o atendimento ao colega, que passa a responder.
  await other.getByRole('button', { name: 'Retomar', exact: true }).click()
  await expect(other.getByText('Chamado retomado')).toBeVisible()
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  await expect(
    other.getByRole('navigation', { name: 'Meus chamados' }).getByRole('link', {
      name: new RegExp(contact),
    }),
  ).toBeVisible()
  await expect(other.getByText('Pendente:')).toHaveCount(0)
  await context.close()
})

test('quem não é do setor do pendente não vê o Retomar, mesmo conseguindo abrir o chamado', async ({
  page,
  baseURL,
}) => {
  // O servidor recusa o pendente de outro setor; a resposta fabricada prova a proteção da tela, que
  // não pode oferecer o Retomar a quem o backend recusaria (spec #332). Sem ela, só quem é do setor
  // (ou o administrador) abre um pendente.
  const pendingSector = await seedSector(baseURL!)
  const outsider = await seedSector(baseURL!)
  const contact = `Helena ${unique().id}`
  const ticketId = 990001
  const now = new Date().toISOString()
  await page.route(`**/api/tickets/${ticketId}`, (route) =>
    route.fulfill({
      json: {
        id: ticketId,
        protocol: '2026-099999',
        status: 'pending',
        channel: 'whatsapp',
        sector: { id: pendingSector.sector.id, name: pendingSector.sector.name },
        arrivedAt: now,
        assignedAt: now,
        startedAt: now,
        endedAt: null,
        closedAt: null,
        subject: null,
        resolution: null,
        contact: { id: 1, name: contact, phone: '5511999999999', registered: true },
        organization: null,
        assignee: { id: 1, name: 'Outro atendente' },
        closedBy: null,
        closureType: null,
        pending: {
          reason: 'Aguardando retorno do órgão',
          by: { id: 1, name: 'Outro atendente' },
          at: now,
        },
        previous: null,
        next: null,
      },
    }),
  )

  await signIn(page, outsider.agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(page.getByRole('heading', { name: contact })).toBeVisible()
  await expect(
    page.getByText('Somente leitura. Retome o chamado para responder ao contato.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retomar', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mais ações' })).toHaveCount(0)
})

test('retomar com outro chamado do contato aberto mostra o aviso e nada muda', async ({
  page,
  browser,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!)
  const colleague = await addAgent(baseURL!, sector.id)
  const contact = `Diego ${unique().id}`
  const phone = await receive(baseURL!, sector.id, contact)

  await signIn(page, agent, userPassword)
  await markPending(page, contact, 'Cliente vai confirmar o número do protocolo antigo')

  // O cliente volta a escrever: a mensagem abre um chamado novo na fila.
  await receive(baseURL!, sector.id, contact, 'Voltei, consegue ver agora?', phone)

  const context = await browser.newContext()
  const other = await context.newPage()
  await signIn(other, colleague, userPassword)
  const secondId = await queuedTicketId(other, contact)
  await openQueued(other, contact)
  await other.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(other.getByRole('button', { name: 'Encerrar' })).toBeVisible()
  const secondProtocol = await protocolOf(other, secondId)
  const colleagueName = agentNameOf(colleague)

  // O pendente do mesmo contato não pode voltar enquanto o chamado novo está aberto.
  await other.goto('/chamados')
  await pendingTab(other)
    .getByRole('tab', { name: /^Pendentes/ })
    .click()
  const row = pendingRow(other, contact)
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: `Retomar chamado de ${contact}` }).click()
  const notice = other.locator('[data-sonner-toast]', { hasText: 'Este contato tem o chamado' })
  await expect(notice).toContainText(
    `Este contato tem o chamado ${secondProtocol} aberto com ${colleagueName}`,
  )
  await expect(notice).toContainText('Encerre esse chamado ou use Retomar chamado a partir dele.')
  // O erro aparece uma vez só: a aba Pendentes não repete o aviso num alerta.
  await expect(pendingTab(other).getByRole('alert')).toHaveCount(0)
  // Nada mudou: o pendente continua na lista.
  await expect(row).toBeVisible()
  await expect(other).toHaveURL(/\/chamados$/)
  await context.close()
})

test('o erro ao retomar o pendente aberto aparece uma vez só', async ({
  page,
  browser,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!)
  const colleague = await addAgent(baseURL!, sector.id)
  const contact = `Gabi ${unique().id}`
  const phone = await receive(baseURL!, sector.id, contact)

  await signIn(page, agent, userPassword)
  const pendingId = await queuedTicketId(page, contact)
  await markPending(page, contact, 'Aguardando o número do protocolo antigo')

  // O cliente volta a escrever: chamado novo, que o colega assume e deixa aberto.
  await receive(baseURL!, sector.id, contact, 'Voltei, consegue ver agora?', phone)
  const context = await browser.newContext()
  const other = await context.newPage()
  const toasts = await recordToasts(other)
  await signIn(other, colleague, userPassword)
  const secondId = await queuedTicketId(other, contact)
  const secondProtocol = await protocolOf(other, secondId)
  await openQueued(other, contact)
  await other.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(other.getByRole('button', { name: 'Encerrar' })).toBeVisible()

  // Abre o pendente pela aba Pendentes (que fica aberta na coluna da direita) e tenta retomar.
  await other.goto('/chamados')
  await pendingTab(other)
    .getByRole('tab', { name: /^Pendentes/ })
    .click()
  await pendingRow(other, contact).getByRole('button', { name: contact, exact: true }).click()
  await expect(other).toHaveURL(new RegExp(`/chamados/${pendingId}$`))
  await other.getByRole('button', { name: 'Retomar', exact: true }).click()

  // Um aviso só: nem o toast se repete no alerta da aba Pendentes, nem um segundo toast.
  await expect(other.getByText(/Este contato tem o chamado/)).toHaveCount(1)
  await expect(
    other.locator('[data-sonner-toast]', {
      hasText: `Este contato tem o chamado ${secondProtocol} aberto`,
    }),
  ).toBeVisible()
  await expect(other.getByRole('alert')).toHaveCount(0)
  await expect
    .poll(
      async () =>
        (await toasts()).filter((text) => text.includes('Este contato tem o chamado')).length,
    )
    .toBe(1)
  // Nada mudou: o chamado continua pendente e só leitura.
  await expect(other.getByText('Somente leitura. Retome o chamado')).toBeVisible()
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await context.close()
})

test('a aba Pendentes se atualiza sozinha para o setor, e o administrador vê o setor na linha', async ({
  page,
  browser,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!)
  const colleague = await addAgent(baseURL!, sector.id)
  const contact = `Elisa ${unique().id}`
  await receive(baseURL!, sector.id, contact)
  const reason = 'Aguardando a nota fiscal do serviço para responder'

  await signIn(page, agent, userPassword)
  // O responsável abre o chamado e assume, sem marcar ainda.
  await openQueued(page, contact)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeVisible()

  // O colega assiste à aba Pendentes vazia.
  const colleagueContext = await browser.newContext()
  const other = await colleagueContext.newPage()
  await signIn(other, colleague, userPassword)
  await pendingTab(other)
    .getByRole('tab', { name: /^Pendentes/ })
    .click()
  await expect(pendingRow(other, contact)).toHaveCount(0)

  // O administrador também, com a lista de todos os setores.
  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await signIn(adminPage, admin.email, admin.password)
  await pendingTab(adminPage)
    .getByRole('tab', { name: /^Pendentes/ })
    .click()
  await expect(pendingRow(adminPage, contact)).toHaveCount(0)

  // A pessoa marca como pendente e volta para Chamados, com a aba aberta.
  await chooseAction(page, 'Colocar como pendente')
  const dialog = page.getByRole('dialog', { name: 'Colocar como pendente' })
  await dialog.getByLabel('Motivo').fill(reason)
  await dialog.getByRole('button', { name: 'Colocar como pendente' }).click()
  await expect(page).toHaveURL(/\/chamados$/)
  await pendingTab(page)
    .getByRole('tab', { name: /^Pendentes/ })
    .click()

  // Sem recarregar, o colega e o administrador veem o pendente; o administrador, com o setor.
  await expect(pendingRow(other, contact)).toBeVisible()
  const adminRow = pendingRow(adminPage, contact)
  await expect(adminRow).toBeVisible()
  await expect(adminRow).toContainText(sector.name)

  // O colega retoma; sem recarregar, o pendente some da lista de quem marcou.
  await pendingRow(other, contact)
    .getByRole('button', { name: `Retomar chamado de ${contact}` })
    .click()
  await expect(other.getByText('Chamado retomado')).toBeVisible()
  await expect(pendingRow(page, contact)).toHaveCount(0)
  await expect(pendingRow(adminPage, contact)).toHaveCount(0)
  await colleagueContext.close()
  await adminContext.close()
})

test('a conversa mostra os avisos de pendente com o motivo e de retomada, na ordem do tempo', async ({
  page,
  browser,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!)
  const colleague = await addAgent(baseURL!, sector.id)
  const contact = `Fábio ${unique().id}`
  await receive(baseURL!, sector.id, contact)
  const reason = 'Aguardando laudo do setor de Infraestrutura'

  await signIn(page, agent, userPassword)
  const ticketId = await queuedTicketId(page, contact)
  await markPending(page, contact, reason)

  const context = await browser.newContext()
  const other = await context.newPage()
  await signIn(other, colleague, userPassword)
  await other.goto(`/chamados/${ticketId}`)
  await other.getByRole('button', { name: 'Retomar', exact: true }).click()
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  await context.close()

  // Quem marcou abre o chamado retomado e vê os dois avisos, na ordem do tempo.
  await page.goto(`/chamados/${ticketId}`)
  const entries = page
    .getByRole('region', { name: 'Conversa', exact: true })
    .getByRole('listitem', { name: 'Registro do chamado' })
  await expect(entries.filter({ hasText: 'colocou o chamado como pendente' })).toBeVisible()
  await expect(entries.filter({ hasText: 'retomou o chamado' })).toBeVisible()
  const texts = await entries.allTextContents()
  const pendingAt = texts.findIndex((text) => text.includes('colocou o chamado como pendente'))
  const resumedAt = texts.findIndex((text) => text.includes('retomou o chamado'))
  expect(pendingAt).toBeGreaterThanOrEqual(0)
  expect(resumedAt).toBeGreaterThan(pendingAt)
  expect(texts[pendingAt]).toContain(`Motivo: ${reason}`)
  expect(texts[pendingAt]).toContain(agentNameOf(agent))
  expect(texts[resumedAt]).toContain(agentNameOf(colleague))
})

test('o link do histórico para um pendente abre o chamado em Chamados', async ({
  page,
  baseURL,
}) => {
  const seed = await seedClosedTicket(baseURL!)
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  const closed = (await (await api.get(`/api/tickets/${seed.ticketId}`)).json()) as {
    contact: { name: string; phone: string }
  }
  await api.dispose()

  // O mesmo contato volta a escrever: chamado novo, que fica pendente.
  await receive(
    baseURL!,
    seed.sector.id,
    closed.contact.name,
    'Continuação do contracheque',
    closed.contact.phone,
  )

  await signIn(page, seed.agent, userPassword)
  await markPending(page, closed.contact.name, 'Aguardando a correção do contracheque')
  const pendings = (await (
    await page.request.get(`/api/sectors/${seed.sector.id}/pending-tickets`)
  ).json()) as { id: number; protocol: string; pendingAt: string }[]
  const pending = pendings.sort((a, b) => Date.parse(a.pendingAt) - Date.parse(b.pendingAt))[0]
  const protocol = pending.protocol

  // Na ficha do atendimento encerrado, o histórico do contato liga o pendente a /chamados/:id.
  await page.goto(`/atendimentos/${seed.ticketId}`)
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await page
    .getByRole('list', { name: 'Chamados do contato' })
    .getByRole('link', { name: protocol, exact: true })
    .click()
  await expect(page).toHaveURL(new RegExp(`/chamados/${pending.id}$`))
  await expect(page.getByRole('heading', { name: closed.contact.name })).toBeVisible()
})
