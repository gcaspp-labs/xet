import {
  expect,
  request as apiRequest,
  type APIRequestContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test'
import { admin, seedSector, signIn, test, unique, userPassword } from './fixtures'

declare global {
  interface Window {
    __alerts: {
      notifications: { title: string; body?: string; tag?: string; instance: Notification }[]
      beeps: number
      focuses: number
    }
    __requests: number
    __stored: Record<string, string | null>
  }
}

// O headless shell, padrão do Playwright, responde sempre "denied" em Notification.permission,
// mesmo com a permissão concedida. O Chromium completo respeita a permissão.
test.use({ channel: 'chromium' })

async function phone(request: APIRequestContext, sectorId: number, action: string, data?: object) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, { data })
  expect(response.ok()).toBeTruthy()
}

async function receive(request: APIRequestContext, sectorId: number, contactName: string) {
  await phone(request, sectorId, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName,
    body: `Texto sigiloso de ${contactName}`,
  })
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
  await phone(request, seed.sector.id, 'pair')
  return seed
}

// Registra as notificações, o som e o foco, e deixa o teste dizer se a aba está em segundo plano.
// O Playwright mantém as abas sempre visíveis, e a escolha sobrevive ao recarregar a página.
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

test('aba em segundo plano notifica só com o nome, aba visível não, e o clique abre a conversa', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setOption(page, browserOption, true)

  await receive(request, sector.id, 'Ana Visivel')
  await expect(page.getByText('Chamado recebido: Ana Visivel')).toBeVisible()

  await setHidden(page, true)
  await receive(request, sector.id, 'Bruno Oculto')
  // Quando a notificação de Bruno aparece, a de Ana, se existisse, já estaria na lista.
  await expect.poll(() => notified(page)).toEqual(['Bruno Oculto'])
  const shown = await page.evaluate(() => {
    const { title, body, tag } = window.__alerts.notifications[0]
    return { title, body, tag }
  })
  expect(shown.title).toBe('Chamado recebido')
  expect(JSON.stringify(shown)).not.toContain('sigiloso')

  await page.evaluate(() =>
    window.__alerts.notifications[0].instance.dispatchEvent(new Event('click')),
  )
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByRole('heading', { name: 'Bruno Oculto' })).toBeVisible()
  expect(await page.evaluate(() => window.__alerts.focuses)).toBe(1)
})

test('escolha sobrevive ao recarregar, e recarregar não notifica nem toca', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setOption(page, browserOption, true)
  await setOption(page, soundOption, true)
  await setHidden(page, true)
  await receive(request, sector.id, 'Caio Antes')
  await expect.poll(() => notified(page)).toEqual(['Caio Antes'])

  await page.reload()
  await expect(
    page.getByRole('banner').getByRole('button', { name: /^Notificações, 1/ }),
  ).toBeVisible()

  // O chamado seguinte prova que os alertas seguem ligados; o de Caio, se repetisse, estaria na lista.
  await receive(request, sector.id, 'Davi Depois')
  await expect.poll(() => notified(page)).toEqual(['Davi Depois'])

  await setHidden(page, false)
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: browserOption })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(page.getByRole('menuitemcheckbox', { name: soundOption })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('reconectar não notifica nem toca pelo que entrou durante a queda', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/api\/ws$/, (ws) => {
    sockets.push(ws)
    ws.connectToServer()
  })
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setOption(page, browserOption, true)
  await setOption(page, soundOption, true)
  await setHidden(page, true)
  await expect.poll(() => sockets.length).toBeGreaterThan(0)
  const opened = sockets.length

  await sockets[opened - 1].close({ code: 1006 })
  await receive(request, sector.id, 'Quim Durante')
  await expect.poll(() => sockets.length, { timeout: 10_000 }).toBe(opened + 1)
  await expect(page).toHaveTitle('(1) Central de Atendimento', { timeout: 30_000 })

  // O chamado seguinte prova que os alertas voltaram; o de Quim, se existisse, estaria na lista.
  await receive(request, sector.id, 'Rita Depois')
  await expect.poll(() => notified(page)).toEqual(['Rita Depois'])
  await expect.poll(() => beeps(page)).toBe(1)
})

