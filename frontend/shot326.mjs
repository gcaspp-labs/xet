import { chromium } from 'playwright'

// Capturas do protótipo #326: 1360x900, desktop, como o design.md pede.
const base = 'http://localhost:5326/chamados?prototype=326&captura=1'
const out = process.argv[2] ?? 'prototype-captures'

// `digita` procura no campo de busca antes da captura, para mostrar o filtro funcionando.
const corridas = [
  ['326-menu-claro', 'variant=A&estado=menu&tema=claro'],
  ['326-A-busca-claro', 'variant=A&estado=busca&tema=claro'],
  ['326-A-busca-ana-claro', 'variant=A&estado=busca&tema=claro', 'ana'],
  ['326-A-previa-claro', 'variant=A&estado=previa&tema=claro'],
  ['326-B-busca-claro', 'variant=B&estado=busca&tema=claro'],
  ['326-B-previa-claro', 'variant=B&estado=previa&tema=claro'],
  ['326-C-previa-claro', 'variant=C&estado=previa&tema=claro'],
  ['326-enviado-claro', 'variant=A&estado=enviado&tema=claro'],
  ['326-A-previa-escuro', 'variant=A&estado=previa&tema=escuro'],
  ['326-A-previa-contraste', 'variant=A&estado=previa&tema=contraste'],
]

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1360, height: 900 },
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text())
})

for (const [nome, query, digita] of corridas) {
  await page.goto(`${base}&${query}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  if (digita) {
    await page.fill('[aria-label="Buscar contato"]', digita)
    await page.waitForTimeout(300)
  }
  await page.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
}

await browser.close()
