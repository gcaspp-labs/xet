import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test'
import {
  admin,
  json,
  ok,
  openQueued,
  seedContact,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

type Quote = { messageId: number | null; type: string | null; text: string | null }
type ApiMessage = {
  id: number
  direction: 'inbound' | 'outbound'
  type: string
  body: string | null
  status: string | null
  quote: Quote | null
}

async function connectSector(baseURL: string, sectorId: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sectorId}/connection`)).ok()).toBeTruthy()
  await api.dispose()
}

async function phone(request: APIRequestContext, sectorId: number, action: string, data?: object) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, {
    data,
  })
  expect(response.ok()).toBeTruthy()
}

const listMessages = async (page: Page, ticketId: number) =>
  json<ApiMessage[]>(await page.request.get(`/api/tickets/${ticketId}/messages`))

// A mensagem pelo texto dela: a citação de outra mensagem também mostra texto, mas fora do parágrafo.
const bubbleOf = (scope: Locator, text: string) =>
  scope
    .getByRole('listitem', { name: /^Mensagem (enviada|recebida)$/ })
    .filter({ has: scope.page().locator('p', { hasText: text }) })

// Na mensagem do XET o Responder fica no menu (⋯); nas demais, é o botão ao lado do balão.
async function pressReply(message: Locator) {
  await message.hover()
  const menu = message.getByRole('button', { name: 'Ações da mensagem' })
  if ((await menu.count()) > 0) {
    await menu.click()
    await message.page().getByRole('menuitem', { name: 'Responder', exact: true }).click()
    return
  }
  await message.getByRole('button', { name: 'Responder', exact: true }).click()
}

const first = 'Qual o prazo da nota?'

// Setor conectado e pareado, com o cliente que escreve e cita mensagens (dados fictícios).
async function seedCustomer(request: APIRequestContext, baseURL: string, contactName: string) {
  const seed = await seedSector(baseURL)
  await connectSector(baseURL, seed.sector.id)
  await phone(request, seed.sector.id, 'pair')
  const { phone: number, id } = unique()
  const externalId = (suffix: string) => `E2E-QSCREEN-${id}-${suffix}`
  const receive = (suffix: string, data: object) =>
    phone(request, seed.sector.id, 'receive', {
      externalMessageId: externalId(suffix),
      phone: number,
      contactName,
      ...data,
    })
  return { ...seed, receive, externalId }
}

// Assume o chamado do cliente e devolve a conversa aberta.
async function openAssigned(page: Page, agent: string, contactName: string) {
  await signIn(page, agent, userPassword)
  await openQueued(page, contactName)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  return page.getByRole('region', { name: 'Conversa', exact: true })
}

const currentTicketId = (page: Page) => Number(new URL(page.url()).pathname.split('/').pop())

test('a citação aparece dentro do balão, nas recebidas e nas enviadas, e continua depois de recarregar, também em chamado encerrado', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { agent, supervisor, receive, externalId } = await seedCustomer(
    request,
    baseURL!,
    'Clara Cita',
  )
  await receive('1', { body: first })
  await receive('2', {
    body: 'Isso mesmo',
    quote: { externalMessageId: externalId('1'), snippet: { text: first } },
  })
  // Cita um arquivo e um áudio que o XET não tem: tipo e nome, sem ligação.
  await receive('3', {
    body: 'E este?',
    quote: {
      externalMessageId: 'ANTES-DO-XET-1',
      snippet: { type: 'document', text: 'contrato.pdf' },
    },
  })
  await receive('4', {
    body: 'E aquele?',
    quote: { externalMessageId: 'ANTES-DO-XET-2', snippet: { type: 'audio' } },
  })
  // Só o identificador, de mensagem que o XET não tem.
  await receive('5', { body: 'Oi?', quote: { externalMessageId: 'SEM-TRECHO' } })
  // Um áudio do XET e a citação dele.
  await receive('6', {
    type: 'audio',
    media: { data: 'T2dnUw==', mimeType: 'audio/ogg; codecs=opus', durationSeconds: 7 },
  })
  await receive('7', { body: 'Deu pra ouvir?', quote: { externalMessageId: externalId('6') } })

  const conversation = await openAssigned(page, agent, 'Clara Cita')
  const ticketId = currentTicketId(page)

  // Resposta do setor citando a mensagem do cliente: a citação sai no balão enviado.
  await pressReply(bubbleOf(conversation, first))
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('O prazo é sexta-feira')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  await expect(bubbleOf(conversation, 'O prazo é sexta-feira')).toContainText('Enviada')

  const citationOfFirst = { name: `Citação de Cliente: ${first}` }
  const expectScreen = async (scope: Locator) => {
    // Conhecida: autor e conteúdo da mensagem do XET, dentro do balão que a usa.
    const known = bubbleOf(scope, 'Isso mesmo').getByRole('button', citationOfFirst)
    await expect(known).toBeVisible()
    await expect(known).toContainText('Cliente')
    // Nas enviadas também.
    await expect(
      bubbleOf(scope, 'O prazo é sexta-feira').getByRole('button', citationOfFirst),
    ).toBeVisible()
    // Desconhecida: o trecho do WhatsApp, com tipo e nome, sem ligação.
    const unknown = bubbleOf(scope, 'E este?').getByRole('group', {
      name: 'Citação do WhatsApp: 📎 contrato.pdf',
    })
    await expect(unknown).toContainText('Trecho do WhatsApp')
    await expect(unknown.getByRole('link')).toHaveCount(0)
    await expect(
      bubbleOf(scope, 'E aquele?').getByRole('group', { name: 'Citação do WhatsApp: 🎤 Áudio' }),
    ).toBeVisible()
    // Só o identificador, sem a mensagem no XET: indisponível.
    await expect(
      bubbleOf(scope, 'Oi?').getByRole('group', { name: 'Citação: mensagem indisponível' }),
    ).toContainText('Mensagem indisponível')
    // Mídia do XET: tipo e duração, sem player nem link dentro da citação.
    const media = bubbleOf(scope, 'Deu pra ouvir?').getByRole('button', {
      name: 'Citação de Cliente: 🎤 Áudio (0:07)',
    })
    await expect(media).toBeVisible()
    await expect(media.locator('audio, a, video')).toHaveCount(0)
    // Sem citação, sem faixa.
    await expect(bubbleOf(scope, first).getByRole('button', { name: /^Citação/ })).toHaveCount(0)
  }

  await expectScreen(conversation)
  await page.reload()
  await expectScreen(page.getByRole('region', { name: 'Conversa', exact: true }))

  // Clicar na citação de uma mensagem do XET leva à original, sem sair da conversa.
  await bubbleOf(conversation, 'Isso mesmo').getByRole('button', citationOfFirst).click()
  await expect(bubbleOf(conversation, first)).toBeInViewport()
  await expect(page).toHaveURL(new RegExp(`/chamados/${ticketId}$`))

  // Quem não é o responsável vê as citações, sem o botão de responder.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await other.goto(`/chamados/${ticketId}`)
  await expectScreen(other.getByRole('region', { name: 'Conversa', exact: true }))
  await expect(other.getByRole('button', { name: 'Responder', exact: true })).toHaveCount(0)
  await otherContext.close()

  // Chamado encerrado (aqui, cancelado): a ficha só leitura mostra as citações, sem responder.
  const cancel = await page.request.post(`/api/tickets/${ticketId}/cancel`, {
    data: { reason: 'Engano.' },
  })
  expect(cancel.ok()).toBeTruthy()
  await page.goto(`/atendimentos/${ticketId}`)
  await expectScreen(page.getByRole('region', { name: 'Conversa', exact: true }))
  await expect(page.getByRole('button', { name: 'Responder', exact: true })).toHaveCount(0)
})

test('o responsável responde citando texto, arquivo e áudio, e cancelar envia sem citação', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, receive } = await seedCustomer(request, baseURL!, 'Clara Cita')
  await receive('1', { body: first })
  const conversation = await openAssigned(page, agent, 'Clara Cita')
  const ticketId = currentTicketId(page)
  const received = bubbleOf(conversation, first)
  const input = page.getByRole('textbox', { name: 'Mensagem' })
  const draft = page.getByRole('group', { name: 'Respondendo a Cliente' })
  const target = (await listMessages(page, ticketId))[0].id
  const stored = async (body: string) =>
    (await listMessages(page, ticketId)).find(
      (m) => m.direction === 'outbound' && m.body?.includes(body),
    )

  // Preparo: a faixa acima do campo mostra o autor e o trecho, e o foco vai para o campo.
  await pressReply(received)
  await expect(draft).toBeVisible()
  await expect(draft).toContainText('Respondendo a Cliente')
  await expect(draft).toContainText(first)
  await expect(input).toBeFocused()

  // Cancelar antes de enviar: a mensagem sai sem citação.
  await draft.getByRole('button', { name: 'Cancelar citação' }).click()
  await expect(draft).toHaveCount(0)
  await input.fill('Sem citação')
  await input.press('Enter')
  const plain = bubbleOf(conversation, 'Sem citação')
  await expect(plain).toContainText('Enviada')
  await expect(plain.getByRole('button', { name: /^Citação/ })).toHaveCount(0)
  expect((await stored('Sem citação'))?.quote).toBeNull()

  // Texto: depois de enviar, a faixa some e a mensagem mostra a citação.
  await pressReply(received)
  await input.fill('Respondendo por texto')
  await input.press('Enter')
  const byText = bubbleOf(conversation, 'Respondendo por texto')
  await expect(byText).toContainText('Enviada')
  await expect(draft).toHaveCount(0)
  await expect(byText.getByRole('button', { name: `Citação de Cliente: ${first}` })).toBeVisible()
  expect((await stored('Respondendo por texto'))?.quote).toEqual({
    messageId: target,
    type: 'text',
    text: first,
  })

  // Arquivo, citando a mensagem do próprio setor (o apelido não entra no trecho mostrado).
  await pressReply(byText)
  const own = page.getByRole('group', { name: /^Respondendo a agent \d+$/ })
  await expect(own).toContainText('Respondendo por texto')
  await expect(own).not.toContainText('*')
  await page.getByLabel('Arquivo para enviar').setInputFiles({
    name: 'balancete.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('teste'),
  })
  await page.getByRole('textbox', { name: 'Legenda do arquivo' }).fill('Segue o arquivo')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  const byFile = bubbleOf(conversation, 'Segue o arquivo')
  await expect(byFile).toContainText('Enviada')
  await expect(own).toHaveCount(0)
  await expect(
    byFile.getByRole('button', { name: /^Citação de agent \d+: Respondendo por texto$/ }),
  ).toBeVisible()
  const sentFile = (await listMessages(page, ticketId)).find((m) => m.type === 'document')
  expect(sentFile?.quote?.messageId).toBe((await stored('Respondendo por texto'))?.id)

  // Áudio gravado.
  await pressReply(received)
  await expect(draft).toBeVisible()
  await page.getByRole('button', { name: 'Gravar áudio' }).click()
  await expect(page.getByRole('status', { name: 'Gravação de áudio' })).toContainText('Gravando')
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Concluir gravação' }).click()
  await expect(page.getByLabel('Áudio gravado')).toBeVisible()
  await expect(draft).toBeVisible()
  await page.getByRole('button', { name: 'Enviar áudio' }).click()
  await expect(draft).toHaveCount(0)
  await expect
    .poll(
      async () =>
        (await listMessages(page, ticketId)).find(
          (m) => m.type === 'audio' && m.direction === 'outbound',
        )?.quote?.messageId,
      { timeout: 15_000 },
    )
    .toBe(target)

  // Continua depois de recarregar.
  await page.reload()
  const reloaded = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(
    bubbleOf(reloaded, 'Segue o arquivo').getByRole('button', {
      name: /^Citação de agent \d+: Respondendo por texto$/,
    }),
  ).toBeVisible()
  await expect(
    reloaded
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .filter({ has: page.getByRole('group', { name: 'Áudio' }) })
      .getByRole('button', { name: `Citação de Cliente: ${first}` }),
  ).toBeVisible()
})

test('sem o botão de responder para mensagem com falha ou não suportada; arquivo indisponível mantém', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, sector, receive } = await seedCustomer(request, baseURL!, 'Clara Cita')
  await receive('1', { body: first })
  await receive('2', { type: 'unsupported', body: '' })
  await receive('3', { type: 'media_unavailable', body: 'video-grande.mp4' })
  const conversation = await openAssigned(page, agent, 'Clara Cita')
  const reply = (message: Locator) =>
    message.getByRole('button', { name: 'Responder', exact: true })

  await expect(reply(bubbleOf(conversation, first))).toBeAttached()
  await expect(reply(bubbleOf(conversation, 'video-grande.mp4'))).toBeAttached()
  // Figurinha, localização e aviso antigo de reação: sem o botão.
  const unsupported = bubbleOf(conversation, 'Tipo de mensagem não suportado')
  await expect(unsupported).toBeVisible()
  await expect(reply(unsupported)).toHaveCount(0)

  // Enviada com falha: sem o botão.
  await phone(request, sector.id, 'drop')
  const input = page.getByRole('textbox', { name: 'Mensagem' })
  await input.fill('Esta vai falhar')
  await input.press('Enter')
  const failed = bubbleOf(conversation, 'Esta vai falhar')
  await expect(failed).toContainText('Falhou')
  await failed.hover()
  await expect(reply(failed)).toHaveCount(0)
})

test('Reenviar de uma resposta citada que falhou repete a mesma citação', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, sector, receive } = await seedCustomer(request, baseURL!, 'Clara Cita')
  await receive('1', { body: first })
  const conversation = await openAssigned(page, agent, 'Clara Cita')
  const ticketId = currentTicketId(page)
  const target = (await listMessages(page, ticketId))[0].id

  await phone(request, sector.id, 'drop')
  await pressReply(bubbleOf(conversation, first))
  const input = page.getByRole('textbox', { name: 'Mensagem' })
  await input.fill('Resposta que falha')
  await input.press('Enter')
  const message = bubbleOf(conversation, 'Resposta que falha')
  await expect(message).toContainText('Falhou')
  // A citação continua no balão que falhou, e a faixa do campo já saiu.
  await expect(message.getByRole('button', { name: `Citação de Cliente: ${first}` })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Respondendo a Cliente' })).toHaveCount(0)

  await connectSector(baseURL!, sector.id)
  await message.getByRole('button', { name: 'Reenviar' }).click()
  await expect(message).toContainText('Enviada')
  await expect(message.getByRole('button', { name: `Citação de Cliente: ${first}` })).toBeVisible()
  const sent = (await listMessages(page, ticketId)).filter((m) => m.direction === 'outbound')
  expect(sent).toHaveLength(1)
  expect(sent[0].quote?.messageId).toBe(target)
})

test('trocar de chamado limpa a citação em preparo', async ({ page, request, baseURL }) => {
  const seed = await seedSector(baseURL!)
  await connectSector(baseURL!, seed.sector.id)
  await phone(request, seed.sector.id, 'pair')
  for (const name of ['Clara Cita', 'Davi Dois']) {
    await phone(request, seed.sector.id, 'receive', {
      externalMessageId: `E2E-QSCREEN-${unique().id}`,
      phone: unique().phone,
      contactName: name,
      body: `Mensagem de ${name}`,
    })
  }
  await signIn(page, seed.agent, userPassword)
  for (const name of ['Clara Cita', 'Davi Dois']) {
    await openQueued(page, name)
    await page.getByRole('button', { name: 'Assumir', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  }

  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const list = page.getByRole('navigation', { name: 'Meus chamados' })
  await list.getByRole('link', { name: /Clara Cita/ }).click()
  await expect(page.getByRole('heading', { name: 'Clara Cita' })).toBeVisible()
  await pressReply(bubbleOf(conversation, 'Mensagem de Clara Cita'))
  await expect(page.getByRole('group', { name: 'Respondendo a Cliente' })).toBeVisible()

  await list.getByRole('link', { name: /Davi Dois/ }).click()
  await expect(page.getByRole('heading', { name: 'Davi Dois' })).toBeVisible()
  await expect(page.getByRole('group', { name: /^Respondendo a/ })).toHaveCount(0)
  // Voltar não traz a citação de volta.
  await list.getByRole('link', { name: /Clara Cita/ }).click()
  await expect(page.getByRole('heading', { name: 'Clara Cita' })).toBeVisible()
  await expect(page.getByRole('group', { name: /^Respondendo a/ })).toHaveCount(0)
})

test('perder a responsabilidade descarta a citação em preparo: ao reassumir, o campo volta sem citação', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, supervisor, sector, receive } = await seedCustomer(request, baseURL!, 'Clara Cita')
  await receive('1', { body: first })
  const conversation = await openAssigned(page, agent, 'Clara Cita')
  const ticketId = currentTicketId(page)
  await pressReply(bubbleOf(conversation, first))
  await expect(page.getByRole('group', { name: 'Respondendo a Cliente' })).toBeVisible()

  const login = async (email: string) => {
    const api = await apiRequest.newContext({ baseURL })
    expect(
      (await api.post('/api/auth/login', { data: { email, password: userPassword } })).ok(),
    ).toBeTruthy()
    return api
  }
  const agentApi = await login(agent)
  const supervisorApi = await login(supervisor)
  const people = await json<{ id: number; name: string }[]>(
    await agentApi.get(`/api/sectors/${sector.id}/workload`),
  )
  const idOf = (email: string) =>
    people.find((p) => p.name === email.replace('.', ' ').split('@')[0])!.id

  // O atendente transfere o chamado ao supervisor: a conversa vira leitura e a citação some.
  expect(
    (
      await agentApi.post(`/api/tickets/${ticketId}/transfer`, {
        data: { assigneeId: idOf(supervisor) },
      })
    ).ok(),
  ).toBeTruthy()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: /^Respondendo a/ })).toHaveCount(0)

  // O chamado volta ao atendente, sem recarregar a tela: o campo volta limpo.
  expect(
    (
      await supervisorApi.post(`/api/tickets/${ticketId}/transfer`, {
        data: { assigneeId: idOf(agent) },
      })
    ).ok(),
  ).toBeTruthy()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  await expect(page.getByRole('group', { name: /^Respondendo a/ })).toHaveCount(0)
  await agentApi.dispose()
  await supervisorApi.dispose()
})

test('teclado e leitor de tela: responder, citação em preparo, cancelar e citação exibida têm nome', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, receive, externalId } = await seedCustomer(request, baseURL!, 'Clara Cita')
  await receive('1', { body: first })
  await receive('2', {
    body: 'Isso mesmo',
    quote: { externalMessageId: externalId('1'), snippet: { text: first } },
  })
  const conversation = await openAssigned(page, agent, 'Clara Cita')
  const message = bubbleOf(conversation, first)

  // O botão ao lado do balão recebe o foco pelo teclado e fica visível ao focar.
  const trigger = message.getByRole('button', { name: 'Responder', exact: true })
  await trigger.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveCSS('opacity', '1')
  await page.keyboard.press('Enter')

  // Citação em preparo: grupo com nome, foco no campo, cancelar pelo teclado.
  const draft = page.getByRole('group', { name: 'Respondendo a Cliente' })
  await expect(draft).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeFocused()
  await draft.getByRole('button', { name: 'Cancelar citação' }).focus()
  await page.keyboard.press('Enter')
  await expect(draft).toHaveCount(0)

  // Citação exibida: um botão com nome, que se aciona pelo teclado.
  const shown = bubbleOf(conversation, 'Isso mesmo').getByRole('button', {
    name: `Citação de Cliente: ${first}`,
  })
  await shown.focus()
  await expect(shown).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(message).toBeInViewport()
})

// O cartão de contato de João Silva, nos dois sentidos.
const joaoCard = {
  name: 'João Silva',
  organization: 'Prefeitura de Itu',
  phones: [{ phone: '5511988881234', whatsAppId: '5511988881234' }],
}

// A janela "Enviar contato", aberta pelo menu do clipe.
const contactDialog = (page: Page) => page.getByRole('dialog', { name: 'Enviar contato' })

// Escolhe o contato pela busca e envia o cartão, como o responsável faz na janela do anexo.
async function sendContact(page: Page, name: string) {
  await page.getByRole('button', { name: 'Anexar arquivo' }).click()
  await page.getByRole('menuitem', { name: 'Contato', exact: true }).click()
  await expect(contactDialog(page)).toBeVisible()
  await contactDialog(page).getByRole('searchbox', { name: 'Buscar contato' }).fill(name)
  await contactDialog(page)
    .getByRole('list', { name: 'Contatos' })
    .getByRole('button', { name: new RegExp(name) })
    .click()
  await contactDialog(page).getByRole('button', { name: 'Enviar' }).click()
  await expect(contactDialog(page)).toHaveCount(0)
}

// O balão que tem o cartão do contato, na direção pedida.
const cardBubble = (scope: Locator, direction: string, name: string) =>
  scope
    .getByRole('listitem', { name: direction })
    .filter({ has: scope.page().getByRole('group', { name: new RegExp(`^Contato: ${name},`) }) })

// O que o adaptador falso do WhatsApp recebeu para o setor, pela rota de teste do próprio adaptador.
type SentToProvider = {
  id: string
  kind: string
  type?: string
  to?: string
  body?: string
  card?: { name: string; organization?: string; phones?: string[] }
  quote?: { externalMessageId: string; type?: string; text?: string }
}

const sentToProvider = async (request: APIRequestContext, sectorId: number) =>
  json<SentToProvider[]>(await request.get(`/api/test/messaging/sectors/${sectorId}/sent`))

// Os cartões que o adaptador falso recebeu, pelo nome do contato.
const cardsSentToProvider = async (request: APIRequestContext, sectorId: number, name: string) =>
  (await sentToProvider(request, sectorId)).filter(
    (item) => item.kind === 'contact' && item.card?.name === name,
  )

test('Responder num cartão mostra "👤 Nome" na citação em preparo e na resposta, e o cliente citando um cartão também', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, receive, externalId } = await seedCustomer(request, baseURL!, 'Clara Cartão')
  await receive('1', { body: 'Segue o contato do setor.' })
  await receive('2', { type: 'contact', contactCards: [joaoCard] })
  // O cliente cita o cartão que ele mesmo mandou: a citação também mostra "👤 Nome".
  await receive('3', {
    body: 'E o outro?',
    quote: { externalMessageId: externalId('2'), snippet: { type: 'contact', text: 'João Silva' } },
  })

  const conversation = await openAssigned(page, agent, 'Clara Cartão')
  const ticketId = currentTicketId(page)
  const card = cardBubble(conversation, 'Mensagem recebida', 'João Silva')
  await expect(card).toBeVisible()
  const draft = page.getByRole('group', { name: 'Respondendo a Cliente' })
  const input = page.getByRole('textbox', { name: 'Mensagem' })

  // A citação em preparo mostra o nome do primeiro cartão, e o foco vai para o campo.
  await pressReply(card)
  await expect(draft).toContainText('👤 João Silva')
  await expect(input).toBeFocused()

  // Enviada, a citação continua acima da resposta, com o mesmo nome.
  await input.fill('Fale com ele')
  await input.press('Enter')
  const reply = bubbleOf(conversation, 'Fale com ele')
  await expect(reply).toContainText('Enviada')
  await expect(draft).toHaveCount(0)
  await expect(
    reply.getByRole('button', { name: 'Citação de Cliente: 👤 João Silva' }),
  ).toBeVisible()
  const sent = (await listMessages(page, ticketId)).find((m) => m.body?.includes('Fale com ele'))
  expect(sent?.quote).toEqual({
    messageId: (await listMessages(page, ticketId)).find((m) => m.type === 'contact')?.id,
    type: 'contact',
    text: 'João Silva',
  })

  // O cartão citado pelo cliente mostra o nome do cartão também.
  await expect(
    bubbleOf(conversation, 'E o outro?').getByRole('button', {
      name: 'Citação de Cliente: 👤 João Silva',
    }),
  ).toBeVisible()

  // Continua depois de recarregar.
  await page.reload()
  const reloaded = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(
    bubbleOf(reloaded, 'Fale com ele').getByRole('button', {
      name: 'Citação de Cliente: 👤 João Silva',
    }),
  ).toBeVisible()
  await expect(
    bubbleOf(reloaded, 'E o outro?').getByRole('button', {
      name: 'Citação de Cliente: 👤 João Silva',
    }),
  ).toBeVisible()
})

test('o cartão enviado pela janela vai como resposta citada, a citação sai do campo e Reenviar repete a mesma citação', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, sector, receive, externalId } = await seedCustomer(request, baseURL!, 'Clara Cita')
  await receive('1', { body: first })
  const { id } = unique()
  const name = `Rita ${id}`
  await seedContact(baseURL!, sector.id, name, unique().phone)

  const conversation = await openAssigned(page, agent, 'Clara Cita')
  const ticketId = currentTicketId(page)
  const target = (await listMessages(page, ticketId))[0].id
  const draft = page.getByRole('group', { name: 'Respondendo a Cliente' })

  // Com a citação em preparo, o cartão vai como resposta citada e a faixa some do compositor.
  await pressReply(bubbleOf(conversation, first))
  await expect(draft).toBeVisible()
  await sendContact(page, name)
  const card = cardBubble(conversation, 'Mensagem enviada', name)
  await expect(card).toContainText('Enviada')
  await expect(draft).toHaveCount(0)
  await expect(card.getByRole('button', { name: `Citação de Cliente: ${first}` })).toBeVisible()
  const contacts = async () =>
    (await listMessages(page, ticketId)).filter((message) => message.type === 'contact')
  expect((await contacts())[0].quote).toEqual({
    messageId: target,
    type: 'text',
    text: first,
  })

  // O adaptador falso recebe o cartão com a citação: o que a tela guarda não basta.
  await expect
    .poll(async () => (await cardsSentToProvider(request, sector.id, name)).length)
    .toBe(1)
  expect((await cardsSentToProvider(request, sector.id, name))[0].quote).toMatchObject({
    externalMessageId: externalId('1'),
    type: 'text',
    text: first,
  })

  // Com o número desconectado, o cartão fica com falha e mantém a citação; o falso recebe a mesma
  // citação de novo no Reenviar, sem duplicar a mensagem.
  const other = `Bruno ${id}`
  await seedContact(baseURL!, sector.id, other, unique().phone)
  await phone(request, sector.id, 'drop')
  await pressReply(bubbleOf(conversation, first))
  await sendContact(page, other)
  const failed = cardBubble(conversation, 'Mensagem enviada', other)
  await expect(failed).toContainText('Falhou')
  await expect(draft).toHaveCount(0)
  await expect(failed.getByRole('button', { name: `Citação de Cliente: ${first}` })).toBeVisible()
  // Desconectado, o cartão com falha não chegou ao provedor.
  expect(await cardsSentToProvider(request, sector.id, other)).toHaveLength(0)

  await connectSector(baseURL!, sector.id)
  await failed.getByRole('button', { name: 'Reenviar' }).click()
  await expect(failed).toContainText('Enviada')
  const sent = await contacts()
  expect(sent).toHaveLength(2)
  expect(sent[1].quote?.messageId).toBe(target)
  await expect(page.getByRole('group', { name: new RegExp(`^Contato: ${other},`) })).toHaveCount(1)

  // O Reenviar chegou ao falso uma vez só, com a mesma citação.
  const resent = await cardsSentToProvider(request, sector.id, other)
  expect(resent).toHaveLength(1)
  expect(resent[0].quote).toMatchObject({
    externalMessageId: externalId('1'),
    type: 'text',
    text: first,
  })
})

test('Responder pelo menu de um cartão enviado mostra "👤 Nome", e o cliente também cita esse cartão', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, sector, receive } = await seedCustomer(request, baseURL!, 'Clara Cita')
  await receive('1', { body: first })
  const { id } = unique()
  const name = `Rita ${id}`
  await seedContact(baseURL!, sector.id, name, unique().phone)

  const conversation = await openAssigned(page, agent, 'Clara Cita')
  const ticketId = currentTicketId(page)
  const input = page.getByRole('textbox', { name: 'Mensagem' })
  const draft = page.getByRole('group', { name: /^Respondendo a agent \d+$/ })

  // O cartão sai pela janela do anexo, como nas outras jornadas.
  await sendContact(page, name)
  const card = cardBubble(conversation, 'Mensagem enviada', name)
  await expect(card).toContainText('Enviada')
  await expect
    .poll(async () => (await cardsSentToProvider(request, sector.id, name)).length)
    .toBe(1)
  const atProvider = (await cardsSentToProvider(request, sector.id, name))[0]

  // No cartão enviado o Responder fica no menu (⋯), não ao lado do balão. Aqui pelo teclado, como
  // um leitor de tela faria; o mouse no ⋯ está no teste da janela de 1280px.
  await card.hover()
  await expect(card.getByRole('button', { name: 'Responder', exact: true })).toHaveCount(0)
  await card.getByRole('button', { name: 'Ações da mensagem' }).focus()
  await page.keyboard.press('Enter')
  const replyItem = page.getByRole('menuitem', { name: 'Responder', exact: true })
  await expect(replyItem).toBeVisible()
  await replyItem.focus()
  await page.keyboard.press('Enter')
  await expect(draft).toContainText(`👤 ${name}`)
  await expect(input).toBeFocused()

  // A resposta citada mostra o nome do cartão, como as demais mensagens citadas.
  await input.fill('Falo com ela')
  await input.press('Enter')
  const reply = bubbleOf(conversation, 'Falo com ela')
  await expect(reply).toContainText('Enviada')
  await expect(draft).toHaveCount(0)
  const citation = { name: new RegExp(`^Citação de agent \\d+: 👤 ${name}$`) }
  await expect(reply.getByRole('button', citation)).toBeVisible()
  const sentCard = (await listMessages(page, ticketId)).find(
    (message) => message.type === 'contact',
  )
  expect(
    (await listMessages(page, ticketId)).find((m) => m.body?.includes('Falo com ela'))?.quote,
  ).toEqual({
    messageId: sentCard?.id,
    type: 'contact',
    text: name,
  })

  // O cliente cita o cartão que o setor mandou, pelo identificador que chegou ao provedor.
  await receive('2', {
    body: 'Falo com ela também',
    quote: { externalMessageId: atProvider.id, snippet: { type: 'contact', text: name } },
  })
  const fromClient = bubbleOf(conversation, 'Falo com ela também')
  await expect(fromClient.getByRole('button', citation)).toBeVisible()
  await expect(fromClient.getByRole('button', citation)).toContainText(name)
})

test('em janela de 1280px, o cartão enviado cabe na conversa e o mouse alcança o ⋯ e o Reagir', async ({
  page,
  request,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const { agent, sector, receive } = await seedCustomer(request, baseURL!, 'Clara Cita')
  await receive('1', { body: first })
  const { id } = unique()
  const name = `Rita ${id}`
  await seedContact(baseURL!, sector.id, name, unique().phone)

  const conversation = await openAssigned(page, agent, 'Clara Cita')
  await sendContact(page, name)
  const card = cardBubble(conversation, 'Mensagem enviada', name)
  await expect(card).toContainText('Enviada')

  // O cartão, o Reagir e o ⋯ ficam dentro da coluna da conversa, sem passar para "Meus chamados".
  const column = (await conversation.boundingBox())!
  await card.hover()
  const menu = card.getByRole('button', { name: 'Ações da mensagem' })
  const react = card.getByRole('button', { name: 'Reagir', exact: true })
  for (const part of [card, menu, react]) {
    const box = (await part.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(column.x)
    expect(box.x + box.width).toBeLessThanOrEqual(column.x + column.width)
  }

  // O ⋯ abre pelo clique do mouse (o Playwright recusa o clique se outro elemento cobre o botão).
  await menu.click()
  await expect(page.getByRole('menuitem', { name: 'Responder', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menuitem', { name: 'Responder', exact: true })).toHaveCount(0)

  // O Reagir também abre pelo mouse, e a reação escolhida aparece no cartão.
  await card.hover()
  await react.click()
  const bar = page.getByRole('group', { name: 'Reagir à mensagem' })
  await expect(bar).toBeVisible()
  await bar.getByRole('button', { name: 'Reagir com 👍' }).click()
  await expect(card.getByRole('listitem', { name: /^Setor reagiu com 👍, / })).toBeVisible()
})

test('em janela de 1280px, o cartão recebido cabe na conversa e o mouse alcança o Responder e o Reagir', async ({
  page,
  request,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const { agent, receive } = await seedCustomer(request, baseURL!, 'Clara Recebe')
  await receive('1', { type: 'contact', contactCards: [joaoCard] })

  const conversation = await openAssigned(page, agent, 'Clara Recebe')
  const card = cardBubble(conversation, 'Mensagem recebida', 'João Silva')
  await expect(card).toBeVisible()

  // O cartão, o Responder e o Reagir ficam dentro da coluna da conversa.
  const column = (await conversation.boundingBox())!
  await card.hover()
  const reply = card.getByRole('button', { name: 'Responder', exact: true })
  const react = card.getByRole('button', { name: 'Reagir', exact: true })
  for (const part of [card, reply, react]) {
    const box = (await part.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(column.x)
    expect(box.x + box.width).toBeLessThanOrEqual(column.x + column.width)
  }

  // Os dois abrem pelo clique do mouse (o Playwright recusa o clique se outro elemento cobre o botão).
  await reply.click()
  await expect(page.getByRole('group', { name: 'Respondendo a Cliente' })).toContainText(
    '👤 João Silva',
  )
  await card.hover()
  await react.click()
  await expect(page.getByRole('group', { name: 'Reagir à mensagem' })).toBeVisible()
})

test('cartão enviando ou com falha não oferece reação nem Responder', async ({
  page,
  request,
  baseURL,
}) => {
  // Dois contatos, o envio segurado e a falha: dá mais passos que os testes vizinhos.
  test.slow()
  const { agent, sector, receive } = await seedCustomer(request, baseURL!, 'Clara Cita')
  await receive('1', { body: first })
  const { id } = unique()
  const sending = `Rita ${id}`
  const failing = `Bruno ${id}`
  const { id: sendingId } = await seedContact(baseURL!, sector.id, sending, unique().phone)
  await seedContact(baseURL!, sector.id, failing, unique().phone)
  const conversation = await openAssigned(page, agent, 'Clara Cita')
  const ticketId = currentTicketId(page)
  const noActions = async (message: Locator) => {
    await message.hover()
    await expect(message.getByRole('button', { name: 'Reagir', exact: true })).toHaveCount(0)
    await expect(message.getByRole('button', { name: 'Responder', exact: true })).toHaveCount(0)
    // A mensagem do XET tem o menu (⋯), que também não oferece Responder.
    const menu = message.getByRole('button', { name: 'Ações da mensagem' })
    if ((await menu.count()) > 0) {
      await menu.click()
      // O menu só existe depois de abrir: sem esperar por ele, o Esc cairia na regra da tela
      // (com nada por cima, volta para Chamados) e o chamado fecharia no meio do teste.
      await expect(page.getByRole('menu')).toBeVisible()
      await expect(page.getByRole('menuitem', { name: 'Responder', exact: true })).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('menu')).toHaveCount(0)
      // O chamado continua aberto: o menu fechou, e não foi a tela que saiu daqui.
      await expect(page).toHaveURL(/\/chamados\/\d+$/)
    }
  }

  // Em envio: o provedor segura o envio, e o cartão fica "Enviando" enquanto isso, sem as ações.
  // O envio sai de outra sessão para não prender a janela do compositor; a tela é recarregada para
  // mostrar o cartão como ele está, sem depender do aviso em tempo real sob carga no CI.
  await phone(request, sector.id, 'hold')
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const sendingSend = api.post(`/api/tickets/${ticketId}/messages/contact`, {
    data: { contactId: sendingId, clientRequestId: crypto.randomUUID() },
  })
  const cardStatuses = async () =>
    (await listMessages(page, ticketId))
      .filter((message) => message.type === 'contact')
      .map((message) => message.status)
  await expect.poll(cardStatuses).toEqual(['pending'])

  await page.reload()
  const pending = cardBubble(conversation, 'Mensagem enviada', sending)
  await expect(pending).toContainText('Enviando')
  await noActions(pending)

  await phone(request, sector.id, 'release')
  ok(await sendingSend)
  await api.dispose()
  await expect.poll(cardStatuses).toEqual(['sent'])

  // Enviada, o cartão volta a oferecer reação.
  await page.reload()
  const sent = cardBubble(conversation, 'Mensagem enviada', sending)
  await expect(sent).toContainText('Enviada')
  await expect(sent.getByRole('button', { name: 'Reagir', exact: true })).toBeAttached()

  // Com falha: também sem reação e sem Responder, só a exclusão para mim no menu.
  await phone(request, sector.id, 'drop')
  await sendContact(page, failing)
  const failed = cardBubble(conversation, 'Mensagem enviada', failing)
  await expect(failed).toContainText('Falhou')
  await noActions(failed)
})
