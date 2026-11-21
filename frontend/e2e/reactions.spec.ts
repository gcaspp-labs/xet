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
  queuedTicketId,
  recordToasts,
  seedContact,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

type Reactions = {
  customer: { emoji: string; at: string } | null
  sector: { emoji: string; at: string; by: unknown; viaPhone: boolean } | null
}
type ApiMessage = {
  id: number
  direction: string
  type: string
  body: string | null
  reactions: Reactions
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

async function simulateMessaging(
  request: APIRequestContext,
  sectorId: number,
  action: string,
  data?: object,
) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, {
    data,
  })
  expect(response.ok()).toBeTruthy()
}

const received = 'Bom dia, preciso de ajuda'

// Setor conectado e pareado, com uma mensagem do cliente na fila. A reação do cliente e a do
// celular do setor chegam pelas rotas de teste do adaptador falso.
async function receiveCustomerMessage(
  request: APIRequestContext,
  baseURL: string,
  contactName = 'Clara Cliente',
) {
  const seed = await seedSector(baseURL)
  const { sector } = seed
  await connectSector(baseURL, sector.id)
  await simulateMessaging(request, sector.id, 'pair')
  const { phone, id } = unique()
  const messageId = `E2E-REACT-${id}`
  await simulateMessaging(request, sector.id, 'receive', {
    externalMessageId: messageId,
    phone,
    contactName,
    body: received,
  })
  const customerReacts = (emoji: string, fromSectorPhone = false) =>
    simulateMessaging(request, sector.id, 'react', {
      targetExternalMessageId: messageId,
      phone,
      emoji,
      fromSectorPhone,
    })
  return { ...seed, customerReacts }
}

const listMessages = async (page: Page, ticketId: number) =>
  json<ApiMessage[]>(await page.request.get(`/api/tickets/${ticketId}/messages`))

// As reações guardadas na mensagem recebida do chamado, como a API as entrega.
async function storedReactions(page: Page, ticketId: number) {
  const message = (await listMessages(page, ticketId)).find((m) => m.body === received)
  expect(message).toBeTruthy()
  return message!.reactions
}

// A reação recebida chega pela API de mensagens do chamado, troca, some quando removida, e
// sobrevive a recarregar a página.
test('reação do cliente e do celular do setor chegam pela API e continuam depois de recarregar', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, customerReacts: react } = await receiveCustomerMessage(request, baseURL!)

  await signIn(page, agent, userPassword)
  const ticketId = await queuedTicketId(page, 'Clara Cliente')
  const reactions = () => storedReactions(page, ticketId)

  expect(await reactions()).toEqual({ customer: null, sector: null })

  await react('👍')
  await expect.poll(async () => (await reactions()).customer?.emoji).toBe('👍')

  // A troca substitui a anterior; a do celular do setor fica no outro lado, "pelo celular".
  await react('❤️')
  await react('🙏', true)
  await expect.poll(async () => (await reactions()).customer?.emoji).toBe('❤️')
  const both = await reactions()
  expect(both.sector).toMatchObject({ emoji: '🙏', viaPhone: true, by: null })

  await page.reload()
  const afterReload = await reactions()
  expect(afterReload.customer?.emoji).toBe('❤️')
  expect(afterReload.sector?.emoji).toBe('🙏')

  // Reação vazia remove só o lado do cliente.
  await react('')
  await expect.poll(async () => (await reactions()).customer).toBeNull()
  expect((await reactions()).sector?.emoji).toBe('🙏')

  // Nada foi gravado como mensagem: continua uma só, e o chamado é o mesmo.
  expect(await listMessages(page, ticketId)).toHaveLength(1)
})

