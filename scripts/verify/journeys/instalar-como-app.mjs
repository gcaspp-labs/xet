// Instalar o sistema como app: ver features/instalar-como-app.md.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('instalar-como-app', async (t) => {
  const sector = await t.step('Preparar um setor com um atendente', () =>
    t.seedSector({ agents: 1 }),
  )
  const page = await t.signIn(sector.agents[0])

  await t.step(
    'A página liga o manifest com as credenciais do Access e o ícone do iPhone',
    async () => {
      const links = await page.evaluate(() => {
        const manifest = document.querySelector('link[rel="manifest"]')
        const touch = document.querySelector('link[rel="apple-touch-icon"]')
        return {
          manifest: manifest?.getAttribute('href') ?? null,
          credentials: manifest?.getAttribute('crossorigin') ?? null,
          touch: touch?.getAttribute('href') ?? null,
          installButton: [...document.querySelectorAll('button')].some((button) =>
            /instalar/i.test(button.textContent ?? ''),
          ),
        }
      })
      expect(links).toEqual({
        manifest: '/manifest.json',
        credentials: 'use-credentials',
        touch: '/apple-touch-icon.png',
        installButton: false,
      })
      await t.shot(page, 'links-do-app')
    },
  )

  await t.step(
    'O navegador recebe o manifest e os ícones com o nome e as cores do sistema',
    async () => {
      const manifest = await page.evaluate(async () => {
        const response = await fetch('/manifest.json')
        return {
          status: response.status,
          type: response.headers.get('content-type'),
          body: await response.json(),
        }
      })
      expect(manifest.status).toBe(200)
      expect(manifest.type).toContain('application/json')
      expect(manifest.body).toMatchObject({
        name: 'Central de Atendimento',
        short_name: 'Atendimento',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#01466F',
        background_color: '#FFFFFF',
      })
      expect(manifest.body.icons.map((icon) => [icon.sizes, icon.purpose ?? 'any'])).toEqual([
        ['192x192', 'any'],
        ['512x512', 'any'],
        ['512x512', 'maskable'],
      ])
      for (const src of [
        '/icon-192.png',
        '/icon-512.png',
        '/icon-maskable-512.png',
        '/apple-touch-icon.png',
      ]) {
        const status = await page.evaluate(async (url) => (await fetch(url)).status, src)
        expect(status, src).toBe(200)
      }
      await t.shot(page, 'manifest-e-icones')
    },
  )

  await t.step('O service worker registra e passa a controlar a página', async () => {
    const state = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready
      return { scriptURL: ready.active?.scriptURL ?? null, state: ready.active?.state ?? null }
    })
    expect(state.state).toBe('activated')
    expect(state.scriptURL).toContain('/sw.js')
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
    await t.shot(page, 'service-worker-ativo')
  })

  await t.step('Recarregar com o service worker ativo mostra o sistema de novo', async () => {
    await page.reload()
    await expect(page).toHaveURL(/\/chamados$/)
    await expect(page.getByRole('region', { name: 'Fila, assuntos e pendentes' })).toBeVisible()
    await t.shot(page, 'recarregado-com-service-worker')
  })

  await t.step('Estado final: nada guardado no aparelho e nenhum chamado mexido', async () => {
    const stored = await page.evaluate(async () => ({
      caches: await caches.keys(),
      serviceWorkers: (await navigator.serviceWorker.getRegistrations()).map(
        (registration) => new URL(registration.active?.scriptURL ?? '').pathname,
      ),
    }))
    expect(stored).toEqual({ caches: [], serviceWorkers: ['/sw.js'] })
    t.observe('Guardado no aparelho', stored)

    const tickets = t.sql(`select status from tickets where sector_id = ${sector.id}`)
    expect(tickets).toEqual([])
    t.observe('Chamados do setor (banco)', tickets)
  })

  await t.closeSession(page)
})
