// PROTÓTIPO #247: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5247 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5247'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const states = ['vazia', 'setor', 'motivo', 'enviando', 'erro', 'sem-setores']
for (const [i, state] of states.entries()) {
  const page = await context.newPage()
  await page.goto(`${base}/chamados/300?estado=${state}`)
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/247-${i + 1}-${state}.png` })
  console.log(state)
  await page.close()
}
// O seletor aberto, para ver a lista de destinos.
const page = await context.newPage()
await page.goto(`${base}/chamados/300?estado=vazia`)
await page.getByRole('dialog').waitFor()
await page.waitForTimeout(800)
await page.getByRole('combobox', { name: 'Setor de destino' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/247-7-seletor-aberto.png` })
await browser.close()
