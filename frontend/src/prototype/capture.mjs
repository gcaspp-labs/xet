// PROTÓTIPO #178: tira as capturas e mede o cabeçalho. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5178 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5178'
// [nome, caminho, largura, altura, passo extra]
const cases = [
  ['desktop-responsavel', '/chamados/300?as=agent', 1440, 900],
  ['desktop-responsavel-menu', '/chamados/300?as=agent', 1440, 900, 'menu'],
  ['desktop-supervisor-alheio-menu', '/chamados/500?as=supervisor', 1440, 900, 'menu'],
  ['desktop-fila-menu', '/chamados/400?as=agent', 1440, 900, 'menu'],
  ['desktop-sem-acoes', '/chamados/500?as=agent', 1440, 900],
  ['desktop-admin', '/chamados/300?as=admin', 1440, 900],
  ['desktop-novo-chamado', '/chamados?as=agent', 1440, 900, 'novo'],
  ['1024-responsavel', '/chamados/300?as=agent', 1024, 768],
  ['1024-admin-menu', '/chamados/300?as=admin', 1024, 768, 'menu'],
  ['1024-meus', '/chamados/300?as=agent', 1024, 768, 'meus'],
  ['celular-responsavel', '/chamados/300?as=agent', 390, 844],
  ['celular-responsavel-menu', '/chamados/300?as=agent', 390, 844, 'menu'],
  ['celular-fila-chamado', '/chamados/400?as=agent', 390, 844],
  ['celular-meus', '/chamados?as=agent', 390, 844],
  ['celular-novo-chamado', '/chamados?as=agent', 390, 844, 'novo'],
]
const browser = await chromium.launch()
for (const [name, path, w, h, extra] of cases) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(base + path)
  await page.locator('[aria-label="Fila e assuntos"]').waitFor({ state: 'attached' })
  await page.waitForTimeout(700)
  const header = await page.locator('main header').first().boundingBox()
  if (extra === 'menu') {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menu').waitFor()
  }
  if (extra === 'meus') await page.getByRole('tab', { name: /^Meus/ }).click()
  if (extra === 'novo') {
    await page.getByRole('button', { name: 'Novo chamado' }).click()
    await page.getByRole('dialog').waitFor()
  }
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/178-${name}.png` })
  console.log(name, `${w}x${h}`, 'cabeçalho', Math.round(header?.height ?? -1), 'px')
  await page.close()
}
await browser.close()
