import {
  expect,
  request as apiRequest,
  type APIRequestContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test'
import { admin, seedSector, signIn, test, unique, userPassword } from './fixtures'

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
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, { data })
  expect(response.ok()).toBeTruthy()
}

async function receive(request: APIRequestContext, sectorId: number, contactName: string) {
  await phone(request, sectorId, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName,
    body: `Olá, aqui é ${contactName}`,
  })
}

// Setor com o número conectado, para receber chamados.
async function connectedSector(baseURL: string, request: APIRequestContext) {
  const seed = await seedSector(baseURL)
  await connectSector(baseURL, seed.sector.id)
  await phone(request, seed.sector.id, 'pair')
  return seed
}

const bellOf = (page: Page) =>
  page.getByRole('banner').getByRole('button', { name: /^Notificações/ })

test('chamado novo sobe o contador, avisa e aparece no sino sem recarregar', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await receive(request, sector.id, 'Ana Antiga')
  await signIn(page, agent, userPassword)
  const bell = bellOf(page)
  await expect(bell).toHaveAccessibleName('Notificações, 1 pendente')

  await receive(request, sector.id, 'Bruno Novo')
  await expect(page.getByText('Chamado recebido: Bruno Novo')).toBeVisible()
  // Primeira carga: o chamado que já estava na fila não avisa. A contagem é pontual, feita quando
  // o aviso seguinte aparece: o toHaveCount(0) passaria mesmo se o aviso tivesse aparecido antes.
  expect(await page.getByText('Chamado recebido: Ana Antiga').count()).toBe(0)
  await expect(bell).toHaveAccessibleName('Notificações, 2 pendentes')

  await bell.click()
  const popover = page.getByRole('dialog')
  await expect(popover.getByText('Bruno Novo', { exact: true })).toBeVisible()
  await expect(popover.getByText('Olá, aqui é Bruno Novo')).toBeVisible()
  await expect(popover.getByText('Ana Antiga', { exact: true })).toBeVisible()

  // Recarregar não repete o aviso do chamado que já estava na fila.
  await page.reload()
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 2 pendentes')
  // Um chamado novo prova que o aviso está de pé; o de Bruno, se fosse repetido, estaria na tela.
  await receive(request, sector.id, 'Caio Depois')
  await expect(page.getByText('Chamado recebido: Caio Depois')).toBeVisible()
  expect(await page.getByText('Chamado recebido: Bruno Novo').count()).toBe(0)
  expect(await page.getByText('Chamado recebido: Ana Antiga').count()).toBe(0)
})

test('o botão do sino tem borda visível e o contador continua legível', async ({
  page,
  baseURL,
  request,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await signIn(page, agent, userPassword)
  const bell = bellOf(page)
  const style = await bell.evaluate((element) => {
    const { borderTopWidth, borderTopStyle, borderTopColor } = getComputedStyle(element)
    return { borderTopWidth, borderTopStyle, borderTopColor }
  })
  expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0)
  expect(style.borderTopStyle).toBe('solid')
  const alpha = await page.evaluate((color) => {
    const context = document.createElement('canvas').getContext('2d')!
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    return context.getImageData(0, 0, 1, 1).data[3]
  }, style.borderTopColor)
  expect(alpha).toBeGreaterThan(0)

  await receive(request, sector.id, 'Ana Cliente')
  const count = page.getByTestId('notification-count')
  await expect(count).toHaveText('1')
  // Nada cobre o contador, e ele fica inteiro dentro da tela.
  const box = (await count.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  const onTop = await count.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return hit === element || (hit !== null && element.contains(hit))
  })
  expect(onTop).toBe(true)
})