// Chamado assumido pelo atendente, com uma mensagem do cliente.
async function openAssignedConversation(
  page: Page,
  request: APIRequestContext,
  baseURL: string,
  contactName = 'Clara Cliente',
) {
  const seed = await receiveCustomerMessage(request, baseURL, contactName)
  await signIn(page, seed.agent, userPassword)
  await openQueued(page, contactName)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  return {
    ...seed,
    conversation,
    message: conversation.getByRole('listitem', { name: 'Mensagem recebida' }),
    ticketId: Number(new URL(page.url()).pathname.split('/').pop()),
  }
}

const sectorChip = (message: Locator, emoji: string) =>
  message.getByRole('listitem', { name: new RegExp(`^Setor reagiu com ${emoji}, `) })

async function openReactionBar(page: Page, message: Locator) {
  await message.hover()
  await message.getByRole('button', { name: 'Reagir', exact: true }).click()
  const bar = page.getByRole('group', { name: 'Reagir à mensagem' })
  await expect(bar).toBeVisible()
  return bar
}

test('reação do cliente e do celular do setor aparecem embaixo da mensagem, trocam e somem sem recarregar, sem sino nem alerta', async ({
  page,
  request,
  baseURL,
}) => {
  const toasts = await recordToasts(page)
  const { message, conversation, customerReacts } = await openAssignedConversation(
    page,
    request,
    baseURL!,
  )
  const customerChip = (emoji: string) =>
    message.getByRole('listitem', { name: `Cliente reagiu com ${emoji}` })
  const bell = page.getByRole('banner').getByRole('button', { name: /^Notificações/ })
  await expect(bell).toHaveAccessibleName('Notificações')
  await expect(message).not.toContainText('Cliente')

  await customerReacts('👍')
  await expect(customerChip('👍')).toBeVisible()
  await expect(customerChip('👍')).toContainText('Cliente')
  // A reação fica embaixo do balão, na mesma mensagem, e não vira outra mensagem nem aviso.
  await expect(conversation.getByRole('listitem', { name: 'Mensagem recebida' })).toHaveCount(1)
  await expect(conversation).not.toContainText('Tipo de mensagem não suportado')

  // A troca pelo cliente substitui a anterior.
  await customerReacts('❤️')
  await expect(customerChip('❤️')).toBeVisible()
  await expect(customerChip('👍')).toHaveCount(0)

  // A do celular do setor: sem apelido, aparece como "Setor, pelo celular".
  await customerReacts('🙏', true)
  await expect(sectorChip(message, '🙏')).toContainText('Setor, pelo celular')
  await expect(customerChip('❤️')).toBeVisible()

  // A remoção pelo cliente apaga só a dele.
  await customerReacts('')
  await expect(customerChip('❤️')).toHaveCount(0)
  await expect(sectorChip(message, '🙏')).toBeVisible()

  await page.reload()
  await expect(sectorChip(message, '🙏')).toContainText('Setor, pelo celular')

  // Nem sino, nem aviso na tela, nem mudança na última mensagem do painel.
  await expect(bell).toHaveAccessibleName('Notificações')
  expect((await toasts()).filter((text) => !text.includes('Chamado assumido'))).toEqual([])
  const preview = page
    .getByRole('navigation', { name: 'Meus chamados' })
    .getByRole('link', { name: /Clara Cliente/ })
  await expect(preview).toContainText(received)
  await expect(preview).not.toContainText('🙏')
})

