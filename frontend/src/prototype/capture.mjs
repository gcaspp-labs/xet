// PROTÓTIPO #258: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5258 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5258'
const browser = await chromium.launch()
for (const theme of ['claro', 'escuro']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript((t) => localStorage.setItem('theme', t), theme === 'claro' ? 'light' : 'dark')
  const page = await context.newPage()

  await page.goto(`${base}/prototype/senha`)
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${out}/258-estados-${theme}.png`, fullPage: true })

  await page.goto(`${base}/login`)
  await page.getByLabel('E-mail').waitFor()
  await page.waitForTimeout(800)
  await page.getByLabel('E-mail').fill('ana.souza@exemplo.com.br')
  await page.locator('#password').fill('Senha-ficticia#2026')
  await page.getByRole('button', { name: 'Mostrar senha' }).click()
  await page.getByRole('button', { name: 'Ocultar senha' }).focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${out}/258-login-visivel-${theme}.png` })

  await page.locator('#password').fill('')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/258-login-erro-${theme}.png` })
  await context.close()
}
await browser.close()
