import { chromium } from 'playwright'

// Capturas do protótipo #395 (X de cancelar na fila e motivo opcional).
// Versão C aprovada por Laboratório em 23/11/2026: X sempre visível com
// confirmação no próprio item. Só desktop: 1360x900, como as telas do helpdesk
// no design.md.
const out = process.argv[2] ?? '../prototype-captures'
const base = 'http://localhost:5395'

const browser = await chromium.launch()

async function abrir(url) {
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
  await page.goto(`${base}${url}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  return { ctx, page }
}

async function capturar(nome, url, preparar) {
  const { ctx, page } = await abrir(url)
  if (preparar) {
    await preparar(page)
    await page.waitForTimeout(350)
  }
  await page.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
  await ctx.close()
}

const chamados = '/chamados?prototype=395&tela=chamados&captura=1'
const dashboard = '/dashboard?prototype=395&tela=dashboard&captura=1'
const registro = '/chamados?prototype=395&tela=registro&captura=1'

await capturar('395-chamados-C', chamados)
await capturar('395-chamados-C-confirmar', `${chamados}&estado=confirmar`)
await capturar('395-chamados-janela', `${chamados}&estado=janela`)
await capturar('395-chamados-janela-motivo', `${chamados}&estado=janela-preenchida`)
await capturar('395-chamados-cancelado', chamados, async (page) => {
  await page.getByRole('button', { name: 'Cancelar chamado de Maria Oliveira' }).click()
  await page.getByRole('button', { name: 'Cancelar chamado', exact: true }).click()
  await page.waitForTimeout(250)
})
await capturar('395-dashboard-C', dashboard)
await capturar('395-dashboard-C-confirmar', `${dashboard}&estado=confirmar`)
await capturar('395-dashboard-cancelado', dashboard, async (page) => {
  await page.getByRole('button', { name: 'Cancelar chamado de Maria Oliveira' }).click()
  await page.getByRole('button', { name: 'Cancelar chamado', exact: true }).click()
  await page.waitForTimeout(250)
})
await capturar('395-registro-sem-motivo', registro)
await capturar('395-registro-com-motivo', `${registro}&estado=com-motivo`)
await capturar('395-chamados-escuro', `${chamados}&estado=confirmar&tema=escuro`)
await capturar('395-chamados-contraste', `${chamados}&tema=contraste`)
await capturar('395-dashboard-escuro', `${dashboard}&tema=escuro`)

await browser.close()
