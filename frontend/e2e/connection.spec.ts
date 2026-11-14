import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test'
import { seedSector, signIn, userPassword } from './fixtures'

// Simula o celular do setor pelo adaptador falso do backend (MESSAGING_PROVIDER=fake).
async function phone(
  request: APIRequestContext,
  sectorId: number,
  action: 'pair' | 'qr' | 'drop' | 'logout' | 'unreachable',
  data?: object,
) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, { data })
  expect(response.ok()).toBeTruthy()
}

test('supervisor conecta o número pelo QR code e é avisado da desconexão', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)

  // Número nunca conectado: o sino avisa e leva à tela de conexão.
  const bell = page.getByRole('banner').getByRole('button', { name: /^Notificações/ })
  const item = page.getByRole('link', { name: `Número do setor ${sector.name} desconectado` })
  const openItem = async () => {
    await bell.click()
    await item.click()
  }
  await expect(bell).toHaveAccessibleName('Notificações, 1 pendente')
  await openItem()
  await expect(page.getByRole('heading', { name: 'Conexão do WhatsApp' })).toBeVisible()
  await expect(page.getByText('Desconectado', { exact: true })).toBeVisible()
  await expect(page.getByText('O número ainda não foi conectado.')).toBeVisible()
  await expect(page.getByText('Não conectado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Desvincular número' })).toBeHidden()

  await page.getByRole('button', { name: 'Conectar' }).click()
  const qr = page.getByRole('img', { name: 'QR code para conectar o número' })
  await expect(qr).toBeVisible()
  await expect(page.getByText('Conectando', { exact: true })).toBeVisible()
  await expect
    .poll(() => qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0)

  // O WhatsApp troca o código: a tela mostra o novo sem clique.
  const firstCode = await qr.getAttribute('src')
  await phone(request, sector.id, 'qr')
  await expect(qr).not.toHaveAttribute('src', firstCode!)

  // O celular lê o QR code; a tela mostra o novo estado sem recarregar.
  const account = String(5511900000000 + sector.id)
  const formatted = `+55 (11) ${account.slice(4, 9)}-${account.slice(9)}`
  await phone(request, sector.id, 'pair')
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible()
  await expect(page.getByText(formatted)).toBeVisible()
  await expect(
    page.getByText(/^Última conexão em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\.$/),
  ).toBeVisible()
  await expect(qr).toBeHidden()

  await expect(bell).toHaveAccessibleName('Notificações')
  await page.getByRole('link', { name: 'Atendimentos' }).click()
  await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
  await bell.click()
  await expect(page.getByText('Nenhuma notificação.')).toBeVisible()
  await page.keyboard.press('Escape')

  // Queda da conexão: o item aparece no sino sem recarregar, e a faixa antiga não volta.
  await phone(request, sector.id, 'drop')
  await expect(bell).toHaveAccessibleName('Notificações, 1 pendente')
  await expect(page.getByText(/desconectado\./)).toBeHidden()
  await openItem()
  await expect(page.getByText(formatted)).toBeVisible()
  // O item continua na própria tela de conexão, até o número conectar.
  await bell.click()
  await expect(item).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Atendimentos' }).click()

  // Desvinculado pelo celular: a tela pede um novo QR code.
  await phone(request, sector.id, 'logout')
  await openItem()
  await expect(page.getByText('Requer QR code', { exact: true })).toBeVisible()
  await expect(
    page.getByText('O número foi desvinculado. Conecte de novo pelo QR code.'),
  ).toBeVisible()
  await expect(page.getByText('Não conectado', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reconectar' }).click()
  await expect(qr).toBeVisible()
})

