// Editar e excluir mensagem enviada pelo XET: ver features/edit-delete-sent-message.md.
import { randomUUID } from 'node:crypto'
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('edit-delete-sent-message', async (t) => {
  const sector = await t.step('Preparar setor conectado com dois atendentes', () =>
    t.seedSector({ agents: 2 }),
  )
  const [agent, other] = sector.agents
  const phone = t.phone(sector.id)
  const maria = t.customer('Maria Cliente')
  await t.step('Mensagem do cliente chega à fila', () =>
    phone.receive(maria, 'Preciso do boleto de setembro'),
  )

  const page = await t.signIn(agent)
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const composer = page.getByRole('textbox', { name: 'Mensagem' })
  const sent = conversation.getByRole('listitem', { name: 'Mensagem enviada' })

  const ticketId = await t.step('Atendente assume e responde', async () => {
    await page
      .getByRole('region', { name: 'Fila e assuntos' })
      .getByRole('button', { name: 'Assumir chamado de Maria Cliente' })
      .click()
    await expect(page).toHaveURL(/\/chamados\/\d+$/)
    await composer.fill('Segue o boleto de setembro')
    await composer.press('Enter')
    await expect(sent.filter({ hasText: 'Segue o boleto de setembro' })).toContainText('Enviada')
    await t.shot(page, 'mensagem-enviada')
    return Number(page.url().split('/').pop())
  })
  const [first] = t.sql(
    `select id from messages where ticket_id = ${ticketId} and origin = 'agent' order by id`,
  )
  const agentApi = await t.apiAs(agent)
  const otherApi = await t.apiAs(other)
  const edit = (api, body, clientRequestId = randomUUID()) =>
    api.post(`/api/messages/${first.id}/edit`, { data: { clientRequestId, body } })
  const remove = (api, scope, id, clientRequestId = randomUUID()) =>
    api.post(`/api/messages/${id}/delete`, { data: { clientRequestId, scope } })

  await t.step('Quem não é o responsável não edita nem exclui', async () => {
    expect((await edit(otherApi, 'Tentativa')).status()).toBe(403)
    expect((await remove(otherApi, 'local', first.id)).status()).toBe(403)
  })

  await t.step('Recusa do WhatsApp não muda a mensagem', async () => {
    await phone.failNextChange('refused')
    const response = await edit(agentApi, 'Segue o boleto de outubro')
    expect(response.status()).toBe(502)
    await page.reload()
    await expect(sent.first()).toContainText('Segue o boleto de setembro')
  })

  await t.step('Responsável edita: a conversa mostra a nova versão sem recarregar', async () => {
    const response = await edit(agentApi, 'Segue o boleto de outubro')
    expect(response.status()).toBe(200)
    await expect(sent.first()).toContainText('Segue o boleto de outubro')
    await expect(sent).toHaveCount(1)
    await t.shot(page, 'mensagem-editada')
  })

  await t.step('Excluir para todos: o conteúdo continua guardado', async () => {
    expect((await remove(agentApi, 'everyone', first.id)).status()).toBe(200)
  })

  const second = await t.step('Segunda mensagem é excluída só no XET', async () => {
    await composer.fill('Mensagem por engano')
    await composer.press('Enter')
    await expect(sent.filter({ hasText: 'Mensagem por engano' })).toContainText('Enviada')
    const [row] = t.sql(
      `select id from messages where ticket_id = ${ticketId} and origin = 'agent' order by id desc limit 1`,
    )
    expect((await remove(agentApi, 'local', row.id)).status()).toBe(200)
    await page.reload()
    await t.shot(page, 'apos-exclusoes')
    return row
  })

  await t.step('Estado final no banco', async () => {
    const messages = t.sql(
      `select id, body, edited_at is not null as edited, deletion_scope, deletion_origin, status
         from messages where ticket_id = ${ticketId} and origin = 'agent' order by id`,
    )
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      body: `*${agent.name}:*\nSegue o boleto de outubro`,
      edited: true,
      deletion_scope: 'everyone',
      deletion_origin: 'agent',
    })
    expect(messages[1]).toMatchObject({ id: second.id, deletion_scope: 'local' })
    const actions = t.sql(
      `select message_id, kind, status from message_actions where ticket_id = ${ticketId} order by id`,
    )
    expect(actions.map((a) => `${a.kind}:${a.status}`)).toEqual([
      'edit:refused',
      'edit:accepted',
      'delete_everyone:accepted',
      'delete_local:accepted',
    ])
    const changes = t.sql(
      `select kind, origin, deletion_scope from message_changes where message_id = ${first.id} order by occurred_at, id`,
    )
    expect(changes.map((c) => `${c.kind}:${c.origin}`)).toEqual([
      'original:agent',
      'edit:agent',
      'deletion:agent',
    ])
    t.observe('Mensagens enviadas', messages)
    t.observe('Ações (message_actions)', actions)
    t.observe('Versões e exclusão da primeira (message_changes)', changes)
    t.observe(
      'Auditoria',
      t.sql(
        `select entity_id, action from audit_logs where entity_type = 'message' and ticket_id = ${ticketId} order by id`,
      ),
    )
  })
})
