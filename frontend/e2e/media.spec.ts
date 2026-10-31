import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword } from './fixtures'

// PNG de 1×1 pixel, para a pré-visualização carregar uma imagem de verdade.
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

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

test('mídias recebidas aparecem no painel e o áudio gravado vai como mensagem de voz', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { phone: number } = unique()
  const receive = (type: string, media: object, body = '') =>
    phone(request, sector.id, 'receive', {
      externalMessageId: `E2E-${unique().id}`,
      phone: number,
      contactName: 'Clara Cliente',
      type,
      body,
      media,
    })
  await receive('image', { data: png, mimeType: 'image/png' }, 'Foto do recibo')
  await receive('video', { data: 'AAAA', mimeType: 'video/mp4', durationSeconds: 3 })
  await receive('audio', { data: 'T2dnUw==', mimeType: 'audio/ogg; codecs=opus' })

  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Clara Cliente' }).click()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toHaveCount(3)

  // Imagem com pré-visualização, que abre em tamanho real.
  const image = received.nth(0).getByRole('img', { name: 'Imagem' })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
  await expect(received.nth(0)).toContainText('Foto do recibo')
  await expect(
    received.nth(0).getByRole('link', { name: 'Abrir imagem em tamanho real' }),
  ).toHaveAttribute('href', /^\/api\/media\/\d+$/)
  // Vídeo e áudio com player no painel.
  await expect(received.nth(1).locator('video[controls]')).toHaveAttribute(
    'src',
    /^\/api\/media\/\d+$/,
  )
  await expect(received.nth(2).locator('audio[controls]')).toHaveAttribute(
    'src',
    /^\/api\/media\/\d+$/,
  )

  // Grava pelo microfone (simulado), ouve antes de enviar e envia como mensagem de voz.
  await page.getByRole('button', { name: 'Assumir' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await page.getByRole('button', { name: 'Gravar áudio' }).click()
  await expect(page.getByRole('status', { name: 'Gravação de áudio' })).toContainText('Gravando')
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Concluir gravação' }).click()
  await expect(page.getByLabel('Áudio gravado')).toBeVisible()
  await page.getByRole('button', { name: 'Enviar áudio' }).click()

  const voice = conversation.getByRole('listitem', { name: 'Mensagem enviada' })
  await expect(voice).toContainText('Enviada')
  const src = await voice.locator('audio[controls]').getAttribute('src')
  // O backend converteu a gravação para OGG/Opus, o formato da mensagem de voz do WhatsApp.
  const file = await page.request.get(src!)
  expect(file.ok()).toBeTruthy()
  expect(file.headers()['content-type']).toBe('audio/ogg; codecs=opus')
  expect((await file.body()).subarray(0, 4).toString()).toBe('OggS')
  await expect(page.getByRole('button', { name: 'Gravar áudio' })).toBeVisible()
})