test('o responsável reage, troca e remove a reação, com a barra de 6 emojis e o seletor pelo "+"', async ({
  page,
  request,
  baseURL,
}) => {
  const { message, conversation, ticketId } = await openAssignedConversation(
    page,
    request,
    baseURL!,
  )
  const stored = async () => (await storedReactions(page, ticketId)).sector
  await expect(message.getByRole('button', { name: 'Reagir', exact: true })).toBeAttached()
  expect(await stored()).toBeNull()

  // Reage: os 6 emojis rápidos e o "+"; a etiqueta mostra o apelido de quem reagiu.
  const bar = await openReactionBar(page, message)
  for (const emoji of ['👍', '❤️', '😂', '😮', '😢', '🙏']) {
    await expect(bar.getByRole('button', { name: `Reagir com ${emoji}` })).toBeVisible()
  }
  await expect(bar.getByRole('button', { name: 'Mais emojis' })).toBeVisible()
  await bar.getByRole('button', { name: 'Reagir com 👍' }).click()
  await expect(bar).toHaveCount(0)
  await expect(sectorChip(message, '👍')).toContainText(/agent \d+/)
  await expect.poll(async () => (await stored())?.emoji).toBe('👍')
  expect((await stored())?.viaPhone).toBe(false)
  expect((await stored())?.by).toMatchObject({ name: expect.stringMatching(/^agent \d+$/) })

  // Continua depois de recarregar.
  await page.reload()
  await expect(sectorChip(message, '👍')).toBeVisible()

  // Troca: a reação atual vem marcada, e outro emoji a substitui.
  const swap = await openReactionBar(page, message)
  await expect(swap.getByRole('button', { name: 'Remover reação 👍' })).toBeVisible()
  await swap.getByRole('button', { name: 'Reagir com ❤️' }).click()
  await expect(sectorChip(message, '❤️')).toBeVisible()
  await expect(message.getByRole('listitem', { name: /^Setor reagiu com 👍/ })).toHaveCount(0)
  await expect.poll(async () => (await stored())?.emoji).toBe('❤️')

  // Qualquer emoji pelo "+": o mesmo seletor do campo de mensagem, com busca.
  const more = await openReactionBar(page, message)
  await more.getByRole('button', { name: 'Mais emojis' }).click()
  const search = page.getByRole('searchbox', { name: 'Buscar emoji' })
  await expect(search).toBeFocused()
  await search.fill('foguete')
  await page.getByLabel('Emojis').getByRole('button', { name: 'foguete', exact: true }).click()
  await expect(sectorChip(message, '🚀')).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Buscar emoji' })).toHaveCount(0)
  await expect.poll(async () => (await stored())?.emoji).toBe('🚀')

  // Tocar no emoji atual remove, também pelo seletor completo.
  const remove = await openReactionBar(page, message)
  await expect(remove.getByRole('button', { name: /^Remover reação/ })).toHaveCount(0)
  await remove.getByRole('button', { name: 'Mais emojis' }).click()
  await page.getByRole('searchbox', { name: 'Buscar emoji' }).fill('foguete')
  await page.getByLabel('Emojis').getByRole('button', { name: 'foguete', exact: true }).click()
  await expect(message.getByRole('listitem', { name: /^Setor reagiu/ })).toHaveCount(0)
  await expect.poll(stored).toBeNull()

  // Reagir de novo e remover pelo emoji marcado da barra.
  const again = await openReactionBar(page, message)
  await again.getByRole('button', { name: 'Reagir com 😂' }).click()
  await expect(sectorChip(message, '😂')).toBeVisible()
  const last = await openReactionBar(page, message)
  await last.getByRole('button', { name: 'Remover reação 😂' }).click()
  await expect(message.getByRole('listitem', { name: /^Setor reagiu/ })).toHaveCount(0)
  await expect.poll(stored).toBeNull()

  // Mensagem enviada pelo setor, já com identificador, também aceita reação.
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Já estou vendo')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  const sent = conversation
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Já estou vendo' })
  await expect(sent).toContainText('Enviada')
  const onSent = await openReactionBar(page, sent)
  await onSent.getByRole('button', { name: 'Reagir com 🙏' }).click()
  await expect(sectorChip(sent, '🙏')).toContainText(/agent \d+/)
})

