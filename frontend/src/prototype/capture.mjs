// PROTÓTIPO #203: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5203 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5203'
const browser = await chromium.launch()
const shot = async (name, url, act) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${base}${url}`)
  await page.getByRole('region', { name: 'Conversa' }).waitFor()
  await page.waitForTimeout(700)
  if (act) await act(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${out}/203-${name}.png` })
  console.log(name)
  await page.close()
}
const reply = async (page, id) => {
  const li = page.locator(`#msg-${id}`)
  await li.scrollIntoViewIfNeeded()
  await li.locator('div').first().hover()
  await li.getByRole('button', { name: 'Responder' }).click()
}
const middle = (page, t = 300) => page.locator(`#msg-${t}05`).evaluate((el) => el.scrollIntoView({ block: 'center' }))
// Versão aprovada (antiga A): nomes sem letra de versão.
{
  const v = 'aprovada'
  const url = `/chamados/300?captura=1`
  await shot(`${v}-citacoes`, url, middle)
  await shot(`${v}-fim`, url)
  await shot(`${v}-preparo`, url, async (page) => {
    await reply(page, 30003)
    await page.getByRole('textbox', { name: 'Mensagem' }).fill('Ouvi sim, já anotei o pedido.')
  })
  await shot(`${v}-enviada`, url, async (page) => {
    await reply(page, 30003)
    const field = page.getByRole('textbox', { name: 'Mensagem' })
    await field.fill('Ouvi sim, já anotei o pedido.')
    await field.press('Enter')
    await page.waitForTimeout(600)
    await page.mouse.move(5, 5)
  })
  await shot(`${v}-sem-permissao`, `/chamados/500?captura=1`, async (page) => {
    await middle(page, 500)
    await page.locator('#msg-50005 div').first().hover()
  })
}
await browser.close()
