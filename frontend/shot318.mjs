// PROTÓTIPO #318 — capturas descartáveis. Uso: node shot318.mjs
import { chromium } from 'playwright'

const base = 'http://localhost:5190/dashboard?prototype=318&captura=1'
const shots = [
  ['318-todos.png', ''],
  ['318-todos-escuro.png', '&tema=escuro'],
  ['318-whatsapp.png', '&canal=whatsapp'],
  ['318-whatsapp-tabela.png', '&canal=whatsapp&rolar=tabela'],
  ['318-telefone.png', '&canal=telefone'],
  ['318-telefone-tabela.png', '&canal=telefone&rolar=tabela'],
  ['318-telefone-escuro.png', '&canal=telefone&tema=escuro'],
]

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
})
const page = await ctx.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text())
})
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

for (const [file, query] of shots) {
  await page.goto(base + query, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `../prototype-captures/${file}`, fullPage: false })
  console.log('ok', file)
}

await browser.close()
