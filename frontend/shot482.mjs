import { chromium } from 'playwright'

// Capturas do protótipo #482 (foto do contato conforme o WhatsApp).
// Desktop 1360x900, como as telas do helpdesk no design.md, mais o celular.
const out = process.argv[2] ?? '../prototype-captures'
const base = 'http://localhost:5482'

const browser = await chromium.launch()

async function abrir(url, viewport = { width: 1360, height: 900 }) {
  const ctx = await browser.newContext({
    viewport,
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
  await page.waitForTimeout(400)
  return { ctx, page }
}

async function capturar(nome, url, preparar, viewport) {
  const { ctx, page } = await abrir(url, viewport)
  if (preparar) {
    await preparar(page)
    await page.waitForTimeout(400)
  }
  await page.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
  await ctx.close()
}

const chamados = (estado, extra = '') =>
  `/chamados?prototype=482&tela=chamados&estado=${estado}&captura=1${extra}`
const atendimentos = (estado) =>
  `/chamados?prototype=482&tela=atendimentos&estado=${estado}&captura=1`
const contatos = (estado) => `/chamados?prototype=482&tela=contatos&estado=${estado}&captura=1`
const ficha = (estado) => `/chamados?prototype=482&tela=ficha&estado=${estado}&captura=1`

const abrirFoto = (nome) => async (page) => {
  await page.getByRole('button', { name: `Ver foto de ${nome}` }).click()
}

await capturar('482-chamados-misto', chamados('misto'))
await capturar('482-chamados-iniciais', chamados('iniciais'))
await capturar('482-chamados-icone', chamados('icone'))
await capturar('482-chamados-foto-grande', chamados('misto'), abrirFoto('Maria Oliveira'))
await capturar('482-atendimentos-foto', atendimentos('foto'))
await capturar('482-contatos-misto', contatos('misto'))
await capturar('482-contatos-iniciais', contatos('iniciais'))
await capturar('482-contatos-icone', contatos('icone'))
await capturar('482-ficha-foto', ficha('foto'))
await capturar('482-ficha-iniciais', ficha('iniciais'))
await capturar('482-ficha-icone', ficha('icone'))
await capturar('482-ficha-foto-grande', ficha('foto'), abrirFoto('Maria Oliveira'))
await capturar('482-chamados-escuro', chamados('misto', '&tema=escuro'))
await capturar(
  '482-contatos-escuro',
  `/chamados?prototype=482&tela=contatos&estado=misto&tema=escuro&captura=1`,
)
await capturar('482-chamados-contraste', chamados('misto', '&tema=contraste'))
await capturar('482-chamados-celular', chamados('misto'), undefined, {
  width: 390,
  height: 844,
})

await browser.close()
