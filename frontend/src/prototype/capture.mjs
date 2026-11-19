// PROTÓTIPO #222: tira as capturas. Uso: node src/prototype/capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5222 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5222'
const browser = await chromium.launch()
const shots = [
  ['A', 'light'], ['A', 'dark'], ['A', 'light', 'aberto'], ['B', 'light'], ['C', 'light'], ['D', 'light'], ['D', 'light', 'aberto'], ['hoje', 'light'], ['A', 'light', 'fila'],
]
for (const [variant, scheme, extra] of shots) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })
  await context.addInitScript((s) => localStorage.setItem('theme', s), scheme)
  const page = await context.newPage()
  const ticket = extra === 'fila' ? '' : '/300'
  await page.goto(`${base}/chamados${ticket}?as=admin&variant=${variant}`)
  await page.getByText('PROTÓTIPO #222').waitFor()
  await page.waitForTimeout(1200)
  if (extra === 'aberto') {
    if (variant === 'D') await page.getByRole('button', { name: 'Setor' }).click()
    else await page.getByRole('combobox', { name: 'Setor' }).click()
    await page.waitForTimeout(500)
  }
  const name = `222-${variant}${extra ? '-' + extra : ''}${scheme === 'dark' ? '-escuro' : ''}.png`
  await page.screenshot({ path: `${out}/${name}`, clip: { x: 0, y: 0, width: 1440, height: 420 } })
  console.log(name)
  await context.close()
}
await browser.close()
