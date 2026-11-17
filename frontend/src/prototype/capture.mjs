// PROTÓTIPO #242: tira as capturas. Uso: node capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5242 (vite com BACKEND_URL numa porta morta).
// Os eventos de colar e soltar são disparados com DataTransfer, como nos testes pedidos na tarefa.
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5242'
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['microphone'],
})

// Dispara um evento de arrastar/soltar na área da conversa com arquivos falsos.
const drag = (page, type, files) =>
  page.evaluate(
    ([type, files]) => {
      const dt = new DataTransfer()
      for (const f of files) dt.items.add(new File([new Uint8Array(f.size)], f.name, { type: f.mime }))
      const area = document.querySelector('[aria-label="Conversa"]')
      area.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
    },
    [type, files],
  )
const paste = (page, files) =>
  page.evaluate((files) => {
    const dt = new DataTransfer()
    for (const f of files) dt.items.add(new File([new Uint8Array(f.size)], f.name, { type: f.mime }))
    const input = document.querySelector('textarea')
    input.focus()
    input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }))
  }, files)

const pdf = { name: 'nota-fiscal-outubro.pdf', size: 245_000, mime: 'application/pdf' }
const png = { name: 'image.png', size: 412_000, mime: 'image/png' }
const big = { name: 'video-reuniao.mp4', size: 17 * 1024 * 1024, mime: 'video/mp4' }

const shot = async (name, url, act) => {
  const page = await context.newPage()
  await page.goto(`${base}${url}`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.waitForTimeout(1200)
  if (act) await act(page)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/242-${name}.png` })
  console.log(name)
  await page.close()
}

await shot('1-padrao', '/chamados/300')
await shot('2-arrastando', '/chamados/300', (p) => drag(p, 'dragenter', [pdf]))
await shot('3-solto', '/chamados/300', async (p) => {
  await drag(p, 'dragenter', [pdf])
  await drag(p, 'drop', [pdf])
})
await shot('4-colado', '/chamados/300', (p) => paste(p, [png]))
await shot('5-limite-16mb', '/chamados/300', async (p) => {
  await drag(p, 'dragenter', [big])
  await drag(p, 'drop', [big])
})
await shot('6-varios-so-o-primeiro', '/chamados/300', async (p) => {
  await drag(p, 'dragenter', [pdf, png])
  await drag(p, 'drop', [pdf, png])
})
await shot('7-gravando-sem-efeito', '/chamados/300', async (p) => {
  await p.getByRole('button', { name: 'Gravar áudio' }).click()
  await p.waitForTimeout(1500)
  await drag(p, 'dragenter', [pdf])
  await drag(p, 'drop', [pdf])
})
await shot('8-outro-responsavel-sem-efeito', '/chamados/500', async (p) => {
  await drag(p, 'dragenter', [pdf])
})
await shot('9-atendimento-somente-leitura', '/atendimentos/600', async (p) => {
  await drag(p, 'dragenter', [pdf])
})
await browser.close()
