// PROTÓTIPO #237 (descartável): imagem aberta por cima da conversa, com zoom. Só dados fictícios.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('prototype-237', async (t) => {
  const sector = await t.step('Preparar setor e um chamado fictício', async () => {
    const seeded = await t.seedSector({ agents: 1 })
    const customer = t.customer('Carla Cliente')
    await t.phone(seeded.id).receive(customer, 'Segue o print do erro na tela do sistema')
    return { ...seeded, carla: customer }
  })
  const page = await t.signIn(sector.agents[0])

  // Imagem fictícia: um "print de erro" desenhado na hora.
  const scratch = await page.context().newPage()
  await scratch.setViewportSize({ width: 900, height: 560 })
  await scratch.setContent(`<body style="margin:0;font:16px sans-serif;background:#eef2f7">
    <div style="margin:40px;padding:24px;background:#fff;border:1px solid #c9d2de;border-radius:8px">
      <h2 style="margin:0 0 12px">Sistema Fictício — Folha de Pagamento</h2>
      <div style="padding:12px;background:#fde8e8;color:#9b1c1c;border-radius:6px">
        Erro 4021: competência 10/2026 bloqueada para o órgão Prefeitura de Vila Esperança.</div>
      <p style="font-size:11px;color:#667">Detalhe técnico (texto pequeno, só legível com zoom): rotina FP-CALC-07, lote 3318, usuário maria.ficticia</p>
    </div></body>`)
  const png = await scratch.screenshot()
  await scratch.close()

  await t.step('Imagem na conversa', async () => {
    const [queued] = t.sql(
      `select t.id from tickets t join contacts c on c.id = t.contact_id
        where c.phone = '${sector.carla.phone}' and t.status = 'queued'`,
    )
    await page.goto(`/chamados/${queued.id}`)
    await page.getByRole('button', { name: 'Assumir', exact: true }).click()
    await page.getByLabel('Arquivo para enviar').setInputFiles({
      name: 'print-erro.png',
      mimeType: 'image/png',
      buffer: png,
    })
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()
    await expect(page.getByRole('button', { name: 'Ampliar imagem' })).toBeVisible()
    await page.waitForTimeout(800)
    await t.shot(page, '1-conversa')
  })

  await t.step('Clique abre por cima da conversa', async () => {
    await page.getByRole('button', { name: 'Ampliar imagem' }).click()
    const viewer = page.getByRole('dialog', { name: 'Imagem ampliada' })
    await expect(viewer).toBeVisible()
    await page.waitForTimeout(400)
    await t.shot(page, '2-aberta')
    await viewer.getByRole('button', { name: 'Aumentar zoom' }).click()
    await viewer.getByRole('button', { name: 'Aumentar zoom' }).click()
    await page.waitForTimeout(300)
    await t.shot(page, '3-zoom-200')
    await page.keyboard.press('Escape')
    await expect(viewer).toHaveCount(0)
  })
})
