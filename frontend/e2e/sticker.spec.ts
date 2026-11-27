import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test'
import { admin, openQueued, seedSector, signIn, unique, userPassword } from './fixtures'

// WebP de 1×1 pixel: a figurinha precisa carregar como imagem de verdade.
const webp = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='

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

test('figurinha recebida aparece na conversa, recebe reação e é citada como as outras mídias', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { phone: number, id } = unique()
  const externalId = (suffix: string) => `E2E-STICKER-${id}-${suffix}`
  const receive = (suffix: string, data: object) =>
    phone(request, sector.id, 'receive', {
      externalMessageId: externalId(suffix),
      phone: number,
      contactName: 'Clara Figurinha',
      ...data,
    })
  await receive('1', { body: 'Olha essa' })
  await receive('2', { type: 'sticker', media: { data: webp, mimeType: 'image/webp' } })

  // Na lista de Meus chamados, a última mensagem é a figurinha.
  await signIn(page, agent, userPassword)
  await expect(page.getByText('Figurinha', { exact: true })).toBeVisible()

  await openQueued(page, 'Clara Figurinha')
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toHaveCount(2)

  // A figurinha aparece como imagem pequena, sem o aviso de tipo não suportado e sem abrir ampliada.
  const image = received.getByRole('img', { name: 'Figurinha' })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
  const stickerMessage = conversation
    .getByRole('listitem', { name: 'Mensagem recebida' })
    .filter({ has: page.getByRole('img', { name: 'Figurinha' }) })
  await expect(stickerMessage.getByText('Tipo de mensagem não suportado')).toHaveCount(0)
  await expect(stickerMessage.getByRole('button', { name: 'Ampliar imagem' })).toHaveCount(0)

  // Reagir a uma figurinha funciona e aparece embaixo dela.
  await stickerMessage.hover()
  await stickerMessage.getByRole('button', { name: 'Reagir', exact: true }).click()
  const bar = page.getByRole('group', { name: 'Reagir à mensagem' })
  await expect(bar).toBeVisible()
  await bar.getByRole('button', { name: 'Reagir com 👍' }).click()
  await expect(
    stickerMessage.getByRole('listitem', { name: /^Setor reagiu com 👍, / }),
  ).toBeVisible()

  // Responder cita a figurinha como "🖼️ Figurinha", no rascunho e no balão enviado.
  await stickerMessage.hover()
  await stickerMessage.getByRole('button', { name: 'Responder', exact: true }).click()
  const draft = page.getByRole('group', { name: 'Respondendo a Cliente' })
  await expect(draft).toContainText('🖼️ Figurinha')
  const input = page.getByRole('textbox', { name: 'Mensagem' })
  await input.fill('Adorei a figurinha')
  await input.press('Enter')
  await expect(
    conversation
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .filter({ hasText: 'Adorei a figurinha' })
      .getByRole('button', { name: 'Citação de Cliente: 🖼️ Figurinha' }),
  ).toBeVisible()

  // O cliente citando a figurinha também mostra "🖼️ Figurinha" na citação.
  await receive('3', {
    body: 'E a de antes?',
    quote: { externalMessageId: externalId('2'), snippet: { type: 'sticker' } },
  })
  await expect(
    conversation
      .getByRole('listitem', { name: 'Mensagem recebida' })
      .filter({ hasText: 'E a de antes?' })
      .getByRole('button', { name: 'Citação de Cliente: 🖼️ Figurinha' }),
  ).toBeVisible()
})