test('opção desligada não notifica nem toca', async ({ page, context, request, baseURL }) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setHidden(page, true)

  // Desligadas desde o início: mesmo com a permissão concedida, o aviso na tela é o único efeito.
  await receive(request, sector.id, 'Elisa Desligada')
  await expect(page.getByText('Chamado recebido: Elisa Desligada')).toBeVisible()

  await setOption(page, browserOption, true)
  await setOption(page, soundOption, true)
  await receive(request, sector.id, 'Fabio Ligado')
  await expect.poll(() => notified(page)).toEqual(['Fabio Ligado'])
  await expect.poll(() => beeps(page)).toBe(1)

  // Desligadas de novo: o chamado de Gil não alerta, e o de Helena prova que Gil já foi comparado.
  await setOption(page, browserOption, false)
  await setOption(page, soundOption, false)
  await receive(request, sector.id, 'Gil Desligado')
  await expect(page.getByText('Chamado recebido: Gil Desligado')).toBeVisible()
  await setOption(page, browserOption, true)
  await receive(request, sector.id, 'Helena Ligada')
  await expect.poll(() => notified(page)).toEqual(['Fabio Ligado', 'Helena Ligada'])
  expect(await beeps(page)).toBe(1)
})

test('som toca sozinho, também com a aba visível, sem notificação', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await spyOnAlerts(page)
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setOption(page, soundOption, true)
  await receive(request, sector.id, 'Iris Som')
  await expect.poll(() => beeps(page)).toBe(1)
  expect(await notified(page)).toEqual([])
})

test('som sem interação com a página não quebra nada', async ({ page, request, baseURL }) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setOption(page, soundOption, true)

  // Recarregar zera a interação com a página.
  await page.reload()
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await receive(request, sector.id, 'Jonas Mudo')
  await expect(page.getByText('Chamado recebido: Jonas Mudo')).toBeVisible()
  await receive(request, sector.id, 'Karla Muda')
  await expect(page.getByText('Chamado recebido: Karla Muda')).toBeVisible()
  expect(errors).toEqual([])
})

test('duas abas não repetem o mesmo chamado, e a aba visível evita a notificação', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await context.grantPermissions(['notifications'])
  await context.addInitScript(() => {
    localStorage.setItem('alerts.browser', 'on')
  })
  await spyOnAlerts(page)
  await signIn(page, agent, userPassword)
  const other = await context.newPage()
  await spyOnAlerts(other)
  await other.goto('/atendimento')
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await expect(other.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setHidden(page, true)
  await setHidden(other, true)

  const allNotified = async () => [...(await notified(page)), ...(await notified(other))].sort()

  await receive(request, sector.id, 'Lia Unica')
  await expect.poll(allNotified).toEqual(['Lia Unica'])

  // Com uma aba visível, a de trás também fica quieta: quem alertaria é a aba que a pessoa já vê.
  await setHidden(page, false)
  await receive(request, sector.id, 'Mia Vista')
  await expect(page.getByText('Chamado recebido: Mia Vista')).toBeVisible()
  await expect(other.getByText('Chamado recebido: Mia Vista')).toBeVisible()

  await setHidden(page, true)
  await receive(request, sector.id, 'Nina Final')
  await expect.poll(allNotified).toEqual(['Lia Unica', 'Nina Final'])
})

test('voltar à aba durante a espera não notifica, e o som ainda toca', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setOption(page, browserOption, true)
  await setOption(page, soundOption, true)
  await setHidden(page, true)

  // A volta acontece na própria página, assim que o aviso aparece: bem antes do fim da espera,
  // mesmo com a máquina lenta.
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.body.textContent?.includes('Chamado recebido: Sara Retorno')) {
        sessionStorage.removeItem('test-hidden')
        document.dispatchEvent(new Event('visibilitychange'))
        observer.disconnect()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await receive(request, sector.id, 'Sara Retorno')
  await expect(page.getByText('Chamado recebido: Sara Retorno')).toBeVisible()
  await expect.poll(() => beeps(page)).toBe(1)

  // O chamado seguinte prova que os alertas seguem ligados; o de Sara, se existisse, estaria na lista.
  await setHidden(page, true)
  await receive(request, sector.id, 'Tito Oculto')
  await expect.poll(() => notified(page)).toEqual(['Tito Oculto'])
})

