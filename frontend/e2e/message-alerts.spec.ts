import {
  expect,
  request as apiRequest,
  type APIRequestContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test'
import {
  admin,
  openWhenLive,
  seedSector,
  signIn,
  test,
  trackSocket,
  unique,
  userPassword,
} from './fixtures'

declare global {
  interface Window {
    __alerts: {
      notifications: { title: string; body?: string; tag?: string; instance: Notification }[]
      beeps: number
      focuses: number
    }
  }
}

// O headless shell, padrão do Playwright, responde sempre "denied" em Notification.permission,
// mesmo com a permissão concedida. O Chromium completo respeita a permissão.
test.use({ channel: 'chromium' })

// Mensagem do cliente pelo adaptador falso. O mesmo telefone é sempre o mesmo chamado.
async function receive(
  request: APIRequestContext,
  sectorId: number,
  phone: string,
  contactName: string,
  body: string,
) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
    data: { externalMessageId: `E2E-${unique().id}`, phone, contactName, body },
  })
  expect(response.ok()).toBeTruthy()
}

async function connectedSector(baseURL: string, request: APIRequestContext) {
  const seed = await seedSector(baseURL)
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${seed.sector.id}/connection`)).ok()).toBeTruthy()
  await api.dispose()
  expect(
    (await request.post(`/api/test/messaging/sectors/${seed.sector.id}/pair`)).ok(),
  ).toBeTruthy()
  return seed
}

// A ordem importa: o socket é instrumentado antes de qualquer navegação, e a tela só é usada
// depois que a fila carregou e o socket abriu.
async function signInWhenLive(page: Page, email: string, password: string, sectorId: number) {
  await trackSocket(page)
  await signIn(page, email, password)
  await openWhenLive(page, sectorId)
}

// Registra as notificações, o som e o foco, e deixa o teste dizer se a aba está em segundo plano.
async function spyOnAlerts(page: Page) {
  await page.addInitScript(() => {
    window.__alerts = { notifications: [], beeps: 0, focuses: 0 }
    const Real = window.Notification
    class Spy extends Real {
      constructor(title: string, options?: NotificationOptions) {
        super(title, options)
        window.__alerts.notifications.push({
          title,
          body: options?.body,
          tag: options?.tag,
          instance: this,
        })
      }
    }
    window.Notification = Spy
    const start = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (when?: number) {
      window.__alerts.beeps++
      start.call(this, when)
    }
    const focus = window.focus
    window.focus = () => {
      window.__alerts.focuses++
      focus.call(window)
    }
    Object.defineProperty(document, 'visibilityState', {
      get: () => (sessionStorage.getItem('test-hidden') ? 'hidden' : 'visible'),
    })
  })
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    if (value) {
      sessionStorage.setItem('test-hidden', '1')
    } else {
      sessionStorage.removeItem('test-hidden')
    }
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

const notified = (page: Page) =>
  page.evaluate(() => window.__alerts.notifications.map((n) => n.body))
const beeps = (page: Page) => page.evaluate(() => window.__alerts.beeps)

async function setOption(page: Page, name: string, checked: boolean) {
  await page.getByRole('button', { name: 'Configurações' }).click()
  const option = page.getByRole('menuitemcheckbox', { name })
  if ((await option.getAttribute('aria-checked')) !== String(checked)) {
    await option.click()
  }
  await expect(option).toHaveAttribute('aria-checked', String(checked))
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
}

const browserOption = 'Notificação do navegador'
const soundOption = 'Som'

// Item de um contato em "Meus chamados".
function mineItem(page: Page, contactName: string) {
  return page
    .getByRole('navigation', { name: 'Meus chamados' })
    .getByRole('link')
    .filter({ hasText: contactName })
}

async function assume(page: Page, contactName: string) {
  await page.getByRole('button', { name: `Assumir chamado de ${contactName}` }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  return Number(new URL(page.url()).pathname.split('/').pop())
}

async function backToList(page: Page) {
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await expect(page).toHaveURL(/\/chamados$/)
}

const readCall = (page: Page, ticketId: number) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === `/api/tickets/${ticketId}/read`,
  )

// A interação com a página é o que libera o som no navegador.
async function allowSound(page: Page) {
  await page.locator('body').click({ position: { x: 1, y: 1 } })
}

test('mensagem num chamado meu toca o som e, com a aba em segundo plano, notifica só o nome', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  const contactName = 'Cliente da mensagem'
  const phone = unique().phone
  await receive(request, sector.id, phone, contactName, 'Primeira mensagem')
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  await signInWhenLive(page, agent, userPassword, sector.id)
  await setOption(page, soundOption, true)
  await setOption(page, browserOption, true)
  const ticketId = await assume(page, contactName)
  await backToList(page)

  // Aba visível: toca o som, sem notificação.
  await receive(request, sector.id, phone, contactName, 'Chegou com a aba visível')
  await expect.poll(() => beeps(page)).toBe(1)
  expect(await notified(page)).toEqual([])

  // Aba em segundo plano: notifica com o nome do contato, sem o texto da mensagem.
  await setHidden(page, true)
  await receive(request, sector.id, phone, contactName, 'Texto sigiloso da mensagem nova')
  await expect.poll(() => notified(page)).toEqual([contactName])
  expect(await beeps(page)).toBe(2)
  const shown = await page.evaluate(() => {
    const { title, body } = window.__alerts.notifications[0]
    return { title, body: body ?? '' }
  })
  expect(shown.title).toBe('Mensagem nova')
  expect(shown.body).toBe(contactName)
  expect(JSON.stringify(shown)).not.toContain('sigiloso')

  await page.evaluate(() =>
    window.__alerts.notifications[0].instance.dispatchEvent(new Event('click')),
  )
  await expect(page).toHaveURL(new RegExp(`/chamados/${ticketId}$`))
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
})

test('chamado aberto com a aba visível não toca nem notifica', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  const contactName = 'Cliente aberto'
  const phone = unique().phone
  await receive(request, sector.id, phone, contactName, 'Primeira mensagem')
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  await signInWhenLive(page, agent, userPassword, sector.id)
  await setOption(page, soundOption, true)
  await setOption(page, browserOption, true)
  const ticketId = await assume(page, contactName)

  // A tela marca como lido ao receber a mensagem com o chamado aberto e visível.
  const read = readCall(page, ticketId)
  await receive(request, sector.id, phone, contactName, 'Chegou agora')
  await read
  await expect(page.getByTestId('unread-count')).toHaveCount(0)
  expect(await beeps(page)).toBe(0)
  expect(await notified(page)).toEqual([])
})

test('opções desligadas não tocam nem notificam', async ({ page, context, request, baseURL }) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  const contactName = 'Cliente silencioso'
  const phone = unique().phone
  await receive(request, sector.id, phone, contactName, 'Primeira mensagem')
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  await signInWhenLive(page, agent, userPassword, sector.id)
  await assume(page, contactName)
  await backToList(page)

  // O contador prova que a carga foi comparada; sem as opções, o único efeito é visual.
  await receive(request, sector.id, phone, contactName, 'Chegou desligado')
  await expect(mineItem(page, contactName).getByTestId('unread-count')).toHaveText('1')
  expect(await beeps(page)).toBe(0)
  expect(await notified(page)).toEqual([])

  await setOption(page, soundOption, true)
  await setOption(page, browserOption, true)
  await setHidden(page, true)
  await receive(request, sector.id, phone, contactName, 'Chegou ligado')
  await expect.poll(() => notified(page)).toEqual([contactName])
  expect(await beeps(page)).toBe(1)
})

test('duas abas dão um só som e uma só notificação, e mensagens seguidas alertam duas vezes', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  const contactName = 'Cliente em duas abas'
  const phone = unique().phone
  await receive(request, sector.id, phone, contactName, 'Primeira mensagem')
  await context.grantPermissions(['notifications'])
  await context.addInitScript(() => {
    localStorage.setItem('alerts.browser', 'on')
    localStorage.setItem('alerts.sound', 'on')
  })
  await spyOnAlerts(page)
  await trackSocket(page)
  await signIn(page, agent, userPassword)
  const other = await context.newPage()
  await spyOnAlerts(other)
  await trackSocket(other)
  await openWhenLive(page, sector.id, '/chamados')
  await openWhenLive(other, sector.id, '/chamados')
  await assume(page, contactName)
  await backToList(page)
  await allowSound(page)
  await allowSound(other)

  const allNotified = async () => [...(await notified(page)), ...(await notified(other))]
  const allBeeps = async () => (await beeps(page)) + (await beeps(other))

  await setHidden(page, true)
  await setHidden(other, true)

  await receive(request, sector.id, phone, contactName, 'Uma mensagem')
  await expect.poll(allBeeps).toBe(1)
  await expect.poll(async () => (await allNotified()).length).toBe(1)

  // Segunda mensagem no mesmo chamado: outra chave de reserva, outro alerta.
  await receive(request, sector.id, phone, contactName, 'Outra mensagem')
  await expect.poll(allBeeps).toBe(2)
  await expect.poll(async () => (await allNotified()).length).toBe(2)
  expect(await allNotified()).toEqual([contactName, contactName])
})

test('mensagem que chega logo depois de ler o chamado ainda alerta', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  const contactName = 'Cliente logo depois da leitura'
  const phone = unique().phone
  await receive(request, sector.id, phone, contactName, 'Primeira mensagem')
  await context.grantPermissions(['notifications'])
  await context.addInitScript(() => {
    localStorage.setItem('alerts.browser', 'on')
    localStorage.setItem('alerts.sound', 'on')
  })
  await spyOnAlerts(page)
  await signInWhenLive(page, agent, userPassword, sector.id)
  const ticketId = await assume(page, contactName)
  await backToList(page)
  await allowSound(page)
  await setHidden(page, true)

  // A primeira mensagem alerta e deixa a reserva do chamado guardada por 10 s.
  await receive(request, sector.id, phone, contactName, 'Mensagem que alerta')
  await expect.poll(() => beeps(page)).toBe(1)
  await expect.poll(() => notified(page)).toEqual([contactName])

  // A pessoa volta à aba, lê o chamado (as não lidas voltam a zero) e a aba fica em segundo plano.
  const startedAt = Date.now()
  await setHidden(page, false)
  const read = readCall(page, ticketId)
  await mineItem(page, contactName).click()
  await read
  await backToList(page)
  await expect(mineItem(page, contactName).getByTestId('unread-count')).toHaveCount(0)
  await setHidden(page, true)

  // Outra mensagem chega dentro da reserva, com a mesma quantidade de não lidas (1). A mensagem é
  // outra: precisa alertar de novo, e não ser confundida com a que a pessoa já leu.
  await receive(request, sector.id, phone, contactName, 'Chegou depois da leitura')
  await expect.poll(() => beeps(page)).toBe(2)
  await expect.poll(async () => (await notified(page)).length).toBe(2)
  // Se o caminho todo passasse de 10 s, a reserva teria vencido e o teste não provaria o caso.
  expect(Date.now() - startedAt).toBeLessThan(10_000)
})

test('recarregar e reconectar não alertam das não lidas que já existiam', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  const contactName = 'Cliente que espera'
  const phone = unique().phone
  await receive(request, sector.id, phone, contactName, 'Primeira mensagem')
  await context.grantPermissions(['notifications'])
  await context.addInitScript(() => {
    localStorage.setItem('alerts.browser', 'on')
    localStorage.setItem('alerts.sound', 'on')
  })
  await spyOnAlerts(page)
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/api\/ws$/, (ws) => {
    sockets.push(ws)
    ws.connectToServer()
  })
  await trackSocket(page)
  await signIn(page, agent, userPassword)
  await openWhenLive(page, sector.id)
  await assume(page, contactName)
  await backToList(page)
  await allowSound(page)
  await setHidden(page, true)

  await receive(request, sector.id, phone, contactName, 'Mensagem que alerta')
  await expect.poll(() => beeps(page)).toBe(1)
  await expect.poll(() => notified(page)).toEqual([contactName])

  // Recarregar zera os espiões: a mensagem seguinte prova que só ela alerta.
  await openWhenLive(page, sector.id)
  await expect(mineItem(page, contactName).getByTestId('unread-count')).toHaveText('1')
  await allowSound(page)
  await receive(request, sector.id, phone, contactName, 'Mensagem depois de recarregar')
  await expect.poll(() => beeps(page)).toBe(1)
  await expect.poll(() => notified(page)).toEqual([contactName])

  // Reconectar também não repete as não lidas que já estavam na lista.
  await expect.poll(() => sockets.length).toBeGreaterThan(0)
  const opened = sockets.length
  const refetched = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === `/api/sectors/${sector.id}/tickets`,
  )
  await sockets[opened - 1].close({ code: 1006 })
  await expect.poll(() => sockets.length, { timeout: 10_000 }).toBe(opened + 1)
  await (await refetched).finished()
  expect(await beeps(page)).toBe(1)
  expect(await notified(page)).toEqual([contactName])

  await receive(request, sector.id, phone, contactName, 'Mensagem depois de reconectar')
  await expect.poll(() => beeps(page)).toBe(2)
  await expect.poll(async () => (await notified(page)).length).toBe(2)
})

test('título da aba soma fila e não lidas, e abrir o chamado baixa o título', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  const queuedName = 'Cliente na fila'
  const mineName = 'Cliente meu'
  const queuedPhone = unique().phone
  const minePhone = unique().phone
  await receive(request, sector.id, queuedPhone, queuedName, 'Oi')
  await receive(request, sector.id, minePhone, mineName, 'Primeira mensagem')
  await signInWhenLive(page, agent, userPassword, sector.id)
  await expect(page).toHaveTitle('(2) Central de Atendimento')

  const ticketId = await assume(page, mineName)
  await expect(page).toHaveTitle('(1) Central de Atendimento')
  expect(ticketId).toBeGreaterThan(0)
  await backToList(page)

  await receive(request, sector.id, minePhone, mineName, 'Mensagem nova')
  await expect(page).toHaveTitle('(2) Central de Atendimento')

  const read = readCall(page, ticketId)
  await mineItem(page, mineName).click()
  await read
  await expect(page).toHaveTitle('(1) Central de Atendimento')
})

test('administrador responsável vê o contador, sem som, notificação nem soma no título', async ({
  page,
  context,
  request,
  baseURL,
  onlySectors,
}) => {
  const { sector } = await connectedSector(baseURL!, request)
  const contactName = 'Cliente do administrador'
  const phone = unique().phone
  await receive(request, sector.id, phone, contactName, 'Primeira mensagem')
  await context.grantPermissions(['notifications'])
  await page.addInitScript(() => {
    localStorage.setItem('alerts.browser', 'on')
    localStorage.setItem('alerts.sound', 'on')
  })
  await spyOnAlerts(page)
  await onlySectors(sector.id)
  await signInWhenLive(page, admin.email, admin.password, sector.id)
  await expect(page).toHaveTitle('Central de Atendimento')

  await assume(page, contactName)
  await backToList(page)
  await setHidden(page, true)
  await receive(request, sector.id, phone, contactName, 'Texto sigiloso')
  // O contador em "Meus chamados" aparece; a espera cobre o atraso da aba em segundo plano.
  await expect(mineItem(page, contactName).getByTestId('unread-count')).toHaveText('1')
  await page.waitForTimeout(1_500)
  expect(await beeps(page)).toBe(0)
  expect(await notified(page)).toEqual([])
  await expect(page).toHaveTitle('Central de Atendimento')

  // O sino não ganha item de mensagem: segue só com fila e número desconectado.
  await setHidden(page, false)
  await page
    .getByRole('banner')
    .getByRole('button', { name: /^Notificações/ })
    .click()
  const popover = page.getByRole('dialog')
  await expect(popover).toContainText('Nenhuma notificação.')
  await expect(popover.getByText(contactName)).toHaveCount(0)
})
