// PROTÓTIPO #188: tira as capturas. Uso: node src/prototype/capture.mjs <pasta-saida>
// Precisa do servidor do protótipo em :5288 (vite com BACKEND_URL numa porta morta).
import { chromium } from 'playwright'

const [, , out] = process.argv
const base = 'http://127.0.0.1:5288'
const browser = await chromium.launch()
const shot = async (name, path, step) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base + path)
  // Erros da API passam pelas novas tentativas do React Query antes de aparecer.
  await page.waitForTimeout(path.match(/\/(999|777)$/) ? 9000 : 1200)
  if (step) await step(page)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${out}/188-${name}.png` })
  console.log(name, page.url())
  await page.close()
}
await shot('ativo-atendimentos-300', '/atendimentos/300')
await shot('inexistente-atendimentos-999', '/atendimentos/999')
await shot('rota-antiga-conversas-300', '/conversas/300')
await shot('rota-antiga-atendimento', '/atendimento')
await shot('sem-acesso-403-sem-mudanca', '/atendimentos/777')
// Com página anterior: no Dashboard, abre um link interno que ainda aponta para /conversas/:id;
// Voltar volta ao Dashboard. (Só conferência, não muda o visual.)
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base + '/dashboard')
  await page.waitForTimeout(1500)
  const link = page.locator('a[href^="/conversas/"]').first()
  console.log('links /conversas no dashboard:', await page.locator('a[href^="/conversas/"]').count())
  if (await link.count()) {
    await link.click()
    await page.waitForTimeout(600)
    console.log('depois do link:', page.url())
    await page.getByRole('button', { name: 'Voltar' }).click()
    await page.waitForTimeout(600)
    console.log('Voltar com página anterior ->', page.url())
  }
  await page.close()
}
// Sem página anterior (endereço aberto direto): Voltar vai a /.
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(base + '/conversas')
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Voltar' }).click()
  await page.waitForTimeout(600)
  console.log('Voltar sem página anterior ->', page.url())
  await page.close()
}
await browser.close()
