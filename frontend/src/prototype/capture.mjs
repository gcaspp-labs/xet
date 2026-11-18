// PROTÓTIPO #262: capturas da paleta nova. Uso: node capture.mjs <pasta-saida> [prefixo]
// Precisa do servidor do protótipo em :5262 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out, prefix = '262'] = process.argv
const base = 'http://127.0.0.1:5262'
const cases = [
  ['claro', 'light', null],
  ['escuro', 'dark', null],
  ['ac-claro', 'light', 'high'],
  ['ac-escuro', 'dark', 'high'],
]
const screens = [
  ['login', '/login?deslogado=1', 'button[type=submit]'],
  ['chamados', '/chamados/300', 'main'],
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
    await page.goto(base + path)
    await page.locator(ready).first().waitFor()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${out}/${prefix}-${screen}-${name}.png` })
    console.log(screen, name)
    await page.close()
  }
  await context.close()
}
await browser.close()