test('voltar a uma aba impede a notificação pendente na outra, com som único', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await context.grantPermissions(['notifications'])
  await context.addInitScript(() => {
    localStorage.setItem('alerts.browser', 'on')
    localStorage.setItem('alerts.sound', 'on')
  })
  await spyOnAlerts(page)
  await signIn(page, agent, userPassword)
  const other = await context.newPage()
  await spyOnAlerts(other)
  await other.goto('/atendimento')
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await expect(other.getByText('Nenhum chamado na fila.')).toBeVisible()
  // O navegador só libera o som depois de uma interação com a página.
  await other.locator('body').click({ position: { x: 1, y: 1 } })
  await page.bringToFront()
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await setHidden(page, true)
  await setHidden(other, true)

  const allNotified = async () => [...(await notified(page)), ...(await notified(other))]
  const allBeeps = async () => (await beeps(page)) + (await beeps(other))

  // A resposta da fila chega depois nesta aba, e a pessoa volta a ela assim que vê o aviso.
  let delay = 120
  await page.route(`**/api/sectors/${sector.id}/tickets`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delay))
    await route.continue()
  })
  await page.evaluate(() => {
    const observer = new MutationObserver(() => {
      if (document.body.textContent?.includes('Chamado recebido: Wagner Retorno')) {
        sessionStorage.removeItem('test-hidden')
        document.dispatchEvent(new Event('visibilitychange'))
        observer.disconnect()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await receive(request, sector.id, 'Wagner Retorno')
  await expect(page.getByText('Chamado recebido: Wagner Retorno')).toBeVisible()
  await expect(other.getByText('Chamado recebido: Wagner Retorno')).toBeVisible()
  await expect.poll(allBeeps).toBe(1)

  // A aba visível responde depois da espera da outra: a de trás continua sem notificar.
  delay = 1_500
  await receive(request, sector.id, 'Xenia Lenta')
  await expect(other.getByText('Chamado recebido: Xenia Lenta')).toBeVisible()
  await expect(page.getByText('Chamado recebido: Xenia Lenta')).toBeVisible()
  await expect.poll(allBeeps).toBe(2)
  delay = 0

  // O chamado seguinte prova que os alertas seguem ligados e únicos entre as abas; os anteriores,
  // se tivessem notificado, estariam na lista.
  await setHidden(page, true)
  await receive(request, sector.id, 'Yara Oculta')
  await expect.poll(allNotified).toEqual(['Yara Oculta'])
  await expect.poll(allBeeps).toBe(3)
})

test('mudar as opções numa aba vale na outra, sem abrir o menu nela', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setOption(page, browserOption, true)
  await setOption(page, soundOption, true)

  const other = await context.newPage()
  await spyOnAlerts(other)
  await other.goto('/atendimento')
  await expect(other.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setHidden(page, true)
  await setHidden(other, true)
  // Com a outra aba na frente, o navegador atrasa os cliques nesta.
  await page.bringToFront()

  // Espera a outra aba receber a mudança, para o chamado não chegar antes dela.
  await other.evaluate(() => {
    window.__stored = {}
    window.addEventListener('storage', (event) => {
      window.__stored[event.key ?? ''] = event.newValue
    })
  })
  const otherReceived = (value: string | null) =>
    expect
      .poll(() =>
        other.evaluate(() => [window.__stored['alerts.browser'], window.__stored['alerts.sound']]),
      )
      .toEqual([value, value])
  const allNotified = async () => [...(await notified(page)), ...(await notified(other))]
  const allBeeps = async () => (await beeps(page)) + (await beeps(other))

  await setOption(page, browserOption, false)
  await setOption(page, soundOption, false)
  await otherReceived(null)
  await receive(request, sector.id, 'Ursula Desligada')
  await expect(other.getByText('Chamado recebido: Ursula Desligada')).toBeVisible()

  // Religadas: o chamado de Vera alerta, e o de Ursula, se tivesse alertado, estaria na lista.
  await setOption(page, browserOption, true)
  await setOption(page, soundOption, true)
  await otherReceived('on')
  await receive(request, sector.id, 'Vera Religada')
  await expect.poll(allNotified).toEqual(['Vera Religada'])
  await expect.poll(allBeeps).toBe(1)
})

test('administrador não recebe notificação nem som, mesmo com a escolha salva no navegador', async ({
  page,
  browser,
  context,
  request,
  baseURL,
  onlySectors,
}) => {
  const { sector, supervisor } = await connectedSector(baseURL!, request)
  await context.grantPermissions(['notifications'])
  await spyOnAlerts(page)
  // Escolha feita antes de o administrador perder as opções: ela continua no navegador.
  await page.addInitScript(() => {
    localStorage.setItem('alerts.browser', 'on')
    localStorage.setItem('alerts.sound', 'on')
  })
  await onlySectors(sector.id)
  await signIn(page, admin.email, admin.password)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setHidden(page, true)

  const otherContext = await browser.newContext()
  await otherContext.grantPermissions(['notifications'])
  const other = await otherContext.newPage()
  await spyOnAlerts(other)
  await signIn(other, supervisor, userPassword)
  await expect(other.getByText('Nenhum chamado na fila.')).toBeVisible()
  await setOption(other, browserOption, true)
  await setOption(other, soundOption, true)
  await setHidden(other, true)

  // O supervisor é alertado, e o painel do administrador recebe o chamado. A espera cobre o atraso
  // da aba em segundo plano (hiddenTabDelay, em alerts.ts), depois do qual o alerta já teria saído.
  await receive(request, sector.id, 'Olivia Fila')
  await expect.poll(() => notified(other)).toEqual(['Olivia Fila'])
  await expect.poll(() => beeps(other)).toBe(1)
  await expect(page.getByRole('link', { name: 'Olivia Fila' })).toBeVisible()
  await page.waitForTimeout(1_000)
  expect(await notified(page)).toEqual([])
  expect(await beeps(page)).toBe(0)
  await otherContext.close()
})

test('o menu do administrador não tem o grupo Alertas, e o do supervisor tem', async ({
  page,
  browser,
  baseURL,
}) => {
  const { supervisor } = await seedSector(baseURL!)
  await signIn(page, admin.email, admin.password)
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitem', { name: 'Usuários' })).toBeVisible()
  await expect(page.getByRole('menu').getByText('Alertas', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('menuitemcheckbox', { name: browserOption })).toHaveCount(0)
  await expect(page.getByRole('menuitemcheckbox', { name: soundOption })).toHaveCount(0)

  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await other.getByRole('button', { name: 'Configurações' }).click()
  await expect(other.getByRole('menu').getByText('Alertas', { exact: true })).toBeVisible()
  await expect(other.getByRole('menuitemcheckbox', { name: browserOption })).toBeVisible()
  await expect(other.getByRole('menuitemcheckbox', { name: soundOption })).toBeVisible()
  await otherContext.close()
})

test('permissão só é pedida ao ativar, e a negada mostra o motivo', async ({ page, baseURL }) => {
  const { supervisor } = await seedSector(baseURL!)
  await page.addInitScript(() => {
    let state: NotificationPermission = 'default'
    window.__requests = 0
    Object.defineProperty(Notification, 'permission', { get: () => state })
    Notification.requestPermission = () => {
      window.__requests++
      state = 'denied'
      return Promise.resolve(state)
    }
  })
  await signIn(page, supervisor, userPassword)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  expect(await page.evaluate(() => window.__requests)).toBe(0)

  await page.getByRole('button', { name: 'Configurações' }).click()
  const option = page.getByRole('menuitemcheckbox', { name: browserOption })
  await expect(page.getByRole('alert')).toBeHidden()
  await option.click()

  await expect(
    page.getByRole('alert').filter({
      hasText: 'Notificações bloqueadas neste navegador. Libere nas permissões do site.',
    }),
  ).toBeVisible()
  await expect(option).toHaveAttribute('aria-checked', 'false')
  await expect(option).toHaveAttribute('aria-disabled', 'true')
  expect(await page.evaluate(() => window.__requests)).toBe(1)
  expect(await page.evaluate(() => localStorage.getItem('alerts.browser'))).toBeNull()
})

test('endereço sem HTTPS explica por que não há notificação', async ({ page, baseURL }) => {
  const { supervisor } = await seedSector(baseURL!)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'isSecureContext', { get: () => false })
  })
  await signIn(page, supervisor, userPassword)
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Notificações exigem endereço seguro.' }),
  ).toBeVisible()
  await expect(page.getByRole('menuitemcheckbox', { name: browserOption })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  // O som não depende de HTTPS.
  await expect(page.getByRole('menuitemcheckbox', { name: soundOption })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  )
})

test('título da aba acompanha o contador e volta ao normal com zero', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await expect(page).toHaveTitle('Central de Atendimento')

  await receive(request, sector.id, 'Otavio Um')
  await expect(page).toHaveTitle('(1) Central de Atendimento')
  await receive(request, sector.id, 'Paula Dois')
  await expect(page).toHaveTitle('(2) Central de Atendimento')

  await page.reload()
  await expect(page).toHaveTitle('(2) Central de Atendimento')

  const bell = page.getByRole('banner').getByRole('button', { name: /^Notificações/ })
  await bell.click()
  const popover = page.getByRole('dialog')
  await popover.getByRole('button', { name: 'Assumir chamado de Otavio Um' }).click()
  await expect(page).toHaveTitle('(1) Central de Atendimento')
  await popover.getByRole('button', { name: 'Assumir chamado de Paula Dois' }).click()
  await expect(page).toHaveTitle('Central de Atendimento')
})

test('título da aba conta o número desconectado e volta ao normal ao sair', async ({
  page,
  baseURL,
}) => {
  const { supervisor } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)
  await expect(page).toHaveTitle('(1) Central de Atendimento')
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page).toHaveTitle('Central de Atendimento')
})
