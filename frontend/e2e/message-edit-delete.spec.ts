import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test'
import { admin, json, openQueued, seedSector, signIn, unique, userPassword } from './fixtures'

// As capacidades do WhatsApp falso (prazos) valem para o processo todo: os testes deste arquivo, que
// as mudam, rodam um de cada vez.
test.describe.configure({ mode: 'serial' })

type ApiMessage = {
  id: number
  origin: string
  body: string | null
  editedAt: string | null
  deletion: { scope: 'everyone' | 'local'; origin: string } | null
  media: { id: number } | null
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

// Setor conectado e pareado, com uma mensagem do cliente na fila (dados fictícios).
async function seedCustomer(request: APIRequestContext, baseURL: string, contactName: string) {
  const seed = await seedSector(baseURL)
  await connectSector(baseURL, seed.sector.id)
  await phone(request, seed.sector.id, 'pair')
  const { phone: number, id } = unique()
  const customerMessageId = `E2E-EDIT-${id}`
  await phone(request, seed.sector.id, 'receive', {
    externalMessageId: customerMessageId,
    phone: number,
    contactName,
    body: 'Preciso do boleto de setembro',
  })
  return { ...seed, number, customerMessageId }
}

// Assume o chamado do cliente e devolve a conversa aberta.
async function openAssigned(page: Page, agent: string, contactName: string) {
  await signIn(page, agent, userPassword)
  await openQueued(page, contactName)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  return page.getByRole('region', { name: 'Conversa', exact: true })
}

const ticketIdOf = (page: Page) => Number(new URL(page.url()).pathname.split('/').pop())

const sentIn = (conversation: Locator) =>
  conversation.getByRole('listitem', { name: 'Mensagem enviada' })

// Envia um texto pelo compositor e devolve o balão e o identificador de envio, que dá o id da
// mensagem no WhatsApp falso (`fake-msg-<clientRequestId>`).
async function sendText(page: Page, conversation: Locator, text: string) {
  // O balão é achado pela posição: o texto muda com a edição.
  const position = await sentIn(conversation).count()
  const sending = page.waitForRequest(
    (req) => req.url().endsWith('/messages') && req.method() === 'POST',
  )
  await page.getByRole('textbox', { name: 'Mensagem' }).fill(text)
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  const { clientRequestId } = (await sending).postDataJSON() as { clientRequestId: string }
  const bubble = sentIn(conversation).nth(position)
  await expect(bubble).toContainText(text)
  await expect(bubble).toContainText('Enviada')
  return { bubble, externalId: `fake-msg-${clientRequestId}` }
}

async function openMenu(bubble: Locator) {
  await bubble.hover()
  await bubble.getByRole('button', { name: 'Ações da mensagem' }).click()
}

async function chooseInMenu(bubble: Locator, item: 'Editar' | 'Excluir') {
  await openMenu(bubble)
  await bubble.page().getByRole('menuitem', { name: item, exact: true }).click()
}

const listMessages = async (page: Page, ticketId: number) =>
  json<ApiMessage[]>(await page.request.get(`/api/tickets/${ticketId}/messages`))

const agentMessages = async (page: Page, ticketId: number) =>
  (await listMessages(page, ticketId)).filter((m) => m.origin === 'agent')

// Conta as chamadas de edição e exclusão que o navegador faz, para provar o que não chama a API.
function countChangeRequests(page: Page) {
  const calls: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/messages\/\d+\/(edit|delete)$/.test(req.url())) {
      calls.push(req.url())
    }
  })
  return calls
}

async function setCapabilities(request: APIRequestContext, data?: object) {
  expect((await request.post('/api/test/messaging/capabilities', { data })).ok()).toBeTruthy()
}

// Outra sessão do mesmo responsável, em outro navegador, aberta no mesmo chamado.
async function secondSession(browser: Browser, email: string, url: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, email, userPassword)
  await page.goto(url)
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toBeVisible()
  return { context, page, conversation }
}

