import { chromium } from 'playwright'

// Capturas do protótipo #342 (quadro Pendentes no Dashboard novo da #223).
// Só desktop: 1360x900, como as telas de Dashboard no design.md.
// As versões A e C precisam rolar até o quadro; ?rolar=quadro faz isso.
const base = 'http://localhost:5342/dashboard?prototype=342&captura=1'
const out = process.argv[2] ?? 'prototype-captures'

const corridas = [
  ['342-A-inicio-claro', 'variante=A&tema=claro'],
  ['342-A-quadro-claro', 'variante=A&tema=claro&rolar=quadro'],
  ['342-A-quadro-admin-claro', 'variante=A&as=admin&tema=claro&rolar=quadro'],
  ['342-A-vazio-claro', 'variante=A&pendentes=vazio&tema=claro&rolar=quadro'],
  ['342-A-quadro-escuro', 'variante=A&tema=escuro&rolar=quadro'],
  ['342-B-inicio-claro', 'variante=B&tema=claro'],
  ['342-B-admin-claro', 'variante=B&as=admin&tema=claro'],
  ['342-C-inicio-claro', 'variante=C&tema=claro'],
  ['342-C-admin-claro', 'variante=C&as=admin&tema=claro'],
  ['342-C-escuro', 'variante=C&tema=escuro'],
]

const browser = await chromium.launch()
for (const [nome, query] of corridas) {
  const ctx = await browser.newContext({
    viewport: { width: 1360, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light',
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE:', m.text())
  })
  await page.goto(`${base}&${query}`, { waitUntil: 'networkidle' })
  // O botão Assumir (z-10) das listas pinta por cima da barra fixa ao rolar; já vem
  // da #223. Só nas capturas, a barra fica acima, para não confundir o quadro.
  await page.addStyleTag({ content: 'header{z-index:30!important}' })
  await page.waitForTimeout(600)
  if (query.includes('rolar=quadro')) {
    // Deixa o topo do quadro logo abaixo da barra fixa, sem linha das listas aparecendo nela.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const board = document.querySelector('[aria-labelledby="board-pending-title"]')
        const limit = Math.max(
          0,
          ...[...document.querySelectorAll('header')].map(
            (item) => item.getBoundingClientRect().bottom,
          ),
        )
        const rect = board.getBoundingClientRect()
        window.scrollBy(0, rect.top - limit)
      })
      await page.waitForTimeout(250)
    }
  }
  await page.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
  await ctx.close()
}

// Conferência dos links: uma linha abre o chamado e "Ver todos" abre a aba Pendentes.
{
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'pt-BR' })
  const page = await ctx.newPage()
  await page.goto(`${base}&variante=A&tema=claro&rolar=quadro`, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: 'Maria Oliveira' }).first().click()
  await page.waitForTimeout(700)
  console.log('linha ->', page.url())
  await page.screenshot({ path: `${out}/342-linha-abre-pendente.png` })
  console.log('ok 342-linha-abre-pendente')

  await page.goto(`${base}&variante=A&tema=claro&rolar=quadro`, { waitUntil: 'networkidle' })
  await page.getByRole('link', { name: /Ver todos/ }).click()
  await page.waitForTimeout(700)
  console.log('ver todos ->', page.url())
  await page.screenshot({ path: `${out}/342-ver-todos-aba-pendentes.png` })
  console.log('ok 342-ver-todos-aba-pendentes')
  await ctx.close()
}
await browser.close()
