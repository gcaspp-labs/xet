// PROTÓTIPO #263: capturas dos tons de cinza. Uso: node capture.mjs <pasta-saida> [B|atual]
// Precisa do servidor do protótipo em :5263 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out, variant = 'B'] = process.argv
const prefix = variant
const base = 'http://127.0.0.1:5263'
const cases = [
  ['claro', 'light', null],
  ['escuro', 'dark', null],
  ['ac-claro', 'light', 'high'],
  ['ac-escuro', 'dark', 'high'],
]
const screens = [
  ['chamados', '/chamados/300?as=admin', 'main'],
  ['dashboard', '/dashboard?as=admin', 'main table'],
  ['atendimentos', '/atendimentos?as=admin', 'main table'],
]
const browser = await chromium.launch()
for (const [name, theme, contrast] of cases) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme })
  await context.addInitScript(
    ([t, c]) => {
      localStorage.setItem('theme', t)
      if (c) localStorage.setItem('contrast', c)
      else localStorage.removeItem('contrast')
    },
    [theme, contrast],
  )
  for (const [screen, path, ready] of screens) {
    const page = await context.newPage()
    await page.goto(base + path + '&variant=' + variant)
    await page.locator(ready).first().waitFor({ timeout: 15000 }).catch(() => console.log('sem', ready, screen))
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/${prefix}-${screen}-${name}.png` })
    console.log(screen, name)
    await page.close()
  }
  await context.close()
}
await browser.close()
