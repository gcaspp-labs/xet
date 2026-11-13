// PROTÓTIPO #172: mede a rolagem e tira as capturas. Uso: node measure.mjs [pasta-saida]
// Precisa do servidor do protótipo em :5272 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://localhost:5272'
// [nome, caminho, largura, altura, passo extra]
const cases = [
  ['xl-conversa-aberta', '/conversas/300?variant=A', 1440, 900],
  ['xl-conversa-aberta-178', '/conversas/300?variant=A&cabecalho=178', 1440, 900],
  ['xl-sem-conversa', '/conversas?variant=A', 1440, 900],
  ['A-1024-conversa', '/conversas/300?variant=A', 1024, 768],
  ['A-1024-fila', '/conversas/300?variant=A', 1024, 768, 'fila'],
  ['A-celular-conversa', '/conversas/300?variant=A&as=agent', 390, 844],
  ['A-celular-conversa-178', '/conversas/300?variant=A&as=agent&cabecalho=178', 390, 844],
  ['A-celular-meus', '/conversas?variant=A&as=agent', 390, 844],
  ['A-celular-menu', '/conversas/300?variant=A&as=agent&cabecalho=178', 390, 844, 'menu'],
  ['B-1024-conversa', '/conversas/300?variant=B', 1024, 768],
  ['B-1024-conversa-178', '/conversas/300?variant=B&cabecalho=178', 1024, 768],
  ['B-768-conversa-178', '/conversas/300?variant=B&as=agent&cabecalho=178', 768, 1024],
  ['B-celular-conversa-178', '/conversas/300?variant=B&as=agent&cabecalho=178', 390, 844],
]
const browser = await chromium.launch()
for (const [name, path, w, h, extra] of cases) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(base + path + '&captura=1')
  await page.locator('[aria-label="Fila e assuntos"]').waitFor({ state: 'attached' })
  await page.waitForTimeout(700)
  if (extra === 'fila') {
    await page.getByRole('tab', { name: /^Fila \(/ }).click()
    await page.waitForTimeout(300)
  }
  if (extra === 'menu') {
    await page.getByRole('button', { name: 'Abrir menu' }).first().click()
    await page.waitForTimeout(500)
  }
  const r = await page.evaluate(() => {
    const doc = document.scrollingElement
    const visible = (el) => el && el.getClientRects().length > 0
    const box = (el) => {
      if (!visible(el)) return 'oculto'
      const scroller = [el, ...el.querySelectorAll('*')].find(
        (n) =>
          n.scrollHeight > n.clientHeight + 1 &&
          ['auto', 'scroll'].includes(getComputedStyle(n).overflowY),
      )
      const b = el.getBoundingClientRect()
      return `${Math.round(b.top)}-${Math.round(b.bottom)}${scroller ? ' rola' : ''}`
    }
    const composer = [...document.querySelectorAll('textarea')].find(visible)
    const cb = composer?.getBoundingClientRect()
    const header = document.querySelector('main header')
    return {
      paginaRola: doc.scrollHeight > window.innerHeight + 1,
      cabecalho: header ? Math.round(header.getBoundingClientRect().height) : null,
      meus: box(document.querySelector('[aria-labelledby="my-conversations-title"]')),
      conversa: box(document.querySelector('[aria-label="Conversa"]')),
      fila: box(document.querySelector('[aria-label="Fila e assuntos"]')),
      campoVisivel: cb ? cb.top >= 0 && cb.bottom <= window.innerHeight : null,
    }
  })
  console.log(name.padEnd(26), `${w}x${h}`, JSON.stringify(r))
  if (out) await page.screenshot({ path: `${out}/172-${name}.png` })
  await page.close()
}
await browser.close()
