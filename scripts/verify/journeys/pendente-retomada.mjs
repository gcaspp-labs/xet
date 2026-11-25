// Chamado pendente e retomada por mesclagem: ver features/pendente-retomada.md.
import {
  atendimentosRowOf,
  conversationOf,
  expect,
  expectAuditOrder,
  journey,
  mineOf,
  panelOf,
  queueRowOf,
} from '../scripts/journey-lib.mjs'

await journey('pendente-retomada', async (t) => {
  const reason = 'Aguardando o órgão confirmar o número do protocolo antigo'
  const { sector, customer } = await t.step(
    'Preparar setor com atendente e supervisor, e a primeira mensagem do cliente',
    async () => {
      const seeded = await t.seedSector({ agents: 1 })
      const contact = t.customer('Marina Cliente')
      await t.phone(seeded.id).receive(contact, 'Preciso da segunda via do contracheque de março')
      return { sector: seeded, customer: contact }
    },
  )
  const agent = sector.agents[0]

  const agentPage = await t.signIn(agent)

  // O responsável assume o chamado da fila pelo próprio botão, como o atendente faz.
  const pending = await t.step('Atendente assume o chamado A e o coloca como pendente, com motivo', async () => {
    await panelOf(agentPage)
      .getByRole('button', { name: `Assumir chamado de ${customer.name}` })
      .click()
    await expect(agentPage).toHaveURL(/\/chamados\/\d+$/)
    const ticketId = Number(agentPage.url().split('/').pop())
    const [ticket] = t.sql(`select id, protocol, status from tickets where id = ${ticketId}`)
    // O chamado assumido está em Meus chamados enquanto é um atendimento ativo.
    await expect(mineOf(agentPage)).toContainText('Meus chamados (1)')
    await expect(mineOf(agentPage)).toContainText(ticket.protocol)
    await expect(conversationOf(agentPage)).toContainText(
      'Preciso da segunda via do contracheque de março',
    )
    await agentPage.getByRole('button', { name: 'Mais ações' }).click()
    await agentPage.getByRole('menuitem', { name: 'Colocar como pendente', exact: true }).click()
    const dialog = agentPage.getByRole('dialog', { name: 'Colocar como pendente' })
    await dialog.getByLabel('Motivo').fill(reason)
    await dialog.getByRole('button', { name: 'Colocar como pendente' }).click()
    await expect(agentPage.getByText('Chamado marcado como pendente')).toBeVisible()
    // A tela volta para a lista, sem chamado aberto, e A saiu de Meus chamados.
    await expect(agentPage).toHaveURL(/\/chamados$/)
    await expect(mineOf(agentPage)).toContainText('Meus chamados (0)')
    await expect(mineOf(agentPage)).toContainText('Você não tem atendimentos ativos.')
    await expect(mineOf(agentPage)).not.toContainText(ticket.protocol)
    return ticket
  })

  await t.step('A aparece na aba Pendentes com protocolo, motivo, quem marcou e o Retomar', async () => {
    await panelOf(agentPage)
      .getByRole('tab', { name: /^Pendentes/ })
      .click()
    const row = queueRowOf(agentPage, customer)
    await expect(row).toBeVisible()
    await expect(row).toContainText(pending.protocol)
    await expect(row).toContainText(reason)
    await expect(row).toContainText(`por ${agent.name}`)
    await expect(row).toContainText('agora')
    await expect(
      row.getByRole('button', { name: `Retomar chamado de ${customer.name}` }),
    ).toBeVisible()
    await t.shot(agentPage, 'aba-pendentes')
  })

  // O supervisor vê o mesmo pendente no quadro do Dashboard, que não segue o período dos números.
  const supervisorPage = await t.signIn(sector.supervisor)
  await t.step('Supervisor vê o chamado no quadro Pendentes do Dashboard', async () => {
    await supervisorPage.goto('/dashboard')
    const board = supervisorPage.getByRole('region', { name: /^Pendentes/ })
    await expect(board).toContainText('(1)')
    await expect(board).toContainText('Os 10 parados há mais tempo')
    await expect(board).toContainText(customer.name)
    await expect(board).toContainText(pending.protocol)
    await expect(board).toContainText(reason)
    await expect(board).toContainText('agora')
    // "Ver todos" leva à aba Pendentes de Chamados.
    await expect(board.getByRole('link', { name: /Ver todos/ })).toHaveAttribute(
      'href',
      '/chamados?aba=pendentes',
    )
    await t.shot(supervisorPage, 'dashboard-pendentes')
    await t.closeSession(supervisorPage)
  })

  // O cliente volta a escrever: o pendente não recebe a mensagem, e sim um chamado novo na fila.
  const second = await t.step('Cliente volta a escrever e o chamado B entra na Fila', async () => {
    await panelOf(agentPage)
      .getByRole('tab', { name: /^Fila/ })
      .click()
    await t.phone(sector.id).receive(customer, 'Voltei com a nota fiscal')
    const row = queueRowOf(agentPage, customer)
    await expect(row).toContainText('Voltei com a nota fiscal')
    await t.shot(agentPage, 'b-na-fila')
    const [ticket] = t.sql(
      `select t.id, t.protocol from tickets t
         join contacts c on c.id = t.contact_id
        where t.sector_id = ${sector.id} and c.phone = '${customer.phone}'
          and t.status = 'queued' order by t.id desc limit 1`,
    )
    return ticket
  })

  await t.step('Atendente assume B, vê o aviso de pendente e retoma A pela janela', async () => {
    await panelOf(agentPage)
      .getByRole('button', { name: `Assumir chamado de ${customer.name}` })
      .click()
    await expect(agentPage).toHaveURL(new RegExp(`/chamados/${second.id}$`))
    await expect(agentPage.getByRole('button', { name: 'Encerrar' })).toBeVisible()
    // O aviso fica na conversa do chamado novo e traz só a quantidade: o pendente é do contato.
    const notice = conversationOf(agentPage)
      .locator('[data-slot="alert"]')
      .filter({ hasText: 'Este contato tem' })
    await expect(notice).toHaveCount(1)
    await expect(notice).toContainText('Este contato tem 1 chamado pendente.')
    await t.shot(agentPage, 'aviso-do-pendente')

    await notice.getByRole('button', { name: 'Retomar chamado' }).click()
    const dialog = agentPage.getByRole('dialog', { name: 'Retomar chamado' })
    // A janela explica a mesclagem e lista o pendente, já escolhido, com protocolo e motivo.
    await expect(dialog).toContainText(
      'As mensagens deste chamado passam para o pendente escolhido, que volta para o seu atendimento. Este chamado fica registrado como Mesclado.',
    )
    await expect(dialog.getByRole('radio')).toHaveCount(1)
    await expect(dialog.getByRole('radio')).toBeChecked()
    await expect(dialog).toContainText(pending.protocol)
    await expect(dialog).toContainText(reason)
    await expect(dialog).toContainText(`por ${agent.name}`)
    await t.shot(agentPage, 'janela-retomar')
    await dialog.getByRole('button', { name: 'Retomar chamado' }).click()
    await expect(agentPage.getByText('Chamado retomado')).toBeVisible()
    await expect(agentPage).toHaveURL(new RegExp(`/chamados/${pending.id}$`))
  })

  await t.step('A abre com as mensagens dos dois na ordem do tempo e os avisos', async () => {
    const conversation = conversationOf(agentPage)
    // A volta ao atendimento, com o campo de mensagem de novo à mão.
    await expect(conversation.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
    await expect(agentPage.getByText('Pendente:')).toHaveCount(0)
    const firstMessage = conversation.getByText('Preciso da segunda via do contracheque de março')
    const secondMessage = conversation.getByText('Voltei com a nota fiscal')
    await expect(firstMessage).toBeVisible()
    await expect(secondMessage).toBeVisible()
    const firstAt = await firstMessage.boundingBox()
    const lastAt = await secondMessage.boundingBox()
    if (!firstAt || !lastAt) {
      throw new Error('As duas mensagens precisam estar visíveis para conferir a ordem do tempo.')
    }
    expect(firstAt.y).toBeLessThan(lastAt.y)

    // O histórico conta que A ficou pendente (com o motivo) e que voltou a partir de B.
    const entries = conversation.getByRole('listitem', { name: 'Registro do chamado' })
    const wasPending = entries.filter({ hasText: 'colocou o chamado como pendente' })
    await expect(wasPending).toBeVisible()
    await expect(wasPending).toContainText(`Motivo: ${reason}`)
    await expect(wasPending).toContainText(agent.name)
    const resumedFrom = entries.filter({
      hasText: `retomou este chamado a partir do ${second.protocol}`,
    })
    await expect(resumedFrom).toBeVisible()
    await expect(resumedFrom).toContainText(agent.name)
    await t.shot(agentPage, 'a-com-as-mensagens-dos-dois')
  })

  await t.step('B aparece em Atendimentos como Mesclado, com o link para A', async () => {
    const row = await atendimentosRowOf(agentPage, second.protocol)
    await expect(row).toContainText(customer.name)
    await expect(row).toContainText('Mesclado')
    await expect(row).not.toContainText('Encerrado')
    const link = row.getByRole('link', { name: `Ver chamado ${pending.protocol}` })
    await expect(link).toBeVisible()
    await t.shot(agentPage, 'b-mesclado-na-lista')
    // O link leva ao chamado original, que está ativo de novo: abre em Chamados.
    await link.click()
    await expect(agentPage).toHaveURL(new RegExp(`/chamados/${pending.id}$`))
    await expect(conversationOf(agentPage)).toContainText('Voltei com a nota fiscal')
    await t.shot(agentPage, 'link-para-o-original')
  })

  await t.step('Estado final no banco: A em atendimento com as mensagens dos dois, B mesclado nele', async () => {
    const [a] = t.sql(
      `select t.status, t.closure_type, u.name as assignee,
              (select count(*) from messages m where m.ticket_id = t.id) as messages
         from tickets t left join users u on u.id = t.assignee_id
        where t.id = ${pending.id}`,
    )
    expect(a).toMatchObject({
      status: 'in_progress',
      closure_type: null,
      assignee: agent.name,
      messages: 2,
    })
    t.observe('Chamado A retomado', a)

    const [b] = t.sql(
      `select status, closure_type, merged_into_ticket_id,
              (select count(*) from messages m where m.ticket_id = tickets.id) as messages
         from tickets where id = ${second.id}`,
    )
    expect(b).toEqual({
      status: 'closed',
      closure_type: 'merged',
      merged_into_ticket_id: pending.id,
      messages: 0,
    })
    t.observe('Chamado B mesclado', b)

    const audit = t.sql(
      `select ticket_id, action, changes from audit_logs
        where ticket_id in (${pending.id}, ${second.id}) order by id`,
    )
    // A auditoria pode ganhar registros novos ao lado destes. O que se prova é que os esperados
    // aparecem nesta ordem relativa, sem a checagem quebrar por uma ação a mais no meio.
    expectAuditOrder(audit, [
      `${pending.id} ticket_assigned`,
      `${pending.id} ticket_pending`,
      `${second.id} ticket_assigned`,
      `${second.id} ticket_merged`,
      `${pending.id} ticket_resumed_by_merge`,
    ])
    const resumed = audit.find((entry) => entry.action === 'ticket_resumed_by_merge')
    expect(resumed.changes.merged_protocol).toEqual({ from: null, to: second.protocol })
    const merged = audit.find((entry) => entry.action === 'ticket_merged')
    expect(merged.changes.merged_into_ticket_id).toEqual({ from: null, to: pending.id })
    t.observe('Auditoria do pendente e da mesclagem', audit)
  })
})
