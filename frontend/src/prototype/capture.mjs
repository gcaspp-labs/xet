// PROTÓTIPO #174: tira as capturas. Uso: node capture.mjs <pasta-saida> <prefixo>
// Precisa do servidor do protótipo em :5274 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out, prefix] = process.argv
const base = 'http://localhost:5274'
const W = 1440
const H = 900
const browser = await chromium.launch()
const shot = async (name, path, step, opts = {}) => {
  const page = await browser.newPage({ viewport: { width: W, height: opts.h ?? H } })
  await page.goto(base + path)
  await page.waitForTimeout(900)
  if (step) await step(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/${prefix}-${name}.png`, fullPage: !!opts.full })
  await page.close()
}
const tab = (name) => async (page) => {
  const t = page.getByRole('tab', { name })
  if (await t.count()) await t.click()
}
// Ficha encerrada: abas e Detalhes (com Falou com e histórico de alterações).
await shot('chamado-encerrado-detalhes', '/chamados/500', null, { h: 1300 })
// Aba Notas (só no antes).
await shot('chamado-encerrado-notas', '/chamados/500', tab('Notas'))
// Chamado em atendimento: Detalhes com o campo editável Falou com.
await shot('chamado-aberto-detalhes', '/chamados/300')
// Formulário de correção.
await shot(
  'correcao',
  '/chamados/500',
  async (page) => {
    await page.getByRole('button', { name: 'Corrigir' }).click()
  },
  { h: 1300 },
)
// Janela Devolver à fila aberta em Conversas (texto citava notas).
await shot('conversas-devolver', '/conversas/300?as=agent', async (page) => {
  await page.getByRole('button', { name: 'Devolver à fila' }).click()
})
await shot('conversas-transferir', '/conversas/300?as=agent', async (page) => {
  await page.getByRole('button', { name: 'Transferir' }).click()
})
await browser.close()
