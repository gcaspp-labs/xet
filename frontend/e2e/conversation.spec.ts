import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword } from './fixtures'

// Liga o número do setor pelo adaptador falso: conectar e o celular ler o QR code.
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

test('responsável conversa com o cliente pelo painel e outro atendente é bloqueado', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { phone: number } = unique()
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: number,
    contactName: 'Maria Cliente',
    body: '*Cliente:*\nBom dia, preciso do balancete',
  })

  // O atendente assume o chamado pela tela da conversa.
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Maria Cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Maria Cliente' })).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toContainText('*Cliente:*')
  await expect(received.locator('strong')).toHaveCount(0)
  await expect(conversation).toContainText('Chamado na fila. Assuma o chamado para responder.')
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  // O supervisor acompanha a mesma conversa em outra janela, sem poder responder.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await other.goto(page.url())
  const otherConversation = other.getByRole('region', { name: 'Conversa', exact: true })
  await expect(otherConversation).toContainText(/Chamado com agent \d+\. Peça a transferência/)
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)

  // Texto: Enter envia; o identificador do envio dá o id da mensagem no WhatsApp falso.
  const sending = page.waitForRequest(
    (req) => req.url().endsWith('/messages') && req.method() === 'POST',
  )
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Segue o balancete em anexo.')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  const { clientRequestId } = (await sending).postDataJSON() as { clientRequestId: string }
  const sent = conversation
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Segue o balancete em anexo.' })
  await expect(sent).toContainText('Enviada')
  // O painel mostra o texto como o cliente recebeu, com o apelido de quem enviou.
  await expect(sent.locator('strong')).toHaveText(/agent \d+:/)
  await expect(sent.locator('p.whitespace-pre-wrap')).toHaveText(
    /agent \d+:\nSegue o balancete em anexo\./,
  )
  await expect(sent.locator('p.whitespace-pre-wrap')).not.toContainText('*')
  const preview = page
    .getByRole('navigation', { name: 'Meus chamados' })
    .getByRole('link', { name: /Maria Cliente/ })
  await expect(preview).toContainText('Segue o balancete em anexo.')
  await expect(preview).not.toContainText('*')
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('')
  // A outra janela recebe a mensagem sem recarregar.
  await expect(otherConversation).toContainText('Segue o balancete em anexo.')

  // Situação de entrega informada pelo celular do cliente.
  await phone(request, sector.id, 'status', {
    status: 'read',
    externalMessageIds: [`fake-msg-${clientRequestId}`],
  })
  await expect(sent).toContainText('Lida')

  // Arquivo com legenda.
  await page.getByLabel('Arquivo para enviar').setInputFiles({
    name: 'balancete.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 balancete'),
  })
  await page.getByRole('textbox', { name: 'Legenda do arquivo' }).fill('Balancete de outubro')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  const file = conversation
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'balancete.pdf' })
  await expect(file).toContainText('Enviada')
  await expect(file.locator('strong')).toHaveText(/agent \d+:/)
  await expect(file.locator('p.whitespace-pre-wrap')).toHaveText(/agent \d+:\nBalancete de outubro/)
  await expect(file.locator('p.whitespace-pre-wrap')).not.toContainText('*')
  await page.reload()
  await expect(sent.locator('strong')).toHaveText(/agent \d+:/)
  await expect(file.locator('strong')).toHaveText(/agent \d+:/)
  await expect(received).toContainText('*Cliente:*')
  await expect(file.getByRole('link', { name: /balancete\.pdf/ })).toHaveAttribute(
    'href',
    /^\/api\/media\/\d+$/,
  )

  // Chamando a API diretamente, o supervisor também é bloqueado.
  const ticketId = page.url().split('/').pop()
  const blocked = await other.request.post(`/api/tickets/${ticketId}/messages`, {
    data: { clientRequestId: crypto.randomUUID(), body: 'Resposta indevida' },
  })
  expect(blocked.status()).toBe(403)
  await expect(conversation).not.toContainText('Resposta indevida')

  // Notas internas e "Falou com" saíram: sem aba, sem campo e sem as rotas.
  for (const screen of [page, other]) {
    await expect(screen.getByRole('tab', { name: 'Notas' })).toHaveCount(0)
    await expect(screen.getByLabel('Falou com')).toHaveCount(0)
    await expect(screen.getByText('Falou com')).toHaveCount(0)
  }
  expect((await page.request.get(`/api/tickets/${ticketId}/notes`)).status()).toBe(404)
  expect(
    (
      await page.request.put(`/api/tickets/${ticketId}/spoke-with`, {
        data: { spokeWith: 'Maria' },
      })
    ).status(),
  ).toBe(404)

  // Meus chamados: o atual marcado; um chamado novo chega à Fila sem recarregar e abre ao assumir.
  const list = page.getByRole('navigation', { name: 'Meus chamados' })
  await expect(list.getByRole('link', { name: /Maria Cliente/ })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName: 'Pedro Cliente',
    body: 'Boa tarde',
  })
  const queue = page.getByRole('region', { name: 'Fila e assuntos' })
  await expect(queue).toContainText('Pedro Cliente')
  await expect(queue).toContainText('Boa tarde')
  await queue.getByRole('button', { name: 'Assumir chamado de Pedro Cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Pedro Cliente' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Boa tarde',
  )
  await otherContext.close()
})

test('assumir pelo botão do chamado na fila mostra o novo responsável', async ({
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
    contactName: 'Caio Aberto',
    body: 'Olá',
  })
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Caio Aberto' }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText('Chamado na fila. Assuma o chamado para responder.')
  const openedAt = page.url()

  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  expect(page.url()).toBe(openedAt)
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Meus chamados' }).getByRole('link', {
      name: /Caio Aberto/,
    }),
  ).toBeVisible()
})

test('mensagem que falhou é reenviada pelo responsável', async ({ page, request, baseURL }) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName: 'João Cliente',
    body: 'Olá',
  })
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'João Cliente' }).click()
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  // Número desconectado: a mensagem fica como falha, sem reenvio automático.
  await phone(request, sector.id, 'drop')
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Bom dia')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  const message = page
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Bom dia' })
  await expect(message).toContainText('Falhou')
  await expect(message).toContainText('Número do setor desconectado.')

  await connectSector(baseURL!, sector.id)
  await message.getByRole('button', { name: 'Reenviar' }).click()
  await expect(message).toContainText('Enviada')
  await expect(message).not.toContainText('Falhou')
  await expect(page.getByRole('listitem', { name: 'Mensagem enviada' })).toHaveCount(1)
})