test('assumir pelo sino não muda a tela e "Abrir conversa" leva à tela Conversas', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await receive(request, sector.id, 'Carla Fila')
  await receive(request, sector.id, 'Davi Fila')
  await receive(request, sector.id, 'Eva Fila')
  await signIn(page, agent, userPassword)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  const openedAt = page.url()

  await bellOf(page).click()
  const popover = page.getByRole('dialog')
  await popover.getByRole('button', { name: 'Assumir chamado de Carla Fila' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  expect(page.url()).toBe(openedAt)
  await expect(popover.getByText('Carla Fila')).toHaveCount(0)
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 2 pendentes')

  // O link do aviso abre a conversa assumida na tela Conversas.
  const openConversation = page.getByRole('link', { name: 'Abrir conversa' })
  await expect(openConversation).toHaveAttribute('href', /^\/conversas\/\d+$/)
  await openConversation.click()
  await expect(page).toHaveURL(/\/conversas\/\d+$/)
  await expect(
    page.getByRole('region', { name: 'Conversa', exact: true }).getByText('Carla Fila'),
  ).toBeVisible()
  const mine = page.getByRole('navigation', { name: 'Meus atendimentos' })
  await expect(mine.getByRole('link', { name: /Carla Fila/ })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('link', { name: 'Conversas', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )

  // Os demais links do sino mantêm o comportamento.
  await bellOf(page).click()
  await popover.getByRole('link', { name: 'Abrir chamado de Davi Fila' }).click()
  await expect(page.getByRole('heading', { name: 'Davi Fila' })).toBeVisible()
  await expect(popover).toBeHidden()

  // Em outra tela (a do chamado) assumir também não navega, e o link leva à tela Conversas.
  const ticketPage = page.url()
  // O aviso da Carla pode ainda estar na tela: espera sumir para o link ser o da Eva.
  await expect(page.getByText('Chamado assumido')).toHaveCount(0, { timeout: 15_000 })
  await bellOf(page).click()
  await popover.getByRole('button', { name: 'Assumir chamado de Eva Fila' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  expect(page.url()).toBe(ticketPage)
  await page.getByRole('link', { name: 'Abrir conversa' }).click()
  await expect(page).toHaveURL(/\/conversas\/\d+$/)
  await expect(mine.getByRole('link', { name: /Eva Fila/ })).toHaveAttribute('aria-current', 'page')
})

test('item sai quando outra pessoa assume e volta quando o chamado é devolvido à fila', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await connectedSector(baseURL!, request)
  await receive(request, sector.id, 'Elisa Fila')
  await signIn(page, agent, userPassword)
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 1 pendente')

  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await bellOf(other).click()
  await other
    .getByRole('dialog')
    .getByRole('button', { name: 'Assumir chamado de Elisa Fila' })
    .click()
  await expect(other.getByText('Chamado assumido')).toBeVisible()
  await expect(bellOf(page)).toHaveAccessibleName('Notificações')

  // Devolver à fila: o item volta nas duas janelas.
  const openConversation = other.getByRole('link', { name: 'Abrir conversa' })
  await expect(openConversation).toHaveAttribute('href', /^\/conversas\/\d+$/)
  await openConversation.click()
  await expect(other).toHaveURL(/\/conversas\/\d+$/)
  await other.getByRole('button', { name: 'Devolver à fila' }).click()
  const drawer = other.getByRole('dialog', { name: 'Devolver à fila' })
  await drawer.getByRole('button', { name: 'Devolver à fila' }).click()
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 1 pendente')
  await otherContext.close()
})

test('item sai quando outra pessoa cancela o chamado', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await connectedSector(baseURL!, request)
  await receive(request, sector.id, 'Lauro Golpe')
  await signIn(page, agent, userPassword)
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 1 pendente')

  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await other.getByRole('link', { name: 'Lauro Golpe' }).click()
  await other.getByRole('button', { name: 'Cancelar chamado' }).click()
  const sheet = other.getByRole('dialog', { name: 'Cancelar chamado' })
  await sheet.getByLabel('Motivo').fill('Golpe do falso boleto.')
  await sheet.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(other.getByText('Chamado cancelado', { exact: true })).toBeVisible()

  await expect(bellOf(page)).toHaveAccessibleName('Notificações')
  await bellOf(page).click()
  await expect(page.getByRole('dialog').getByText('Lauro Golpe')).toHaveCount(0)
  await expect(page.getByText('Nenhuma notificação.')).toBeVisible()
  await otherContext.close()
})

test('quem perde a disputa pelo sino vê o erro dentro da lista', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await connectedSector(baseURL!, request)
  await receive(request, sector.id, 'Fabio Disputado')
  await signIn(page, agent, userPassword)

  // Sem o WebSocket, a janela do colega continua mostrando o chamado na fila.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await other.routeWebSocket(/\/api\/ws$/, () => {})
  await signIn(other, supervisor, userPassword)
  await bellOf(other).click()
  const contested = other
    .getByRole('dialog')
    .getByRole('button', { name: 'Assumir chamado de Fabio Disputado' })
  await expect(contested).toBeVisible()

  await bellOf(page).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Assumir chamado de Fabio Disputado' })
    .click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  await contested.click()
  await expect(
    other
      .getByRole('dialog')
      .getByRole('alert')
      .filter({ hasText: 'Este chamado já foi assumido por outro atendente.' }),
  ).toBeVisible()
  await otherContext.close()
})

test('voltar a rede não repete o aviso dos chamados que entraram durante a queda', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await signIn(page, agent, userPassword)
  // A fila precisa ter carregado: a primeira carga é a referência e não avisa.
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  await receive(request, sector.id, 'Gabi Antes')
  await expect(page.getByText('Chamado recebido: Gabi Antes')).toBeVisible()
  await expect(page.getByText('Chamado recebido: Gabi Antes')).toBeHidden()

  // A queda precisa estar de pé na página antes de a mensagem chegar.
  await page.context().setOffline(true)
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)
  await receive(request, sector.id, 'Hugo Durante')
  await page.context().setOffline(false)
  // O contador alcança a fila quando a rede volta.
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 2 pendentes', { timeout: 30_000 })

  // Com a conexão em dia, o aviso volta a funcionar. Quando o aviso de Iara aparece, o de Hugo,
  // se existisse, ainda estaria na tela. A contagem é pontual: o toHaveCount(0) esperaria o aviso
  // sumir e passaria mesmo com ele tendo aparecido.
  await receive(request, sector.id, 'Iara Depois')
  await expect(page.getByText('Chamado recebido: Iara Depois')).toBeVisible()
  expect(await page.getByText('Chamado recebido: Hugo Durante').count()).toBe(0)
})

