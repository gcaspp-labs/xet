// Encerrar: ver features/close.md.
import { expect, journey } from '../scripts/journey-lib.mjs'

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

  const supervisorPage = await t.signIn(sector.supervisor)
  const supervisorDone = supervisorPage.getByRole('region', { name: 'Realizados hoje' })
  await expect(supervisorDone).toContainText('Nenhum atendimento realizado hoje.')

  const agentPage = await t.signIn(agent)

  const ticketId = await t.step('Atendente assume o chamado', async () => {
    await agentPage.getByRole('link', { name: paulo.name }).click()
    await agentPage.getByRole('button', { name: 'Assumir', exact: true }).click()
    await expect(agentPage.getByText('Chamado assumido')).toBeVisible()
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
    'Com tudo certo, encerra e volta ao painel com o atendimento nos realizados',
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
      await expect(agentPage.getByText('Chamado encerrado', { exact: true })).toBeVisible()
      await expect(agentPage.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
      const doneRow = agentPage
        .getByRole('region', { name: 'Realizados hoje' })
        .getByRole('row', { name: new RegExp(paulo.name) })
      await expect(doneRow).toContainText('Você')
      await expect(doneRow).toContainText('Encerrado')
      await t.shot(agentPage, 'painel-realizados')
    },
  )

  await t.step('Supervisor vê o atendimento nos realizados, sem recarregar', async () => {
    const row = supervisorDone.getByRole('row', { name: new RegExp(paulo.name) })
    await expect(row).toContainText(agent.name)
    await expect(row).not.toContainText('Você')
    await t.shot(supervisorPage, 'supervisor-realizados')
  })
  await t.closeSession(supervisorPage)

  await t.step('Chamado encerrado mostra o registro e não aceita resposta', async () => {
    await agentPage.goto(`/chamados/${ticketId}`)
    const conversation = agentPage.getByRole('region', { name: 'Conversa', exact: true })
    await expect(conversation).toContainText('Chamado encerrado.')
    await expect(
      conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
        hasText: `${agent.name} encerrou o chamado`,
      }),
    ).toBeVisible()
    await expect(agentPage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    await expect(agentPage.getByRole('button', { name: 'Encerrar' })).toHaveCount(0)
    const details = agentPage.getByRole('region', { name: 'Chamado' })
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
      await agentPage.getByRole('link', { name: 'Atendimento' }).click()
      const queue = agentPage.getByRole('region', { name: 'Fila do setor' })
      await expect(queue.getByRole('link', { name: paulo.name })).toHaveCount(1)
      await expect(queue).toContainText('Agora é sobre férias')
      await t.shot(agentPage, 'novo-chamado-na-fila')
      const rows = t.sql(
        `select t.id, t.status from tickets t join contacts c on c.id = t.contact_id
        where c.phone = '${paulo.phone}' order by t.id`,
      )
      expect(rows.map((row) => row.status)).toEqual(['closed', 'queued'])
      return rows[1].id
    },
  )

  await t.step('Cancelamento direto da fila exige motivo e dispensa o cadastro', async () => {
    const golpe = t.customer('Paula Golpe')
    await phone.receive(golpe, 'Seu boleto venceu')
    await agentPage.getByRole('link', { name: golpe.name }).click()
    await agentPage.getByRole('button', { name: 'Cancelar chamado' }).click()
    const cancel = agentPage.getByRole('dialog', { name: 'Cancelar chamado' })
    await cancel.getByRole('button', { name: 'Cancelar chamado' }).click()
    await expect(cancel).toContainText('Informe o motivo do cancelamento.')
    await cancel.getByLabel('Motivo').fill('Golpe do falso boleto.')
    await t.shot(agentPage, 'cancelamento')
    await cancel.getByRole('button', { name: 'Cancelar chamado' }).click()
    await expect(agentPage.getByText('Chamado cancelado', { exact: true })).toBeVisible()
    const row = agentPage
      .getByRole('region', { name: 'Realizados hoje' })
      .getByRole('row', { name: new RegExp(golpe.name) })
    await expect(row).toContainText('Cancelado')
    await t.shot(agentPage, 'cancelado-nos-realizados')
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
      reason: 'Golpe do falso boleto.',
      contact_registered: false,
    })
    t.observe('Chamado cancelado', cancelled)
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
