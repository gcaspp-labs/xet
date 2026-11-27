import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword, openQueued } from './fixtures'

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
  await openQueued(page, 'Maria Cliente')
  await expect(page.getByRole('heading', { name: 'Maria Cliente' })).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toContainText('Cliente:')
  await expect(received.locator('strong')).toHaveText('Cliente:')
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
  await expect(received).toContainText('Cliente:')
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
  const queue = page.getByRole('region', { name: 'Fila, assuntos e pendentes' })
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
  await openQueued(page, 'Caio Aberto')
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
  await openQueued(page, 'João Cliente')
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

// Abre o chamado de um contato que está na fila e o assume, deixando o compositor à vista.
async function assume(page: Page, contactName: string) {
  await openQueued(page, contactName)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
}

test('rascunho da mensagem volta ao recarregar e ao trocar de chamado, e some ao enviar', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { id } = unique()
  const first = `Ana Rascunho ${id}`
  const second = `Bia Rascunho ${id}`
  for (const contactName of [first, second]) {
    await phone(request, sector.id, 'receive', {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName,
      body: 'Olá',
    })
  }

  await signIn(page, agent, userPassword)
  await assume(page, first)
  const field = page.getByRole('textbox', { name: 'Mensagem' })
  const typed = 'Segue o balancete de outubro, com a planilha.'
  await field.fill(typed)

  // Recarregar devolve o texto, com o cursor no fim, pronto para continuar.
  await page.reload()
  await expect(field).toHaveValue(typed)
  expect(
    await field.evaluate((element) => {
      const input = element as HTMLTextAreaElement
      return (
        input.selectionStart === input.value.length && input.selectionEnd === input.value.length
      )
    }),
  ).toBe(true)

  // Outro chamado começa vazio; o rascunho de cada um volta ao trocar pela lista de Meus chamados.
  await page.goto('/chamados')
  const queue = page.getByRole('region', { name: 'Fila, assuntos e pendentes' })
  await queue.getByRole('button', { name: `Assumir chamado de ${second}` }).click()
  await expect(page.getByRole('heading', { name: second })).toBeVisible()
  await expect(field).toHaveValue('')
  await field.fill('Rascunho da Bia')
  const mine = page.getByRole('navigation', { name: 'Meus chamados' })
  await mine.getByRole('link', { name: new RegExp(first) }).click()
  await expect(page.getByRole('heading', { name: first })).toBeVisible()
  await expect(field).toHaveValue(typed)
  await mine.getByRole('link', { name: new RegExp(second) }).click()
  await expect(page.getByRole('heading', { name: second })).toBeVisible()
  await expect(field).toHaveValue('Rascunho da Bia')

  // Enviar limpa o rascunho daquele chamado, e recarregar mostra o campo vazio.
  await field.press('Enter')
  await expect(
    page.getByRole('listitem', { name: 'Mensagem enviada' }).filter({ hasText: 'Rascunho da Bia' }),
  ).toContainText('Enviada')
  await expect(field).toHaveValue('')
  await page.reload()
  await expect(field).toHaveValue('')

  // Apagar todo o texto também limpa, e o rascunho do outro chamado continua onde estava.
  await mine.getByRole('link', { name: new RegExp(first) }).click()
  await expect(field).toHaveValue(typed)
  await field.fill('')
  await page.reload()
  await expect(field).toHaveValue('')
  await mine.getByRole('link', { name: new RegExp(second) }).click()
  await expect(field).toHaveValue('')
})

test('sair da conta apaga os rascunhos do usuário', async ({ page, request, baseURL }) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const contactName = `Carla Rascunho ${unique().id}`
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName,
    body: 'Olá',
  })

  await signIn(page, agent, userPassword)
  await assume(page, contactName)
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Texto que não vai ao cliente')
  // O rascunho fica no armazenamento do navegador, como a pessoa digitou.
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('message-draft.')),
    ),
  ).toHaveLength(1)

  // Computador compartilhado: sair da conta leva junto o que estava escrito.
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('message-draft.')),
    ),
  ).toHaveLength(0)

  // Ao entrar de novo no mesmo navegador, o campo volta vazio.
  await signIn(page, agent, userPassword)
  await page
    .getByRole('navigation', { name: 'Meus chamados' })
    .getByRole('link', { name: contactName })
    .click()
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('')
})

