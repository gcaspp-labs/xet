import { expect, request as apiRequest, test, type Locator, type Page } from '@playwright/test'
import { admin, seedSector, signIn, userPassword } from './fixtures'

// Um setor com três módulos: lista curta, que cabe abaixo do campo no desktop.
async function sectorWithModules(baseURL: string) {
  const seed = await seedSector(baseURL)
  const api = await apiRequest.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect(login.ok()).toBeTruthy()
  for (const name of ['Folha', 'Patrimônio', 'Compras']) {
    const created = await api.post(`/api/sectors/${seed.sector.id}/modules`, { data: { name } })
    expect(created.ok()).toBeTruthy()
  }
  await api.dispose()
  return seed
}

// As animações de abertura mudam as posições por um instante: confere até elas assentarem.
async function expectListBelow(page: Page, trigger: Locator) {
  const list = page.getByRole('listbox')
  await expect(async () => {
    const [listBox, field] = [await list.boundingBox(), await trigger.boundingBox()]
    expect(listBox!.y).toBeGreaterThanOrEqual(field!.y + field!.height)
  }).toPass()
}

// A lista termina acima do campo, sem cobri-lo, e cabe inteira na tela.
async function expectListAbove(page: Page, trigger: Locator) {
  const list = page.getByRole('listbox')
  await expect(async () => {
    const [listBox, field] = [await list.boundingBox(), await trigger.boundingBox()]
    expect(listBox!.y + listBox!.height).toBeLessThanOrEqual(field!.y)
    expect(listBox!.y).toBeGreaterThanOrEqual(0)
  }).toPass()
}

async function openDashboard(page: Page, supervisor: string) {
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  return page.getByRole('combobox', { name: 'Módulo' })
}

test('em tela cheia, a lista abre abaixo do campo e escolhe por clique e por teclado', async ({
  page,
  baseURL,
}) => {
  const { supervisor } = await sectorWithModules(baseURL!)
  const trigger = await openDashboard(page, supervisor)

  // Com item escolhido por clique, a lista continua abaixo do campo.
  await trigger.click()
  await expectListBelow(page, trigger)
  await page.getByRole('option', { name: 'Folha' }).click()
  await expect(trigger).toHaveText(/Folha/)
  await trigger.click()
  await expectListBelow(page, trigger)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)

  // Por teclado: Enter abre, a seta anda a partir do item escolhido e Enter escolhe.
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expectListBelow(page, trigger)
  await expect(page.getByRole('option', { name: 'Folha' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  const focused = page.locator('[role="option"]:focus')
  await expect(focused).not.toHaveText(/Folha/)
  const chosen = await focused.innerText()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(trigger).toHaveText(new RegExp(chosen))
  await expect(page).toHaveURL(/moduleId=/)
})

test('com o campo no fim da tela, a lista abre acima, sem cobrir o campo', async ({
  page,
  baseURL,
}) => {
  const { supervisor } = await sectorWithModules(baseURL!)
  const trigger = await openDashboard(page, supervisor)
  await trigger.click()
  await page.getByRole('option', { name: 'Folha' }).click()

  // Sobra pouco espaço abaixo do campo, menos que a altura da lista.
  const field = (await trigger.boundingBox())!
  await page.setViewportSize({ width: 1280, height: Math.ceil(field.y + field.height + 24) })
  await expect
    .poll(async () => (await trigger.boundingBox())!.y + (await trigger.boundingBox())!.height)
    .toBeLessThanOrEqual(page.viewportSize()!.height)

  await trigger.click()
  await expectListAbove(page, trigger)
  await page.getByRole('option', { name: 'Patrimônio' }).click()
  await expect(trigger).toHaveText(/Patrimônio/)
})

test('dentro de janela, a lista abre abaixo do campo e escolhe por clique e por teclado', async ({
  page,
}) => {
  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/usuarios')
  await page.getByRole('button', { name: 'Novo usuário' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo usuário' })
  const trigger = dialog.getByRole('combobox', { name: 'Papel' })

  await trigger.click()
  await expectListBelow(page, trigger)
  await page.getByRole('option', { name: 'Supervisor' }).click()
  await expect(trigger).toHaveText(/Supervisor/)
  await expect(dialog).toBeVisible()

  await trigger.click()
  await expectListBelow(page, trigger)
  await expect(page.getByRole('option', { name: 'Supervisor' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(dialog).toBeVisible()

  await trigger.focus()
  await page.keyboard.press('Enter')
  await expectListBelow(page, trigger)
  await page.keyboard.press('ArrowUp')
  await expect(page.getByRole('option', { name: 'Atendente' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveText(/Atendente/)
  await expect(dialog).toBeVisible()
})

test('dentro de janela, com o campo no fim da tela, a lista abre acima', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 300 })
  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/usuarios')
  await page.getByRole('button', { name: 'Novo usuário' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo usuário' })
  const trigger = dialog.getByRole('combobox', { name: 'Papel' })
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'end' }))

  await trigger.click()
  await expectListAbove(page, trigger)
  await page.getByRole('option', { name: 'Supervisor' }).click()
  await expect(trigger).toHaveText(/Supervisor/)
})
