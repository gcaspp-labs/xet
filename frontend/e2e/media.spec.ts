import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Locator,
} from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword, openQueued } from './fixtures'

// PNG de 1×1 pixel, para a pré-visualização carregar uma imagem de verdade.
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// PNG liso de 240×160 pixels, grande o bastante para arrastar e dar zoom no visualizador.
const largePng =
  'iVBORw0KGgoAAAANSUhEUgAAAPAAAACgCAIAAAC9uXYyAAABRElEQVR42u3SQQ0AAAjEsJODRIQhEBV8SJMqWJbqgTciAYYGQ4OhwdAYGgwNhgZDg6ExNBgaDA2GBkNjaDA0GBoMDYbG0GBoMDQYGgyNocHQYGgwNBgaQ4OhwdBgaDA0hgZDg6HB0BgaDA2GBkODoTE0GBoMDYYGQ2NoMDQYGgwNhsbQYGgwNBgaDI2hwdBgaDA0GBpDg6HB0GBoMDSGBkODocHQYGgMDYYGQ4OhMTQYGgwNhgZDY2gwNBgaDA2GxtBgaDA0GBoMjaHB0GBoMDQYGkODocHQYGgwNIYGQ4OhwdBgaAwNhgZDg6ExtAoYGgwNhgZDY2gwNBgaDA2GxtBgaDA0GBoMjaHB0GBoMDQYGkODocHQYGgwNIYGQ4OhwdBgaAwNhgZDg6HB0BgaDA2GBkNjaDA0GBoMDYbG0GBoMDTcWOEhQ6qtXEgpAAAAAElFTkSuQmCC'

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
  await openQueued(page, 'Clara Cliente')

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
  await openQueued(page, 'Clara Cliente')
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toHaveCount(3)

  // Imagem com pré-visualização, que abre ampliada por cima da conversa.
  const image = received.nth(0).getByRole('img', { name: 'Imagem' })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
  await expect(received.nth(0)).toContainText('Foto do recibo')
  await expect(received.nth(0).getByRole('button', { name: 'Ampliar imagem' })).toBeVisible()
  await expect(received.nth(0).getByRole('link')).toHaveCount(0)
  // Vídeo e áudio com player no painel.
  await expect(received.nth(1).locator('video[controls]')).toHaveAttribute(
    'src',
    /^\/api\/media\/\d+$/,
  )
  await expect(received.nth(2).locator('audio')).toHaveAttribute('src', /^\/api\/media\/\d+$/)
  await expect(received.nth(2).getByLabel('Duração do áudio')).toHaveText('0:07')

  // Grava pelo microfone (simulado), ouve antes de enviar e envia como mensagem de voz.
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
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
  // O áudio sai sem legenda, portanto sem o apelido.
  const ticketId = page.url().split('/').pop()
  const messages = (await (await page.request.get(`/api/tickets/${ticketId}/messages`)).json()) as {
    direction: string
    body: string | null
  }[]
  expect(messages.filter((m) => m.direction === 'outbound').map((m) => m.body)).toEqual([null])
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
  await openQueued(page, 'Clara Cliente')
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })

  // Arquivo que o navegador não consegue ler: avisa e mantém a duração informada.
  await expect(received.nth(0)).toContainText('Áudio indisponível')
  await expect(received.nth(0).getByLabel('Duração do áudio')).toHaveText('0:03')

  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
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