test('sem acesso ao armazenamento do navegador, a tela funciona e não há rascunho', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const contactName = `Duda Rascunho ${unique().id}`
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName,
    body: 'Olá',
  })

  // Armazenamento bloqueado (por política do navegador ou cheio): toda leitura e escrita falha.
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('Armazenamento bloqueado', 'SecurityError')
    }
    Storage.prototype.getItem = blocked
    Storage.prototype.setItem = blocked
    Storage.prototype.removeItem = blocked
    Storage.prototype.clear = blocked
  })

  await signIn(page, agent, userPassword)
  await assume(page, contactName)
  const field = page.getByRole('textbox', { name: 'Mensagem' })
  await field.fill('Mensagem sem rascunho')
  await field.press('Enter')
  await expect(
    page
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .filter({ hasText: 'Mensagem sem rascunho' }),
  ).toContainText('Enviada')
  await expect(page.getByText('Não foi possível')).toHaveCount(0)

  // Sem armazenamento, não há o que restaurar: o campo volta vazio, sem erro na tela.
  await page.reload()
  await expect(field).toHaveValue('')
})

// Enviar e trocar de chamado na sequência: a resposta do servidor chega com o outro chamado aberto, e
// o campo dele não pode ser limpo nem perder o rascunho guardado.
test('rascunho do outro chamado continua ao enviar e trocar de chamado em seguida', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { id } = unique()
  const first = `Elis Rascunho ${id}`
  const second = `Fabio Rascunho ${id}`
  for (const contactName of [first, second]) {
    await phone(request, sector.id, 'receive', {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName,
      body: 'Olá',
    })
  }

  await signIn(page, agent, userPassword)
  const field = page.getByRole('textbox', { name: 'Mensagem' })
  const mine = page.getByRole('navigation', { name: 'Meus chamados' })
  const open = async (contactName: string) => {
    await mine.getByRole('link', { name: new RegExp(contactName) }).click()
    await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  }

  // Cada chamado ganha o seu rascunho.
  await assume(page, first)
  await field.fill('Rascunho da Elis')
  await page.goto('/chamados')
  const queue = page.getByRole('region', { name: 'Fila, assuntos e pendentes' })
  await queue.getByRole('button', { name: `Assumir chamado de ${second}` }).click()
  await expect(page.getByRole('heading', { name: second })).toBeVisible()
  await field.fill('Rascunho do Fabio')

  // O envio demora: dá tempo de trocar de chamado antes de o servidor confirmar.
  await page.route('**/api/tickets/*/messages', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    await route.continue()
  })
  await open(first)
  await expect(field).toHaveValue('Rascunho da Elis')
  const sent = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/messages'),
  )
  await field.press('Enter')
  await open(second)
  await sent

  // O campo do chamado novo abre com o rascunho dele e continua assim depois da confirmação: só o
  // rascunho do chamado enviado sai do armazenamento, o do chamado aberto fica.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith('message-draft.')),
      ),
    )
    .toHaveLength(1)
  await expect(field).toHaveValue('Rascunho do Fabio')
  await page.reload()
  await expect(field).toHaveValue('Rascunho do Fabio')
  // O chamado enviado fica sem rascunho.
  await open(first)
  await expect(field).toHaveValue('')
})

