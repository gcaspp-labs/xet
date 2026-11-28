import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Os ícones do design system instalado; o manifest e o index.html têm que servir os mesmos bytes.
const designSystemAsset = (name: string) =>
  fileURLToPath(
    new URL(
      `../node_modules/@gcaspp-labs/glab-design-system/assets/logos/favicon/${name}`,
      import.meta.url,
    ),
  )

test('o manifest instala o app com nome, cores e ícones do design system', async ({
  page,
  request,
}) => {
  await page.goto('/')
  const manifestLink = page.locator('link[rel="manifest"]')
  // Sem as credenciais o navegador busca o manifest sem o cookie do Cloudflare Access.
  await expect(manifestLink).toHaveAttribute('href', '/manifest.json')
  await expect(manifestLink).toHaveAttribute('crossorigin', 'use-credentials')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/apple-touch-icon.png',
  )
  // Vale o "Instalar app" do navegador: o sistema não tem botão próprio.
  await expect(page.getByRole('button', { name: /instalar/i })).toHaveCount(0)

  const response = await request.get('/manifest.json')
  expect(response.ok()).toBeTruthy()
  expect(response.headers()['content-type']).toContain('application/json')

  const manifest = (await response.json()) as Record<string, unknown>
  expect(manifest.name).toBe('Central de Atendimento')
  expect(manifest.short_name).toBe('Atendimento')
  expect(manifest.start_url).toBe('/')
  expect(manifest.scope).toBe('/')
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toBe('#01466F')
  expect(manifest.background_color).toBe('#FFFFFF')
  expect(manifest.icons).toEqual([
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ])
})

test('os ícones do app são os do design system, servidos como PNG', async ({ request }) => {
  const names = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']
  for (const name of names) {
    const response = await request.get(`/${name}`)
    expect(response.ok(), name).toBeTruthy()
    expect(response.headers()['content-type'], name).toContain('image/png')
    expect(Buffer.from(await response.body()), name).toEqual(readFileSync(designSystemAsset(name)))
  }
})

test('o service worker registra, controla a página e não guarda nada', async ({
  page,
  request,
}) => {
  const response = await request.get('/sw.js')
  expect(response.ok()).toBeTruthy()
  expect(response.headers()['content-type']).toContain('javascript')
  // O service worker é servido sem cache longo, para um deploy novo valer na hora.
  expect(response.headers()['cache-control'] ?? '').not.toContain('max-age')
  const source = await response.text()
  // Sem nada guardado: nem tela, nem resposta da API.
  expect(source).not.toContain('caches')
  expect(source).not.toContain('cache.add')

  await page.goto('/login')
  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready
    return { scriptURL: ready.active?.scriptURL ?? null, state: ready.active?.state ?? null }
  })
  expect(registration.state).toBe('activated')
  expect(registration.scriptURL).toContain('/sw.js')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  // Com o service worker ativo, recarregar mostra a versão servida pela rede, como antes.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Central de Atendimento' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible()
})
