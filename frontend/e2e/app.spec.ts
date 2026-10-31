import { expect, test } from '@playwright/test'

test('abre a página inicial', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Central de atendimento' })).toBeVisible()
})

test('backend responde pelo proxy', async ({ request }) => {
  const response = await request.get('/health')
  expect(response.ok()).toBeTruthy()
  expect(await response.json()).toEqual({ status: 'ok' })
})
