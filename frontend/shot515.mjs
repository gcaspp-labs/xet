import { chromium } from 'playwright'

// Capturas do protótipo #515 (cartão da prévia do link na mensagem recebida).
// Desktop 1360x900, como as telas do helpdesk no design.md.
const out = process.argv[2] ?? '../prototype-captures'
const base = 'http://localhost:5515'

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

async function peca(nome, url, seletor) {
  const { ctx, page } = await abrir(url)
  const alvo = page.locator(seletor)
  await alvo.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await alvo.screenshot({ path: `${out}/${nome}.png` })
  console.log('ok', nome)
  await ctx.close()
}

const url = (variante, tema = 'claro') =>
  `/chamados?prototype=515&variante=${variante}&tema=${tema}&captura=1`

const topo = async (page) => {
  await page.locator('[data-slot="message-list"]').evaluate((el) => el.scrollTo({ top: 0 }))
}
const rodape = async (page) => {
  await page
    .locator('[data-slot="message-list"]')
    .evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
}

// Visão geral da conversa: o começo e o fim, em cada versão.
await capturar('515-A-1-topo', url('A'), topo)
await capturar('515-A-2-rodape', url('A'), rodape)
await capturar('515-B-1-topo', url('B'), topo)
await capturar('515-B-2-rodape', url('B'), rodape)

// Detalhe do cartão: com miniatura (caso 1) e com título e descrição longos (caso 3).
await peca('515-A-3-cartao-com-miniatura', url('A'), '#caso-1')
await peca('515-A-4-cartao-longo', url('A'), '#caso-3')
await peca('515-B-3-cartao-com-miniatura', url('B'), '#caso-1')
await peca('515-B-4-cartao-longo', url('B'), '#caso-3')

// O mesmo cartão no tema escuro, para conferir os tokens.
await capturar('515-A-5-escuro', url('A', 'escuro'), rodape)

await browser.close()
