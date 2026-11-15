// PROTÓTIPO #200: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5200 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5200'
const browser = await chromium.launch()
const shot = async (name, url, act) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${base}${url}`)
  await page.getByRole('region', { name: 'Conversa' }).waitFor()
  await page.waitForTimeout(700)
  const msg = page.getByRole('listitem', { name: /Mensagem/ }).filter({ hasText: 'Enviei agora' })
  if (act) await act(page, msg)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/200-${name}.png` })
  console.log(name)
  await page.close()
}
const openBar = async (page, msg) => {
  await msg.getByRole('button', { name: 'Reagir' }).click()
  await page.getByRole('group', { name: 'Reagir à mensagem' }).first().waitFor()
}
// Versão aprovada (botão ao lado + etiquetas): nomes sem letra de versão.
const url = `/chamados/300?captura=1`
await shot('aprovada-reacoes', url)
await shot('aprovada-barra', url, (page, msg) => openBar(page, msg))
await shot('aprovada-mais', url, async (page, msg) => {
  await openBar(page, msg)
  await page.getByRole('button', { name: 'Mais emojis' }).first().click()
  await page.getByRole('searchbox', { name: 'Buscar emoji' }).fill('festa')
})
await shot('aprovada-sem-permissao', `/chamados/500?captura=1`, async (page, msg) => {
  await msg.hover()
})
await shot('aprovada-falha', `/chamados/300?captura=1&falha=1`, async (page, msg) => {
  await openBar(page, msg)
  await page.getByRole('button', { name: 'Reagir com ❤️' }).click()
  await page.waitForTimeout(900)
})
await browser.close()
