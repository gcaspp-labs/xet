// Transferir: ver features/transfer.md.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('transfer', async (t) => {
  const { sector, destination, joana, lucia, organization } = await t.step(
    'Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila',
    async () => {
      const seeded = await t.seedSector({ agents: 2, modules: ['Folha'] })
      const other = await t.seedSector({ agents: 1 })
      const org = await t.seedOrganization()
      const first = t.customer('Joana Cliente')
      const second = t.customer('Lúcia Cliente')
      await t.phone(seeded.id).receive(first, 'Preciso da segunda via da guia')
      await t.phone(seeded.id).receive(second, 'Folha de março')
      return { sector: seeded, destination: other, joana: first, lucia: second, organization: org }
    },
  )
  const [agent, colleague] = sector.agents

  const agentPage = await t.signIn(agent)
  const conversation = agentPage.getByRole('region', { name: 'Conversa', exact: true })

  const ticketId = await t.step('Atendente assume o chamado', async () => {
    await agentPage.getByRole('link', { name: joana.name }).click()
    await agentPage.getByRole('button', { name: 'Assumir', exact: true }).click()
    await expect(agentPage.getByText('Chamado assumido')).toBeVisible()
    await expect(conversation).toContainText(`${agent.name} assumiu o chamado`)
    return Number(agentPage.url().split('/').pop())
  })

  const colleaguePage = await t.signIn(colleague)
  const colleagueConversation = colleaguePage.getByRole('region', { name: 'Conversa', exact: true })

  await t.step('Colega acompanha, sem poder responder nem transferir', async () => {
    await colleaguePage.goto(`/chamados/${ticketId}`)
    await expect(colleagueConversation).toContainText(
      `Chamado com ${agent.name}. Peça a transferência`,
    )
    await expect(colleaguePage.getByRole('button', { name: 'Transferir' })).toHaveCount(0)
    await expect(colleaguePage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    await t.shot(colleaguePage, 'colega-antes')
  })

  await t.step('Responsável transfere para o colega e perde a resposta', async () => {
    await agentPage.getByRole('button', { name: 'Transferir' }).click()
    const sheet = agentPage.getByRole('dialog', { name: 'Transferir chamado' })
    await sheet.getByRole('combobox', { name: 'Transferir para' }).click()
    await t.shot(agentPage, 'escolher-destino')
    // O próprio responsável não aparece como destino.
    await expect(agentPage.getByRole('option', { name: new RegExp(`^${agent.name}`) })).toHaveCount(
      0,
    )
    await agentPage
      .getByRole('option', { name: new RegExp(`^${colleague.name} · Atendente`) })
      .click()
    await sheet.getByRole('button', { name: 'Transferir' }).click()
    await expect(agentPage.getByText('Chamado transferido')).toBeVisible()
    await expect(conversation).toContainText(`Chamado com ${colleague.name}. Peça a transferência`)
    await expect(agentPage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    await expect(agentPage.getByRole('button', { name: 'Transferir' })).toHaveCount(0)
    await expect(conversation).toContainText('Preciso da segunda via da guia')
    await expect(
      conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
        hasText: `${agent.name} transferiu o chamado para ${colleague.name}`,
      }),
    ).toBeVisible()
    await t.shot(agentPage, 'depois-de-transferir')
  })

  await t.step('Novo responsável passa a responder, sem recarregar', async () => {
    await expect(colleagueConversation).toContainText(
      `${agent.name} transferiu o chamado para ${colleague.name}`,
    )
    const composer = colleaguePage.getByRole('textbox', { name: 'Mensagem' })
    await composer.fill('Assumi o seu atendimento.')
    await composer.press('Enter')
    await expect(
      colleagueConversation
        .getByRole('listitem', { name: 'Mensagem enviada' })
        .filter({ hasText: 'Assumi o seu atendimento.' }),
    ).toContainText('Enviada')
    await expect(conversation).toContainText('Assumi o seu atendimento.')
    await t.shot(colleaguePage, 'novo-responsavel-responde')
  })

  await t.step('Pela API, o responsável anterior é recusado', async () => {
    const blocked = await agentPage.request.post(`/api/tickets/${ticketId}/messages`, {
      data: { clientRequestId: crypto.randomUUID(), body: 'Resposta indevida' },
    })
    expect(blocked.status()).toBe(403)
    t.observe('Resposta do responsável anterior pela API', { http: blocked.status() })
  })

  const supervisorPage = await t.signIn(sector.supervisor)

  await t.step('Supervisor transfere o chamado de outra pessoa', async () => {
    await supervisorPage.goto(`/chamados/${ticketId}`)
    await supervisorPage.getByRole('button', { name: 'Transferir' }).click()
    const sheet = supervisorPage.getByRole('dialog', { name: 'Transferir chamado' })
    await sheet.getByRole('combobox', { name: 'Transferir para' }).click()
    await supervisorPage
      .getByRole('option', { name: new RegExp(`^${agent.name} · Atendente`) })
      .click()
    await sheet.getByRole('button', { name: 'Transferir' }).click()
    await expect(supervisorPage.getByText('Chamado transferido')).toBeVisible()
    await expect(conversation).toContainText(
      `${sector.supervisor.name} transferiu o chamado de ${colleague.name} para ${agent.name}`,
    )
    await expect(agentPage.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
    await expect(colleaguePage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    await t.shot(agentPage, 'supervisor-transferiu')
  })

  await t.closeSession(supervisorPage)
  await t.closeSession(colleaguePage)

  await t.step('Estado final da transferência no banco, com o histórico preservado', async () => {
    const [ticket] = t.sql(
      `select t.status, u.name as assignee, (select count(*) from messages m where m.ticket_id = t.id) as messages
         from tickets t join users u on u.id = t.assignee_id where t.id = ${ticketId}`,
    )
    expect(ticket).toMatchObject({ status: 'in_progress', assignee: agent.name, messages: 2 })
    t.observe('Chamado transferido', ticket)
    const audit = t.sql(
      `select a.action, actor.name as actor, a.changes from audit_logs a
         left join users actor on actor.id = a.actor_id
        where a.ticket_id = ${ticketId} order by a.id`,
    )
    expect(audit.map((entry) => entry.action)).toEqual([
      'ticket_assigned',
      'ticket_transferred_user',
      'ticket_transferred_user',
    ])
    expect(audit[1].actor).toBe(agent.name)
    expect(audit[1].changes.assignee_id).toEqual({ from: agent.id, to: colleague.id })
    expect(audit[2].actor).toBe(sector.supervisor.name)
    expect(audit[2].changes.assignee_id).toEqual({ from: colleague.id, to: agent.id })
    t.observe('Auditoria da transferência', audit)
  })

  const otherTicketId = await t.step(
    'Responsável assume um segundo chamado para mandar a outro setor',
    async () => {
      await agentPage.goto('/')
      await agentPage.getByRole('link', { name: lucia.name }).click()
      await agentPage.getByRole('button', { name: 'Assumir', exact: true }).click()
      await expect(agentPage.getByText('Chamado assumido')).toBeVisible()
      return Number(agentPage.url().split('/').pop())
    },
  )

  await t.step('Transferência para outro setor exige o formulário e encerra a origem', async () => {
    await agentPage.getByRole('button', { name: 'Outro setor' }).click()
    const sheet = agentPage.getByRole('dialog', { name: 'Transferir para outro setor' })
    await sheet.getByRole('button', { name: 'Transferir' }).click()
    await expect(sheet).toContainText('Escolha o setor de destino.')
    await expect(sheet).toContainText('Informe o assunto.')
    await t.shot(agentPage, 'formulario-outro-setor')
    await sheet.getByRole('button', { name: 'Cadastrar contato' }).click()
    const contactSheet = agentPage.getByRole('dialog', { name: 'Editar contato' })
    await contactSheet.getByLabel('Órgão').fill(organization.name)
    await agentPage.getByRole('option', { name: organization.name }).click()
    await contactSheet.getByRole('button', { name: 'Salvar' }).click()
    await expect(agentPage.getByText('Contato salvo')).toBeVisible()
    await sheet.getByLabel('Assunto').fill('Folha de março')
    await sheet.getByLabel('Resolução').fill('Encaminhado ao setor responsável.')
    await sheet.getByRole('checkbox', { name: 'Folha' }).click()
    await sheet.getByLabel('Setor de destino').click()
    await agentPage.getByRole('option', { name: destination.name }).click()
    await sheet.getByRole('button', { name: 'Transferir' }).click()
    await expect(agentPage.getByText('Chamado transferido para outro setor')).toBeVisible()
    await expect(agentPage.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
    const doneRow = agentPage
      .getByRole('region', { name: 'Realizados hoje' })
      .getByRole('row', { name: new RegExp(lucia.name) })
    await expect(doneRow).toContainText('Transferido')
    await t.shot(agentPage, 'origem-realizados')
  })

  const destinationPage = await t.signIn(destination.agents[0])

  await t.step('Destino recebe na fila, com a origem e a conversa anterior', async () => {
    await destinationPage.getByRole('link', { name: lucia.name }).click()
    const destinationConversation = destinationPage.getByRole('region', {
      name: 'Conversa',
      exact: true,
    })
    await expect(destinationConversation).toContainText(
      `Transferido de ${sector.name}. Assuma o chamado e envie a primeira mensagem ao cliente.`,
    )
    const previous = destinationPage
      .getByRole('region', { name: 'Chamado' })
      .getByRole('region', { name: 'Chamado anterior' })
    await expect(previous).toContainText(sector.name)
    await expect(previous).toContainText('Folha de março')
    await expect(previous).toContainText(`Transferido por ${agent.name}`)
    await t.shot(destinationPage, 'destino-na-fila')

    await destinationPage.getByRole('button', { name: 'Assumir', exact: true }).click()
    await expect(destinationPage.getByText('Chamado assumido')).toBeVisible()
    const composer = destinationPage.getByRole('textbox', { name: 'Mensagem' })
    await composer.fill('Olá, aqui é o setor de destino.')
    await composer.press('Enter')
    await expect(
      destinationConversation
        .getByRole('listitem', { name: 'Mensagem enviada' })
        .filter({ hasText: 'Olá, aqui é o setor de destino.' }),
    ).toContainText('Enviada')
    await t.shot(destinationPage, 'destino-responde')
  })

  await t.step('Estado final da transferência entre setores no banco', async () => {
    const chain = t.sql(
      `select s.name as sector, t.status, t.closure_type, t.previous_ticket_id, t.subject
         from tickets t join sectors s on s.id = t.sector_id
        where t.id = ${otherTicketId} or t.previous_ticket_id = ${otherTicketId} order by t.id`,
    )
    expect(chain).toEqual([
      {
        sector: sector.name,
        status: 'closed',
        closure_type: 'transferred',
        previous_ticket_id: null,
        subject: 'Folha de março',
      },
      {
        sector: destination.name,
        status: 'in_progress',
        closure_type: null,
        previous_ticket_id: otherTicketId,
        subject: null,
      },
    ])
    t.observe('Origem e destino', chain)
    const audit = t.sql(
      `select action from audit_logs where ticket_id = ${otherTicketId} order by id`,
    )
    expect(audit.map((entry) => entry.action)).toContain('ticket_transferred_sector')
    t.observe('Auditoria da origem', audit)
  })
})