test('queda real do WebSocket não repete o aviso quando a conexão reabre', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  // Intermedia o WebSocket do painel para simular a queda da conexão.
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/api\/ws$/, (ws) => {
    sockets.push(ws)
    ws.connectToServer()
  })
  await signIn(page, agent, userPassword)
  // A fila precisa ter carregado: a primeira carga é a referência e não avisa.
  await expect(page.getByText('Nenhum chamado na fila.')).toBeVisible()
  // No desenvolvimento, o StrictMode do React abre e fecha uma conexão a mais.
  await expect.poll(() => sockets.length).toBeGreaterThan(0)
  const opened = sockets.length

  // Queda: a mensagem que chega nesse intervalo entra na fila, mas não avisa depois da volta.
  await sockets[opened - 1].close({ code: 1006 })
  await receive(request, sector.id, 'Lia Durante')
  await expect.poll(() => sockets.length, { timeout: 10_000 }).toBe(opened + 1)
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 1 pendente', { timeout: 30_000 })

  // Com a conexão de volta, o aviso funciona. Quando o de Mia aparece, o de Lia, se existisse,
  // ainda estaria na tela. A contagem é pontual: o toHaveCount(0) passaria mesmo com ele tendo aparecido.
  await receive(request, sector.id, 'Mia Depois')
  await expect(page.getByText('Chamado recebido: Mia Depois')).toBeVisible()
  expect(await page.getByText('Chamado recebido: Lia Durante').count()).toBe(0)
})

test('atendente de outro setor não vê o chamado e não vê número desconectado', async ({
  page,
  request,
  baseURL,
}) => {
  const first = await connectedSector(baseURL!, request)
  const second = await seedSector(baseURL!)
  await receive(request, first.sector.id, 'Ivo Outro Setor')
  await signIn(page, second.agent, userPassword)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()

  // O setor do atendente não tem número conectado, mas só supervisor e administrador são avisados.
  await bellOf(page).click()
  await expect(page.getByText('Nenhuma notificação.')).toBeVisible()
  await expect(page.getByText('Ivo Outro Setor')).toHaveCount(0)
})

test('número desconectado deixa o contador em alerta para o supervisor', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)
  const count = page.getByTestId('notification-count')
  await expect(count).toHaveAttribute('data-alert', 'true')
  await bellOf(page).click()
  await page.getByRole('link', { name: `Número do setor ${sector.name} desconectado` }).click()
  await expect(page).toHaveURL(new RegExp(`/conexao\\?setor=${sector.id}`))

  // Durante a conexão o item continua; só sai quando o número conecta.
  await connectSector(baseURL!, sector.id)
  await expect(count).toBeVisible()
  await phone(request, sector.id, 'pair')
  await expect(count).toBeHidden()
})

test('administrador vê o número desconectado, com o contador em alerta', async ({
  page,
  baseURL,
}) => {
  const { sector } = await seedSector(baseURL!)
  await signIn(page, admin.email, admin.password)
  const count = page.getByTestId('notification-count')
  await expect(count).toHaveAttribute('data-alert', 'true')
  await bellOf(page).click()
  await expect(
    page.getByRole('link', { name: `Número do setor ${sector.name} desconectado` }),
  ).toBeVisible()
})

