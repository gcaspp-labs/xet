import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import {
  adminApi,
  json,
  ok,
  openQueued,
  seedContact,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

// Liga o número do setor pelo adaptador falso.
async function connectSector(baseURL: string, sectorId: number) {
  const api = await adminApi(baseURL)
  ok(await api.post(`/api/sectors/${sectorId}/connection`))
  await api.dispose()
}

// Contexto de requisição autenticado como o atendente, que o chamador encerra com `dispose()`.
async function agentApi(baseURL: string, agent: string) {
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  return api
}

async function phone(request: APIRequestContext, sectorId: number, action: string, data?: object) {
  ok(
    await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, {
      data,
    }),
  )
}

// Chamado assumido pelo atendente a partir de uma mensagem recebida do contato.
async function assignTicket(baseURL: string, sectorId: number, agent: string, contact: string) {
  const api = await agentApi(baseURL, agent)
  const tickets = await json<{ id: number; contact: { name: string } }[]>(
    await api.get(`/api/sectors/${sectorId}/tickets`),
  )
  const ticket = tickets.find((item) => item.contact.name === contact)!
  ok(await api.post(`/api/tickets/${ticket.id}/assign`))
  await api.dispose()
  return ticket.id
}

// Envia um cartão do cadastro pela API, como a janela "Enviar contato" da fatia seguinte faz.
async function sendCard(
  baseURL: string,
  agent: string,
  ticketId: number,
  contactId: number,
  requestId = crypto.randomUUID(),
) {
  const api = await agentApi(baseURL, agent)
  const response = await api.post(`/api/tickets/${ticketId}/messages/contact`, {
    data: { contactId, clientRequestId: requestId },
  })
  if (!response.ok()) {
    throw new Error(`envio do cartão: ${response.status()} ${await response.text()}`)
  }
  const message = (await response.json()) as { id: number; status: string }
  await api.dispose()
  return message
}

const conversation = (page: Page) => page.getByRole('region', { name: 'Conversa', exact: true })

type CardPhone = { phone: string; whatsAppId: string | null }
type ContactCard = { name: string; organization: string | null; phones: CardPhone[] }

// O cartão de João Silva dos cenários de recebimento; o cenário de cópia acrescenta um fixo.
const joaoCard = (overrides: Partial<ContactCard> = {}): ContactCard => ({
  name: 'João Silva',
  organization: 'Prefeitura de Itu',
  phones: [{ phone: '5511988881234', whatsAppId: '5511988881234' }],
  ...overrides,
})

// O balão que tem um cartão de contato.
const cardBubble = (page: Page, direction: 'Mensagem recebida' | 'Mensagem enviada') =>
  conversation(page)
    .getByRole('listitem', { name: direction })
    .filter({ has: page.getByRole('group', { name: /^Contato:/ }) })

const card = (page: Page, name: string) =>
  page.getByRole('group', { name: new RegExp(`^Contato: ${name},`) })

