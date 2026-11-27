import { chromium } from 'playwright'

// Capturas do protótipo #415 (campo "Usuário no legado" no cadastro de usuário).
// Desktop 1360x900, como as telas do helpdesk no design.md.
const out = process.argv[2] ?? '../prototype-captures'
const base = 'http://localhost:5415'

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
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
  await ctx.close()
}

const u = (extra = '') => `/admin/usuarios?prototype=415&captura=1${extra}`

await capturar('415-usuarios-lista', u())
await capturar('415-usuario-janela-novo', u('&form=novo'))
await capturar('415-usuario-janela-editar', u('&form=editar'))
// O conteúdo da janela rola: o fim mostra o campo novo e o bloco "Redefinir senha" inteiro.
await capturar('415-usuario-janela-editar-fim', u('&form=editar'), async (page) => {
  await page.evaluate(() => document.activeElement?.blur?.())
  await page
    .locator('[data-slot=dialog-body]')
    .evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
})
await capturar('415-usuarios-lista-escuro', u('&tema=escuro'))
await capturar('415-usuario-janela-editar-escuro', u('&form=editar&tema=escuro'))

await browser.close()
