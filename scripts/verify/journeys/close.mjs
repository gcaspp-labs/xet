// Encerrar: ver features/close.md.
import { conversationOf, expect, journey, panelOf, queueRowOf } from '../scripts/journey-lib.mjs'

await journey('close', async (t) => {
  const { sector, organization, paulo } = await t.step(
    'Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido',
    async () => {
      const seeded = await t.seedSector({ agents: 1, modules: ['Folha', 'Patrimônio'] })
      const org = await t.seedOrganization()
      const customer = t.customer('Paulo Cliente')
      await t.phone(seeded.id).receive(customer, 'Preciso do contracheque')
      return { sector: seeded, organization: org, paulo: customer }
    },
  )
  const agent = sector.agents[0]
  const phone = t.phone(sector.id)

  // Os chamados encerrados ficam no histórico da tela Atendimentos; a fila, na tela Chamados.
  const history = (page) => page.getByRole('table').getByRole('row')
  // As ações menos usadas ficam no menu "Mais ações".
  const chooseAction = async (page, name) => {
    await page.getByRole('button', { name: 'Mais ações' }).click()
    await page.getByRole('menuitem', { name, exact: true }).click()
  }

  const supervisorPage = await t.signIn(sector.supervisor)
  await supervisorPage.getByRole('link', { name: 'Atendimentos', exact: true }).click()
  await expect(supervisorPage.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
  await expect(supervisorPage.getByText('Nenhum chamado encontrado.')).toBeVisible()

  const agentPage = await t.signIn(agent)

  const ticketId = await t.step('Atendente assume o chamado', async () => {
    await panelOf(agentPage)
      .getByRole('button', { name: `Assumir chamado de ${paulo.name}` })
      .click()
    await expect(agentPage).toHaveURL(/\/chamados\/\d+$/)
    await expect(conversationOf(agentPage)).toContainText(`${agent.name} assumiu o chamado`)
    return Number(agentPage.url().split('/').pop())
  })

  const sheet = agentPage.getByRole('dialog', { name: 'Encerrar chamado' })

  await t.step('Formulário vazio não encerra e diz o que falta', async () => {
    await agentPage.getByRole('button', { name: 'Encerrar' }).click()
    await expect(sheet).toContainText('Contato não cadastrado')
    await sheet.getByRole('button', { name: 'Encerrar' }).click()
    await expect(sheet).toContainText('Informe o assunto.')
    await expect(sheet).toContainText('Informe a resolução.')
    await expect(sheet).toContainText('Selecione ao menos um módulo.')
    await expect(sheet).toContainText('Selecione o órgão do atendimento.')
    await t.shot(agentPage, 'formulario-incompleto')
  })

  await t.step('Com o contato sem cadastro, o backend recusa o encerramento', async () => {
    await sheet.getByLabel('Assunto').fill('Contracheque')
    await sheet.getByLabel('Resolução').fill('Enviada a segunda via.')
    await sheet.getByRole('checkbox', { name: 'Folha' }).click()
    await sheet.getByRole('checkbox', { name: 'Patrimônio' }).click()
    await sheet.getByLabel('Órgão').fill(organization.name)
    await agentPage.getByRole('option', { name: organization.name }).click()
    await sheet.getByRole('button', { name: 'Encerrar' }).click()
    await sheet.getByRole('button', { name: 'Não adicionar' }).click()
    await expect(sheet).toContainText(
      'Cadastre o contato e vincule-o a um órgão antes de encerrar.',
    )
    await t.shot(agentPage, 'contato-sem-cadastro')
    const [ticket] = t.sql(`select status from tickets where id = ${ticketId}`)
    expect(ticket.status).toBe('in_progress')
  })

  await t.step('Atendente cadastra o contato pelo próprio formulário', async () => {
    await sheet.getByRole('button', { name: 'Cadastrar contato' }).click()
    const contactSheet = agentPage.getByRole('dialog', { name: 'Editar contato' })
    await contactSheet.getByLabel('Órgão').fill(organization.name)
    await agentPage.getByRole('option', { name: organization.name }).click()
    await contactSheet.getByRole('button', { name: 'Salvar' }).click()
    await expect(agentPage.getByText('Contato salvo')).toBeVisible()
    await expect(sheet).not.toContainText('Contato não cadastrado')
  })

  await t.step('Fim antes do início é recusado', async () => {
    await sheet.getByLabel('Fim').fill('2000-01-01T10:00')
    await sheet.getByRole('button', { name: 'Encerrar' }).click()
    await expect(sheet).toContainText('O fim precisa ser depois do início.')
  })

  await t.step(
    'Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico',
    async () => {
      // Horários de início e fim passados, no fuso da tela.
      const local = (minutesAgo) => {
        const date = new Date(Date.now() - minutesAgo * 60_000 - 3 * 3_600_000)
        return date.toISOString().slice(0, 16)
      }
      await sheet.getByLabel('Início').fill(local(120))
      await sheet.getByLabel('Fim').fill(local(60))
      await t.shot(agentPage, 'formulario-completo')
      await sheet.getByRole('button', { name: 'Encerrar' }).click()
      await sheet.getByRole('button', { name: 'Não adicionar' }).click()
      await expect(agentPage.getByText('Chamado encerrado', { exact: true })).toBeVisible()
      await expect(agentPage).toHaveURL(/\/chamados$/)
      await expect(conversationOf(agentPage)).toHaveCount(0)
      await agentPage.getByRole('link', { name: 'Atendimentos', exact: true }).click()
      await expect(agentPage.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
      const doneRow = history(agentPage).filter({ hasText: paulo.name })
      await expect(doneRow).toContainText(agent.name)
      await expect(doneRow).toContainText('Encerrado')
      await expect(doneRow).toContainText('Contracheque')
      await t.shot(agentPage, 'historico-encerrados')
    },
  )

  await t.step('Supervisor vê o atendimento no histórico, sem recarregar', async () => {
    const row = history(supervisorPage).filter({ hasText: paulo.name })
    await expect(row).toContainText(agent.name)
    await expect(row).toContainText('Encerrado')
    await t.shot(supervisorPage, 'supervisor-historico')
  })
  await t.closeSession(supervisorPage)

  await t.step('Chamado encerrado abre a ficha só leitura e não aceita resposta', async () => {
    // O endereço da tela Chamados leva o chamado encerrado à ficha em Atendimentos.
    await agentPage.goto(`/chamados/${ticketId}`)
    await expect(agentPage).toHaveURL(new RegExp(`/atendimentos/${ticketId}$`))
    await expect(agentPage.getByRole('status', { name: 'Só leitura' })).toContainText(
      'Encerrado em',
    )
    const conversation = conversationOf(agentPage)
    // Na ficha, o aviso "Chamado encerrado." virou "Só leitura. Encerrado em ... por ...".
    await expect(conversation).toContainText('Só leitura. Encerrado em')
    await expect(
      conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
        hasText: `${agent.name} encerrou o chamado`,
      }),
    ).toBeVisible()
    await expect(agentPage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    await expect(agentPage.getByRole('button', { name: 'Encerrar' })).toHaveCount(0)
    const details = agentPage.getByRole('region', { name: 'Atendimento', exact: true })
    await expect(details).toContainText('Contracheque')
    await expect(details).toContainText('Enviada a segunda via.')
    await expect(details).toContainText('Folha')
    await expect(details).toContainText('Patrimônio')
    await expect(details).toContainText(`${organization.name} — ${organization.municipality}`)
    await t.shot(agentPage, 'chamado-encerrado')
  })

  const nextTicket = await t.step(
    'Nova mensagem do cliente abre outro chamado, sem reabrir',
    async () => {
      await phone.receive(paulo, 'Agora é sobre férias')
      await agentPage.getByRole('link', { name: 'Chamados', exact: true }).click()
      await expect(queueRowOf(agentPage, paulo)).toHaveCount(1)
      await expect(panelOf(agentPage)).toContainText('Agora é sobre férias')
      await t.shot(agentPage, 'novo-chamado-na-fila')
      const rows = t.sql(
        `select t.id, t.status from tickets t join contacts c on c.id = t.contact_id
        where c.phone = '${paulo.phone}' order by t.id`,
      )
      expect(rows.map((row) => row.status)).toEqual(['closed', 'queued'])
      return rows[1].id
    },
  )

  await t.step(
    'Cancelar pelo X da fila, com a confirmação no item e sem motivo, dispensa o cadastro',
    async () => {
      const golpe = t.customer('Paula Golpe')
      await phone.receive(golpe, 'Seu boleto venceu')
      await agentPage.getByRole('link', { name: 'Chamados', exact: true }).click()
      const queue = panelOf(agentPage)
      const x = queue.getByRole('button', { name: `Cancelar chamado de ${golpe.name}` })
      // O X não cancela no primeiro clique: o próprio item pede confirmação, com o Voltar em foco.
      await x.click()
      await expect(queue).toContainText(`Cancelar o chamado de ${golpe.name}? Ele não é reaberto.`)
      await expect(queue.getByRole('button', { name: 'Voltar' })).toBeFocused()
      await t.shot(agentPage, 'cancelamento-confirmar')
      await expect(agentPage.getByRole('dialog', { name: 'Cancelar chamado' })).toHaveCount(0)
      await queue.getByRole('button', { name: 'Cancelar chamado', exact: true }).click()
      await expect(agentPage.getByText('Chamado cancelado', { exact: true })).toBeVisible()
      await expect(queue.getByText(golpe.name)).toHaveCount(0)
      await agentPage.getByRole('link', { name: 'Atendimentos', exact: true }).click()
      const row = history(agentPage).filter({ hasText: golpe.name })
      await expect(row).toContainText('Cancelado')
      await t.shot(agentPage, 'cancelado-no-historico')
      // O registro na conversa mostra quem cancelou e quando, sem a linha "Motivo:".
      await row.getByRole('cell', { name: 'Cancelado' }).click({ force: true })
      const conversation = conversationOf(agentPage)
      const entry = conversation
        .getByRole('listitem', { name: 'Registro do chamado' })
        .filter({ hasText: `${agent.name} cancelou o chamado` })
      await expect(entry).toBeVisible()
      await expect(entry).not.toContainText('Motivo:')
      await t.shot(agentPage, 'cancelado-sem-motivo')
      const [cancelled] = t.sql(
        `select t.status, t.closure_type, a.action, a.reason, c.registered as contact_registered
           from tickets t join contacts c on c.id = t.contact_id
           join audit_logs a on a.ticket_id = t.id and a.action = 'ticket_cancelled'
          where c.phone = '${golpe.phone}'`,
      )
      expect(cancelled).toEqual({
        status: 'closed',
        closure_type: 'cancelled',
        action: 'ticket_cancelled',
        reason: null,
        contact_registered: false,
      })
      t.observe('Chamado cancelado pelo X, sem motivo', cancelled)
    },
  )

  await t.step('A janela de cancelamento salva com o motivo opcional', async () => {
    const engano = t.customer('Rita Engano')
    await phone.receive(engano, 'Era engano meu')
    // Um chamado da fila só abre pelo endereço, sem assumir.
    const [queued] = t.sql(
      `select t.id from tickets t join contacts c on c.id = t.contact_id
        where c.phone = '${engano.phone}' and t.status = 'queued'`,
    )
    await agentPage.goto(`/chamados/${queued.id}`)
    await expect(agentPage.getByRole('heading', { name: engano.name })).toBeVisible()
    await chooseAction(agentPage, 'Cancelar chamado')
    const cancel = agentPage.getByRole('dialog', { name: 'Cancelar chamado' })
    await expect(cancel.getByLabel('Motivo (opcional)')).toHaveValue('')
    await expect(cancel).toContainText('Sem o motivo, a conversa mostra só quem cancelou e quando.')
    await t.shot(agentPage, 'cancelamento-motivo-opcional')
    await cancel.getByRole('button', { name: 'Cancelar chamado' }).click()
    await expect(agentPage.getByText('Chamado cancelado', { exact: true })).toBeVisible()
    await expect(agentPage).toHaveURL(/\/chamados$/)
    const [cancelled] = t.sql(
      `select t.status, t.closure_type, a.action, a.reason
         from tickets t join contacts c on c.id = t.contact_id
         join audit_logs a on a.ticket_id = t.id and a.action = 'ticket_cancelled'
        where c.phone = '${engano.phone}'`,
    )
    expect(cancelled).toEqual({
      status: 'closed',
      closure_type: 'cancelled',
      action: 'ticket_cancelled',
      reason: null,
    })
    t.observe('Chamado cancelado pela janela, sem motivo', cancelled)
  })

  await t.step('Estado final do encerramento no banco', async () => {
    const [ticket] = t.sql(
      `select t.status, t.closure_type, t.subject, t.resolution, o.name as organization, closer.name as closed_by,
              t.closed_at is not null as has_closed_at, t.ended_at >= t.started_at as end_after_start,
              (select string_agg(m.name, ', ' order by m.name) from ticket_modules tm
                 join modules m on m.id = tm.module_id where tm.ticket_id = t.id) as modules
         from tickets t join organizations o on o.id = t.organization_id
         join users closer on closer.id = t.closed_by_id where t.id = ${ticketId}`,
    )
    expect(ticket).toEqual({
      status: 'closed',
      closure_type: 'resolved',
      subject: 'Contracheque',
      resolution: 'Enviada a segunda via.',
      organization: organization.name,
      closed_by: agent.name,
      has_closed_at: true,
      end_after_start: true,
      modules: 'Folha, Patrimônio',
    })
    t.observe('Chamado encerrado', ticket)
    const audit = t.sql(
      `select a.action, u.name as actor from audit_logs a left join users u on u.id = a.actor_id
        where a.ticket_id = ${ticketId} order by a.id`,
    )
    expect(audit.map((entry) => entry.action)).toContain('ticket_closed')
    t.observe('Auditoria do encerramento', audit)
    t.observe('Chamado novo depois do encerramento', { id: nextTicket, status: 'queued' })
  })
})