test('responsável edita o texto enviado: a mesma mensagem muda nas duas sessões e depois de recarregar', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { agent, supervisor } = await seedCustomer(request, baseURL!, 'Clara Edita')
  const conversation = await openAssigned(page, agent, 'Clara Edita')
  const ticketId = ticketIdOf(page)
  const { bubble } = await sendText(page, conversation, 'Segue o boleto de setembro')
  const [before] = await agentMessages(page, ticketId)

  const other = await secondSession(browser, agent, page.url())
  await expect(other.conversation).toContainText('Segue o boleto de setembro')

  // O menu da mensagem oferece Editar e Excluir, e o botão Responder continua ao lado.
  await openMenu(bubble)
  await expect(page.getByRole('menuitem', { name: 'Editar', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Excluir', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(bubble.getByRole('button', { name: 'Responder', exact: true })).toBeVisible()

  // A faixa identifica a mensagem; o campo traz só o texto, sem o apelido.
  await chooseInMenu(bubble, 'Editar')
  const banner = page.getByRole('group', { name: 'Editando mensagem' })
  await expect(banner).toContainText('Editando')
  await expect(banner).toContainText('Segue o boleto de setembro')
  const field = page.getByRole('textbox', { name: 'Editar mensagem' })
  await expect(field).toHaveValue('Segue o boleto de setembro')
  await expect(field).toBeFocused()
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Salvar edição' })).toBeDisabled()

  await field.fill('Segue o boleto de outubro')
  await field.press('Enter')
  await expect(bubble).toContainText('Segue o boleto de outubro')
  await expect(bubble).toContainText('Editada')
  await expect(banner).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toBeFocused()
  await expect(sentIn(conversation)).toHaveCount(1)

  // A outra sessão recebe a edição sem recarregar.
  const otherBubble = sentIn(other.conversation)
  await expect(otherBubble).toContainText('Segue o boleto de outubro')
  await expect(otherBubble).toContainText('Editada')
  await expect(otherBubble).toHaveCount(1)

  // Mesma mensagem, mesmo apelido gravado no envio, horário original.
  const [after] = await agentMessages(page, ticketId)
  expect(after.id).toBe(before.id)
  expect(after.body).toMatch(/^\*agent \d+:\*\nSegue o boleto de outubro$/)
  expect(after.editedAt).not.toBeNull()
  await expect(bubble.locator('strong')).toHaveText(/agent \d+:/)

  await page.reload()
  await expect(bubble).toContainText('Segue o boleto de outubro')
  await expect(bubble).toContainText('Editada')
  await other.page.reload()
  await expect(sentIn(other.conversation)).toContainText('Editada')
  await other.context.close()

  // Quem não é o responsável vê a edição, mas não tem menu nem botão de responder.
  const watcher = await secondSession(browser, supervisor, page.url())
  const watched = sentIn(watcher.conversation)
  await expect(watched).toContainText('Segue o boleto de outubro')
  await watched.hover()
  await expect(watched.getByRole('button', { name: 'Ações da mensagem' })).toHaveCount(0)
  await expect(watched.getByRole('button', { name: 'Responder' })).toHaveCount(0)
  await watcher.context.close()
})

test('edição de anexo muda só a legenda e mantém o arquivo e o apelido', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent } = await seedCustomer(request, baseURL!, 'Caio Legenda')
  const conversation = await openAssigned(page, agent, 'Caio Legenda')
  const ticketId = ticketIdOf(page)

  await page.getByLabel('Arquivo para enviar').setInputFiles({
    name: 'balancete.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 balancete'),
  })
  await page.getByRole('textbox', { name: 'Legenda do arquivo' }).fill('Balancete de outubro')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  const file = sentIn(conversation).filter({ hasText: 'balancete.pdf' })
  await expect(file).toContainText('Enviada')
  const [before] = await agentMessages(page, ticketId)
  expect(before.media).not.toBeNull()

  await chooseInMenu(file, 'Editar')
  const field = page.getByRole('textbox', { name: 'Editar mensagem' })
  await expect(field).toHaveValue('Balancete de outubro')
  await expect(page.getByRole('group', { name: 'Editando mensagem' })).toContainText(
    'Balancete de outubro',
  )
  await expect(page.getByRole('button', { name: 'Anexar arquivo' })).toHaveCount(0)
  await field.fill('Balancete de novembro')
  await page.getByRole('button', { name: 'Salvar edição' }).click()

  await expect(file).toContainText('Balancete de novembro')
  await expect(file).toContainText('Editada')
  await expect(file.getByRole('link', { name: /balancete\.pdf/ })).toBeVisible()
  await expect(file.locator('strong')).toHaveText(/agent \d+:/)
  const [after] = await agentMessages(page, ticketId)
  expect(after.id).toBe(before.id)
  expect(after.media?.id).toBe(before.media?.id)
  expect(after.body).toMatch(/^\*agent \d+:\*\nBalancete de novembro$/)
})

