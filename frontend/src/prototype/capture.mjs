// PROTÓTIPO #164: tira as capturas. Uso (de frontend/): node src/prototype/capture.mjs <pasta-saida> <prefixo> [ficha]
// Precisa do servidor do protótipo em :5264 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out, prefix, withTicket] = process.argv
const base = 'http://127.0.0.1:5264'
const browser = await chromium.launch()
const shot = async (name, path, step) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base + path)
  await page.waitForTimeout(1500)
  if (step) await step(page)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${out}/${prefix}-${name}.png` })
  await page.close()
}
await shot('supervisor', '/atendimentos')
await shot('admin', '/atendimentos?perfil=admin')
if (withTicket)
  // Clique numa linha: abre a ficha só leitura da #177.
  await shot('ficha', '/atendimentos', async (page) => {
    await page.locator('tbody tr').first().click({ position: { x: 300, y: 15 } })
    await page.waitForURL(/\/atendimentos\/\d+/)
  })
await browser.close()
