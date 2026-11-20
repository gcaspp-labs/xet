// Consultar, só para leitura, as versões e a exclusão de mensagens em Atendimentos: ver
// features/atendimentos-message-revisions.md.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('atendimentos-message-revisions', async (t) => {
  const data = await t.step(
    'Preparar um atendimento encerrado com mensagens editadas e excluídas',
    async () => {
      const sector = await t.seedSector({ agents: 1, modules: ['Folha'] })
      const organization = await t.seedOrganization()
      const orgId = Number(
        t.sql(`select id from organizations where name = '${organization.name}'`)[0].id,
      )
      const moduleId = Number(
        t.sql(`select id from modules where sector_id = ${sector.id} and name = 'Folha'`)[0].id,
      )
      const customer = t.customer('Nina Cliente')
      await t.apiOk(
        t.admin.post('/api/contacts', {
          data: {
            name: customer.name,
            phone: customer.phone,
            organizationId: orgId,
            sectorIds: [sector.id],
          },
        }),
        `cadastrar ${customer.name}`,
      )

      const phone = t.phone(sector.id)
      const external = await phone.receive(customer, 'Preciso do boleto de setembro')

      const agent = await t.apiAs(sector.agents[0])
      const tickets = await (await agent.get(`/api/sectors/${sector.id}/tickets`)).json()
      const ticket = tickets.find((item) => item.contact.name === customer.name)
      await t.apiOk(agent.post(`/api/tickets/${ticket.id}/assign`), 'assumir o chamado')
      const sent = await (
        await t.apiOk(
          agent.post(`/api/tickets/${ticket.id}/messages`, {
            data: { clientRequestId: crypto.randomUUID(), body: 'Segue o boleto de setembro' },
          }),
          'enviar a mensagem do XET',
        )
      ).json()
      // Duas versões do XET, a última excluída só para o setor: o conteúdo continua preservado.
      await t.apiOk(
        agent.post(`/api/messages/${sent.id}/edit`, {
          data: { clientRequestId: crypto.randomUUID(), body: 'Segue o boleto de outubro' },
        }),
        'editar a mensagem do XET',
      )
      await t.apiOk(
        agent.post(`/api/messages/${sent.id}/delete`, {
          data: { clientRequestId: crypto.randomUUID(), scope: 'local' },
        }),
        'excluir a mensagem do XET só para o setor',
      )
      // O cliente edita e exclui a mensagem dele, fora do XET.
      await phone.edit(customer, external, 'Preciso do boleto de outubro', {
        externalEventId: `EDIT-${external}`,
      })
      await phone.revoke(customer, external, { externalEventId: `REVOKE-${external}` })

      await t.apiOk(
        agent.post(`/api/tickets/${ticket.id}/close`, {
          data: {
            subject: 'Boleto',
            resolution: 'Boleto enviado.',
            moduleIds: [moduleId],
            organizationId: orgId,
          },
        }),
        'encerrar o chamado',
      )
      return { sector, customer, ticket, sent, external }
    },
  )
  const { sector, customer, ticket } = data
  const agent = sector.agents[0]

  const agentPage = await t.signIn(agent, { viewport: { width: 1440, height: 900 } })

  await t.step('O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado', async () => {
    await agentPage.getByRole('link', { name: 'Atendimentos', exact: true }).click()
    await expect(agentPage.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
    await agentPage
      .getByRole('table')
      .locator('tbody')
      .getByRole('row')
      .filter({ hasText: customer.name })
      .getByRole('link')
      .click()
    await expect(agentPage).toHaveURL(new RegExp(`/atendimentos/${ticket.id}$`))
    await expect(agentPage.getByRole('status', { name: 'Só leitura' })).toBeVisible()

    const conversation = agentPage.getByRole('region', { name: 'Conversa', exact: true })
    const sent = conversation.getByRole('listitem', { name: 'Mensagem enviada' })
    await expect(sent).toContainText('Segue o boleto de outubro')
    await expect(sent).toContainText('Editada')
    await expect(sent).toContainText('Excluída')
    // O XET oculta o conteúdo em Chamados; em Atendimentos ele continua consultável.
    await expect(sent).not.toContainText('Mensagem excluída no XET')
    const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
    await expect(received).toContainText('Preciso do boleto de outubro')
    await expect(received).toContainText('Editada')
    await expect(received).toContainText('Excluída')
    await t.shot(agentPage, 'atendimento-com-conteudo-preservado')
  })

  await t.step('Somente leitura: nenhuma ação de alterar, restaurar ou reenviar', async () => {
    await expect(agentPage.getByRole('textbox', { name: 'Mensagem', exact: true })).toHaveCount(0)
    await expect(agentPage.getByRole('button', { name: 'Ações da mensagem' })).toHaveCount(0)
    await expect(agentPage.getByRole('button', { name: 'Reenviar' })).toHaveCount(0)
    await expect(agentPage.getByRole('button', { name: 'Responder' })).toHaveCount(0)
  })

  await t.step('As versões da mensagem do XET por teclado, com a exclusão só no XET', async () => {
    const conversation = agentPage.getByRole('region', { name: 'Conversa', exact: true })
    const trigger = conversation
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .getByRole('button', { name: 'Ver versões e exclusão' })
    await trigger.focus()
    await agentPage.keyboard.press('Enter')
    const dialog = agentPage.getByRole('dialog', { name: 'Versões e exclusão da mensagem' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Somente leitura.')
    await expect(dialog.getByTestId('message-version')).toHaveCount(2)
    await expect(dialog.getByTestId('message-version').first()).toContainText('Original')
    await expect(dialog.getByTestId('message-version').first()).toContainText(
      'Segue o boleto de setembro',
    )
    await expect(dialog.getByTestId('message-version').last()).toContainText('Editada')
    await expect(dialog.getByTestId('message-version').last()).toContainText('Atual')
    await expect(dialog.getByTestId('message-version').last()).toContainText(
      'Segue o boleto de outubro',
    )
    await expect(dialog.getByTestId('message-deletion')).toContainText('Excluída')
    await expect(dialog.getByTestId('message-deletion')).toContainText('Para mim (oculta no XET)')
    await expect(dialog.getByRole('button', { name: /Editar|Excluir|Reenviar|Restaurar/ })).toHaveCount(
      0,
    )
    await t.shot(agentPage, 'versoes-da-mensagem-do-xet')
    await agentPage.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  await t.step('A alteração e a exclusão externas, com autor e alcance registrados', async () => {
    const conversation = agentPage.getByRole('region', { name: 'Conversa', exact: true })
    await conversation
      .getByRole('listitem', { name: 'Mensagem recebida' })
      .getByRole('button', { name: 'Ver versões e exclusão' })
      .click()
    const dialog = agentPage.getByRole('dialog', { name: 'Versões e exclusão da mensagem' })
    await expect(dialog.getByTestId('message-version')).toHaveCount(2)
    await expect(dialog.getByTestId('message-version').first()).toContainText(
      'Preciso do boleto de setembro',
    )
    await expect(dialog.getByTestId('message-version').last()).toContainText(
      'Preciso do boleto de outubro',
    )
    await expect(dialog.getByTestId('message-version').last()).toContainText('pelo cliente')
    await expect(dialog.getByTestId('message-deletion')).toContainText(
      'Para todos (também no WhatsApp)',
    )
    await expect(dialog.getByTestId('message-deletion')).toContainText('pelo cliente')
    await t.shot(agentPage, 'exclusao-do-cliente')
    await agentPage.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })

  await t.step('Recarregar mantém o conteúdo, as etiquetas e as versões', async () => {
    await agentPage.reload()
    const conversation = agentPage.getByRole('region', { name: 'Conversa', exact: true })
    await expect(
      conversation.getByRole('listitem', { name: 'Mensagem enviada' }),
    ).toContainText('Segue o boleto de outubro')
    await expect(
      conversation.getByRole('listitem', { name: 'Mensagem recebida' }),
    ).toContainText('Preciso do boleto de outubro')
    await expect(
      conversation.getByRole('button', { name: 'Ver versões e exclusão' }),
    ).toHaveCount(2)
  })

  await t.step('Estado final no banco', async () => {
    const messages = t.sql(
      `select id, external_message_id, body, edited_at is not null as edited, deletion_scope, deletion_origin
       from messages where ticket_id = ${ticket.id} order by sent_at, id`,
    )
    t.observe('Mensagens do atendimento', JSON.stringify(messages))
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({
      external_message_id: data.external,
      body: 'Preciso do boleto de outubro',
      edited: true,
      deletion_scope: 'everyone',
      deletion_origin: 'customer',
    })
    expect(messages[1].body).toMatch(/^\*Atendente1 .*:\*\nSegue o boleto de outubro$/)
    expect(messages[1]).toMatchObject({
      edited: true,
      deletion_scope: 'local',
      deletion_origin: 'agent',
    })

    // Cada mensagem tem as versões na ordem em que aconteceram, com a exclusão no fim. O apelido
    // gravado no envio ("*Atendente1 ...:*") faz parte do conteúdo guardado, e a tela o separa.
    const content = (body) => (body ?? '').replace(/^\*[^*\n]+:\*\n/, '')
    for (const message of messages) {
      const changes = t.sql(
        `select kind, origin, body from message_changes
         where message_id = ${message.id} order by occurred_at, id`,
      )
      t.observe(`Versões da mensagem ${message.id}`, JSON.stringify(changes))
      const text = message.external_message_id === data.external ? 'Preciso do boleto' : 'Segue o boleto'
      expect(changes.map((change) => `${change.kind}:${content(change.body)}`)).toEqual([
        `original:${text} de setembro`,
        `edit:${text} de outubro`,
        'deletion:',
      ])
    }
    const [closed] = t.sql(`select status, closure_type from tickets where id = ${ticket.id}`)
    t.observe('Chamado', JSON.stringify(closed))
    expect(closed).toMatchObject({ status: 'closed', closure_type: 'resolved' })
  })
})
