import { expect, request as apiRequest, test } from '@playwright/test'
import { admin, openQueued, seedSector, signIn, unique, userPassword } from './fixtures'

test('responsável busca e insere emoji na mensagem pelo teclado', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  await api.dispose()
  expect((await request.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${unique().id}`,
          phone: unique().phone,
          contactName: 'Cliente Emoji',
          body: 'Olá 😊',
        },
      })
    ).ok(),
  ).toBeTruthy()
  await signIn(page, agent, userPassword)
  await openQueued(page, 'Cliente Emoji')
  await expect(page.getByRole('button', { name: 'Inserir emoji' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  const message = page.getByRole('textbox', { name: 'Mensagem' })
  await message.fill('Olá mundo')
  await message.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 9))
  const externalRequests: string[] = []
  page.on('request', (req) => {
    if (!req.url().startsWith(baseURL!)) externalRequests.push(req.url())
  })
  await page.getByRole('button', { name: 'Inserir emoji' }).click()
  const search = page.getByRole('searchbox', { name: 'Buscar emoji' })
  await expect(search).toBeFocused()
  await search.fill('emoji inexistente xyz')
  await expect(page.getByText('Nenhum emoji encontrado.')).toBeVisible()
  await search.fill('coração')
  await search.press('ArrowDown')
  await expect(page.getByLabel('Emojis').getByRole('button').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(message).toBeFocused()
  await page.getByRole('button', { name: 'Inserir emoji' }).click()
  await search.fill('coração vermelho')
  await search.press('Enter')
  await expect(message).toHaveValue('Olá ❤️')
  await expect(message).toBeFocused()
  await message.press('Enter')
  const sent = page
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Olá ❤️' })
  await expect(sent).toContainText(/agent \d+/)
  await page.reload()
  await expect(sent).toContainText('Olá ❤️')
  await expect(page.getByRole('listitem', { name: 'Mensagem recebida' })).toContainText('Olá 😊')
  expect(externalRequests).toEqual([])
})