test('cancelar a edição não chama a API e devolve o rascunho que já existia', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent } = await seedCustomer(request, baseURL!, 'Rita Rascunho')
  const conversation = await openAssigned(page, agent, 'Rita Rascunho')
  const ticketId = ticketIdOf(page)
  const { bubble } = await sendText(page, conversation, 'Primeira resposta')
  const calls = countChangeRequests(page)

  // Rascunho em andamento: texto e citação.
  const composer = page.getByRole('textbox', { name: 'Mensagem', exact: true })
  await composer.fill('Rascunho do atendente')
  await expect(composer).toHaveValue('Rascunho do atendente')

  await chooseInMenu(bubble, 'Editar')
  const banner = page.getByRole('group', { name: 'Editando mensagem' })
  await expect(banner).toContainText('Seu rascunho será recuperado ao cancelar ou salvar.')
  await expect(composer).toHaveCount(0)
  await banner.getByRole('button', { name: 'Cancelar' }).click()
  await expect(banner).toHaveCount(0)
  await expect(composer).toHaveValue('Rascunho do atendente')
  await expect(composer).toBeFocused()

  // Esc também cancela, pelo teclado.
  await chooseInMenu(bubble, 'Editar')
  const field = page.getByRole('textbox', { name: 'Editar mensagem' })
  await field.fill('Texto que não será salvo')
  await field.press('Escape')
  await expect(banner).toHaveCount(0)
  await expect(composer).toHaveValue('Rascunho do atendente')
  await expect(bubble).toContainText('Primeira resposta')

  expect(calls).toEqual([])
  const [message] = await agentMessages(page, ticketId)
  expect(message.editedAt).toBeNull()

  // Salvar também devolve o rascunho.
  await chooseInMenu(bubble, 'Editar')
  await page.getByRole('textbox', { name: 'Editar mensagem' }).fill('Primeira resposta corrigida')
  await page.getByRole('button', { name: 'Salvar edição' }).click()
  await expect(bubble).toContainText('Primeira resposta corrigida')
  await expect(composer).toHaveValue('Rascunho do atendente')
  expect(calls).toHaveLength(1)
})

test('falha na edição mantém a mensagem anterior e o texto editado, e a nova tentativa funciona', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, sector } = await seedCustomer(request, baseURL!, 'Fabi Falha')
  const conversation = await openAssigned(page, agent, 'Fabi Falha')
  const ticketId = ticketIdOf(page)
  const { bubble } = await sendText(page, conversation, 'Texto original')

  await chooseInMenu(bubble, 'Editar')
  const field = page.getByRole('textbox', { name: 'Editar mensagem' })
  await field.fill('Texto com erro de digitação')
  await phone(request, sector.id, 'fail-next-change', { result: 'refused' })
  await page.getByRole('button', { name: 'Salvar edição' }).click()

  await expect(page.getByRole('alert').filter({ hasText: 'O WhatsApp não aceitou' })).toContainText(
    'O WhatsApp não aceitou a alteração. Tente novamente.',
  )
  await expect(field).toHaveValue('Texto com erro de digitação')
  await expect(page.getByRole('group', { name: 'Editando mensagem' })).toBeVisible()
  await expect(bubble).toContainText('Texto original')
  await expect(bubble).not.toContainText('Editada')
  expect((await agentMessages(page, ticketId))[0].editedAt).toBeNull()

  // Resultado incerto: o aviso manda conferir a conversa; nada aparece como feito.
  await phone(request, sector.id, 'fail-next-change', { result: 'uncertain' })
  await page.getByRole('button', { name: 'Salvar edição' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível confirmar' }),
  ).toBeVisible()
  await expect(bubble).toContainText('Texto original')

  await field.fill('Texto corrigido')
  await page.getByRole('button', { name: 'Salvar edição' }).click()
  await expect(bubble).toContainText('Texto corrigido')
  await expect(bubble).toContainText('Editada')
  await expect(page.getByRole('group', { name: 'Editando mensagem' })).toHaveCount(0)
})

