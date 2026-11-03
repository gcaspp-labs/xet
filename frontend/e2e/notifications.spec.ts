import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword } from './fixtures'

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
  // Primeira carga: o chamado que já estava na fila não avisa.
  await expect(page.getByText('Chamado recebido: Ana Antiga')).toHaveCount(0)

  await receive(request, sector.id, 'Bruno Novo')
  await expect(page.getByText('Chamado recebido: Bruno Novo')).toBeVisible()
  await expect(bell).toHaveAccessibleName('Notificações, 2 pendentes')

  await bell.click()
  const popover = page.getByRole('dialog')
  await expect(popover.getByText('Bruno Novo', { exact: true })).toBeVisible()
  await expect(popover.getByText('Olá, aqui é Bruno Novo')).toBeVisible()
  await expect(popover.getByText('Ana Antiga', { exact: true })).toBeVisible()

  // Recarregar não repete o aviso do chamado que já estava na fila.
  await page.reload()
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 2 pendentes')
  await expect(page.getByText('Chamado recebido: Bruno Novo')).toHaveCount(0)
})

test('assumir pelo sino não muda a tela e "Abrir" leva à conversa', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!, request)
  await receive(request, sector.id, 'Carla Fila')
  await receive(request, sector.id, 'Davi Fila')
  await signIn(page, agent, userPassword)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  const openedAt = page.url()

  await bellOf(page).click()
  const popover = page.getByRole('dialog')
  await popover.getByRole('button', { name: 'Assumir chamado de Carla Fila' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  expect(page.url()).toBe(openedAt)
  await expect(popover.getByText('Carla Fila')).toHaveCount(0)
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 1 pendente')

  await popover.getByRole('link', { name: 'Abrir chamado de Davi Fila' }).click()
  await expect(page.getByRole('heading', { name: 'Davi Fila' })).toBeVisible()
  await expect(popover).toBeHidden()
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
  await other.getByRole('link', { name: 'Abrir conversa' }).click()
  await other.getByRole('button', { name: 'Devolver à fila' }).click()
  const drawer = other.getByRole('dialog', { name: 'Devolver à fila' })
  await drawer.getByRole('button', { name: 'Devolver à fila' }).click()
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 1 pendente')
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

test('reconectar o WebSocket não repete o aviso dos chamados que já estavam na fila', async ({
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

  await page.context().setOffline(true)
  await receive(request, sector.id, 'Hugo Durante')
  await page.context().setOffline(false)
  // O contador alcança a fila sem o aviso do que chegou durante a queda.
  await expect(bellOf(page)).toHaveAccessibleName('Notificações, 2 pendentes', { timeout: 30_000 })
  await expect(page.getByText('Chamado recebido: Hugo Durante')).toHaveCount(0)
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

test('administrador vê os chamados de todos os setores, identificados', async ({
  page,
  request,
  baseURL,
}) => {
  const first = await connectedSector(baseURL!, request)
  const second = await connectedSector(baseURL!, request)
  await receive(request, first.sector.id, 'Julia Primeiro')
  await receive(request, second.sector.id, 'Kleber Segundo')
  await signIn(page, admin.email, admin.password)
  await bellOf(page).click()
  const popover = page.getByRole('dialog')
  const juliaItem = popover.getByRole('listitem').filter({ hasText: 'Julia Primeiro' })
  const kleberItem = popover.getByRole('listitem').filter({ hasText: 'Kleber Segundo' })
  await expect(juliaItem).toContainText(first.sector.name)
  await expect(kleberItem).toContainText(second.sector.name)
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
