import { chromium } from 'playwright'

// Capturas do protótipo #414 (campos do de-para do robô do legado nos cadastros).
// Desktop 1360x900, como as telas do helpdesk no design.md.
const out = process.argv[2] ?? '../prototype-captures'
const base = 'http://localhost:5414'

const browser = await chromium.launch()

async function abrir(url) {
  const ctx = await browser.newContext({
    viewport: { width: 1360, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light',
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE:', m.text())
  })
  await page.goto(`${base}${url}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  return { ctx, page }
}

async function capturar(nome, url, preparar) {
  const { ctx, page } = await abrir(url)
  if (preparar) {
    await preparar(page)
    await page.waitForTimeout(500)
  }
  await page.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
  await ctx.close()
}

const u = (tela, extra = '') => `/orgaos?prototype=414&tela=${tela}&captura=1${extra}`

await capturar('414-orgaos-lista', u('orgaos'))
await capturar('414-orgao-janela', u('orgaos', '&form=orgao'))
await capturar('414-orgao-janela-novo', u('orgaos', '&form=orgao-novo'))
await capturar('414-setores-lista', u('setores'))
await capturar('414-setor-janela', u('setores', '&form=setor'))
await capturar('414-modulos-admin', u('modulos'))
await capturar('414-modulo-janela-admin', u('modulos', '&form=modulo'))
await capturar('414-modulos-supervisor', u('modulos', '&papel=supervisor'))
await capturar('414-modulo-janela-supervisor', u('modulos', '&papel=supervisor&form=modulo'))
await capturar('414-modulos-admin-escuro', u('modulos', '&tema=escuro'))

await browser.close()
