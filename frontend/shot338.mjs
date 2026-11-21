import { chromium } from 'playwright'

// Capturas do protótipo #338 (aviso de pendentes no chamado novo e janela Retomar).
// Só desktop: 1360x900, como as telas de Chamados no design.md.
const base = 'http://localhost:5338/chamados?prototype=338&captura=1&tema=claro'
const out = process.argv[2] ?? 'prototype-captures'

const corridas = [
  ['338-aviso-2-pendentes', 'estado=aviso'],
  ['338-aviso-1-pendente', 'estado=aviso1'],
  ['338-sem-aviso', 'estado=sem-aviso'],
  ['338-chamado-na-fila', 'estado=fila'],
  ['338-menu-mais-acoes', 'estado=menu'],
  ['338-janela-retomar', 'estado=retomar'],
  ['338-aviso-escuro', 'estado=aviso&tema=escuro'],
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
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
  await ctx.close()
}
await browser.close()