test('a imagem abre por cima da conversa, com zoom, arrastar e abrir o original', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName: 'Clara Cliente',
    type: 'image',
    body: 'Foto do recibo',
    media: { data: largePng, mimeType: 'image/png' },
  })
  await signIn(page, agent, userPassword)
  await openQueued(page, 'Clara Cliente')
  const chamado = page.url()

  const viewer = page.getByRole('dialog', { name: 'Imagem ampliada' })
  const zoom = viewer.getByLabel('Zoom atual')
  const zoomIn = viewer.getByRole('button', { name: 'Aumentar zoom' })
  const zoomOut = viewer.getByRole('button', { name: 'Diminuir zoom' })
  const fit = viewer.getByRole('button', { name: 'Ajustar à tela' })
  const picture = viewer.getByRole('img', { name: 'Imagem ampliada' })
  const thumbnail = page.getByRole('button', { name: 'Ampliar imagem' })
  const open = async () => {
    await thumbnail.click()
    await expect(viewer).toBeVisible()
  }
  // Posição da imagem na tela, para saber se ela se mexeu.
  const origin = async () => {
    const box = (await picture.boundingBox())!
    return { x: Math.round(box.x), y: Math.round(box.y) }
  }
  // Espera a animação curta do zoom (150 ms) terminar: duas leituras iguais, 250 ms depois.
  const settled = async () => {
    let current = await origin()
    await expect
      .poll(async () => {
        const before = current
        await page.waitForTimeout(250)
        current = await origin()
        return current.x === before.x && current.y === before.y
      })
      .toBe(true)
    return current
  }

  // Abre por cima da conversa, sem guia nova nem mudar o endereço, a 100%.
  const popups: unknown[] = []
  page.context().on('page', (opened) => popups.push(opened))
  await open()
  expect(page.url()).toBe(chamado)
  expect(popups).toHaveLength(0)
  await expect(zoom).toHaveText('100%')
  await expect(zoomOut).toBeDisabled()
  await expect(zoomIn).toBeEnabled()

  // Botões + e −.
  await zoomIn.click()
  await expect(zoom).toHaveText('150%')
  await expect(zoomOut).toBeEnabled()
  await zoomOut.click()
  await expect(zoom).toHaveText('100%')

  // Ajustar à tela volta a 100%.
  await zoomIn.click()
  await zoomIn.click()
  await expect(zoom).toHaveText('200%')
  await fit.click()
  await expect(zoom).toHaveText('100%')

  // A 100% a imagem não arrasta.
  const fitted = await settled()
  const box = (await picture.boundingBox())!
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 80, center.y + 60, { steps: 4 })
  await page.mouse.up()
  expect(await settled()).toEqual(fitted)

  // Roda do mouse: de 100% até o máximo de 500%, que desativa o +.
  await page.mouse.move(center.x, center.y)
  await page.mouse.wheel(0, -100)
  await expect(zoom).toHaveText('125%')
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -100)
  await expect(zoom).toHaveText('500%')
  await expect(zoomIn).toBeDisabled()
  await page.mouse.wheel(0, 100)
  await expect(zoom).toHaveText('475%')
  await fit.click()

  // Acima de 100% a imagem arrasta.
  await zoomIn.click()
  await expect(zoom).toHaveText('150%')
  const zoomed = await settled()
  await page.mouse.move(center.x, center.y)
  await page.mouse.down()
  await page.mouse.move(center.x + 80, center.y + 60, { steps: 4 })
  await page.mouse.up()
  await expect.poll(origin).toEqual({ x: zoomed.x + 80, y: zoomed.y + 60 })
  // Clicar na própria imagem não fecha.
  await expect(viewer).toBeVisible()
  await fit.click()

  // Duplo clique alterna 100% e 200%.
  await picture.dblclick()
  await expect(zoom).toHaveText('200%')
  await picture.dblclick()
  await expect(zoom).toHaveText('100%')

  // Abrir original: guia nova, para o mesmo arquivo.
  const original = viewer.getByRole('link', { name: 'Abrir original em nova guia' })
  await expect(original).toHaveAttribute('href', /^\/api\/media\/\d+$/)
  await expect(original).toHaveAttribute('target', '_blank')
  await expect(original).toHaveAttribute('rel', /noopener/)
  await expect(picture).toHaveAttribute('src', (await original.getAttribute('href'))!)

  // Esc fecha, o foco volta à miniatura, e a próxima abertura começa a 100%.
  await zoomIn.click()
  await expect(zoom).toHaveText('150%')
  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
  await expect(thumbnail).toBeFocused()
  await open()
  await expect(zoom).toHaveText('100%')

  // O foco fica preso no visualizador.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab')
    await expect(viewer.locator(':focus')).toHaveCount(1)
  }

  // X fecha.
  await viewer.getByRole('button', { name: 'Fechar' }).click()
  await expect(viewer).toBeHidden()

  // Clique na área vazia, fora da imagem, fecha.
  await open()
  await page.mouse.click(20, 400)
  await expect(viewer).toBeHidden()
  expect(page.url()).toBe(chamado)
  expect(popups).toHaveLength(0)
})
