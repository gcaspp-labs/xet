// Responder: ver features/reply.md.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('reply', async (t) => {
  const sector = await t.step(
    'Preparar setor conectado, atendente, supervisor e um chamado na fila',
    async () => {
      const seeded = await t.seedSector({ agents: 1 })
      await t.phone(seeded.id).receive(t.customer('Carla Cliente'), 'Preciso do contracheque')
      return seeded
    },
  )
  const agent = sector.agents[0]
  const phone = t.phone(sector.id)

  const agentPage = await t.signIn(agent)
  const conversation = agentPage.getByRole('region', { name: 'Conversa', exact: true })
  const composer = agentPage.getByRole('textbox', { name: 'Mensagem' })
  const sent = (text) =>
    conversation.getByRole('listitem', { name: 'Mensagem enviada' }).filter({ hasText: text })

  const ticketId = await t.step('Sem assumir, não há como responder', async () => {
    await agentPage.getByRole('link', { name: 'Carla Cliente' }).click()
    await expect(agentPage.getByRole('heading', { name: 'Carla Cliente' })).toBeVisible()
    await expect(conversation).toContainText('Preciso do contracheque')
    await expect(conversation).toContainText('Chamado na fila. Assuma o chamado para responder.')
    await expect(composer).toHaveCount(0)
    await t.shot(agentPage, 'sem-assumir')
    return Number(agentPage.url().split('/').pop())
  })

  await t.step('Atendente assume e a caixa de resposta aparece', async () => {
    await agentPage.getByRole('button', { name: 'Assumir', exact: true }).click()
    await expect(agentPage.getByText('Chamado assumido')).toBeVisible()
    await expect(composer).toBeVisible()
  })

  const supervisorPage = await t.signIn(sector.supervisor)
  const supervisorConversation = supervisorPage.getByRole('region', {
    name: 'Conversa',
    exact: true,
  })

  await t.step('Quem não é o responsável acompanha, mas não responde', async () => {
    await supervisorPage.goto(`/chamados/${ticketId}`)
    await expect(supervisorConversation).toContainText(
      `Chamado com ${agent.name}. Peça a transferência`,
    )
    await expect(supervisorPage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    await t.shot(supervisorPage, 'supervisor-sem-resposta')
  })

  const clientRequestId = await t.step(
    'Responsável responde com Enter e a mensagem sai',
    async () => {
      const sending = agentPage.waitForRequest(
        (req) => req.url().endsWith('/messages') && req.method() === 'POST',
      )
      await composer.fill('Segue o contracheque em anexo.')
      await composer.press('Enter')
      const { clientRequestId: id } = (await sending).postDataJSON()
      await expect(sent('Segue o contracheque em anexo.')).toContainText('Enviada')
      await expect(composer).toHaveValue('')
      await t.shot(agentPage, 'mensagem-enviada')
      return id
    },
  )

  await t.step('Supervisor vê a resposta na outra janela, sem recarregar', async () => {
    await expect(supervisorConversation).toContainText('Segue o contracheque em anexo.')
    await t.shot(supervisorPage, 'supervisor-acompanha')
  })

  await t.step('Celular do contato confirma a entrega e a leitura', async () => {
    const externalId = `fake-msg-${clientRequestId}`
    await phone.status('delivered', [externalId])
    await expect(sent('Segue o contracheque em anexo.')).toContainText('Entregue')
    await phone.status('read', [externalId])
    await expect(sent('Segue o contracheque em anexo.')).toContainText('Lida')
    await t.shot(agentPage, 'mensagem-lida')
  })

  const countById = (id) =>
    Number(t.sql(`select count(*) as n from messages where client_request_id = '${id}'`)[0].n)

  await t.step('Repetir o envio devolve a mesma mensagem, sem duplicar', async () => {
    const [{ id: messageId }] = t.sql(
      `select id from messages where client_request_id = '${clientRequestId}'`,
    )
    const response = await agentPage.request.post(`/api/tickets/${ticketId}/messages`, {
      data: { clientRequestId, body: 'Segue o contracheque em anexo.' },
    })
    expect(response.ok()).toBeTruthy()
    expect((await response.json()).id).toBe(messageId)
    expect(countById(clientRequestId)).toBe(1)
    t.observe('Envio repetido', { http: response.status(), mesmaMensagem: messageId, linhas: 1 })
  })

  await t.step('Pela API, quem não é responsável também é recusado', async () => {
    const before = t.sql(`select count(*) as n from messages where ticket_id = ${ticketId}`)[0].n
    const blocked = await supervisorPage.request.post(`/api/tickets/${ticketId}/messages`, {
      data: { clientRequestId: crypto.randomUUID(), body: 'Resposta indevida' },
    })
    expect(blocked.status()).toBe(403)
    expect(t.sql(`select count(*) as n from messages where ticket_id = ${ticketId}`)[0].n).toBe(
      before,
    )
    await expect(conversation).not.toContainText('Resposta indevida')
    t.observe('Resposta indevida pela API', { http: blocked.status(), mensagensAlteradas: 0 })
  })

  await t.step('Arquivo com legenda é enviado e fica disponível na conversa', async () => {
    await agentPage.getByLabel('Arquivo para enviar').setInputFiles({
      name: 'contracheque.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.7 contracheque de teste'),
    })
    await agentPage
      .getByRole('textbox', { name: 'Legenda do arquivo' })
      .fill('Contracheque de outubro')
    await agentPage.getByRole('button', { name: 'Enviar mensagem' }).click()
    const file = sent('contracheque.pdf')
    await expect(file).toContainText('Contracheque de outubro')
    await expect(file).toContainText('Enviada')
    const link = file.getByRole('link', { name: /contracheque\.pdf/ })
    await expect(link).toHaveAttribute('href', /^\/api\/media\/\d+$/)
    const download = await agentPage.request.get((await link.getAttribute('href')) ?? '')
    expect(download.ok()).toBeTruthy()
    expect((await download.body()).toString()).toContain('contracheque de teste')
    await t.shot(agentPage, 'arquivo-enviado')
  })

  await t.step('Número caído: a mensagem falha, sem reenvio automático', async () => {
    await phone.drop()
    await composer.fill('Mensagem com o número caído')
    await agentPage.getByRole('button', { name: 'Enviar mensagem' }).click()
    const message = sent('Mensagem com o número caído')
    await expect(message).toContainText('Falhou')
    await expect(message).toContainText('Número do setor desconectado.')
    await t.shot(agentPage, 'mensagem-falhou')
  })

  await t.step('Com o número de volta, o responsável reenvia sem duplicar', async () => {
    await t.apiOk(t.admin.post(`/api/sectors/${sector.id}/connection`), 'reconectar setor')
    const message = sent('Mensagem com o número caído')
    await message.getByRole('button', { name: 'Reenviar' }).click()
    await expect(message).toContainText('Enviada')
    await expect(message).not.toContainText('Falhou')
    await expect(sent('Mensagem com o número caído')).toHaveCount(1)
    await t.shot(agentPage, 'mensagem-reenviada')
  })

  await t.step('Estado final no banco', async () => {
    const messages = t.sql(
      `select direction, origin, type, status, body, external_message_id is not null as accepted_by_provider
         from messages where ticket_id = ${ticketId} order by id`,
    )
    expect(messages.map((message) => [message.direction, message.status])).toEqual([
      ['inbound', null],
      ['outbound', 'read'],
      ['outbound', 'sent'],
      ['outbound', 'sent'],
    ])
    expect(messages.slice(1).every((message) => message.accepted_by_provider)).toBe(true)
    t.observe('Mensagens do chamado', messages)
  })
})