// O arquivo anexado é do chamado em que foi escolhido: ao enviar e trocar de chamado em seguida, ele
// não pode ficar no campo do chamado novo, senão um Enter o mandaria para o cliente errado.
test('arquivo anexado não passa para o chamado novo ao enviar e trocar em seguida', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { id } = unique()
  const first = `Gil Rascunho ${id}`
  const second = `Hana Rascunho ${id}`
  for (const contactName of [first, second]) {
    await phone(request, sector.id, 'receive', {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName,
      body: 'Olá',
    })
  }

  await signIn(page, agent, userPassword)
  const mine = page.getByRole('navigation', { name: 'Meus chamados' })
  const open = async (contactName: string) => {
    await mine.getByRole('link', { name: new RegExp(contactName) }).click()
    await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  }
  const fileName = `balancete-${id}.pdf`

  await assume(page, first)
  await assume(page, second)
  await open(first)
  await page.getByLabel('Arquivo para enviar').setInputFiles({
    name: fileName,
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7 rascunho'),
  })
  await expect(page.getByRole('textbox', { name: 'Legenda do arquivo' })).toBeVisible()

  // O envio demora: dá tempo de abrir o outro chamado antes de o servidor confirmar.
  await page.route('**/api/tickets/*/messages', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    await route.continue()
  })
  const sent = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/messages'),
  )
  await page.getByRole('textbox', { name: 'Legenda do arquivo' }).press('Enter')
  await open(second)
  await sent

  // O chamado novo abre sem o arquivo do anterior, pronto para uma mensagem própria.
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Legenda do arquivo' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Remover arquivo' })).toHaveCount(0)

  // O arquivo foi para o cliente do chamado em que foi anexado, e o campo de lá ficou vazio.
  await open(first)
  await expect(
    page.getByRole('listitem', { name: 'Mensagem enviada' }).filter({ hasText: fileName }),
  ).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('')
})

// Sair da conversa antes de o servidor confirmar o envio: o texto já enviado não pode voltar como
// rascunho, senão um Enter manda a mesma mensagem de novo.
test('sair do chamado antes da confirmação apaga o rascunho enviado', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const contactName = `Iara Rascunho ${unique().id}`
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName,
    body: 'Olá',
  })

  await signIn(page, agent, userPassword)
  await assume(page, contactName)
  const field = page.getByRole('textbox', { name: 'Mensagem' })
  await field.fill('Mensagem que sai da tela')

  await page.route('**/api/tickets/*/messages', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    await route.continue()
  })
  const sent = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/messages'),
  )
  await field.press('Enter')
  // A pessoa deixa a conversa com o envio ainda em andamento.
  await page.getByRole('link', { name: 'Atendimentos', exact: true }).click()
  await sent

  // O rascunho sai do armazenamento mesmo com o campo fora da tela.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith('message-draft.')),
      ),
    )
    .toHaveLength(0)

  // De volta ao chamado, o campo está vazio, inclusive depois de recarregar.
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Meus chamados' })
    .getByRole('link', { name: new RegExp(contactName) })
    .click()
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('')
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveValue('')
})

// O rascunho sai no próprio envio, e não na confirmação: sair do chamado e voltar antes de o
// servidor responder não pode trazer de volta o texto já enviado, senão um Enter o manda de novo.
test('sair e voltar ao chamado antes da confirmação não traz o texto enviado de volta', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const contactName = `Joana Rascunho ${unique().id}`
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName,
    body: 'Olá',
  })

  await signIn(page, agent, userPassword)
  await assume(page, contactName)
  const field = page.getByRole('textbox', { name: 'Mensagem' })
  const mine = page.getByRole('navigation', { name: 'Meus chamados' })
  const drafts = () =>
    page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('message-draft.')))
  await field.fill('Mensagem que já saiu')

  // O envio demora: dá tempo de sair do chamado e voltar antes da confirmação.
  await page.route('**/api/tickets/*/messages', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }
    await route.continue()
  })
  const sent = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/messages'),
  )
  await field.press('Enter')
  // O rascunho sai do armazenamento no envio, antes de a resposta chegar.
  await expect.poll(drafts).toHaveLength(0)
  await page.getByRole('link', { name: 'Atendimentos', exact: true }).click()
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await mine.getByRole('link', { name: new RegExp(contactName) }).click()
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  await expect(field).toHaveValue('')
  await sent
  await expect(field).toHaveValue('')
  await page.reload()
  await expect(field).toHaveValue('')
})

// Envio que falha devolve o texto como rascunho: a pessoa sai do chamado e, ao voltar, encontra o
// que escreveu para reenviar depois de resolver o problema.
test('envio que falha devolve o texto como rascunho', async ({ page, request, baseURL }) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const contactName = `Kaique Rascunho ${unique().id}`
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName,
    body: 'Olá',
  })

  await signIn(page, agent, userPassword)
  await assume(page, contactName)
  const field = page.getByRole('textbox', { name: 'Mensagem' })
  const mine = page.getByRole('navigation', { name: 'Meus chamados' })
  const drafts = () =>
    page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('message-draft.')))

  await page.route('**/api/tickets/*/messages', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 500))
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Não foi possível enviar agora.' }),
      })
      return
    }
    await route.continue()
  })
  await field.fill('Texto que não saiu')
  await field.press('Enter')
  await expect(page.getByText('Não foi possível enviar agora.')).toBeVisible()
  // O texto volta para o armazenamento e, ao sair e voltar ao chamado, está no campo de novo.
  await expect.poll(drafts).toHaveLength(1)
  await page.getByRole('link', { name: 'Atendimentos', exact: true }).click()
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await mine.getByRole('link', { name: new RegExp(contactName) }).click()
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  await expect(field).toHaveValue('Texto que não saiu')
})

