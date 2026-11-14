// PROTÓTIPO #177: tira as capturas. Uso (de frontend/): node src/prototype/capture.mjs <pasta-saida> <prefixo>
// Precisa do servidor do protótipo em :5277 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out, prefix] = process.argv
const base = 'http://127.0.0.1:5277'
const browser = await chromium.launch()
const shot = async (name, path, step, opts = {}) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: opts.h ?? 900 } })
  await page.goto(base + path)
  await page.waitForTimeout(1200)
  if (step) await step(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/${prefix}-${name}.png` })
  await page.close()
}
// Encerrado, visto pelo administrador: com Corrigir.
await shot('encerrado-com-corrigir', '/atendimentos/500')
// Encerrado, visto por outro atendente do setor: sem Corrigir.
await shot('encerrado-sem-corrigir', '/atendimentos/500?as=agent')
// Transferido para outro setor, com origem (chamado anterior) e destino.
await shot('transferido-cadeia', '/atendimentos/510', null, { h: 1100 })
// Cancelado: nunca tem Corrigir.
await shot('cancelado', '/atendimentos/520')
// Formulário de correção aberto na própria ficha.
await shot('correcao', '/atendimentos/500', async (page) => {
  await page.getByRole('button', { name: 'Corrigir' }).click()
})
// Aba Histórico (contato e órgão).
await shot('historico', '/atendimentos/500', async (page) => {
  await page.getByRole('tab', { name: 'Histórico' }).click()
})
await browser.close()