test('falha no envio desfaz a reação na tela e avisa, sem nova tentativa', async ({
  page,
  request,
  baseURL,
}) => {
  const { message, sector, ticketId } = await openAssignedConversation(page, request, baseURL!)
  const stored = async () => (await storedReactions(page, ticketId)).sector?.emoji ?? null

  // Sem reação antes: a escolha some da tela e aparece o aviso.
  await simulateMessaging(request, sector.id, 'fail-next-reaction')
  const first = await openReactionBar(page, message)
  await first.getByRole('button', { name: 'Reagir com 👍' }).click()
  await expect(page.getByText('O WhatsApp não aceitou a reação. Tente novamente.')).toBeVisible()
  await expect(message.getByRole('listitem', { name: /^Setor reagiu/ })).toHaveCount(0)
  expect(await stored()).toBeNull()

  // Com reação antes: volta a anterior.
  const set = await openReactionBar(page, message)
  await set.getByRole('button', { name: 'Reagir com ❤️' }).click()
  await expect(sectorChip(message, '❤️')).toBeVisible()
  await expect.poll(stored).toBe('❤️')
  await simulateMessaging(request, sector.id, 'fail-next-reaction')
  const swap = await openReactionBar(page, message)
  await swap.getByRole('button', { name: 'Reagir com 😮' }).click()
  await expect(
    page.getByText('O WhatsApp não aceitou a reação. Tente novamente.').first(),
  ).toBeVisible()
  await expect(sectorChip(message, '❤️')).toBeVisible()
  await expect(message.getByRole('listitem', { name: /^Setor reagiu com 😮/ })).toHaveCount(0)

  // E a remoção que falha também volta: a reação continua na tela e no servidor.
  await simulateMessaging(request, sector.id, 'fail-next-reaction')
  const remove = await openReactionBar(page, message)
  await remove.getByRole('button', { name: 'Remover reação ❤️' }).click()
  await expect(
    page.getByText('O WhatsApp não aceitou a reação. Tente novamente.').first(),
  ).toBeVisible()
  await expect(sectorChip(message, '❤️')).toBeVisible()
  expect(await stored()).toBe('❤️')
  await page.reload()
  await expect(sectorChip(message, '❤️')).toBeVisible()
})

test('quem não é o responsável e o chamado encerrado veem as reações sem poder reagir', async ({
  browser,
  page,
  request,
  baseURL,
}) => {
  const { message, customerReacts, supervisor, ticketId, sector } = await openAssignedConversation(
    page,
    request,
    baseURL!,
  )
  const reacting = await openReactionBar(page, message)
  await reacting.getByRole('button', { name: 'Reagir com 🙏' }).click()
  await expect(sectorChip(message, '🙏')).toBeVisible()
  await customerReacts('👍')
  await expect(message.getByRole('listitem', { name: 'Cliente reagiu com 👍' })).toBeVisible()

  // Supervisor que não é o responsável: vê as duas reações, sem botão de reagir.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await other.goto(page.url())
  const otherMessage = other
    .getByRole('region', { name: 'Conversa', exact: true })
    .getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(otherMessage.getByRole('listitem', { name: 'Cliente reagiu com 👍' })).toBeVisible()
  await expect(sectorChip(otherMessage, '🙏')).toContainText(/agent \d+/)
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await expect(other.getByRole('button', { name: 'Reagir', exact: true })).toHaveCount(0)
  // A troca do cliente chega a quem acompanha, sem recarregar.
  await customerReacts('❤️')
  await expect(otherMessage.getByRole('listitem', { name: 'Cliente reagiu com ❤️' })).toBeVisible()
  await otherContext.close()

  // Mensagem que falhou não oferece reagir; a recebida do mesmo chamado continua oferecendo.
  await request.post(`/api/test/messaging/sectors/${sector.id}/drop`)
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Esta vai falhar')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  const failed = page
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Esta vai falhar' })
  await expect(failed).toContainText('Falhou')
  await failed.hover()
  await expect(failed.getByRole('button', { name: 'Reagir', exact: true })).toHaveCount(0)
  await expect(message.getByRole('button', { name: 'Reagir', exact: true })).toBeAttached()

  // Chamado encerrado (aqui, cancelado): a ficha só leitura mostra as reações e não oferece reagir.
  const cancel = await page.request.post(`/api/tickets/${ticketId}/cancel`, {
    data: { reason: 'Engano.' },
  })
  expect(cancel.ok()).toBeTruthy()
  // Pelo histórico: a linha do chamado em Atendimentos abre a ficha.
  await page.goto('/atendimentos')
  await page
    .getByRole('row', { name: /Clara Cliente/ })
    .getByRole('cell', { name: 'Cancelado' })
    .click({ force: true })
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ticketId}$`))
  const closed = page
    .getByRole('region', { name: 'Conversa', exact: true })
    .getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(closed.getByRole('listitem', { name: 'Cliente reagiu com ❤️' })).toBeVisible()
  await expect(sectorChip(closed, '🙏')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reagir', exact: true })).toHaveCount(0)
  // O mesmo endereço do chamado encerrado leva ao atendimento: a reação não pode ser trocada.
  await page.goto(`/chamados/${ticketId}`)
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ticketId}$`))
  await expect(page.getByRole('button', { name: 'Reagir', exact: true })).toHaveCount(0)
  // A API também recusa: o responsável de antes não reage a chamado encerrado.
  const target = (await listMessages(page, ticketId)).find((m) => m.body === received)!
  const refused = await page.request.put(`/api/messages/${target.id}/reaction`, {
    data: { emoji: '👍' },
  })
  expect(refused.ok()).toBeFalsy()
})