test('supervisor desvincula o número com confirmação e conecta de novo', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)
  await page.goto('/conexao')
  await page.getByRole('button', { name: 'Conectar' }).click()
  await expect(page.getByRole('img', { name: 'QR code para conectar o número' })).toBeVisible()
  await phone(request, sector.id, 'pair')
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible()

  // Cancelar a confirmação não muda nada.
  await page.getByRole('button', { name: 'Desvincular número' }).click()
  const drawer = page.getByRole('dialog', { name: 'Desvincular número' })
  await expect(drawer).toContainText(`deixa de atender o setor ${sector.name}`)
  await drawer.getByRole('button', { name: 'Cancelar' }).click()
  await expect(drawer).toBeHidden()
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Desvincular número' }).click()
  await drawer.getByRole('button', { name: 'Desvincular número' }).click()
  await expect(page.getByText('Número desvinculado')).toBeVisible()
  await expect(drawer).toBeHidden()
  await expect(page.getByText('Requer QR code', { exact: true })).toBeVisible()
  await expect(page.getByText('Não conectado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Desvincular número' })).toBeHidden()

  await page.getByRole('button', { name: 'Reconectar' }).click()
  await expect(page.getByRole('img', { name: 'QR code para conectar o número' })).toBeVisible()
  await phone(request, sector.id, 'pair')
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Desvincular número' })).toBeVisible()
})

test('aparelho que não pôde ser avisado é removido também pelo celular', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)
  await page.goto('/conexao')
  await page.getByRole('button', { name: 'Conectar' }).click()
  await expect(page.getByRole('img', { name: 'QR code para conectar o número' })).toBeVisible()
  await phone(request, sector.id, 'pair')
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible()

  await phone(request, sector.id, 'unreachable')
  await page.getByRole('button', { name: 'Desvincular número' }).click()
  const drawer = page.getByRole('dialog', { name: 'Desvincular número' })
  await drawer.getByRole('button', { name: 'Desvincular número' }).click()
  await expect(page.getByText('Requer QR code', { exact: true })).toBeVisible()
  await expect(page.getByText('Remova-o também pelo celular', { exact: false })).toBeVisible()
})

test('número ligado a outro setor é recusado com o motivo na tela', async ({
  page,
  request,
  baseURL,
}) => {
  const owner = await seedSector(baseURL!)
  const { sector, supervisor } = await seedSector(baseURL!)
  const accountId = `${5511900000000 + owner.sector.id}@s.whatsapp.net`
  const connect = async (sectorId: number) => {
    const response = await page.request.post(`/api/sectors/${sectorId}/connection`)
    expect(response.ok()).toBeTruthy()
  }

  await signIn(page, supervisor, userPassword)
  await page.goto('/conexao')
  await page.getByRole('button', { name: 'Conectar' }).click()
  await expect(page.getByRole('img', { name: 'QR code para conectar o número' })).toBeVisible()

  const ownerApi = await apiRequest.newContext({ baseURL })
  const login = await ownerApi.post('/api/auth/login', {
    data: { email: owner.supervisor, password: userPassword },
  })
  expect(login.ok()).toBeTruthy()
  expect((await ownerApi.post(`/api/sectors/${owner.sector.id}/connection`)).ok()).toBeTruthy()
  await ownerApi.dispose()
  await phone(request, owner.sector.id, 'pair', { accountId })

  await phone(request, sector.id, 'pair', { accountId })
  await expect(
    page.getByText('Este número já está ligado a outro setor.', { exact: false }),
  ).toBeVisible()
  await expect(page.getByText('Requer QR code', { exact: true })).toBeVisible()
  await expect(page.getByText('Não conectado', { exact: true })).toBeVisible()

  // Nova tentativa limpa o motivo.
  await connect(sector.id)
  await expect(
    page.getByText('Este número já está ligado a outro setor.', { exact: false }),
  ).toBeHidden()
})

test('atendente não vê a conexão nem o aviso de desconexão', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)

  await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Conexão' })).toBeHidden()
  await expect(page.getByText(/desconectado\./)).toBeHidden()
  await page.goto('/conexao')
  await expect(page).toHaveURL(/\/conversas$/)
})
