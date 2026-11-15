// PROTÓTIPO #199: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5199 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5199'
const browser = await chromium.launch()
for (const v of ['A']) {
  for (const step of ['aberto', 'busca', 'inserido']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`${base}/chamados/300?as=agent&variant=${v}&captura=1`)
    const field = page.getByRole('textbox', { name: 'Mensagem' })
    await field.waitFor()
    await page.waitForTimeout(600)
    await field.fill('Pode enviar o comprovante por aqui, obrigada!')
    await field.evaluate((el) => el.setSelectionRange(44, 44))
    await page.getByRole('button', { name: 'Inserir emoji' }).click()
    await page.getByRole('textbox', { name: 'Buscar emoji' }).or(page.getByRole('combobox', { name: 'Buscar emoji' })).first().waitFor()
    if (step !== 'aberto') await page.keyboard.type('coração')
    if (step === 'busca' && v === 'A') await page.getByRole('button', { name: 'coração azul' }).hover()
    if (step === 'inserido') {
      await page.keyboard.press('Enter')
    }
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${out}/199-${v}-${step}.png` })
    console.log(v, step, step === 'inserido' ? await field.inputValue() : '')
    await page.close()
  }
}
await browser.close()