test('teclado e leitor de tela: botão, barra, "+", seletor, reação e quem reagiu têm nome', async ({
  page,
  request,
  baseURL,
}) => {
  const { message, customerReacts } = await openAssignedConversation(page, request, baseURL!)
  await customerReacts('👍')
  const customer = message.getByRole('listitem', { name: 'Cliente reagiu com 👍' })
  await expect(customer).toBeVisible()

  // Só com o teclado: foca o botão ao lado do balão, abre a barra, escolhe e volta o foco.
  const trigger = message.getByRole('button', { name: 'Reagir', exact: true })
  await trigger.focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await expect(trigger).toBeFocused()
  await expect(trigger).toHaveCSS('opacity', '1')
  await page.keyboard.press('Enter')
  const bar = page.getByRole('group', { name: 'Reagir à mensagem' })
  await expect(bar).toBeVisible()
  const quick = bar.getByRole('button')
  await expect(quick).toHaveCount(7)
  await expect(quick.nth(0)).toBeFocused()
  await expect(quick.nth(0)).toHaveAccessibleName('Reagir com 👍')
  await expect(quick.nth(6)).toHaveAccessibleName('Mais emojis')
  await page.keyboard.press('Escape')
  await expect(bar).toHaveCount(0)
  await expect(trigger).toBeFocused()

  // Do "+" ao seletor completo, também pelo teclado.
  await page.keyboard.press('Enter')
  await bar.getByRole('button', { name: 'Mais emojis' }).focus()
  await page.keyboard.press('Enter')
  const search = page.getByRole('searchbox', { name: 'Buscar emoji' })
  await expect(search).toBeFocused()
  await search.fill('coração vermelho')
  await page.keyboard.press('Enter')
  const mine = sectorChip(message, '❤️')
  await expect(mine).toBeVisible()
  await expect(mine).toHaveAccessibleName(/^Setor reagiu com ❤️, agent \d+$/)
  await expect(customer).toHaveAccessibleName('Cliente reagiu com 👍')
  await expect(message.getByRole('list', { name: 'Reações' })).toBeVisible()
})

// O cartão de contato de João Silva, nos dois sentidos.
const joaoCard = {
  name: 'João Silva',
  organization: 'Prefeitura de Itu',
  phones: [{ phone: '5511988881234', whatsAppId: '5511988881234' }],
}