test('confirmação em andamento não pode ser duplicada', async ({ page, request, baseURL }) => {
  const { agent } = await seedCustomer(request, baseURL!, 'Duda Duplo')
  const conversation = await openAssigned(page, agent, 'Duda Duplo')
  const ticketId = ticketIdOf(page)
  const { bubble } = await sendText(page, conversation, 'Mensagem para confirmar')

  let calls = 0
  await page.route('**/api/messages/*/edit', async (route) => {
    calls++
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await route.continue()
  })
  await page.route('**/api/messages/*/delete', async (route) => {
    calls++
    await new Promise((resolve) => setTimeout(resolve, 1200))
    await route.continue()
  })

  await chooseInMenu(bubble, 'Editar')
  const field = page.getByRole('textbox', { name: 'Editar mensagem' })
  await field.fill('Mensagem confirmada uma vez')
  const save = page.getByRole('button', { name: 'Salvar edição' })
  await save.click()
  await expect(save).toBeDisabled()
  await field.press('Enter')
  await expect(bubble).toContainText('Editada')
  expect(calls).toBe(1)

  // Na exclusão: a janela não fecha nem repete enquanto confirma.
  calls = 0
  await chooseInMenu(bubble, 'Excluir')
  const dialog = page.getByRole('dialog', { name: 'Excluir mensagem' })
  await dialog.getByRole('button', { name: 'Excluir para mim' }).click()
  await expect(dialog.getByRole('button', { name: 'Excluindo…' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Excluir para todos' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveCount(0)
  expect(calls).toBe(1)
  expect((await agentMessages(page, ticketId))[0].deletion?.scope).toBe('local')
})

test('prazo: depois de 15 minutos o menu explica e não oferece editar; o servidor recusa o prazo que expira entre abrir e confirmar', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent } = await seedCustomer(request, baseURL!, 'Paulo Prazo')
  const conversation = await openAssigned(page, agent, 'Paulo Prazo')
  const { bubble } = await sendText(page, conversation, 'Mensagem do prazo')

  // Prazo expirado na tela (o servidor confere de novo com o relógio dele).
  await page.clock.setFixedTime(Date.now() + 16 * 60 * 1000)
  await openMenu(bubble)
  await expect(page.getByRole('menuitem', { name: 'Editar', exact: true })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Excluir', exact: true })).toBeVisible()
  await expect(page.getByRole('menu')).toContainText('Prazo de edição encerrado.')
  await page.keyboard.press('Escape')
  await page.clock.setFixedTime(Date.now())

  // Prazo que expira depois de a edição abrir: o servidor recusa e o texto fica para outra via.
  try {
    await setCapabilities(request, {
      editWindowSeconds: 3,
      revokeWindowSeconds: 172800,
      receivesChanges: true,
    })
    const second = await sendText(page, conversation, 'Mensagem que expira')
    await chooseInMenu(second.bubble, 'Editar')
    const field = page.getByRole('textbox', { name: 'Editar mensagem' })
    await field.fill('Texto que chegou tarde')
    await page.waitForTimeout(3500)
    await page.getByRole('button', { name: 'Salvar edição' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'O prazo para editar' })).toContainText(
      'O prazo para editar esta mensagem terminou.',
    )
    await expect(field).toHaveValue('Texto que chegou tarde')
    await expect(second.bubble).toContainText('Mensagem que expira')
    await expect(second.bubble).not.toContainText('Editada')
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
    await expect(page.getByRole('group', { name: 'Editando mensagem' })).toHaveCount(0)
  } finally {
    await setCapabilities(request)
  }
})

test('indisponibilidade: mensagem do cliente, em envio e com falha não oferecem as ações que não cabem', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, sector } = await seedCustomer(request, baseURL!, 'Isa Indisponível')
  const conversation = await openAssigned(page, agent, 'Isa Indisponível')

  // Mensagem do cliente: nada de menu.
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
  await received.hover()
  await expect(received.getByRole('button', { name: 'Ações da mensagem' })).toHaveCount(0)

  // Em envio: o menu só explica.
  await phone(request, sector.id, 'hold')
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Mensagem em envio')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  const sending = sentIn(conversation).nth(0)
  await expect(sending).toContainText('Enviando')
  await openMenu(sending)
  await expect(page.getByRole('menuitem')).toHaveCount(0)
  await expect(page.getByRole('menu')).toContainText(
    'Mensagem em envio. Edição e exclusão indisponíveis.',
  )
  await page.keyboard.press('Escape')
  await phone(request, sector.id, 'release')
  await expect(sending).toContainText('Enviada')

  // Com falha: só excluir para mim.
  await phone(request, sector.id, 'drop')
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Mensagem que falha')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  const failed = sentIn(conversation).nth(1)
  await expect(failed).toContainText('Falhou')
  await openMenu(failed)
  await expect(page.getByRole('menuitem', { name: 'Editar', exact: true })).toHaveCount(0)
  await expect(page.getByRole('menu')).toContainText(
    'Mensagem com falha só pode ser excluída para mim.',
  )
  await page.getByRole('menuitem', { name: 'Excluir', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Excluir mensagem' })
  await expect(dialog.getByRole('button', { name: 'Excluir para todos' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Excluir para mim' }).click()
  await expect(failed).toContainText('Mensagem excluída no XET')
  await expect(failed.getByRole('button', { name: 'Reenviar' })).toHaveCount(0)
})

test('excluir para mim: cancelar não chama a API; confirmar oculta o conteúdo do setor, com aviso, e continua depois de recarregar', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { agent } = await seedCustomer(request, baseURL!, 'Lia Local')
  const conversation = await openAssigned(page, agent, 'Lia Local')
  const ticketId = ticketIdOf(page)
  const { bubble } = await sendText(page, conversation, 'Mensagem enviada por engano')
  const other = await secondSession(browser, agent, page.url())
  await expect(other.conversation).toContainText('Mensagem enviada por engano')
  const calls = countChangeRequests(page)

  await chooseInMenu(bubble, 'Excluir')
  const dialog = page.getByRole('dialog', { name: 'Excluir mensagem' })
  await expect(dialog).toContainText('Para todos: solicita a exclusão da mensagem no WhatsApp.')
  await expect(dialog).toContainText(
    'Para mim: oculta a mensagem para todo o setor no XET. O registro permanece em Atendimentos e pode continuar nos celulares e outros dispositivos.',
  )
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(bubble.getByRole('button', { name: 'Ações da mensagem' })).toBeFocused()
  expect(calls).toEqual([])
  await expect(bubble).toContainText('Mensagem enviada por engano')

  await chooseInMenu(bubble, 'Excluir')
  await dialog.getByRole('button', { name: 'Excluir para mim' }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls).toHaveLength(1)
  await expect(bubble).toContainText('Mensagem excluída no XET')
  await expect(conversation).not.toContainText('Mensagem enviada por engano')
  await bubble.hover()
  await expect(bubble.getByRole('button', { name: 'Ações da mensagem' })).toHaveCount(0)
  await expect(bubble.getByRole('button', { name: 'Responder' })).toHaveCount(0)
  // A lista Meus chamados não mostra o conteúdo ocultado.
  const preview = page
    .getByRole('navigation', { name: 'Meus chamados' })
    .getByRole('link', { name: /Lia Local/ })
  await expect(preview).toContainText('Mensagem excluída no XET')
  await expect(preview).not.toContainText('Mensagem enviada por engano')

  const [stored] = await agentMessages(page, ticketId)
  expect(stored.deletion).toMatchObject({ scope: 'local', origin: 'agent' })

  // A outra sessão vê o aviso sem recarregar, e a página recarregada o mantém.
  await expect(other.conversation).toContainText('Mensagem excluída no XET')
  await expect(other.conversation).not.toContainText('Mensagem enviada por engano')
  await page.reload()
  await expect(bubble).toContainText('Mensagem excluída no XET')
  await expect(conversation).not.toContainText('Mensagem enviada por engano')
  await other.context.close()
})

test('excluir para todos: falha mantém a janela e a mensagem; a nova tentativa oculta o conteúdo', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, sector } = await seedCustomer(request, baseURL!, 'Tati Todos')
  const conversation = await openAssigned(page, agent, 'Tati Todos')
  const ticketId = ticketIdOf(page)
  const { bubble } = await sendText(page, conversation, 'Mensagem para todos')

  await chooseInMenu(bubble, 'Excluir')
  const dialog = page.getByRole('dialog', { name: 'Excluir mensagem' })
  await phone(request, sector.id, 'fail-next-change', { result: 'refused' })
  await dialog.getByRole('button', { name: 'Excluir para todos' }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'O WhatsApp não aceitou a alteração. Tente novamente.',
  )
  await expect(dialog).toBeVisible()
  // Com a janela aberta o restante da página fica fora da árvore de acessibilidade.
  await expect(page.locator('li[id^="message-"]', { hasText: 'Mensagem para todos' })).toHaveCount(
    1,
  )
  expect((await agentMessages(page, ticketId))[0].deletion).toBeNull()

  await dialog.getByRole('button', { name: 'Excluir para todos' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(bubble).toContainText('Mensagem excluída no XET')
  await expect(conversation).not.toContainText('Mensagem para todos')
  expect((await agentMessages(page, ticketId))[0].deletion).toMatchObject({
    scope: 'everyone',
    origin: 'agent',
  })
})

test('prazo de excluir para todos: depois dele a janela só oferece excluir para mim', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent } = await seedCustomer(request, baseURL!, 'Vera Velha')
  const conversation = await openAssigned(page, agent, 'Vera Velha')
  const { bubble } = await sendText(page, conversation, 'Mensagem antiga')

  await page.clock.setFixedTime(Date.now() + 49 * 60 * 60 * 1000)
  await chooseInMenu(bubble, 'Excluir')
  const dialog = page.getByRole('dialog', { name: 'Excluir mensagem' })
  await expect(dialog).toContainText('Prazos de edição e de exclusão para todos encerrados.')
  await expect(dialog.getByRole('button', { name: 'Excluir para todos' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Excluir para mim' }).click()
  await expect(bubble).toContainText('Mensagem excluída no XET')
})

test('alterações do cliente e do celular do setor mostram o conteúdo conhecido com etiqueta', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent, sector, number, customerMessageId } = await seedCustomer(
    request,
    baseURL!,
    'Edu Externo',
  )
  const conversation = await openAssigned(page, agent, 'Edu Externo')
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })

  // O cliente edita a mensagem dele: o texto novo, com "Editada", sem novo balão.
  await phone(request, sector.id, 'edit', {
    targetExternalMessageId: customerMessageId,
    phone: number,
    body: 'Preciso do boleto de outubro',
  })
  await expect(received).toContainText('Preciso do boleto de outubro')
  await expect(received).toContainText('Editada')
  await expect(received).toHaveCount(1)

  // O cliente exclui: o conteúdo conhecido continua, com "Excluída".
  await phone(request, sector.id, 'revoke', {
    targetExternalMessageId: customerMessageId,
    phone: number,
  })
  await expect(received).toContainText('Excluída')
  await expect(received).toContainText('Preciso do boleto de outubro')
  await received.hover()
  await expect(received.getByRole('button', { name: 'Ações da mensagem' })).toHaveCount(0)

  // O celular do setor edita e depois exclui uma mensagem enviada pelo XET.
  const { bubble, externalId } = await sendText(page, conversation, 'Mensagem do setor')
  await phone(request, sector.id, 'edit', {
    targetExternalMessageId: externalId,
    phone: number,
    fromSector: true,
    body: 'Mensagem do setor, corrigida pelo celular',
  })
  await expect(bubble).toContainText('Mensagem do setor, corrigida pelo celular')
  await expect(bubble).toContainText('Editada')
  await phone(request, sector.id, 'revoke', {
    targetExternalMessageId: externalId,
    phone: number,
    fromSector: true,
  })
  await expect(bubble).toContainText('Excluída')
  await expect(bubble).toContainText('Mensagem do setor, corrigida pelo celular')
  await expect(bubble).not.toContainText('Mensagem excluída no XET')
  await bubble.hover()
  await expect(bubble.getByRole('button', { name: 'Ações da mensagem' })).toHaveCount(0)

  await page.reload()
  await expect(received).toContainText('Excluída')
  await expect(bubble).toContainText('Excluída')
})

