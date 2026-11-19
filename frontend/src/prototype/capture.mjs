// PROTÓTIPO #259: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5259 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5259'
const browser = await chromium.launch()
const states = ['menu', 'vazio', 'atual-incorreta', 'politica', 'comum', 'longa', 'confirmacao', 'igual', 'enviando', 'sucesso']
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })
  const list = scheme === 'light' ? states : ['menu', 'politica']
  for (const [i, state] of list.entries()) {
    const page = await context.newPage()
    await page.goto(`${base}/chamados?estado=${state}`)
    if (state === 'menu') await page.getByRole('menu').waitFor()
    else if (state !== 'sucesso') await page.getByRole('dialog').waitFor()
    await page.waitForTimeout(1200)
    const n = states.indexOf(state) + 1
    await page.screenshot({ path: `${out}/259-${String(n).padStart(2, '0')}-${state}${scheme === 'dark' ? '-escuro' : ''}.png` })
    console.log(scheme, state)
    await page.close()
  }
  await context.close()
}
await browser.close()
