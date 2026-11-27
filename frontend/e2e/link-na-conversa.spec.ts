import { expect, request as apiRequest, type APIRequestContext } from '@playwright/test'
import { admin, openQueued, seedSector, signIn, test, unique, userPassword } from './fixtures'

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

test('link e e-mail no balão abrem como no WhatsApp Web, e o resto do texto fica igual', async ({
  page,
  context,
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
  await receive('Site https://exemplo.com/a?b=1, www.exemplo.com e fulano@exemplo.com.br.')
  await receive('Veja (https://x.com/a_(b)).')
  await receive('javascript:alert(1) e google.com continuam texto.')
  await receive('Recibo em https://exemplo.com/recibo', 'image', {
    data: png,
    mimeType: 'image/png',
  })
  await receive('veja o arquivo.pdf, a v1.2 e data:text/html,<b>oi</b>')
  await receive(
    'https://x.com/p1. https://x.com/p2, https://x.com/p3; https://x.com/p4: ' +
      'https://x.com/p5! https://x.com/p6? https://x.com/p7)',
  )
  await receive('(https://x.com/a)')
  await receive('https://a.com, fulano@b.com e www.c.com')
  await receive('Bom dia!\n\nTudo bem?  Sim.')
  await receive('abc.www.x.com, abc-www.x.com e a/www.x.com ficam texto; (www.x.com) vira link')

  await signIn(page, agent, userPassword)
  await openQueued(page, 'Lia Cliente')
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toHaveCount(10)

  // Endereço com esquema, www. e e-mail: cada um com o seu destino, e a frase sem alteração.
  const first = received.nth(0)
  await expect(first.locator('p.whitespace-pre-wrap')).toHaveText(
    'Site https://exemplo.com/a?b=1, www.exemplo.com e fulano@exemplo.com.br.',
  )
  const site = first.getByRole('link', { name: 'https://exemplo.com/a?b=1', exact: true })
  await expect(site).toHaveAttribute('href', 'https://exemplo.com/a?b=1')
  await expect(site).toHaveAttribute('target', '_blank')
  await expect(site).toHaveAttribute('rel', 'noopener noreferrer')
  const www = first.getByRole('link', { name: 'www.exemplo.com', exact: true })
  await expect(www).toHaveAttribute('href', 'https://www.exemplo.com')
  const email = first.getByRole('link', { name: 'fulano@exemplo.com.br', exact: true })
  await expect(email).toHaveAttribute('href', 'mailto:fulano@exemplo.com.br')
  await expect(email).not.toHaveAttribute('target', '_blank')

  // O parêntese que a URL abriu fica no link; o que fecha a frase não.
  await expect(
    received.nth(1).getByRole('link', { name: 'https://x.com/a_(b)', exact: true }),
  ).toHaveAttribute('href', 'https://x.com/a_(b)')

  // Esquema perigoso e domínio solto não viram link.
  await expect(received.nth(2).getByRole('link')).toHaveCount(0)

  // Legenda de imagem com URL mostra o link.
  await expect(
    received.nth(3).getByRole('link', { name: 'https://exemplo.com/recibo', exact: true }),
  ).toHaveAttribute('href', 'https://exemplo.com/recibo')

  // Extensão de arquivo, número de versão e esquema que não abre site continuam texto.
  const plain = received.nth(4)
  await expect(plain.locator('p.whitespace-pre-wrap')).toHaveText(
    'veja o arquivo.pdf, a v1.2 e data:text/html,<b>oi</b>',
  )
  await expect(plain.getByRole('link')).toHaveCount(0)

  // A pontuação do fim fica fora do link, uma a uma.
  const punctuation = received.nth(5)
  await expect(punctuation.locator('p.whitespace-pre-wrap')).toHaveText(
    'https://x.com/p1. https://x.com/p2, https://x.com/p3; https://x.com/p4: ' +
      'https://x.com/p5! https://x.com/p6? https://x.com/p7)',
  )
  const punctuated = punctuation.getByRole('link')
  await expect(punctuated).toHaveCount(7)
  const addresses = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map(
    (path) => `https://x.com/${path}`,
  )
  for (const [index, address] of addresses.entries()) {
    await expect(punctuated.nth(index)).toHaveText(address)
    await expect(punctuated.nth(index)).toHaveAttribute('href', address)
  }

  // O parêntese que abre a frase não entra no link, nem o que fecha.
  const parentheses = received.nth(6)
  await expect(parentheses.locator('p.whitespace-pre-wrap')).toHaveText('(https://x.com/a)')
  await expect(parentheses.getByRole('link')).toHaveCount(1)
  await expect(parentheses.getByRole('link')).toHaveText('https://x.com/a')
  await expect(parentheses.getByRole('link')).toHaveAttribute('href', 'https://x.com/a')

  // Vários links na mesma frase, na ordem em que aparecem.
  const many = received.nth(7)
  const manyLinks = many.getByRole('link')
  await expect(manyLinks).toHaveCount(3)
  for (const [index, [label, href]] of [
    ['https://a.com', 'https://a.com'],
    ['fulano@b.com', 'mailto:fulano@b.com'],
    ['www.c.com', 'https://www.c.com'],
  ].entries()) {
    await expect(manyLinks.nth(index)).toHaveText(label)
    await expect(manyLinks.nth(index)).toHaveAttribute('href', href)
  }

  // Linha em branco e espaço duplo saem como vieram, sem link nenhum.
  const spacing = received.nth(8)
  expect(
    await spacing.locator('p.whitespace-pre-wrap').evaluate((element) => element.textContent),
  ).toBe('Bom dia!\n\nTudo bem?  Sim.')
  await expect(spacing.getByRole('link')).toHaveCount(0)

  // "www." no meio de uma palavra não começa link, e o texto todo continua texto:
  // colado depois de letra e ponto, de hífen ou de barra. Depois de pontuação de
  // abertura, como o "(", ele começa.
  const glued = received.nth(9)
  await expect(glued.locator('p.whitespace-pre-wrap')).toHaveText(
    'abc.www.x.com, abc-www.x.com e a/www.x.com ficam texto; (www.x.com) vira link',
  )
  const afterParen = glued.getByRole('link')
  await expect(afterParen).toHaveCount(1)
  await expect(afterParen).toHaveText('www.x.com')
  await expect(afterParen).toHaveAttribute('href', 'https://www.x.com')

  // Clicar abre numa aba nova, com o endereço do link, e não dispara ação do balão.
  // O site de exemplo não existe: a resposta é servida aqui, sem sair para a internet.
  await context.route('https://exemplo.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<p>ok</p>' }),
  )
  const [popup] = await Promise.all([page.waitForEvent('popup'), site.click()])
  await expect(popup).toHaveURL('https://exemplo.com/a?b=1')
  await popup.close()
  await context.unroute('https://exemplo.com/**')
  await expect(page).not.toHaveURL(/\/atendimentos/)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // Mensagem enviada pelo atendente: o apelido continua em negrito e o link abre.
  const sending = page.waitForRequest(
    (req) => req.url().endsWith('/messages') && req.method() === 'POST',
  )
  await page
    .getByRole('textbox', { name: 'Mensagem' })
    .fill('O balancete está em https://exemplo.com/balancete.pdf.')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  await sending
  const sent = conversation
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'O balancete está' })
  await expect(sent).toContainText('Enviada')
  await expect(sent.locator('strong')).toHaveText(/agent \d+:/)
  await expect(sent.locator('p.whitespace-pre-wrap')).toHaveText(
    /agent \d+:\nO balancete está em https:\/\/exemplo\.com\/balancete\.pdf\./,
  )
  await expect(
    sent.getByRole('link', { name: 'https://exemplo.com/balancete.pdf', exact: true }),
  ).toHaveAttribute('href', 'https://exemplo.com/balancete.pdf')

  // Recarregar não muda o que a conversa mostra.
  await page.reload()
  await expect(
    conversation
      .getByRole('listitem', { name: 'Mensagem recebida' })
      .nth(0)
      .getByRole('link', { name: 'https://exemplo.com/a?b=1', exact: true }),
  ).toBeVisible()
})
