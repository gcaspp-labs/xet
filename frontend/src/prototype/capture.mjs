// PROTÓTIPO #239: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5239 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5239'
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const shot = async (name, url, act, ready = 'Copiar telefone') => {
  const page = await context.newPage()
  await page.goto(`${base}${url}`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.waitForTimeout(1200)
  if (act) await act(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/239-${name}.png` })
  console.log(name)
  await page.close()
}
const btn = (page) => page.getByRole('button', { name: 'Copiar telefone' }).first()
// Cabeçalho do chamado ativo
await shot('chamado-padrao', '/chamados/300')
await shot('chamado-hover', '/chamados/300', (p) => btn(p).hover())
await shot('chamado-foco-teclado', '/chamados/300', async (p) => {
  await btn(p).focus()
  await p.keyboard.press('Shift+Tab')
  await p.keyboard.press('Tab')
})
await shot('chamado-copiado', '/chamados/300', async (p) => {
  await btn(p).click()
  await p.waitForTimeout(300)
  console.log('área de transferência:', await p.evaluate(() => navigator.clipboard.readText()))
  await p.mouse.move(5, 5)
})
await shot('chamado-falha', '/chamados/300?falha=1', async (p) => {
  await btn(p).click()
  await p.mouse.move(5, 5)
})
await shot('chamado-sem-telefone', '/chamados/301')
// Ficha do atendimento encerrado (aba Detalhes, linha Contato)
await shot('ficha-padrao', '/atendimentos/600')
await shot('ficha-copiado', '/atendimentos/600', async (p) => {
  await btn(p).click()
  await p.mouse.move(5, 5)
})
await shot('ficha-sem-telefone', '/atendimentos/601')
await browser.close()
