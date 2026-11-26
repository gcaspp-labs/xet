// Receber e assumir: ver features/receive-and-assign.md.
import {
  conversationOf,
  expect,
  journey,
  mineOf,
  panelOf,
  queueRowOf,
} from '../scripts/journey-lib.mjs'

await journey('receive-and-assign', async (t) => {
  const sector = await t.step('Preparar setor conectado, dois atendentes e um supervisor', () =>
    t.seedSector({ agents: 2 }),
  )
  const [agent, colleague] = sector.agents
  const phone = t.phone(sector.id)
  const maria = t.customer('Maria Cliente')

  const agentPage = await t.signIn(agent)
  // A fila é a aba Fila do cartão "Fila, assuntos e pendentes" da tela Chamados; cada chamado é um item da lista.
  const queue = panelOf(agentPage)
  const mariaRow = queueRowOf(agentPage, maria)
  const mine = mineOf(agentPage)

  await t.step('Atendente entra na tela Chamados e vê a fila vazia', async () => {
    await expect(agentPage).toHaveURL(/\/chamados$/)
    await expect(agentPage.getByRole('heading', { name: 'Chamados' })).toBeVisible()
    await expect(agentPage.getByText('Sem atendimentos disponíveis')).toBeVisible()
    await expect(queue.getByText('Nenhum chamado esperando.')).toBeVisible()
    await t.shot(agentPage, 'fila-vazia')
  })

  const firstMessage = await t.step(
    'Mensagem de número desconhecido entra na fila sem recarregar',
    async () => {
      const id = await phone.receive(maria, 'Bom dia, preciso do balancete')
      await expect(mariaRow).toContainText('Bom dia, preciso do balancete')
      await expect(mariaRow).toContainText(/\d{4}-\d{6}/)
      await t.shot(agentPage, 'mensagem-na-fila')
      return id
    },
  )

  const contactFilter = `c.phone = '${maria.phone}'`
  const countMessages = () =>
    Number(
      t.sql(
        `select count(*) as n from messages m join contacts c on c.id = m.contact_id where ${contactFilter}`,
      )[0].n,
    )

  await t.step('Reentrega da mesma mensagem não gera efeito', async () => {
    await phone.receive(maria, 'Bom dia, preciso do balancete', firstMessage)
    expect(countMessages()).toBe(1)
    await expect(mariaRow).toHaveCount(1)
  })

  await t.step('Segunda mensagem entra no mesmo chamado, sem abrir outro', async () => {
    await phone.receive(maria, 'É o de outubro')
    await expect(mariaRow).toContainText('É o de outubro')
    await expect(mariaRow).toHaveCount(1)
    expect(countMessages()).toBe(2)
    await t.shot(agentPage, 'mesmo-chamado')
  })

  // A colega entra agora e fica sem tempo real: a tela dela continua mostrando o chamado na fila.
  const stalePage = await t.signIn(colleague, { blockRealtime: true })
  const staleQueue = panelOf(stalePage)
  const staleAssign = staleQueue.getByRole('button', { name: `Assumir chamado de ${maria.name}` })
  await expect(staleAssign).toBeVisible()

  const ticketId = await t.step('Atendente assume pela fila e cai no chamado', async () => {
    await queue.getByRole('button', { name: `Assumir chamado de ${maria.name}` }).click()
    await expect(agentPage).toHaveURL(/\/chamados\/\d+$/)
    await expect(agentPage.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
    const conversation = conversationOf(agentPage)
    // O contato é de número desconhecido: a conversa avisa que falta o cadastro.
    await expect(conversation).toContainText('Contato não cadastrado')
    await expect(conversation).toContainText(`${agent.name} assumiu o chamado`)
    await expect(conversation).toContainText('Bom dia, preciso do balancete')
    await expect(conversation).toContainText('É o de outubro')
    await t.shot(agentPage, 'conversa-assumida')
    return Number(agentPage.url().split('/').pop())
  })

  await t.step('Colega com a tela desatualizada perde a disputa e é avisada', async () => {
    await staleAssign.click()
    await expect(
      stalePage.getByRole('alert').filter({
        hasText: 'Este chamado já foi assumido por outro atendente.',
      }),
    ).toBeVisible()
    await expect(stalePage).not.toHaveURL(/\/chamados\/\d/)
    await t.shot(stalePage, 'disputa-perdida')
  })

  await t.step('Duas pessoas assumindo ao mesmo tempo: só uma consegue', async () => {
    const joao = t.customer('João Disputado')
    await phone.receive(joao, 'Quem me atende?')
    const [ticket] = t.sql(
      `select t.id from tickets t join contacts c on c.id = t.contact_id where c.phone = '${joao.phone}'`,
    )
    const results = await Promise.all(
      [agentPage, stalePage].map((page) => page.request.post(`/api/tickets/${ticket.id}/assign`)),
    )
    expect(results.map((result) => result.status()).sort()).toEqual([200, 409])
    const [audit] = t.sql(
      `select count(*) as n from audit_logs where ticket_id = ${ticket.id} and action = 'ticket_assigned'`,
    )
    expect(Number(audit.n)).toBe(1)
    t.observe('Disputa simultânea: respostas HTTP e auditoria', {
      respostas: results.map((result) => result.status()).sort(),
      registrosDeAuditoria: Number(audit.n),
    })
  })

  await t.step('Em Meus chamados o chamado está com o responsável, fora da fila', async () => {
    await agentPage.getByRole('link', { name: 'Chamados', exact: true }).click()
    await expect(agentPage).toHaveURL(/\/chamados$/)
    await expect(mine.getByRole('link', { name: maria.name })).toBeVisible()
    await expect(mariaRow).toHaveCount(0)
    await expect(queue.getByText('Nenhum chamado esperando.')).toBeVisible()
    await t.shot(agentPage, 'meus-chamados')
  })

  await t.step('Atendente assume outro chamado pela fila, sem chamado aberto', async () => {
    const cliente = t.customer('Pessoa da fila')
    await phone.receive(cliente, 'Preciso de atendimento')
    await queue.getByRole('button', { name: `Assumir chamado de ${cliente.name}` }).click()
    await expect(agentPage).toHaveURL(/\/chamados\/\d+$/)
    await expect(conversationOf(agentPage)).toContainText('Preciso de atendimento')
    await expect(mine.getByRole('link', { name: cliente.name })).toBeVisible()
    await t.shot(agentPage, 'assumido-pela-fila')
  })

  await t.step('Outro setor não vê a fila nem abre o chamado', async () => {
    const other = await t.seedSector({ connected: false })
    const otherPage = await t.signIn(other.agents[0])
    await expect(otherPage.getByRole('heading', { name: 'Chamados' })).toBeVisible()
    await expect(panelOf(otherPage).getByText('Nenhum chamado esperando.')).toBeVisible()
    await expect(otherPage.getByText(maria.name)).toHaveCount(0)
    const response = await otherPage.request.get(`/api/tickets/${ticketId}`)
    expect(response.status()).toBe(403)
    await t.shot(otherPage, 'outro-setor-nao-ve')
    t.observe('Outro setor pedindo o chamado pela API', { http: response.status() })
    await t.closeSession(otherPage)
  })

  await t.step('Estado final no banco', async () => {
    const [ticket] = t.sql(
      `select t.protocol, t.status, u.name as assignee, t.assigned_at is not null as has_assigned_at
         from tickets t join users u on u.id = t.assignee_id where t.id = ${ticketId}`,
    )
    expect(ticket).toMatchObject({
      status: 'in_progress',
      assignee: agent.name,
      has_assigned_at: true,
    })
    t.observe('Chamado', ticket)

    const open = t.sql(
      `select t.id from tickets t join contacts c on c.id = t.contact_id
        where ${contactFilter} and t.status <> 'closed'`,
    )
    expect(open).toHaveLength(1)
    expect(countMessages()).toBe(2)
    const audit = t.sql(
      `select a.action, u.name as actor from audit_logs a left join users u on u.id = a.actor_id
        where a.ticket_id = ${ticketId} order by a.id`,
    )
    expect(audit).toEqual([{ action: 'ticket_assigned', actor: agent.name }])
    t.observe('Auditoria do chamado', audit)
    t.observe('Mensagens e chamados abertos do contato', {
      mensagens: countMessages(),
      chamadosAbertos: open.length,
    })
  })
})