test('teclado e foco: menu, edição e janela de exclusão funcionam sem o mouse e devolvem o foco', async ({
  page,
  request,
  baseURL,
}) => {
  const { agent } = await seedCustomer(request, baseURL!, 'Kátia Teclado')
  const conversation = await openAssigned(page, agent, 'Kátia Teclado')
  const { bubble } = await sendText(page, conversation, 'Mensagem pelo teclado')
  const trigger = bubble.getByRole('button', { name: 'Ações da mensagem' })

  await trigger.focus()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Editar', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  const field = page.getByRole('textbox', { name: 'Editar mensagem' })
  await expect(field).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toBeFocused()

  await trigger.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Excluir', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Excluir mensagem' })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

// Cor do texto e do fundo mais próximo que o pinta, para medir o contraste do elemento.
const contrastOf = (locator: Locator) =>
  locator.evaluate((element) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      return { r, g, b, a: a / 255 }
    }
    let background = { r: 255, g: 255, b: 255, a: 1 }
    for (let at: Element | null = element; at; at = at.parentElement) {
      const color = rgba(getComputedStyle(at).backgroundColor)
      if (color.a > 0.99) {
        background = color
        break
      }
    }
    const text = rgba(getComputedStyle(element).color)
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const [lr, lg, lb] = [r, g, b].map((value) => {
        const c = value / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
    }
    const [high, low] = [luminance(text), luminance(background)].sort((a, b) => b - a)
    return (high + 0.05) / (low + 0.05)
  })

