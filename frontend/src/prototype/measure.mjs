// PROTÓTIPO #172: mede a rolagem e tira as capturas. Uso: node measure.mjs <pasta-saida> <prefixo>
import { chromium } from 'playwright'

const [, , out, prefix] = process.argv
const base = 'http://localhost:5272'
const cases = [
  ['conversa-aberta', '/conversas/300', 1440, 900],
  ['sem-conversa', '/conversas', 1440, 900],
  ['conversa-aberta-1280x720', '/conversas/300', 1280, 720],
  ['aba-assuntos', '/conversas/300', 1440, 900, 'assuntos'],
  ['poucos-itens', '/conversas/300?poucos=1', 1440, 900],
  ['abaixo-xl-1024', '/conversas/300', 1024, 768],
]
const browser = await chromium.launch()
for (const [name, path, w, h, extra] of cases) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(base + path)
  await page.getByRole('region', { name: 'Fila e assuntos' }).waitFor()
  await page.waitForTimeout(600)
  if (extra === 'assuntos') {
    await page.getByRole('tab', { name: 'Assuntos' }).click()
    await page.waitForTimeout(400)
  }
  const r = await page.evaluate(() => {
    const doc = document.scrollingElement
    const header = document.querySelector('main header')
    const box = (el) => {
      if (!el) return null
      const scroller = [el, ...el.querySelectorAll('*')].find(
        (n) => n.scrollHeight > n.clientHeight + 1 && ['auto', 'scroll'].includes(getComputedStyle(n).overflowY),
      )
      const b = el.getBoundingClientRect()
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), rolaSozinha: !!scroller }
    }
    const composer = document.querySelector('[aria-label="Enviar mensagem"], [aria-label="Gravar áudio"], textarea')
    const cb = composer?.getBoundingClientRect()
    return {
      paginaRola: doc.scrollHeight > window.innerHeight + 1,
      sobra: doc.scrollHeight - window.innerHeight,
      cabecalho: header ? Math.round(header.getBoundingClientRect().height) : null,
      meus: box(document.querySelector('[aria-labelledby="my-conversations-title"]')),
      conversa: box(document.querySelector('[aria-label="Conversa"]')),
      fila: box(document.querySelector('[aria-label="Fila e assuntos"]')),
      campoVisivel: cb ? cb.top >= 0 && cb.bottom <= window.innerHeight : null,
    }
  })
  console.log(name, `${w}x${h}`, JSON.stringify(r))
  if (out) await page.screenshot({ path: `${out}/${prefix}-${name}.png` })
  await page.close()
}
await browser.close()