test('administrador não vê os chamados no sino, mas os vê e assume pelo painel', async ({
  page,
  browser,
  request,
  baseURL,
  onlySectors,
}) => {
  const { sector, supervisor } = await connectedSector(baseURL!, request)
  await onlySectors(sector.id)
  await receive(request, sector.id, 'Julia Antiga')
  await signIn(page, admin.email, admin.password)
  const bell = bellOf(page)
  await expect(page.getByRole('link', { name: 'Julia Antiga' })).toBeVisible()
  await expect(bell).toHaveAccessibleName('Notificações')
  await expect(page).toHaveTitle('Central de Atendimento')

  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await expect(bellOf(other)).toHaveAccessibleName('Notificações, 1 pendente')

  // O painel do administrador recebe o chamado, e o aviso do supervisor marca o momento em que o
  // dele estaria na tela. A contagem é pontual: o toHaveCount(0) passaria com o aviso já fechado.
  await receive(request, sector.id, 'Kleber Novo')
  await expect(other.getByText('Chamado recebido: Kleber Novo')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Kleber Novo' })).toBeVisible()
  expect(await page.getByText('Chamado recebido: Kleber Novo').count()).toBe(0)
  await expect(page.getByTestId('notification-count')).toBeHidden()
  await expect(bell).toHaveAccessibleName('Notificações')
  await expect(page).toHaveTitle('Central de Atendimento')

  await bell.click()
  const popover = page.getByRole('dialog')
  await expect(popover.getByText('Nenhuma notificação.')).toBeVisible()
  await expect(popover.getByText('Kleber Novo')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // Atendentes e supervisores continuam com a lista, sem o nome do setor em cada item.
  await expect(bellOf(other)).toHaveAccessibleName('Notificações, 2 pendentes')
  await bellOf(other).click()
  const otherItem = other
    .getByRole('dialog')
    .getByRole('listitem')
    .filter({ hasText: 'Kleber Novo' })
  await expect(otherItem).toBeVisible()
  await expect(otherItem).not.toContainText(sector.name)
  await other.keyboard.press('Escape')

  // Pelo painel, o administrador assume como sempre, e o item sai do sino do supervisor.
  await page.getByRole('link', { name: 'Kleber Novo' }).click()
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeVisible()
  await expect(bellOf(other)).toHaveAccessibleName('Notificações, 1 pendente')
  await otherContext.close()
})

test('administrador só conta o número desconectado, no sino e no título da aba', async ({
  page,
  request,
  baseURL,
  onlySectors,
}) => {
  const connected = await connectedSector(baseURL!, request)
  const { sector: down } = await seedSector(baseURL!)
  await onlySectors(connected.sector.id, down.id)
  await receive(request, connected.sector.id, 'Lucas Fila')
  await signIn(page, admin.email, admin.password)
  const bell = bellOf(page)
  const count = page.getByTestId('notification-count')
  await expect(count).toHaveText('1')
  await expect(count).toHaveAttribute('data-alert', 'true')
  await expect(bell).toHaveAccessibleName('Notificações, 1 pendente')
  await expect(page).toHaveTitle('(1) Central de Atendimento')

  await bell.click()
  const popover = page.getByRole('dialog')
  await expect(popover.getByRole('listitem')).toHaveCount(1)
  await expect(
    popover.getByRole('link', { name: `Número do setor ${down.name} desconectado` }),
  ).toBeVisible()
  await expect(popover.getByText('Lucas Fila')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // O número conecta: o chamado na fila não deixa nada no contador nem no título da aba.
  await connectSector(baseURL!, down.id)
  await phone(request, down.id, 'pair')
  await expect(count).toBeHidden()
  await expect(bell).toHaveAccessibleName('Notificações')
  await expect(page).toHaveTitle('Central de Atendimento')
})

test('o sino cabe na largura do celular', async ({ page, request, baseURL }) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await receive(request, sector.id, 'Lia Celular')
  await page.setViewportSize({ width: 375, height: 667 })
  await signIn(page, agent, userPassword)
  await bellOf(page).click()
  const popover = page.getByRole('dialog')
  await expect(
    popover.getByRole('button', { name: 'Assumir chamado de Lia Celular' }),
  ).toBeVisible()
  const box = (await popover.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(375)
})
