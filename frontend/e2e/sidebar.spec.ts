import { expect, request as apiRequest, test } from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword } from './fixtures'

const sidebar = '[data-slot=sidebar-inner]'

test('barra lateral acompanha o tema escolhido', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, admin.email, admin.password)
  const inner = page.locator(sidebar)
  await expect(inner).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(inner.locator('img:visible')).toHaveAttribute('src', /glab-simbolo(?!-escuro)/)

  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitemradio', { name: 'Escuro' }).click()
  await page.keyboard.press('Escape')
  await expect(inner).toHaveCSS('background-color', 'rgb(24, 31, 34)')
  await expect(inner.locator('img:visible')).toHaveAttribute('src', /glab-simbolo-escuro/)
})

test('barra lateral recolhe para os ícones, dá mais espaço e lembra a escolha', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await signIn(page, admin.email, admin.password)
  const inner = page.locator(sidebar)
  const content = page.locator('[data-slot=sidebar-inset]')
  const openWidth = (await content.boundingBox())!.width
  await expect(inner.getByText('Central de Atendimento')).toBeVisible()

  await page.getByRole('button', { name: 'Recolher menu' }).click()
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible()
  await expect(inner.getByText('Central de Atendimento')).toBeHidden()
  await expect.poll(async () => (await inner.boundingBox())!.width).toBeLessThanOrEqual(49)
  await expect
    .poll(async () => (await content.boundingBox())!.width)
    .toBeGreaterThan(openWidth + 150)

  // Os itens continuam navegáveis e o menu de configurações continua abrindo.
  await inner.getByRole('link', { name: 'Contatos' }).click()
  await expect(page).toHaveURL(/\/contatos$/)
  await inner.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible()
  await expect(inner.getByText('Central de Atendimento')).toBeHidden()

  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await expect(inner.getByText('Central de Atendimento')).toBeVisible()
})

test('botão de voltar leva da conversa à lista de atendimentos', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const api = await apiRequest.newContext({ baseURL })
  await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  await api.dispose()
  const messaging = `/api/test/messaging/sectors/${sector.id}`
  expect((await request.post(`${messaging}/pair`)).ok()).toBeTruthy()
  const { phone, id } = unique()
  const received = await request.post(`${messaging}/receive`, {
    data: {
      externalMessageId: `E2E-${id}`,
      phone,
      contactName: 'Clara Cliente',
      type: 'text',
      body: 'Bom dia',
    },
  })
  expect(received.ok()).toBeTruthy()

  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Clara Cliente' }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)

  await page.getByRole('link', { name: 'Voltar à lista' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
})
