// PROTÓTIPO #129: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5129 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5129/assuntos'
const steps = [
  ['01-pagina-1', ''],
  ['02-pagina-2', '?pagina=2'],
  ['03-ultima-pagina', '?pagina=3'],
  ['04-ordem-modulo', '?ordem=modulo&direcao=desc'],
  ['05-busca-solucao', '?busca=parcelamento'],
  ['06-busca-assunto', '?busca=iptu'],
  ['07-busca-sem-resultado', '?busca=xyz'],
  ['08-vazio', '?vazio=1'],
]
const browser = await chromium.launch()
for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: scheme,
  })
  const list = scheme === 'light' ? steps : steps.slice(0, 2)
  for (const [name, query] of list) {
    const page = await context.newPage()
    await page.goto(base + query)
    await page.waitForTimeout(1500)
    await page.screenshot({
      path: `${out}/129-${name}${scheme === 'dark' ? '-escuro' : ''}.png`,
      fullPage: true,
    })
    console.log(scheme, name)
    await page.close()
  }
  await context.close()
}
// Celular: a lista e a paginação cabem na largura.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await phone.newPage()
await page.goto(base)
await page.waitForTimeout(1500)
await page.screenshot({ path: `${out}/129-09-celular.png`, fullPage: true })
console.log('celular')
await phone.close()
await browser.close()
