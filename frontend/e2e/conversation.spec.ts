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
    body: 'Bom dia, preciso do balancete',
  })

  // O atendente assume o chamado pela tela da conversa.
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Maria Cliente' }).click()
  await expect(page.getByRole('heading', { name: 'Maria Cliente' })).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversa' })
  await expect(conversation).toContainText('Bom dia, preciso do balancete')
  await expect(conversation).toContainText('Chamado na fila. Assuma o chamado para responder.')
  await page.getByRole('button', { name: 'Assumir' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  // O supervisor acompanha a mesma conversa em outra janela, sem poder responder.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await other.goto(page.url())
  const otherConversation = other.getByRole('region', { name: 'Conversa' })
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
  await expect(file).toContainText('Balancete de outubro')
  await expect(file).toContainText('Enviada')
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

  // Notas internas: qualquer pessoa do setor escreve; o responsável vê sem recarregar.
  await other.getByRole('tab', { name: 'Notas' }).click()
  await other.getByLabel('Nova nota').fill('Cliente pediu retorno até sexta.')
  await other.getByRole('button', { name: 'Adicionar nota' }).click()
  await expect(other.getByText('Nota adicionada')).toBeVisible()
  await page.getByRole('tab', { name: 'Notas' }).click()
  await expect(page.getByRole('list', { name: 'Notas internas' })).toContainText(
    'Cliente pediu retorno até sexta.',
  )

  // "Falou com", só pelo responsável.
  await page.getByRole('tab', { name: 'Detalhes' }).click()
  await page.getByLabel('Falou com').fill('Maria, esposa do titular')
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Falou com salvo')).toBeVisible()
  await other.getByRole('tab', { name: 'Detalhes' }).click()
  await expect(other.getByText('Maria, esposa do titular')).toBeVisible()
  await expect(other.getByLabel('Falou com')).toHaveCount(0)

  // Histórico do contato mostra este chamado.
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(page.getByRole('list', { name: 'Chamados do contato' })).toContainText(
    'Este chamado',
  )
  await otherContext.close()
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
  await page.getByRole('button', { name: 'Assumir' }).click()
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