const themes = [
  { name: 'claro', stored: {}, minimum: 4.5 },
  { name: 'escuro', stored: { theme: 'dark' }, minimum: 4.5 },
  { name: 'alto contraste', stored: { theme: 'light', contrast: 'high' }, minimum: 7 },
  { name: 'alto contraste escuro', stored: { theme: 'dark', contrast: 'high' }, minimum: 7 },
]

for (const { name, stored, minimum } of themes) {
  test(`temas: edição, etiqueta e aviso de exclusão legíveis no tema ${name}`, async ({
    page,
    request,
    baseURL,
  }, testInfo) => {
    await page.addInitScript((values) => {
      for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value)
    }, stored)
    const contactName = `Tema ${unique().id}`
    const { agent } = await seedCustomer(request, baseURL!, contactName)
    const conversation = await openAssigned(page, agent, contactName)
    const first = await sendText(page, conversation, 'Mensagem do tema')

    // Menu aberto.
    await openMenu(first.bubble)
    await expect(page.getByRole('menuitem', { name: 'Editar', exact: true })).toBeVisible()
    await testInfo.attach(`menu-${name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click()

    // Edição no compositor.
    const field = page.getByRole('textbox', { name: 'Editar mensagem' })
    await expect(field).toBeVisible()
    await testInfo.attach(`edicao-${name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    expect(
      await contrastOf(
        page.getByRole('group', { name: 'Editando mensagem' }).getByText('Editando'),
      ),
    ).toBeGreaterThanOrEqual(minimum)
    await field.fill('Mensagem do tema, editada')
    await page.getByRole('button', { name: 'Salvar edição' }).click()
    const label = first.bubble.getByText('· Editada')
    await expect(label).toBeVisible()
    expect(await contrastOf(label)).toBeGreaterThanOrEqual(minimum)

    // Janela de exclusão e aviso no lugar do conteúdo.
    await chooseInMenu(first.bubble, 'Excluir')
    const dialog = page.getByRole('dialog', { name: 'Excluir mensagem' })
    await expect(dialog).toBeVisible()
    await testInfo.attach(`exclusao-${name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await dialog.getByRole('button', { name: 'Excluir para mim' }).click()
    const notice = first.bubble.getByText('Mensagem excluída no XET')
    await expect(notice).toBeVisible()
    expect(await contrastOf(notice)).toBeGreaterThanOrEqual(minimum)
    await testInfo.attach(`aviso-${name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  })
}
