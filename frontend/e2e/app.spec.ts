import { expect, test } from '@playwright/test'

test('backend responde pelo proxy', async ({ request }) => {
  const response = await request.get('/health')
  expect(response.ok()).toBeTruthy()
  expect(await response.json()).toEqual({ status: 'ok' })
})
