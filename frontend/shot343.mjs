import { chromium } from 'playwright'

// Capturas do protótipo #343 (Mesclar em pendente na ficha do atendimento).
// Só desktop: 1360x900, como as telas de Atendimentos no design.md.
const base = '/atendimentos/125?prototype=343&captura=1&tema=claro'
const out = process.argv[2] ?? 'prototype-captures'

const corridas = [
  ['343-A-dois-botoes', 'variante=A'],
  ['343-B-menu-fechado', 'variante=B'],
  ['343-C-faixa', 'variante=C'],
  ['343-sem-pendente', 'variante=A&estado=sem-pendente'],
  ['343-transferido', 'variante=A&estado=transferido'],
  ['343-janela', 'variante=A&estado=janela'],
  ['343-janela-escuro', 'variante=A&estado=janela&tema=escuro'],
  ['343-A-escuro', 'variante=A&tema=escuro'],
  ['343-C-contraste', 'variante=C&tema=contraste'],
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
  await page.goto(`http://localhost:5343${base}&${query}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
  await ctx.close()
}

// Conferência: o menu da B abre com a ação; a janela abre pelo botão da A.
{
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: 'pt-BR' })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:5343${base}&variante=B`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Mais ações' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/343-B-menu-aberto.png` })
  console.log('ok 343-B-menu-aberto')
  await ctx.close()
}
await browser.close()
