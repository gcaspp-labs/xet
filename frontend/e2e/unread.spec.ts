import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { seedSector, signIn, test, trackSocket, unique, userPassword } from './fixtures'

// Mensagem de texto de um contato, simulada pelo adaptador falso do backend.
async function receive(
  request: APIRequestContext,
  sectorId: number,
  message: { phone: string; contactName: string; body: string },
) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
    data: { externalMessageId: `E2E-${unique().id}`, ...message },
  })
  expect(response.ok()).toBeTruthy()
}

// Item de um contato em "Meus chamados".
function mineItem(page: Page, contactName: string) {
  return page
    .getByRole('navigation', { name: 'Meus chamados' })
    .getByRole('link')
    .filter({ hasText: contactName })
}

async function assume(page: Page, contactName: string) {
  await page.getByRole('button', { name: `Assumir chamado de ${contactName}` }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  return Number(new URL(page.url()).pathname.split('/').pop())
}

async function backToList(page: Page) {
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await expect(page).toHaveURL(/\/chamados$/)
}

// O Playwright mantém as abas sempre visíveis. O teste diz se a aba está em segundo plano, como
// os testes de alerta já fazem: o getter lê o sessionStorage e o evento avisa a tela.
async function spyOnVisibility(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', {
      get: () => (sessionStorage.getItem('test-hidden') ? 'hidden' : 'visible'),
    })
  })
}

async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((value) => {
    if (value) {
      sessionStorage.setItem('test-hidden', '1')
    } else {
      sessionStorage.removeItem('test-hidden')
    }
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)
}

const readCall = (page: Page, ticketId: number) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === `/api/tickets/${ticketId}/read`,
  )

test('mensagem num chamado meu não aberto mostra o contador, e abrir zera', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const contactName = 'Cliente com mensagem nova'
  const phone = unique().phone
  await receive(request, sector.id, { phone, contactName, body: 'Primeira mensagem' })
  await signIn(page, agent, userPassword)
  await assume(page, contactName)
  const item = mineItem(page, contactName)
  await expect(item.getByTestId('unread-count')).toHaveCount(0)

  await backToList(page)
  await receive(request, sector.id, { phone, contactName, body: 'Mensagem nova' })
  await expect(item.getByTestId('unread-count')).toHaveText('1')
  await expect(item).toHaveAccessibleName(/1 mensagem não lida/)
  await expect(item.getByText(contactName)).toHaveCSS('font-weight', '600')
  await expect(item.getByText('Mensagem nova', { exact: true })).toHaveCSS('font-weight', '600')

  await item.click()
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
  await expect(item.getByTestId('unread-count')).toHaveCount(0)
  await expect(item.getByText(contactName)).toHaveCSS('font-weight', '500')

  await backToList(page)
  await expect(item.getByTestId('unread-count')).toHaveCount(0)
})

test('com o chamado aberto e a aba visível, a mensagem nova é lida sem contador', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const contactName = 'Cliente aberto'
  const phone = unique().phone
  await receive(request, sector.id, { phone, contactName, body: 'Primeira mensagem' })
  await signIn(page, agent, userPassword)
  const ticketId = await assume(page, contactName)
  const item = mineItem(page, contactName)

  const read = readCall(page, ticketId)
  await receive(request, sector.id, { phone, contactName, body: 'Chegou agora' })
  await read
  await expect(item.getByTestId('unread-count')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Chegou agora',
  )
})

test('com a aba em segundo plano a mensagem conta, e voltar à aba com o chamado aberto zera', async ({
  page,
  request,
  baseURL,
}) => {
  await spyOnVisibility(page)
  const { sector, agent } = await seedSector(baseURL!)
  const contactName = 'Cliente na outra aba'
  const phone = unique().phone
  await receive(request, sector.id, { phone, contactName, body: 'Primeira mensagem' })
  await signIn(page, agent, userPassword)
  const ticketId = await assume(page, contactName)
  const item = mineItem(page, contactName)

  await setHidden(page, true)
  await receive(request, sector.id, { phone, contactName, body: 'Mensagem na aba escondida' })
  await expect(item.getByTestId('unread-count')).toHaveText('1')

  const read = readCall(page, ticketId)
  await setHidden(page, false)
  await read
  await expect(item.getByTestId('unread-count')).toHaveCount(0)
})

test('recarregar mantém o contador, e abrir em outra aba do mesmo usuário zera sem recarregar', async ({
  page,
  context,
  request,
  baseURL,
}) => {
  await trackSocket(page)
  const { sector, agent } = await seedSector(baseURL!)
  const contactName = 'Cliente em duas abas'
  const phone = unique().phone
  await receive(request, sector.id, { phone, contactName, body: 'Primeira mensagem' })
  await signIn(page, agent, userPassword)
  const ticketId = await assume(page, contactName)
  const item = mineItem(page, contactName)
  await backToList(page)
  await receive(request, sector.id, { phone, contactName, body: 'Mensagem nova' })
  await expect(item.getByTestId('unread-count')).toHaveText('1')

  await page.reload({ waitUntil: 'commit' })
  await expect(item.getByTestId('unread-count')).toHaveText('1')

  const other = await context.newPage()
  await other.goto(`/chamados/${ticketId}`)
  await expect(other.getByRole('heading', { name: contactName })).toBeVisible()
  await expect(item.getByTestId('unread-count')).toHaveCount(0)
  await other.close()
})

test('supervisor abrindo o chamado não zera o contador da atendente', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const contactName = 'Cliente da atendente'
  const phone = unique().phone
  await receive(request, sector.id, { phone, contactName, body: 'Primeira mensagem' })
  await signIn(page, agent, userPassword)
  const ticketId = await assume(page, contactName)
  const item = mineItem(page, contactName)
  await backToList(page)
  await receive(request, sector.id, { phone, contactName, body: 'Mensagem da cliente' })
  await expect(item.getByTestId('unread-count')).toHaveText('1')

  const context = await browser.newContext()
  const supervisorPage = await context.newPage()
  await signIn(supervisorPage, supervisor, userPassword)
  // A supervisão chama a leitura ao abrir o chamado e o servidor responde sucesso sem mudar nada;
  // esperar a resposta prova que a chamada aconteceu, sem o sono fixo que deixava o teste instável.
  const ignoredRead = readCall(supervisorPage, ticketId)
  await supervisorPage.goto(`/chamados/${ticketId}`)
  await expect(supervisorPage.getByRole('heading', { name: contactName })).toBeVisible()
  expect((await ignoredRead).status()).toBe(204)
  await expect(item.getByTestId('unread-count')).toHaveText('1')
  await context.close()
})

test('acima de 99 mostra 99+, o nome acessível diz o número e só há negrito com não lidas', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const contactName = 'Cliente de muitas mensagens'
  const phone = unique().phone
  await receive(request, sector.id, { phone, contactName, body: 'Primeira mensagem' })
  await signIn(page, agent, userPassword)
  await assume(page, contactName)
  const item = mineItem(page, contactName)
  await backToList(page)

  for (let i = 1; i <= 100; i++) {
    await receive(request, sector.id, { phone, contactName, body: `Mensagem ${i}` })
  }
  await expect(item.getByTestId('unread-count')).toHaveText('99+', { timeout: 30_000 })
  await expect(item).toHaveAccessibleName(/100 mensagens não lidas/)
  await expect(item.getByText(contactName)).toHaveCSS('font-weight', '600')
  await expect(item.getByText('Mensagem 100')).toHaveCSS('font-weight', '600')
})
