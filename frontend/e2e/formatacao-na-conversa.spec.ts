import { expect, request as apiRequest, type APIRequestContext } from '@playwright/test'
import {
  admin,
  openQueued,
  queuedTicketId,
  seedSector,
  signIn,
  test,
  unique,
  userPassword,
} from './fixtures'

// PNG de 1×1 pixel, para a legenda de uma imagem de verdade.
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

test('a formatação do WhatsApp aparece no balão, como no WhatsApp Web', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { phone: number } = unique()
  const receive = (body: string, type = 'text', media?: object) =>
    phone(request, sector.id, 'receive', {
      externalMessageId: `E2E-${unique().id}`,
      phone: number,
      contactName: 'Lia Cliente',
      type,
      body,
      ...(media ? { media } : {}),
    })
  await receive('*urgente*: o prazo é amanhã')
  await receive('Veja _isso_ e ~aquilo~ agora')
  await receive('*_combinado_* e *negrito _com itálico_ junto*')
  await receive('2*3*4, * solto * e arquivo_v1_final.pdf ficam texto')
  await receive('https://x.com/a_b_c')
  await receive('```linha 1\nlinha 2```')
  await receive('```veja https://x.com/a_b_c e *forte*```')
  await receive('use `npm ci` agora')
  await receive('*a\nb*')
  await receive('Legenda com *forte* e _calma_', 'image', { data: png, mimeType: 'image/png' })
  await receive('Bom dia!\n\nTudo bem?  Sim.')

  await signIn(page, agent, userPassword)
  await openQueued(page, 'Lia Cliente')
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toHaveCount(11)

  // Negrito, itálico e riscado: os símbolos somem e o texto continua o mesmo.
  const bold = received.nth(0)
  await expect(bold.locator('p.whitespace-pre-wrap')).toHaveText('urgente: o prazo é amanhã')
  await expect(bold.locator('strong')).toHaveText('urgente')

  const mixed = received.nth(1)
  await expect(mixed.locator('p.whitespace-pre-wrap')).toHaveText('Veja isso e aquilo agora')
  await expect(mixed.locator('em')).toHaveText('isso')
  await expect(mixed.locator('s')).toHaveText('aquilo')

  // As marcações se combinam: negrito com itálico dentro, e itálico com negrito dentro.
  const combined = received.nth(2)
  await expect(combined.locator('strong').nth(0).locator('em')).toHaveText('combinado')
  await expect(combined.locator('strong').nth(1)).toHaveText('negrito com itálico junto')
  await expect(combined.locator('strong').nth(1).locator('em')).toHaveText('com itálico')

  // Sem espaço dos dois lados e sem encostar na palavra seguinte, não formata.
  const loose = received.nth(3)
  await expect(loose.locator('p.whitespace-pre-wrap')).toHaveText(
    '2*3*4, * solto * e arquivo_v1_final.pdf ficam texto',
  )
  await expect(loose.locator('strong')).toHaveCount(0)
  await expect(loose.locator('em')).toHaveCount(0)

  // O "_" dentro do link não vira itálico, e o endereço todo continua um link só.
  const linked = received.nth(4)
  const linkedAnchor = linked.getByRole('link')
  await expect(linkedAnchor).toHaveCount(1)
  await expect(linkedAnchor).toHaveAttribute('href', 'https://x.com/a_b_c')
  await expect(linkedAnchor).toHaveText('https://x.com/a_b_c')
  await expect(linked.locator('em')).toHaveCount(0)

  // O bloco de monoespacado atravessa a quebra de linha, e dentro dele nada formata nem vira link.
  const block = received.nth(5)
  const blockCode = block.locator('code')
  await expect(blockCode).toHaveText('linha 1\nlinha 2')
  expect(await blockCode.evaluate((element) => getComputedStyle(element).fontFamily)).toContain(
    'IBM Plex Mono',
  )
  expect(await blockCode.evaluate((element) => getComputedStyle(element).display)).toBe('block')

  const blockNoLink = received.nth(6)
  await expect(blockNoLink.locator('code')).toHaveText('veja https://x.com/a_b_c e *forte*')
  await expect(blockNoLink.getByRole('link')).toHaveCount(0)
  await expect(blockNoLink.locator('strong')).toHaveCount(0)

  // Código em linha: a crase some e o trecho sai em monoespaçado.
  const inline = received.nth(7)
  await expect(inline.locator('p.whitespace-pre-wrap')).toHaveText('use npm ci agora')
  const inlineCode = inline.locator('code')
  await expect(inlineCode).toHaveText('npm ci')
  expect(await inlineCode.evaluate((element) => getComputedStyle(element).display)).toBe('inline')

  // Formatação não atravessa quebra de linha: os símbolos ficam no texto.
  const acrossLines = received.nth(8)
  expect(
    await acrossLines.locator('p.whitespace-pre-wrap').evaluate((element) => element.textContent),
  ).toBe('*a\nb*')
  await expect(acrossLines.locator('strong')).toHaveCount(0)

  // A legenda de mídia formata como o texto do balão.
  const caption = received.nth(9)
  await expect(caption.locator('p.whitespace-pre-wrap')).toHaveText('Legenda com forte e calma')
  await expect(caption.locator('strong')).toHaveText('forte')
  await expect(caption.locator('em')).toHaveText('calma')

  // Texto sem marcador sai igual a hoje, com as quebras e os espaços.
  const plain = received.nth(10)
  expect(
    await plain.locator('p.whitespace-pre-wrap').evaluate((element) => element.textContent),
  ).toBe('Bom dia!\n\nTudo bem?  Sim.')
  await expect(plain.locator('strong')).toHaveCount(0)

  // Mensagem enviada: o texto guardado e enviado não muda, mas o balão mostra a formatação.
  const sentText = 'Mensagem *importante*, _calma_ e ~antiga~.'
  const sending = page.waitForRequest(
    (req) => req.url().endsWith('/messages') && req.method() === 'POST',
  )
  await page.getByRole('textbox', { name: 'Mensagem' }).fill(sentText)
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  const sentRequest = await sending
  expect((sentRequest.postDataJSON() as { body: string }).body).toBe(sentText)

  const sent = conversation
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Mensagem importante' })
  await expect(sent).toContainText('Enviada')
  const sentBubble = sent.locator('p.whitespace-pre-wrap')
  await expect(sentBubble).toHaveText(/agent \d+:\nMensagem importante, calma e antiga\./)
  const sentStrong = sentBubble.locator('strong')
  await expect(sentStrong).toHaveCount(2)
  await expect(sentStrong.nth(0)).toHaveText(/agent \d+:/)
  await expect(sentStrong.nth(1)).toHaveText('importante')
  await expect(sentBubble.locator('em')).toHaveText('calma')
  await expect(sentBubble.locator('s')).toHaveText('antiga')

  // Recarregar não muda o que a conversa mostra.
  await page.reload()
  await expect(
    conversation
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .filter({ hasText: 'Mensagem importante' })
      .locator('strong')
      .nth(1),
  ).toHaveText('importante')
})

