import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Locator,
} from '@playwright/test'
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

test('arquivo indisponível vira aviso na conversa e na última mensagem do painel', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { phone: number, id } = unique()
  const delivery = {
    externalMessageId: `E2E-${id}`,
    phone: number,
    contactName: 'Clara Cliente',
    type: 'media_unavailable',
    body: 'video-grande.mp4',
  }
  // A reentrega da mesma mensagem não duplica o aviso.
  await phone(request, sector.id, 'receive', delivery)
  await phone(request, sector.id, 'receive', delivery)

  await signIn(page, agent, userPassword)
  await expect(page.getByText('Arquivo não pôde ser baixado: video-grande.mp4')).toBeVisible()
  await page.getByRole('link', { name: 'Clara Cliente' }).click()

  const received = page
    .getByRole('region', { name: 'Conversa', exact: true })
    .getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toHaveCount(1)
  await expect(received).toContainText('Arquivo não pôde ser baixado')
  await expect(received).toContainText('video-grande.mp4')
})

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
  await receive('audio', {
    data: 'T2dnUw==',
    mimeType: 'audio/ogg; codecs=opus',
    durationSeconds: 7,
  })

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
  await expect(received.nth(2).locator('audio')).toHaveAttribute('src', /^\/api\/media\/\d+$/)
  await expect(received.nth(2).getByLabel('Duração do áudio')).toHaveText('0:07')

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
  // O envio só responde depois da conversão com ffmpeg, mais lenta com a máquina carregada.
  await expect(voice).toContainText('Enviada', { timeout: 15_000 })
  await expect(voice.getByLabel('Duração do áudio')).toHaveText(/^0:0[12]$/)
  const src = await voice.locator('audio').getAttribute('src')
  // O backend converteu a gravação para OGG/Opus, o formato da mensagem de voz do WhatsApp.
  const file = await page.request.get(src!)
  expect(file.ok()).toBeTruthy()
  expect(file.headers()['content-type']).toBe('audio/ogg; codecs=opus')
  expect((await file.body()).subarray(0, 4).toString()).toBe('OggS')
  await expect(page.getByRole('button', { name: 'Gravar áudio' })).toBeVisible()
})

// Toca até o tempo avançar e pausa; a barra deixa de andar com o áudio pausado.
async function playAndPause(player: Locator) {
  await player.getByRole('button', { name: 'Tocar áudio' }).click()
  await expect(player.getByLabel('Tempo do áudio')).not.toHaveText('0:00', { timeout: 5_000 })
  await player.getByRole('button', { name: 'Pausar áudio' }).click()
  await expect(player.getByRole('button', { name: 'Tocar áudio' })).toBeVisible()
  await expect.poll(() => position(player)).toBeGreaterThan(0)
}

const position = (player: Locator) =>
  player.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)

test('player de áudio toca, avança e responde ao teclado na gravação e nas mensagens', async ({
  page,
  request,
  baseURL,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { phone: number } = unique()
  const receive = (data: string) =>
    phone(request, sector.id, 'receive', {
      externalMessageId: `E2E-${unique().id}`,
      phone: number,
      contactName: 'Clara Cliente',
      type: 'audio',
      media: { data, mimeType: 'audio/ogg; codecs=opus', durationSeconds: 3 },
    })
  await receive('T2dnUw==')

  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Clara Cliente' }).click()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })

  // Arquivo que o navegador não consegue ler: avisa e mantém a duração informada.
  await expect(received.nth(0)).toContainText('Áudio indisponível')
  await expect(received.nth(0).getByLabel('Duração do áudio')).toHaveText('0:03')

  await page.getByRole('button', { name: 'Assumir' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await page.getByRole('button', { name: 'Gravar áudio' }).click()
  await expect(page.getByRole('status', { name: 'Gravação de áudio' })).toContainText('Gravando')
  await page.waitForTimeout(3500)
  await page.getByRole('button', { name: 'Concluir gravação' }).click()

  // Gravação: sem controles nativos, duração uma única vez, toca, avança e volta ao início.
  const recorded = page.getByRole('group', { name: 'Áudio gravado' })
  await expect(recorded.locator('audio')).not.toHaveAttribute('controls')
  await expect(recorded.getByLabel('Duração do áudio')).toHaveText(/^0:03$/)
  await expect(recorded).toContainText(/^0:00 \/ 0:03$/)
  await playAndPause(recorded)

  // A barra funciona por teclado.
  const bar = recorded.getByRole('slider', { name: 'Posição do áudio' })
  await bar.focus()
  const before = await position(recorded)
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => position(recorded)).toBeGreaterThan(before)
  await page.keyboard.press('Home')
  await expect.poll(() => position(recorded)).toBe(0)
  await expect(recorded.getByLabel('Tempo do áudio')).toHaveText('0:00')

  // Em tela estreita, o botão de enviar continua visível.
  await page.setViewportSize({ width: 320, height: 640 })
  const sendAudio = page.getByRole('button', { name: 'Enviar áudio' })
  await sendAudio.scrollIntoViewIfNeeded()
  await expect(sendAudio).toBeInViewport({ ratio: 1 })
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320)
  await expect(bar).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 720 })
  await sendAudio.click()

  // Mensagem enviada.
  const sent = conversation.getByRole('listitem', { name: 'Mensagem enviada' })
  await expect(sent).toContainText('Enviada', { timeout: 15_000 })
  const sentPlayer = sent.getByRole('group', { name: 'Áudio' })
  await playAndPause(sentPlayer)

  // Mensagem recebida, com um arquivo que o navegador lê, no tema claro e no escuro.
  const src = await sent.locator('audio').getAttribute('src')
  const file = await page.request.get(src!)
  await receive((await file.body()).toString('base64'))
  await expect(received).toHaveCount(2)
  const receivedPlayer = received.nth(1).getByRole('group', { name: 'Áudio' })
  await playAndPause(receivedPlayer)
  const lightSurface = await receivedPlayer.evaluate((el) => getComputedStyle(el).backgroundColor)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(16, 21, 23)')
  await expect(receivedPlayer).not.toHaveCSS('background-color', lightSurface)
  await playAndPause(receivedPlayer)
})