// O erro de um envio é do chamado em que ele foi feito: se o envio do chamado A falhar depois de a
// pessoa abrir o chamado B, o aviso não pode aparecer no B.
test('falha de envio de outro chamado não aparece no chamado aberto', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { id } = unique()
  const first = `Nara Rascunho ${id}`
  const second = `Otavio Rascunho ${id}`
  for (const contactName of [first, second]) {
    await phone(request, sector.id, 'receive', {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName,
      body: 'Olá',
    })
  }

  await signIn(page, agent, userPassword)
  const mine = page.getByRole('navigation', { name: 'Meus chamados' })
  const open = async (contactName: string) => {
    await mine.getByRole('link', { name: new RegExp(contactName) }).click()
    await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  }
  const field = page.getByRole('textbox', { name: 'Mensagem' })
  const drafts = () =>
    page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('message-draft.')))

  await assume(page, first)
  await assume(page, second)
  await open(first)
  await field.fill('Mensagem do chamado que falha')

  // O envio do chamado A demora e falha, e a pessoa já está no chamado B quando o aviso chega.
  await page.route('**/api/tickets/*/messages', async (route) => {
    if (route.request().method() === 'POST') {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Não foi possível enviar agora.' }),
      })
      return
    }
    await route.continue()
  })
  const failed = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().includes('/messages'),
  )
  await field.press('Enter')
  await open(second)
  await failed

  // O texto voltou a ser rascunho do chamado A, mas o aviso do erro não aparece no B.
  await expect.poll(drafts).toHaveLength(1)
  await expect(page.getByText('Não foi possível enviar agora.')).toHaveCount(0)
  await expect(field).toHaveValue('')

  // No chamado A, o aviso e o texto para reenviar estão lá.
  await open(first)
  await expect(page.getByText('Não foi possível enviar agora.')).toBeVisible()
  await expect(field).toHaveValue('Mensagem do chamado que falha')
})

// A gravação em andamento é do chamado em que começou: ao trocar de chamado ela é descartada, para o
// áudio não ir para o cliente do chamado novo.
test('gravação de áudio em andamento não passa para o chamado novo', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { id } = unique()
  const first = `Lara Rascunho ${id}`
  const second = `Murilo Rascunho ${id}`
  for (const contactName of [first, second]) {
    await phone(request, sector.id, 'receive', {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName,
      body: 'Olá',
    })
  }

  await signIn(page, agent, userPassword)
  const mine = page.getByRole('navigation', { name: 'Meus chamados' })
  const open = async (contactName: string) => {
    await mine.getByRole('link', { name: new RegExp(contactName) }).click()
    await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  }
  await assume(page, first)
  await assume(page, second)
  await open(first)
  await page.getByRole('button', { name: 'Gravar áudio' }).click()
  await expect(page.getByRole('status', { name: 'Gravação de áudio' })).toContainText('Gravando')

  // Trocar de chamado com a gravação rolando descarta o áudio, sem anexar nada ao chamado novo.
  await open(second)
  await expect(page.getByRole('status', { name: 'Gravação de áudio' })).toHaveCount(0)
  await expect(page.getByLabel('Áudio gravado')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Gravar áudio' })).toBeVisible()

  // O gravador volta a funcionar no chamado novo, e o áudio gravado fica nele.
  await page.getByRole('button', { name: 'Gravar áudio' }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Concluir gravação' }).click()
  await expect(page.getByLabel('Áudio gravado')).toBeVisible()
  await page.getByRole('button', { name: 'Descartar áudio' }).click()
  await expect(page.getByLabel('Áudio gravado')).toHaveCount(0)
})
