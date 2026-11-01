import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test'
import { admin, seedDirectory, seedSector, signIn, unique, userPassword } from './fixtures'

// Liga o número do setor pelo adaptador falso: conectar e o celular ler o QR code.
async function connectSector(baseURL: string, request: APIRequestContext, sectorId: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sectorId}/connection`)).ok()).toBeTruthy()
  await api.dispose()
  expect((await request.post(`/api/test/messaging/sectors/${sectorId}/pair`)).ok()).toBeTruthy()
}

test('atendente busca um contato e inicia a conversa pelo número do setor', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await connectSector(baseURL!, request, sector.id)
  const { id, phone } = unique()
  const name = `Carla ${id}`
  await seedDirectory(baseURL!, [{ name: `Prefeitura ${id}` }], [{ name, phone, organization: 0 }])

  await signIn(page, agent, userPassword)
  await page.getByRole('button', { name: 'Nova conversa' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nova conversa' })
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(name)
  await sheet.getByRole('button', { name: new RegExp(name) }).click()
  await sheet.getByRole('textbox', { name: 'Mensagem' }).fill('Bom dia, sua guia está pronta.')
  await sheet.getByRole('button', { name: 'Enviar' }).click()

  // O chamado nasce com o atendente, que já conduz a conversa.
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByText('Conversa iniciada')).toBeVisible()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(
    conversation
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .filter({ hasText: 'Bom dia, sua guia está pronta.' }),
  ).toContainText('Enviada')
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  const ticketUrl = page.url()

  // Outro integrante do setor que inicia conversa com o mesmo contato é levado ao
  // chamado existente, sem permissão de resposta.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await other.getByRole('button', { name: 'Nova conversa' }).click()
  const otherSheet = other.getByRole('dialog', { name: 'Nova conversa' })
  await otherSheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(name)
  await otherSheet.getByRole('button', { name: new RegExp(name) }).click()
  await expect(other).toHaveURL(ticketUrl)
  await expect(other.getByText('O contato já tem um chamado aberto no setor.')).toBeVisible()
  await expect(other.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    /Chamado com agent \d+\. Peça a transferência/,
  )
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await otherContext.close()
})

test('contato com chamado na fila leva ao chamado existente', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, request, sector.id)
  const { id, phone } = unique()
  const name = `Cliente ${id}`
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${id}`,
          phone,
          contactName: name,
          body: 'Preciso de ajuda',
        },
      })
    ).ok(),
  ).toBeTruthy()

  await signIn(page, agent, userPassword)
  await page.getByRole('button', { name: 'Nova conversa' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nova conversa' })
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(phone)
  await sheet.getByRole('button', { name: new RegExp(name) }).click()

  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText('Preciso de ajuda')
  await expect(conversation).toContainText('Chamado na fila. Assuma o chamado para responder.')
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
})