test('contato recebido aparece como cartão, com vários no mesmo balão e a prévia "👤 Nome"', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { id, phone: sender } = unique()
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${id}-texto`,
    phone: sender,
    contactName: 'Clara Cliente',
    body: 'Segue o contato do setor.',
  })
  // O cliente manda três contatos de uma vez: cada um no seu cartão, no mesmo balão.
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${id}-cartoes`,
    phone: sender,
    contactName: 'Clara Cliente',
    type: 'contact',
    contactCards: [
      {
        name: 'Ana Beatriz Nunes',
        organization: 'Departamento de Compras — Campinas',
        phones: [
          { phone: '5519997774321', whatsAppId: '5519997774321' },
          { phone: '551933334444', whatsAppId: null },
        ],
      },
      {
        name: 'Carlos Eduardo Lima',
        organization: 'Secretaria de Administração — Hortolândia',
        phones: [{ phone: '5519996662211', whatsAppId: '5519996662211' }],
      },
      {
        name: 'Fernanda Souza',
        organization: null,
        phones: [{ phone: '5519985553344', whatsAppId: null }],
      },
    ],
  })

  await signIn(page, agent, userPassword)

  // A Fila mostra a prévia com o nome do primeiro cartão.
  const queue = page.getByRole('region', { name: 'Fila e assuntos' })
  await expect(queue).toContainText('👤 Ana Beatriz Nunes')

  await openQueued(page, 'Clara Cliente')
  const received = cardBubble(page, 'Mensagem recebida')
  await expect(received).toHaveCount(1)
  await expect(received).not.toContainText('Tipo de mensagem não suportado')
  await expect(received.getByRole('group', { name: /^Contato:/ })).toHaveCount(3)
  await expect(card(page, 'Ana Beatriz Nunes')).toContainText('Departamento de Compras — Campinas')
  await expect(card(page, 'Ana Beatriz Nunes')).toContainText('+55 (19) 99777-4321')
  await expect(card(page, 'Ana Beatriz Nunes')).toContainText('+55 (19) 3333-4444')
  await expect(card(page, 'Carlos Eduardo Lima')).toContainText(
    'Secretaria de Administração — Hortolândia',
  )
  await expect(card(page, 'Fernanda Souza')).toContainText('+55 (19) 98555-3344')
  await expect(card(page, 'Fernanda Souza')).not.toContainText('—')

  // Assumido, o chamado vai para "Meus chamados", com a mesma prévia.
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  const mine = page
    .getByRole('navigation', { name: 'Meus chamados' })
    .getByRole('link', { name: /Clara Cliente/ })
  await expect(mine).toContainText('👤 Ana Beatriz Nunes')
})

test('cartão recebido copia o telefone pelo teclado e tem nome acessível', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { id, phone: sender } = unique()
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${id}`,
    phone: sender,
    contactName: 'Clara Cliente',
    type: 'contact',
    contactCards: [
      // Este cenário acrescenta o telefone fixo, sem WhatsApp, para conferir os dois botões de copiar.
      joaoCard({
        phones: [
          { phone: '5511988881234', whatsAppId: '5511988881234' },
          { phone: '551133334444', whatsAppId: null },
        ],
      }),
    ],
  })

  await signIn(page, agent, userPassword)
  await openQueued(page, 'Clara Cliente')

  const joao = page.getByRole('group', {
    name: 'Contato: João Silva, +55 (11) 98888-1234, +55 (11) 3333-4444',
  })
  await expect(joao).toContainText('Prefeitura de Itu')

  // O botão de cada telefone tem o número no nome acessível e funciona só pelo teclado.
  const copy = joao.getByRole('button', { name: 'Copiar telefone +55 (11) 98888-1234' })
  await copy.focus()
  await expect(copy).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Telefone copiado')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('011988881234')
})

test('cartão enviado mostra a situação de entrega, falha com o número desconectado e reenvia sem duplicar', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id, phone: sender } = unique()
  const contactName = `Rita ${id}`
  await seedContact(baseURL!, sector.id, contactName, sender)
  const aline = await seedContact(baseURL!, sector.id, `Aline ${id}`, `551199${id.slice(-6)}`)
  const bruno = await seedContact(baseURL!, sector.id, `Bruno ${id}`, `551188${id.slice(-6)}`)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${id}`,
    phone: sender,
    contactName,
    body: 'Bom dia',
  })
  const ticketId = await assignTicket(baseURL!, sector.id, agent, contactName)

  // O cartão enviado aparece como o cliente recebeu: nome, telefone e órgão, sem apelido.
  const alineRequest = crypto.randomUUID()
  await sendCard(baseURL!, agent, ticketId, aline.id, alineRequest)
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  const alineCard = card(page, `Aline ${id}`)
  await expect(alineCard).toBeVisible()
  await expect(alineCard).toContainText(aline.organizationName)
  await expect(alineCard).toContainText('— Itu')
  const alineBubble = cardBubble(page, 'Mensagem enviada').filter({ has: alineCard })
  await expect(alineBubble).toContainText('Enviada')
  // O cartão sai sem legenda: o nome acima do balão é autoria interna, não texto enviado.
  const messages = (await (await page.request.get(`/api/tickets/${ticketId}/messages`)).json()) as {
    direction: string
    body: string | null
    contactCards: ContactCard[] | null
  }[]
  const sent = messages.filter((message) => message.direction === 'outbound')
  expect(sent.map((message) => message.body)).toEqual([null])
  expect(sent[0].contactCards).toEqual([
    {
      name: `Aline ${id}`,
      organization: `${aline.organizationName} — Itu`,
      phones: [{ phone: `551199${id.slice(-6)}`, whatsAppId: null }],
    },
  ])

  // A situação de entrega avança com a confirmação do celular do cliente.
  await phone(request, sector.id, 'status', {
    status: 'read',
    externalMessageIds: [`fake-msg-${alineRequest}`],
  })
  await expect(alineBubble).toContainText('Lida')

  // Número desconectado: o cartão fica com falha e "Reenviar", como as outras mensagens.
  await phone(request, sector.id, 'drop')
  const failed = await sendCard(baseURL!, agent, ticketId, bruno.id)
  expect(failed.status).toBe('failed')
  const brunoBubble = cardBubble(page, 'Mensagem enviada').filter({
    has: card(page, `Bruno ${id}`),
  })
  await expect(brunoBubble).toContainText('Falhou')
  await expect(brunoBubble).toContainText('Número do setor desconectado.')

  await connectSector(baseURL!, sector.id)
  await brunoBubble.getByRole('button', { name: 'Reenviar' }).click()
  await expect(brunoBubble).toContainText('Enviada')
  await expect(brunoBubble).not.toContainText('Falhou')
  await expect(page.getByRole('group', { name: new RegExp(`^Contato: Bruno ${id},`) })).toHaveCount(
    1,
  )
  await expect(page.getByRole('listitem', { name: 'Mensagem enviada' })).toHaveCount(2)
})

