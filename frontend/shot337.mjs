import { chromium } from 'playwright'

// Capturas do protótipo #337: 1360x900 no desktop e 390x844 no celular,
// como as telas de Chamados do design.md. Rola o painel de Pendentes quando
// a captura pede, para mostrar a linha do setor (administrador).
const base = 'http://localhost:5337/chamados?prototype=337&captura=1'
const out = process.argv[2] ?? 'prototype-captures'

const corridas = [
  ['337-pendentes-claro', 1360, 900, 'estado=inicio&tema=claro'],
  ['337-pendentes-admin-claro', 1360, 900, 'estado=admin&tema=claro'],
  ['337-pendentes-vazia-claro', 1360, 900, 'estado=vazio&tema=claro'],
  ['337-menu-claro', 1360, 900, 'estado=menu&tema=claro'],
  ['337-colocar-pendente-claro', 1360, 900, 'estado=marcar&tema=claro'],
  ['337-colocar-pendente-erro-claro', 1360, 900, 'estado=marcar-erro&tema=claro'],
  ['337-pendente-aberto-claro', 1360, 900, 'estado=pendente&tema=claro'],
  ['337-retomar-chamado-claro', 1360, 900, 'estado=retomar&tema=claro'],
  ['337-pendentes-escuro', 1360, 900, 'estado=inicio&tema=escuro'],
  ['337-pendente-escuro', 1360, 900, 'estado=pendente&tema=escuro'],
  ['337-pendentes-contraste', 1360, 900, 'estado=inicio&tema=contraste'],
  ['337-pendentes-390', 390, 844, 'estado=estreito&tema=claro'],
  ['337-pendente-390', 390, 844, 'estado=pendente&tema=claro'],
]

const browser = await chromium.launch()
for (const [nome, width, height, query] of corridas) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE:', m.text())
  })
  await page.goto(`${base}&${query}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
  await ctx.close()
}
await browser.close()
