import { expect, request as apiRequest, test } from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword } from './fixtures'

const sidebar = '[data-slot=sidebar-inner]'

test('barra lateral acompanha o tema escolhido', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, admin.email, admin.password)
  const inner = page.locator(sidebar)
  await expect(inner).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  const brand = page.getByRole('banner').locator('img:visible')
  await expect(brand).toHaveAttribute('src', /glab-simbolo(?!-escuro)/)

  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitemradio', { name: 'Escuro' }).click()
  await page.keyboard.press('Escape')
  await expect(inner).toHaveCSS('background-color', 'rgb(24, 31, 34)')
  await expect(brand).toHaveAttribute('src', /glab-simbolo-escuro/)
})

test('cabeçalho fica fixo com a marca e o lugar das notificações, acima da barra lateral', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 400 })
  await signIn(page, admin.email, admin.password)
  const header = page.getByRole('banner')
  await expect(header).toContainText('GCASPP LAB')
  await expect(header).toContainText('Central de Atendimento')
  await expect(header.getByRole('button', { name: 'Notificações' })).toBeDisabled()

  const height = (await header.boundingBox())!.height
  expect((await page.locator(sidebar).boundingBox())!.y).toBe(height)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  expect((await header.boundingBox())!.y).toBe(0)
  expect((await page.locator(sidebar).boundingBox())!.y).toBe(height)
})

test('barra lateral recolhe para os ícones, sem o botão mudar de lugar, e lembra a escolha', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await signIn(page, admin.email, admin.password)
  const inner = page.locator(sidebar)
  const content = page.locator('[data-slot=sidebar-inset]')
  const openWidth = (await content.boundingBox())!.width
  const collapse = inner.getByRole('button', { name: 'Recolher menu' })
  const place = await collapse.boundingBox()
  const brand = await page.getByRole('banner').getByText('GCASPP LAB').boundingBox()
  const settings = await inner.getByRole('button', { name: 'Configurações' }).boundingBox()
  const contacts = await inner.getByRole('link', { name: 'Contatos' }).boundingBox()

  await collapse.click()
  const expand = inner.getByRole('button', { name: 'Abrir menu' })
  await expect(expand).toBeVisible()
  await expect.poll(async () => (await inner.boundingBox())!.width).toBeLessThanOrEqual(49)
  await expect
    .poll(async () => (await content.boundingBox())!.width)
    .toBeGreaterThan(openWidth + 150)
  await expect(inner.getByText('Administrador E2E')).toBeHidden()

  // O botão, a marca e a altura dos itens da barra não mudam.
  expect((await inner.getByRole('link', { name: 'Contatos' }).boundingBox())!.y).toBe(contacts!.y)
  expect(await expand.boundingBox()).toEqual(place)
  expect(await page.getByRole('banner').getByText('GCASPP LAB').boundingBox()).toEqual(brand)
  expect((await inner.getByRole('button', { name: 'Configurações' }).boundingBox())!.y).toBe(
    settings!.y,
  )

  // Os itens continuam navegáveis e o menu de configurações continua abrindo.
  await inner.getByRole('link', { name: 'Contatos' }).click()
  await expect(page).toHaveURL(/\/contatos$/)
  await inner.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.reload()
  await expect(expand).toBeVisible()
  await expect(inner.getByText('Administrador E2E')).toBeHidden()

  await expand.click()
  await expect(inner.getByText('Administrador E2E')).toBeVisible()
  expect(await inner.getByRole('button', { name: 'Recolher menu' }).boundingBox()).toEqual(place)
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
