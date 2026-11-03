// Conexão do número: ver features/connection.md. O celular é simulado; nada aqui toca no WhatsApp real.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('connection', async (t) => {
  const sector = await t.step('Preparar setor nunca conectado, com supervisor e atendente', () =>
    t.seedSector({ agents: 1, connected: false }),
  )
  const phone = t.phone(sector.id)
  const account = String(5511900000000 + sector.id)
  const formatted = `+55 (11) ${account.slice(4, 9)}-${account.slice(9)}`

  const page = await t.signIn(sector.supervisor)
  const notice = page
    .getByRole('alert')
    .filter({ hasText: `Número do setor ${sector.name} desconectado.` })
  const qr = page.getByRole('img', { name: 'QR code para conectar o número' })

  await t.step('Número nunca conectado: o painel avisa e leva à tela de conexão', async () => {
    await expect(notice).toBeVisible()
    await t.shot(page, 'aviso-no-painel')
    await notice.getByRole('link', { name: 'Reconecte pelo QR code.' }).click()
    await expect(page.getByRole('heading', { name: 'Conexão do WhatsApp' })).toBeVisible()
    await expect(page.getByText('Desconectado', { exact: true })).toBeVisible()
    await expect(page.getByText('O número ainda não foi conectado.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Desvincular número' })).toBeHidden()
    await t.shot(page, 'nunca-conectado')
  })

  await t.step('Conectar mostra o QR code, que troca sozinho', async () => {
    await page.getByRole('button', { name: 'Conectar' }).click()
    await expect(qr).toBeVisible()
    await expect(page.getByText('Conectando', { exact: true })).toBeVisible()
    await expect
      .poll(() => qr.evaluate((img) => img.complete && img.naturalWidth), { timeout: 20_000 })
      .toBeGreaterThan(0)
    await t.shot(page, 'qr-code')
    const firstCode = await qr.getAttribute('src')
    await phone.nextQR()
    await expect(qr).not.toHaveAttribute('src', firstCode)
  })

  await t.step(
    'Celular lê o QR code: a tela mostra o número conectado, sem recarregar',
    async () => {
      await phone.pair()
      await expect(page.getByText('Conectado', { exact: true })).toBeVisible()
      await expect(page.getByText(formatted)).toBeVisible()
      await expect(
        page.getByText(/^Última conexão em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\.$/),
      ).toBeVisible()
      await expect(qr).toBeHidden()
      await t.shot(page, 'conectado')
      await page.getByRole('link', { name: 'Atendimento' }).click()
      await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
      await expect(notice).toBeHidden()
    },
  )

  await t.step('Queda da conexão: o aviso aparece no painel, sem recarregar', async () => {
    await phone.drop()
    await expect(notice).toBeVisible()
    await t.shot(page, 'queda-no-painel')
    await notice.getByRole('link', { name: 'Reconecte pelo QR code.' }).click()
    await expect(page.getByText(formatted)).toBeVisible()
    await page.getByRole('link', { name: 'Atendimento' }).click()
  })

  await t.step('Desvinculado pelo celular: a tela pede um novo QR code', async () => {
    await phone.logOut()
    await notice.getByRole('link', { name: 'Reconecte pelo QR code.' }).click()
    await expect(page.getByText('Requer QR code', { exact: true })).toBeVisible()
    await expect(
      page.getByText('O número foi desvinculado. Conecte de novo pelo QR code.'),
    ).toBeVisible()
    await t.shot(page, 'requer-qr-code')
  })

  await t.step('Reconecta e desvincula pela tela, com confirmação', async () => {
    await page.getByRole('button', { name: 'Reconectar' }).click()
    await expect(qr).toBeVisible()
    await phone.pair(`${5511800000000 + sector.id}@s.whatsapp.net`)
    await expect(page.getByText('Conectado', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Desvincular número' }).click()
    const drawer = page.getByRole('dialog', { name: 'Desvincular número' })
    await expect(drawer).toContainText(`deixa de atender o setor ${sector.name}`)
    await t.shot(page, 'confirmar-desvinculo')
    await drawer.getByRole('button', { name: 'Cancelar' }).click()
    await expect(drawer).toBeHidden()
    await expect(page.getByText('Conectado', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Desvincular número' }).click()
    await drawer.getByRole('button', { name: 'Desvincular número' }).click()
    await expect(page.getByText('Número desvinculado')).toBeVisible()
    await expect(page.getByText('Requer QR code', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Desvincular número' })).toBeHidden()
    await t.shot(page, 'desvinculado')
  })

  await t.step('Número já ligado a outro setor é recusado, com o motivo na tela', async () => {
    const owner = await t.seedSector({ agents: 1 })
    await page.getByRole('button', { name: 'Reconectar' }).click()
    await expect(qr).toBeVisible()
    await phone.pair(`${5511900000000 + owner.id}@s.whatsapp.net`)
    await expect(
      page.getByText('Este número já está ligado a outro setor.', { exact: false }),
    ).toBeVisible()
    await expect(page.getByText('Requer QR code', { exact: true })).toBeVisible()
    await t.shot(page, 'numero-de-outro-setor')
  })

  await t.step('Atendente não vê a conexão nem o aviso, e a rota o devolve ao painel', async () => {
    const agentPage = await t.signIn(sector.agents[0])
    await expect(agentPage.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
    await expect(agentPage.getByRole('link', { name: 'Conexão' })).toBeHidden()
    await expect(agentPage.getByText(/desconectado\./)).toBeHidden()
    await agentPage.goto('/conexao')
    await expect(agentPage).toHaveURL(/\/$/)
    await t.shot(agentPage, 'atendente-sem-conexao')
    const blocked = await agentPage.request.post(`/api/sectors/${sector.id}/connection`)
    expect(blocked.status()).toBe(403)
    t.observe('Atendente tentando conectar pela API', { http: blocked.status() })
    await t.closeSession(agentPage)
  })

  await t.step('Estado final no banco, com a auditoria da conexão', async () => {
    const [row] = t.sql(
      `select connection_status, phone, external_account_id from sectors where id = ${sector.id}`,
    )
    expect(row.connection_status).toBe('logged_out')
    expect(row.external_account_id).toBeNull()
    t.observe('Setor', row)
    const audit = t.sql(
      `select a.action, u.name as actor from audit_logs a left join users u on u.id = a.actor_id
        where a.entity_type = 'sector' and a.entity_id = ${sector.id}
          and a.action in ('sector_connected', 'sector_disconnected') order by a.id`,
    )
    expect(audit.map((entry) => entry.action)).toEqual([
      'sector_connected',
      'sector_disconnected',
      'sector_connected',
      'sector_disconnected',
    ])
    expect(audit.at(-1).actor).toBe(sector.supervisor.name)
    t.observe('Auditoria da conexão', audit)
  })
})
