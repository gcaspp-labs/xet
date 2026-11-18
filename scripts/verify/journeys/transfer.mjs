// Transferir: ver features/transfer.md.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('transfer', async (t) => {
  const { sector, destination, joana, lucia } = await t.step(
    'Preparar dois setores conectados, pessoas e dois chamados na fila',
    async () => {
      const seeded = await t.seedSector({ agents: 2 })
      const other = await t.seedSector({ agents: 1 })
      const first = t.customer('Joana Cliente')
      const second = t.customer('Lúcia Cliente')
      await t.phone(seeded.id).receive(first, 'Preciso da segunda via da guia')
      await t.phone(seeded.id).receive(second, 'Folha de março')
      return { sector: seeded, destination: other, joana: first, lucia: second }
    },
  )
  const [agent, colleague] = sector.agents

  // As ações do chamado (Transferir, Outro setor, Cancelar chamado) ficam no menu "Mais ações".
  const chooseAction = async (page, name) => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }
  // A fila fica na aba Fila do cartão "Fila e assuntos" da tela Chamados.
  const queueOf = (page) => page.getByRole('region', { name: 'Fila e assuntos' })

  const agentPage = await t.signIn(agent)
  const conversation = agentPage.getByRole('region', { name: 'Conversa', exact: true })

  const ticketId = await t.step('Atendente assume o chamado', async () => {
    await queueOf(agentPage)
      .getByRole('button', { name: `Assumir chamado de ${joana.name}` })
      .click()
    await expect(agentPage).toHaveURL(/\/chamados\/\d+$/)
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
    // Sem permissão, nem o menu "Mais ações" aparece.
    await expect(colleaguePage.getByRole('button', { name: 'Mais ações' })).toHaveCount(0)
    await expect(colleaguePage.getByRole('button', { name: 'Transferir' })).toHaveCount(0)
    await expect(colleaguePage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    await t.shot(colleaguePage, 'colega-antes')
  })

  await t.step('Responsável transfere para o colega e perde a resposta', async () => {
    await chooseAction(agentPage, 'Transferir')
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
    // Quem transfere sai da conversa e volta à lista; o chamado deixa de ser dele.
    await expect(agentPage).toHaveURL(/\/chamados$/)
    await agentPage.goto(`/chamados/${ticketId}`)
    await expect(conversation).toContainText(`Chamado com ${colleague.name}. Peça a transferência`)
    await expect(agentPage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    await expect(agentPage.getByRole('button', { name: 'Mais ações' })).toHaveCount(0)
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
    await chooseAction(supervisorPage, 'Transferir')
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
      await expect(agentPage).toHaveURL(/\/chamados$/)
      await queueOf(agentPage)
        .getByRole('button', { name: `Assumir chamado de ${lucia.name}` })
        .click()
      await expect(agentPage).toHaveURL(/\/chamados\/\d+$/)
      return Number(agentPage.url().split('/').pop())
    },
  )

  await t.step('Transferência para outro setor é sem formulário e encerra a origem', async () => {
    await chooseAction(agentPage, 'Outro setor')
    const sheet = agentPage.getByRole('dialog', { name: 'Transferir para outro setor' })
    // Só o setor e o motivo opcional: nada de formulário de encerramento nem de cadastro do contato.
    await expect(sheet.getByLabel('Assunto')).toHaveCount(0)
    await expect(sheet.getByRole('button', { name: 'Cadastrar contato' })).toHaveCount(0)
    await sheet.getByRole('button', { name: 'Transferir' }).click()
    await expect(sheet.getByRole('alert')).toContainText('Escolha o setor de destino.')
    await t.shot(agentPage, 'janela-outro-setor')
    await sheet.getByLabel('Setor de destino').click()
    await agentPage.getByRole('option', { name: destination.name }).click()
    await sheet.getByLabel('Motivo da transferência (opcional)').fill('Folha de março é com o outro setor.')
    await sheet.getByRole('button', { name: 'Transferir' }).click()
    await expect(agentPage.getByText('Chamado transferido para outro setor')).toBeVisible()
    await expect(agentPage).toHaveURL(/\/chamados$/)
    // O chamado de origem, encerrado como transferido, vai para o histórico em Atendimentos.
    await agentPage.getByRole('link', { name: 'Atendimentos', exact: true }).click()
    await expect(agentPage.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
    const doneRow = agentPage.getByRole('table').getByRole('row', { name: new RegExp(lucia.name) })
    await expect(doneRow).toContainText('Transferido')
    await expect(doneRow).toContainText(`para ${destination.name}`)
    await t.shot(agentPage, 'origem-no-historico')
  })

  const destinationPage = await t.signIn(destination.agents[0])
  let destinationTicketId

  await t.step('Destino recebe na fila, assume e responde', async () => {
    // O chamado novo está na fila do destino e só abre pelo endereço, até alguém assumir.
    const [created] = t.sql(
      `select id from tickets where previous_ticket_id = ${otherTicketId}`,
    )
    destinationTicketId = created.id
    await expect(
      queueOf(destinationPage).getByRole('listitem').filter({ hasText: lucia.name }),
    ).toHaveCount(1)
    await destinationPage.goto(`/chamados/${destinationTicketId}`)
    const destinationConversation = destinationPage.getByRole('region', {
      name: 'Conversa',
      exact: true,
    })
    await expect(destinationConversation).toContainText(
      `Transferido de ${sector.name}. Assuma o chamado e envie a primeira mensagem ao cliente.`,
    )
    // O aviso da transferência, na ordem do tempo, traz o setor de origem e o motivo.
    await expect(
      destinationConversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
        hasText: `${agent.name} transferiu o chamado do setor ${sector.name} para o setor ${destination.name}`,
      }),
    ).toContainText('Motivo: Folha de março é com o outro setor.')
    await t.shot(destinationPage, 'destino-na-fila')

    await destinationPage.getByRole('button', { name: 'Assumir', exact: true }).click()
    await expect(destinationPage.getByText('Chamado assumido')).toBeVisible()
    await expect(destinationPage.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
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
      `select s.name as sector, t.status, t.closure_type, t.previous_ticket_id, t.subject, t.transfer_reason,
              t.organization_id
         from tickets t join sectors s on s.id = t.sector_id
        where t.id = ${otherTicketId} or t.previous_ticket_id = ${otherTicketId} order by t.id`,
    )
    expect(chain).toEqual([
      {
        sector: sector.name,
        status: 'closed',
        closure_type: 'transferred',
        previous_ticket_id: null,
        subject: null,
        transfer_reason: 'Folha de março é com o outro setor.',
        organization_id: null,
      },
      {
        sector: destination.name,
        status: 'in_progress',
        closure_type: null,
        previous_ticket_id: otherTicketId,
        subject: null,
        transfer_reason: null,
        // O contato não tem cadastro nem órgão: o chamado chega sem órgão.
        organization_id: null,
      },
    ])
    t.observe('Origem e destino', chain)
    const audit = t.sql(
      `select action, changes from audit_logs where ticket_id = ${otherTicketId} order by id`,
    )
    const transfer = audit.find((entry) => entry.action === 'ticket_transferred_sector')
    expect(transfer).toBeTruthy()
    expect(transfer.changes.transfer_reason).toEqual({
      from: null,
      to: 'Folha de março é com o outro setor.',
    })
    t.observe('Auditoria da origem', audit)
  })

  const details = (page) => page.getByRole('region', { name: 'Atendimento', exact: true })

  await t.step('Chamado de origem abre a ficha só leitura, com o destino na cadeia', async () => {
    await agentPage.goto(`/atendimentos/${otherTicketId}`)
    await expect(agentPage.getByRole('status', { name: 'Só leitura' })).toContainText(
      `Transferido para ${destination.name}`,
    )
    const chain = details(agentPage).getByRole('region', { name: 'Cadeia de transferências' })
    await expect(chain).toContainText(sector.name)
    await expect(chain).toContainText(destination.name)
    await expect(agentPage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    // Quem encerrou corrigiria um atendimento comum, mas a etapa transferida não tem correção.
    await expect(agentPage.getByRole('button', { name: 'Corrigir' })).toHaveCount(0)
    // O aviso da origem mostra o setor de destino, quem transferiu e o motivo.
    await expect(
      agentPage
        .getByRole('region', { name: 'Conversa', exact: true })
        .getByRole('listitem', { name: 'Registro do chamado' })
        .filter({ hasText: `${agent.name} transferiu o chamado para o setor ${destination.name}` }),
    ).toContainText('Motivo: Folha de março é com o outro setor.')
    await t.shot(agentPage, 'ficha-origem')
  })

  await t.step('Destino cancela o chamado novo e a ficha dele traz a origem', async () => {
    await chooseAction(destinationPage, 'Cancelar chamado')
    const cancel = destinationPage.getByRole('dialog', { name: 'Cancelar chamado' })
    await cancel.getByLabel('Motivo').fill('Encerrado ao fim da verificação.')
    await cancel.getByRole('button', { name: 'Cancelar chamado' }).click()
    await expect(destinationPage.getByText('Chamado cancelado', { exact: true })).toBeVisible()
    await destinationPage.goto(`/atendimentos/${destinationTicketId}`)
    const previous = details(destinationPage).getByRole('region', { name: 'Chamado anterior' })
    const [origin] = t.sql(`select protocol from tickets where id = ${otherTicketId}`)
    await expect(previous).toContainText(sector.name)
    await expect(previous).toContainText(origin.protocol)
    await expect(previous).toContainText('Motivo: Folha de março é com o outro setor.')
    await expect(previous).toContainText(`transferido por ${agent.name}`)
    // Sem formulário, o quadro não mostra assunto nem resolução vazios.
    await expect(previous).not.toContainText('Assunto:')
    await expect(previous).not.toContainText('Resolução:')
    await t.shot(destinationPage, 'ficha-destino-com-origem')
    await previous.getByRole('link', { name: 'Ver chamado anterior' }).click()
    await expect(destinationPage).toHaveURL(new RegExp(`/atendimentos/${otherTicketId}$`))
    await expect(destinationPage.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
      'Folha de março',
    )
    await t.shot(destinationPage, 'ficha-origem-pelo-destino')
  })

  await t.step('Estado final do destino cancelado no banco', async () => {
    const [destinationTicket] = t.sql(
      `select status, closure_type, previous_ticket_id from tickets where id = ${destinationTicketId}`,
    )
    expect(destinationTicket).toEqual({
      status: 'closed',
      closure_type: 'cancelled',
      previous_ticket_id: otherTicketId,
    })
    t.observe('Destino depois do cancelamento', destinationTicket)
  })
})
