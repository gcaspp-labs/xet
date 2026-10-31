import {
  expect,
  test,
  type APIRequestContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test'
import { seedSector, signIn, unique, userPassword } from './fixtures'

// Mensagem de texto de um contato, simulada pelo adaptador falso do backend.
async function receive(
  request: APIRequestContext,
  sectorId: number,
  message: { phone: string; contactName: string; body: string },
) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
    data: { externalMessageId: `E2E-${unique().id}`, ...message },
  })
  expect(response.ok()).toBeTruthy()
}

const card = (page: Page, title: string) => page.getByRole('region', { name: title })

test('nova mensagem aparece no painel sem recarregar e o atendente assume o chamado', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  const queue = card(page, 'Fila do setor')
  await expect(queue.getByText('Nenhum chamado na fila.')).toBeVisible()

  // O supervisor acompanha o mesmo setor em outra janela.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await expect(card(other, 'Fila do setor').getByText('Nenhum chamado na fila.')).toBeVisible()

  const { phone } = unique()
  await receive(request, sector.id, { phone, contactName: 'Maria Cliente', body: 'Bom dia' })
  const row = queue.getByRole('row', { name: /Maria Cliente/ })
  await expect(row).toContainText('Bom dia')
  await expect(row).toContainText('Não cadastrado')
  await expect(row).toContainText(/\d{4}-\d{6}/)

  // Nova mensagem no mesmo chamado atualiza a prévia, sem criar outro chamado.
  await receive(request, sector.id, {
    phone,
    contactName: 'Maria Cliente',
    body: 'Preciso de ajuda',
  })
  await expect(row).toContainText('Preciso de ajuda')
  await expect(queue.getByRole('row', { name: /Maria Cliente/ })).toHaveCount(1)
  await expect(
    card(other, 'Fila do setor').getByRole('row', { name: /Maria Cliente/ }),
  ).toContainText('Preciso de ajuda')

  await row.getByRole('button', { name: 'Assumir chamado de Maria Cliente' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await expect(queue.getByText('Nenhum chamado na fila.')).toBeVisible()
  const mine = card(page, 'Em atendimento').getByRole('row', { name: /Maria Cliente/ })
  await expect(mine).toContainText('Você')
  const workload = card(page, 'Chamados por atendente')
  await expect(workload.getByRole('row', { name: /^agent / })).toContainText('1')

  // A outra janela vê o responsável e a contagem sem recarregar.
  await expect(card(other, 'Fila do setor').getByText('Nenhum chamado na fila.')).toBeVisible()
  await expect(
    card(other, 'Em atendimento').getByRole('row', { name: /Maria Cliente/ }),
  ).toContainText(/agent \d+/)
  await expect(
    card(other, 'Chamados por atendente').getByRole('row', { name: /^agent / }),
  ).toContainText('1')
  await otherContext.close()
})

test('atendente de outro setor não vê a fila', async ({ page, request, baseURL }) => {
  const first = await seedSector(baseURL!)
  const second = await seedSector(baseURL!)
  await signIn(page, second.agent, userPassword)
  const queue = card(page, 'Fila do setor')
  await expect(queue.getByText('Nenhum chamado na fila.')).toBeVisible()

  await receive(request, first.sector.id, {
    phone: unique().phone,
    contactName: 'Contato de outro setor',
    body: 'Olá',
  })
  // Uma mensagem no próprio setor chega; a do outro setor não.
  await receive(request, second.sector.id, {
    phone: unique().phone,
    contactName: 'Contato do setor',
    body: 'Olá',
  })
  await expect(queue.getByRole('row', { name: /Contato do setor/ })).toBeVisible()
  await expect(page.getByText('Contato de outro setor')).toHaveCount(0)
})

test('painel avisa quando a atualização em tempo real cai e volta sozinho', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  // Intermedia o WebSocket do painel para simular a queda da conexão.
  const sockets: WebSocketRoute[] = []
  await page.routeWebSocket(/\/api\/ws$/, (ws) => {
    sockets.push(ws)
    ws.connectToServer()
  })
  await signIn(page, agent, userPassword)
  const note = page
    .getByRole('alert')
    .filter({ hasText: 'Atualização em tempo real interrompida.' })
  await expect(card(page, 'Fila do setor').getByText('Nenhum chamado na fila.')).toBeVisible()
  // No desenvolvimento, o StrictMode do React abre e fecha uma conexão a mais.
  await expect.poll(() => sockets.length).toBeGreaterThan(0)
  await expect(note).toBeHidden()
  const opened = sockets.length

  // Queda: o aviso aparece, e a mensagem que chega nesse intervalo não se perde.
  await sockets[opened - 1].close({ code: 1006 })
  await expect(note).toBeVisible()
  await receive(request, sector.id, {
    phone: unique().phone,
    contactName: 'Contato na queda',
    body: 'Olá',
  })
  await expect.poll(() => sockets.length, { timeout: 10_000 }).toBe(opened + 1)
  await expect(note).toBeHidden()
  await expect(
    card(page, 'Fila do setor').getByRole('row', { name: /Contato na queda/ }),
  ).toBeVisible()
})