// Setor conectado e pareado, com um cartão de contato recebido do cliente, no chamado assumido.
// Devolve o identificador externo do cartão, para a reação do cliente chegar pela rota de teste.
async function openCardConversation(page: Page, request: APIRequestContext, baseURL: string) {
  const seed = await seedSector(baseURL)
  await connectSector(baseURL, seed.sector.id)
  await simulateMessaging(request, seed.sector.id, 'pair')
  const { phone, id } = unique()
  const externalId = `E2E-REACT-CARD-${id}`
  await simulateMessaging(request, seed.sector.id, 'receive', {
    externalMessageId: externalId,
    phone,
    contactName: 'Clara Cartão',
    type: 'contact',
    contactCards: [joaoCard],
  })
  await signIn(page, seed.agent, userPassword)
  await openQueued(page, 'Clara Cartão')
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const card = conversation
    .getByRole('listitem', { name: 'Mensagem recebida' })
    .filter({ has: page.getByRole('group', { name: /^Contato: João Silva,/ }) })
  return { ...seed, conversation, card, externalId, phone }
}

// As reações guardadas no cartão, como a API as entrega.
async function cardReactions(page: Page, ticketId: number) {
  const messages = await json<ApiMessage[]>(
    await page.request.get(`/api/tickets/${ticketId}/messages`),
  )
  const card = messages.find(
    (message) => message.type === 'contact' && message.direction === 'inbound',
  )
  expect(card).toBeTruthy()
  return card!.reactions
}

test('reação ao cartão de contato, recebido e enviado, e a do cliente embaixo do cartão', async ({
  page,
  request,
  baseURL,
}) => {
  const { conversation, card, externalId, phone, sector, agent } = await openCardConversation(
    page,
    request,
    baseURL!,
  )
  const ticketId = Number(new URL(page.url()).pathname.split('/').pop())
  await expect(card).toBeVisible()

  // A reação do cliente ao cartão aparece embaixo dele, como nas outras mensagens.
  await simulateMessaging(request, sector.id, 'react', {
    targetExternalMessageId: externalId,
    phone,
    emoji: '❤️',
  })
  await expect(card.getByRole('listitem', { name: 'Cliente reagiu com ❤️' })).toBeVisible()
  await expect.poll(async () => (await cardReactions(page, ticketId)).customer?.emoji).toBe('❤️')

  // O responsável reage ao cartão recebido pela barra de reações.
  const onReceived = await openReactionBar(page, card)
  await onReceived.getByRole('button', { name: 'Reagir com 👍' }).click()
  await expect(sectorChip(card, '👍')).toContainText(/agent \d+/)
  await expect.poll(async () => (await cardReactions(page, ticketId)).sector?.emoji).toBe('👍')

  // Um cartão enviado pelo setor, já com o identificador do WhatsApp, também aceita reação.
  const name = `Rita ${unique().id}`
  const { id: contactId } = await seedContact(baseURL!, sector.id, name, unique().phone)
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  ok(
    await api.post(`/api/tickets/${ticketId}/messages/contact`, {
      data: { contactId, clientRequestId: crypto.randomUUID() },
    }),
  )
  await api.dispose()

  await page.reload()
  const sent = conversation
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ has: page.getByRole('group', { name: new RegExp(`^Contato: ${name},`) }) })
  await expect(sent).toContainText('Enviada')
  const onSent = await openReactionBar(page, sent)
  await onSent.getByRole('button', { name: 'Reagir com 🙏' }).click()
  await expect(sectorChip(sent, '🙏')).toBeVisible()

  // A reação ficou gravada no cartão enviado, sem virar outra mensagem.
  const stored = await json<ApiMessage[]>(
    await page.request.get(`/api/tickets/${ticketId}/messages`),
  )
  const sentCard = stored.find(
    (message) => message.type === 'contact' && message.direction === 'outbound',
  )
  expect(sentCard?.reactions.sector?.emoji).toBe('🙏')
  await expect(conversation.getByRole('listitem', { name: 'Mensagem enviada' })).toHaveCount(1)
})
