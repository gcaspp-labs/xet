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
  await page.getByRole('link', { name: 'Ver chamado' }).click()
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
    .getByRole('navigation', { name: 'Conversas abertas' })
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

  // Lista de conversas do setor ao lado: a atual marcada, uma nova chega sem recarregar.
  const list = page.getByRole('navigation', { name: 'Conversas abertas' })
  await expect(list.getByRole('link', { name: /Maria Cliente/ })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(list.getByRole('link', { name: /Maria Cliente/ })).toContainText('Você')
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName: 'Pedro Cliente',
    body: 'Boa tarde',
  })
  const pedro = list.getByRole('link', { name: /Pedro Cliente/ })
  await expect(pedro).toContainText('Boa tarde')
  await expect(list.getByRole('region', { name: 'Na fila (1)' })).toContainText('Pedro Cliente')
  await pedro.click()
  await expect(page.getByRole('heading', { name: 'Pedro Cliente' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Boa tarde',
  )
  await otherContext.close()
})

test('assumir pela lista não muda a tela nem apaga o texto em digitação', async ({
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
    contactName: 'Ana Aberta',
    body: 'Primeira conversa',
  })
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Ana Aberta' }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  // O aviso deste chamado sai antes, para o seguinte não empilhar sobre ele.
  const notice = page.getByText('Chamado assumido')
  await expect(notice).toBeVisible()
  await expect(notice).toBeHidden()
  const draft = page.getByRole('textbox', { name: 'Mensagem' })
  await draft.fill('Texto ainda em digitação')
  const openedAt = page.url()

  // Só com chamado na fila a seção aparece, com a prévia e o botão fora do link.
  const list = page.getByRole('navigation', { name: 'Conversas abertas' })
  await expect(list.getByRole('heading', { name: /Na fila/ })).toHaveCount(0)
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName: 'Bia Fila',
    body: 'Mensagem na fila',
  })
  const queue = list.getByRole('region', { name: 'Na fila (1)' })
  await expect(queue.getByRole('link', { name: /Bia Fila/ })).toContainText('Mensagem na fila')
  await expect(queue.getByRole('link').getByRole('button')).toHaveCount(0)

  await queue.getByRole('button', { name: 'Assumir chamado de Bia Fila' }).click()
  await expect(notice).toBeVisible()
  // Com o mouse em cima, o aviso não some antes de clicar no link.
  const openConversation = page.getByRole('link', { name: 'Abrir conversa' })
  await openConversation.hover()
  expect(page.url()).toBe(openedAt)
  await expect(page.getByRole('heading', { name: 'Ana Aberta' })).toBeVisible()
  await expect(draft).toHaveValue('Texto ainda em digitação')

  // O chamado sai da fila, a seção vazia some e ele aparece como do usuário.
  await expect(list.getByRole('heading', { name: /Na fila/ })).toHaveCount(0)
  await expect(list.getByRole('link', { name: /Bia Fila/ })).toContainText('Você')

  // O link do aviso abre a conversa assumida, já com a caixa de resposta.
  await openConversation.click()
  await expect(page.getByRole('heading', { name: 'Bia Fila' })).toBeVisible()
  await expect(draft).toBeVisible()
})

test('assumir pela lista a conversa aberta mostra o novo responsável', async ({
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
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  const details = page.getByRole('region', { name: 'Chamado' })
  await expect(details).toContainText('Sem responsável')
  const openedAt = page.url()

  await page.getByRole('button', { name: 'Assumir chamado de Caio Aberto' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  expect(page.url()).toBe(openedAt)
  await expect(details).toContainText(/agent \d+/)
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
})

test('quem perde a disputa pela lista vê o erro e o chamado sai da fila', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  for (const contactName of ['Duda Aberta', 'Enzo Disputado']) {
    await phone(request, sector.id, 'receive', {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName,
      body: 'Olá',
    })
  }
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Duda Aberta' }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()

  // Sem o WebSocket, a janela do colega continua mostrando o chamado na fila.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await other.routeWebSocket(/\/api\/ws$/, () => {})
  await signIn(other, supervisor, userPassword)
  await other.getByRole('link', { name: 'Duda Aberta' }).click()
  await other.getByRole('link', { name: 'Ver chamado' }).click()
  const otherQueue = other.getByRole('region', { name: 'Na fila (2)' })
  const contested = otherQueue.getByRole('button', { name: 'Assumir chamado de Enzo Disputado' })
  await expect(contested).toBeVisible()

  await page.getByRole('button', { name: 'Assumir chamado de Enzo Disputado' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  await contested.click()
  const conflict = other
    .getByRole('region', { name: 'Conversas do setor' })
    .getByRole('alert')
    .filter({ hasText: 'Este chamado já foi assumido por outro atendente.' })
  await expect(conflict).toBeVisible()
  const otherList = other.getByRole('navigation', { name: 'Conversas abertas' })
  const remaining = otherList.getByRole('region', { name: 'Na fila (1)' })
  await expect(remaining.getByRole('link', { name: /Enzo Disputado/ })).toHaveCount(0)
  await expect(otherList.getByRole('link', { name: /Enzo Disputado/ })).toContainText(/agent \d+/)
  await expect(other.getByText('Chamado assumido')).toHaveCount(0)

  // Ao trocar de conversa, o erro da tentativa anterior some.
  await otherList.getByRole('link', { name: /Enzo Disputado/ }).click()
  await expect(other.getByRole('heading', { name: 'Enzo Disputado' })).toBeVisible()
  await expect(conflict).toHaveCount(0)
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
  await page.getByRole('link', { name: 'Ver chamado' }).click()
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