test('o detalhe de Atendimentos mostra o cartão, só para leitura', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id, phone: sender } = unique()
  const rita = await seedContact(baseURL!, sector.id, `Rita ${id}`, sender)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${id}`,
    phone: sender,
    contactName: `Rita ${id}`,
    type: 'contact',
    contactCards: [joaoCard()],
  })
  const ticketId = await assignTicket(baseURL!, sector.id, agent, `Rita ${id}`)
  const adminContext = await adminApi(baseURL!)
  const module = await json<{ id: number }>(
    await adminContext.post(`/api/sectors/${sector.id}/modules`, { data: { name: 'Sistema' } }),
  )
  await adminContext.dispose()
  const api = await agentApi(baseURL!, agent)
  ok(
    await api.post(`/api/tickets/${ticketId}/close`, {
      data: {
        subject: 'Contracheque',
        resolution: 'Orientei o contato.',
        moduleIds: [module.id],
        organizationId: rita.organizationId,
      },
    }),
  )
  await api.dispose()

  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  await expect(card(page, 'João Silva')).toBeVisible()
  await expect(card(page, 'João Silva')).toContainText('+55 (11) 98888-1234')
  await expect(page.getByRole('status', { name: 'Só leitura' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reenviar' })).toHaveCount(0)
})

test('integrante do setor que não é o responsável vê o cartão sem as ações de envio', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { id, phone: sender } = unique()
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${id}`,
    phone: sender,
    contactName: 'Clara Cliente',
    type: 'contact',
    contactCards: [joaoCard()],
  })
  const ticketId = await assignTicket(baseURL!, sector.id, agent, 'Clara Cliente')

  await signIn(page, supervisor, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(card(page, 'João Silva')).toBeVisible()
  await expect(page.getByText(/Chamado com agent \d+\. Peça a transferência/)).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reenviar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ações da mensagem' })).toHaveCount(0)
})

test('contato recebido antes da mudança continua com o aviso de não suportado', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { id, phone: sender } = unique()
  // Cartão sem nome, como os gravados antes como não suportado: nada é convertido.
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${id}`,
    phone: sender,
    contactName: 'Clara Cliente',
    type: 'contact',
    contactCards: [
      { name: '   ', organization: 'Prefeitura de Itu', phones: [{ phone: '5511988881234' }] },
    ],
  })

  await signIn(page, agent, userPassword)
  await openQueued(page, 'Clara Cliente')
  const received = conversation(page).getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toHaveCount(1)
  await expect(received).toContainText('Tipo de mensagem não suportado')
  await expect(page.getByRole('group', { name: /^Contato:/ })).toHaveCount(0)
})
