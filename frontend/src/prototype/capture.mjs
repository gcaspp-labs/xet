// PROTÓTIPO #114: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5114 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5114/chamados/300'
const shots = [
  ['01-encerrar-falhou', 'janela=encerrar&ultima=falhou', 'light'],
  ['02-encerrar-enviando', 'janela=encerrar&ultima=enviando', 'light'],
  ['03-encerrar-entregue', 'janela=encerrar&ultima=entregue', 'light'],
  ['04-encerrar-falhou-sem-cadastro', 'janela=encerrar&ultima=falhou&contato=0', 'light'],
  ['05-atendente-falhou', 'janela=atendente&ultima=falhou', 'light'],
  ['06-atendente-enviando', 'janela=atendente&ultima=enviando', 'light'],
  ['07-setor-falhou', 'janela=setor&ultima=falhou', 'light'],
  ['08-setor-enviando', 'janela=setor&ultima=enviando', 'light'],
  ['01-encerrar-falhou-escuro', 'janela=encerrar&ultima=falhou', 'dark'],
  ['05-atendente-enviando-escuro', 'janela=atendente&ultima=enviando', 'dark'],
  ['07-setor-falhou-escuro', 'janela=setor&ultima=falhou', 'dark'],
]
const browser = await chromium.launch()
for (const [name, query, scheme] of shots) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('pageerror', name, e.message))
  await page.goto(`${base}?${query}`)
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${out}/114-${name}.png` })
  console.log(name)
  await context.close()
}
await browser.close()