// Uma mensagem longa sem espaços (um hash, um base64, uma chave colada) já congelou a
// conversa: o scanner de link procurava o resto do texto a partir de cada letra e a tela
// ficava parada por segundos a cada desenho. Aqui a conversa tem que abrir em tempo normal
// e mostrar o texto inteiro, sem formatar nada.
test('texto longo sem espaços abre a conversa em tempo normal', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { phone: number } = unique()
  const long = 'a1b2c3d4'.repeat(1000) // 8.000 caracteres, sem espaço nem marcador
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: number,
    contactName: 'Lia Longa',
    type: 'text',
    body: long,
  })

  await signIn(page, agent, userPassword)
  const ticketId = await queuedTicketId(page, 'Lia Longa', sector.id)

  // A conversa desenha todas as mensagens ao abrir o chamado. O teto de 10 s é folgado para
  // a máquina de desenvolvimento e para o CI, e muito abaixo dos 98 s que o defeito levava
  // com este mesmo texto (medido no Node 24, com a expressão sem a flag "y").
  const started = Date.now()
  await page.goto(`/chamados/${ticketId}`)
  const bubble = page
    .getByRole('region', { name: 'Conversa', exact: true })
    .getByRole('listitem', { name: 'Mensagem recebida' })
    .locator('p.whitespace-pre-wrap')
  await expect(bubble).toHaveText(long, { timeout: 10_000 })
  const elapsed = Date.now() - started
  expect(elapsed, 'texto longo sem espaços tem que desenhar em tempo normal').toBeLessThan(10_000)
  await expect(bubble.locator('strong')).toHaveCount(0)
  await expect(bubble.locator('em')).toHaveCount(0)
})
