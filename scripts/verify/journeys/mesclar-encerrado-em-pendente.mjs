// Mesclar um atendimento encerrado num chamado pendente: ver features/mesclar-encerrado-em-pendente.md.
import {
  atendimentosRowOf,
  conversationOf,
  expect,
  expectAuditOrder,
  journey,
  panelOf,
  queueRowOf,
} from '../scripts/journey-lib.mjs'

await journey('mesclar-encerrado-em-pendente', async (t) => {
  const reason = 'Aguardando o órgão confirmar o número antigo do protocolo'
  const subject = 'Comprovante de férias'
  const resolution = 'Comprovante enviado por e-mail, a pedido da servidora.'

  const { sector, customer, organization } = await t.step(
    'Preparar setor com módulo e órgão, com o contato cadastrado e a primeira mensagem',
    async () => {
      const seeded = await t.seedSector({ agents: 1, modules: ['Folha'] })
      const org = await t.seedOrganization()
      const contact = t.customer('Marina Cliente')
      const orgId = Number(t.sql(`select id from organizations where name = '${org.name}'`)[0].id)
      // O encerramento exige o contato cadastrado num órgão; o cadastro é preparação, não o que se prova.
      await t.apiOk(
        t.admin.post('/api/contacts', {
          data: {
            name: contact.name,
            phone: contact.phone,
            organizationId: orgId,
            sectorIds: [seeded.id],
          },
        }),
        `cadastrar ${contact.name}`,
      )
      await t.phone(seeded.id).receive(contact, 'Preciso da segunda via do contracheque de março')
      return { sector: seeded, customer: contact, organization: org }
    },
  )
  const agent = sector.agents[0]

  const page = await t.signIn(agent)

  const pending = await t.step(
    'Atendente assume o chamado A e o coloca como pendente, com motivo',
    async () => {
      await panelOf(page)
        .getByRole('button', { name: `Assumir chamado de ${customer.name}` })
        .click()
      await expect(page).toHaveURL(/\/chamados\/\d+$/)
      const ticketId = Number(page.url().split('/').pop())
      const [ticket] = t.sql(`select id, protocol from tickets where id = ${ticketId}`)
      await page.getByRole('button', { name: 'Mais ações' }).click()
      await page.getByRole('menuitem', { name: 'Colocar como pendente', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Colocar como pendente' })
      await dialog.getByLabel('Motivo').fill(reason)
      await dialog.getByRole('button', { name: 'Colocar como pendente' }).click()
      await expect(page.getByText('Chamado marcado como pendente')).toBeVisible()
      // A tela volta para a lista e o chamado sai da Fila: ele está na aba Pendentes.
      await expect(page).toHaveURL(/\/chamados$/)
      await expect(queueRowOf(page, customer)).toHaveCount(0)
      await t.shot(page, 'a-pendente')
      return ticket
    },
  )

  const second = await t.step('Cliente volta a escrever e o chamado B entra na Fila', async () => {
    await panelOf(page)
      .getByRole('tab', { name: /^Fila/ })
      .click()
    await t.phone(sector.id).receive(customer, 'Voltei com o comprovante errado')
    await expect(queueRowOf(page, customer)).toContainText('Voltei com o comprovante errado')
    await t.shot(page, 'b-na-fila')
    // O id de B sai do banco: a entrega da mensagem devolve o id da mensagem, não do chamado.
    const [ticket] = t.sql(
      `select t.id, t.protocol from tickets t
         join contacts c on c.id = t.contact_id
        where t.sector_id = ${sector.id} and c.phone = '${customer.phone}'
          and t.status = 'queued' order by t.id desc limit 1`,
    )
    return ticket
  })

  await t.step('Atendente assume B e encerra o atendimento com assunto e resolução', async () => {
    await panelOf(page)
      .getByRole('button', { name: `Assumir chamado de ${customer.name}` })
      .click()
    await expect(page).toHaveURL(new RegExp(`/chamados/${second.id}$`))
    await page.getByRole('button', { name: 'Encerrar' }).click()
    const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
    await sheet.getByLabel('Assunto').fill(subject)
    await sheet.getByLabel('Resolução').fill(resolution)
    await sheet.getByRole('checkbox', { name: 'Folha' }).click()
    await sheet.getByLabel('Órgão').fill(organization.name)
    await page.getByRole('option', { name: organization.name }).click()
    await t.shot(page, 'b-formulario-de-encerramento')
    await sheet.getByRole('button', { name: 'Encerrar' }).click()
    // O assunto é novo no setor: a janela pergunta se entra na lista, e não entra.
    await sheet.getByRole('button', { name: 'Não adicionar' }).click()
    await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/chamados$/)
  })

  await t.step('Em Atendimentos, abre o encerrado e usa Mesclar em pendente com A escolhido', async () => {
    const row = await atendimentosRowOf(page, second.protocol)
    await expect(row).toContainText('Encerrado')
    await expect(row).not.toContainText('Mesclado')
    // A linha inteira abre a ficha; o link do protocolo é o alvo de verdade.
    await row.getByRole('link', { name: second.protocol }).click()
    await expect(page).toHaveURL(new RegExp(`/atendimentos/${second.id}$`))
    const details = page.getByRole('region', { name: 'Atendimento', exact: true })
    await expect(details).toContainText('Encerrado')
    await expect(details).toContainText(subject)
    // A ação vem ao lado do Corrigir, como secundária (protótipo versão A).
    await expect(page.getByRole('button', { name: 'Corrigir', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Mesclar em pendente' }).click()
    const dialog = page.getByRole('dialog', { name: 'Mesclar em pendente' })
    await expect(dialog).toContainText(
      'As mensagens deste atendimento passam para o pendente escolhido, que fica com a situação e os dados deste encerramento. Este atendimento fica registrado como Mesclado.',
    )
    // A janela lista o pendente do contato, já escolhido, com protocolo, motivo e quem marcou.
    await expect(dialog.getByRole('radio')).toHaveCount(1)
    await expect(dialog.getByRole('radio')).toBeChecked()
    await expect(dialog).toContainText(pending.protocol)
    await expect(dialog).toContainText(reason)
    await expect(dialog).toContainText(`por ${agent.name}`)
    await t.shot(page, 'janela-mesclar-em-pendente')
    await dialog.getByRole('button', { name: 'Mesclar em pendente' }).click()
    await expect(page.getByText('Atendimento mesclado')).toBeVisible()
    // O pendente abre no lugar do encerrado.
    await expect(page).toHaveURL(new RegExp(`/atendimentos/${pending.id}$`))
  })

  await t.step(
    'A abre como Encerrado, com os dados de B, as mensagens dos dois na ordem e o aviso',
    async () => {
      const details = page.getByRole('region', { name: 'Atendimento', exact: true })
      await expect(details).toContainText('Encerrado')
      await expect(details).toContainText(subject)
      await expect(details).toContainText(resolution)
      await expect(details).toContainText(agent.name)
      await expect(page.getByRole('status', { name: 'Só leitura' })).toContainText('Encerrado em')

      const conversation = conversationOf(page)
      const firstMessage = conversation.getByText('Preciso da segunda via do contracheque de março')
      const secondMessage = conversation.getByText('Voltei com o comprovante errado')
      await expect(firstMessage).toBeVisible()
      await expect(secondMessage).toBeVisible()
      const firstAt = await firstMessage.boundingBox()
      const lastAt = await secondMessage.boundingBox()
      if (!firstAt || !lastAt) {
        throw new Error('As duas mensagens precisam estar visíveis para conferir a ordem do tempo.')
      }
      expect(firstAt.y).toBeLessThan(lastAt.y)

      // O aviso da mesclagem nomeia o protocolo de B e não traz motivo: B foi encerrado, não cancelado.
      const notice = conversation
        .getByRole('listitem', { name: 'Registro do chamado' })
        .filter({ hasText: `mesclou o atendimento ${second.protocol} neste chamado` })
      await expect(notice).toBeVisible()
      await expect(notice).toContainText(agent.name)
      await expect(notice).not.toContainText('Motivo:')
      const noticeAt = await notice.boundingBox()
      if (!noticeAt) {
        throw new Error('O aviso da mesclagem precisa estar visível para conferir a posição.')
      }
      expect(noticeAt.y).toBeGreaterThan(lastAt.y)
      await t.shot(page, 'a-encerrado-com-as-mensagens-dos-dois')
    },
  )

  await t.step('B aparece em Atendimentos como Mesclado, com o link para A', async () => {
    const row = await atendimentosRowOf(page, second.protocol)
    await expect(row).toContainText(customer.name)
    await expect(row).toContainText('Mesclado')
    await expect(row).not.toContainText('Encerrado')
    const link = row.getByRole('link', { name: `Ver chamado ${pending.protocol}` })
    await expect(link).toBeVisible()
    await t.shot(page, 'b-mesclado-com-link-para-a')
    // A está encerrado: o link abre a ficha dele em Atendimentos, com o assunto herdado.
    await link.click()
    await expect(page).toHaveURL(new RegExp(`/atendimentos/${pending.id}$`))
    const details = page.getByRole('region', { name: 'Atendimento', exact: true })
    await expect(details).toContainText('Encerrado')
    await expect(details).toContainText(subject)
  })

  await t.step('A não está mais na aba Pendentes', async () => {
    await page.getByRole('link', { name: 'Chamados', exact: true }).click()
    await panelOf(page)
      .getByRole('tab', { name: /^Pendentes/ })
      .click()
    await expect(panelOf(page)).toContainText('Nenhum chamado pendente')
    await expect(queueRowOf(page, customer)).toHaveCount(0)
    await expect(panelOf(page)).not.toContainText(pending.protocol)
    await t.shot(page, 'pendentes-vazio')
  })

  await t.step('Estado final no banco: A encerrado com os dados de B, B mesclado em A', async () => {
    const [a] = t.sql(
      `select t.status, t.closure_type, t.subject, t.resolution, o.name as organization,
              closer.name as closed_by, t.merged_into_ticket_id,
              (select count(*) from messages m where m.ticket_id = t.id) as messages
         from tickets t join organizations o on o.id = t.organization_id
         join users closer on closer.id = t.closed_by_id
        where t.id = ${pending.id}`,
    )
    expect(a).toEqual({
      status: 'closed',
      closure_type: 'resolved',
      subject,
      resolution,
      organization: organization.name,
      closed_by: agent.name,
      merged_into_ticket_id: null,
      messages: 2,
    })
    t.observe('Chamado A encerrado com os dados de B', a)

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
      `select ticket_id, action, changes, reason from audit_logs
        where ticket_id in (${pending.id}, ${second.id}) order by id`,
    )
    // A auditoria pode ganhar registros novos ao lado destes. O que se prova é que os esperados
    // aparecem nesta ordem relativa, sem a checagem quebrar por uma ação a mais no meio.
    expectAuditOrder(audit, [
      `${pending.id} ticket_assigned`,
      `${pending.id} ticket_pending`,
      `${second.id} ticket_assigned`,
      `${second.id} ticket_closed`,
      `${second.id} ticket_merged`,
      `${pending.id} ticket_closed_by_merge`,
    ])
    const closedByMerge = audit.find((entry) => entry.action === 'ticket_closed_by_merge')
    expect(closedByMerge.changes.merged_protocol).toEqual({ from: null, to: second.protocol })
    // B era encerrado: o registro de A não tem motivo de cancelamento.
    expect(closedByMerge.reason).toBeNull()
    const merged = audit.find((entry) => entry.action === 'ticket_merged')
    expect(merged.changes.merged_into_ticket_id).toEqual({ from: null, to: pending.id })
    t.observe('Auditoria do pendente, do encerramento e da mesclagem', audit)
  })
})
