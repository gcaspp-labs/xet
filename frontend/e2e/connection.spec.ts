import { expect, test, type APIRequestContext } from '@playwright/test'
import { seedSector, signIn, userPassword } from './fixtures'

// Simula o celular do setor pelo adaptador falso do backend (MESSAGING_PROVIDER=fake).
async function phone(
  request: APIRequestContext,
  sectorId: number,
  action: 'pair' | 'drop' | 'logout',
) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`)
  expect(response.ok()).toBeTruthy()
}

test('supervisor conecta o número pelo QR code e é avisado da desconexão', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)

  // Número nunca conectado: o painel avisa e leva à tela de conexão.
  const note = page
    .getByRole('alert')
    .filter({ hasText: `Número do setor ${sector.name} desconectado.` })
  await expect(note).toBeVisible()
  await note.getByRole('link', { name: 'Reconecte pelo QR code.' }).click()
  await expect(page.getByRole('heading', { name: 'Conexão do WhatsApp' })).toBeVisible()
  await expect(page.getByText('Desconectado', { exact: true })).toBeVisible()
  await expect(page.getByText('O número ainda não foi conectado.')).toBeVisible()

  await page.getByRole('button', { name: 'Conectar' }).click()
  const qr = page.getByRole('img', { name: 'QR code para conectar o número' })
  await expect(qr).toBeVisible()
  await expect(page.getByText('Conectando', { exact: true })).toBeVisible()
  await expect
    .poll(() => qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0)

  // O celular lê o QR code; a tela mostra o novo estado ao atualizar.
  await phone(request, sector.id, 'pair')
  await page.getByRole('button', { name: 'Atualizar' }).click()
  await expect(page.getByText('Conectado', { exact: true })).toBeVisible()
  await expect(
    page.getByText(/^Última conexão em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\.$/),
  ).toBeVisible()
  await expect(qr).toBeHidden()

  await page.getByRole('link', { name: 'Início' }).click()
  await expect(page.getByText('Sessão iniciada como')).toBeVisible()
  await expect(note).toBeHidden()

  // Queda da conexão: o aviso aparece ao recarregar o painel.
  await phone(request, sector.id, 'drop')
  await page.reload()
  await expect(note).toBeVisible()

  // Desvinculado pelo celular: a tela pede um novo QR code.
  await phone(request, sector.id, 'logout')
  await note.getByRole('link', { name: 'Reconecte pelo QR code.' }).click()
  await expect(page.getByText('Requer QR code', { exact: true })).toBeVisible()
  await expect(
    page.getByText('O número foi desvinculado pelo celular. Conecte de novo pelo QR code.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Reconectar' }).click()
  await expect(qr).toBeVisible()
})

test('atendente não vê a conexão nem o aviso de desconexão', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)

  await expect(page.getByText('Sessão iniciada como')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Conexão' })).toBeHidden()
  await expect(page.getByText(/desconectado\./)).toBeHidden()
  await page.goto('/conexao')
  await expect(page).toHaveURL(/\/$/)
})
