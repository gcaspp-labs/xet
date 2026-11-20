// PROTÓTIPO #130: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5130 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5130/admin/usuarios'
const steps = [
  ['01-pagina-1', ''],
  ['02-pagina-2', '?pagina=2'],
  ['03-ordem-situacao', '?ordem=situacao&direcao=desc'],
  ['04-ordem-setor', '?ordem=setor'],
  ['05-ordem-papel', '?ordem=papel'],
  ['06-vazio', '?vazio=1'],
]
const browser = await chromium.launch()
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: scheme,
  })
  const list = scheme === 'light' ? steps : steps.slice(0, 1)
  for (const [name, query] of list) {
    const page = await context.newPage()
    await page.goto(base + query)
    await page.waitForTimeout(1500)
    await page.screenshot({
      path: `${out}/130-${name}${scheme === 'dark' ? '-escuro' : ''}.png`,
      fullPage: true,
    })
    console.log(scheme, name)
    await page.close()
  }
  await context.close()
}
// Celular: as colunas de dados viram legenda sob o nome.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await phone.newPage()
await page.goto(base)
await page.waitForTimeout(1500)
await page.screenshot({ path: `${out}/130-07-celular.png`, fullPage: true })
console.log('celular')
await phone.close()
await browser.close()
