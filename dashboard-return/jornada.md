# Código da jornada dashboard-return

```js
const { expect, journey } = await import(process.env.VERIFY_APP_LIB)
await journey('dashboard-return', async (t) => {
  const sector = await t.step('Preparar setor e chamado recebido', async () => {
    const sector = await t.seedSector({ agents: 2 })
    await t.phone(sector.id).receive(t.customer('Revisão retorno'), 'Preciso de atendimento')
    return sector
  })
  const first = await t.signIn(sector.agents[0])
  const second = await t.signIn(sector.agents[1])
  const supervisor = await t.signIn(sector.supervisor)
  const [ticket] = t.sql(`select id from tickets where sector_id = ${sector.id}`)
  const read = async () => {
    const response = await supervisor.goto('/api/dashboard')
    expect(response.status()).toBe(200)
    return response.json()
  }
  let initial, assigned
  await t.step('API mostra a primeira atribuição e a espera calculada', async () => {
    await t.apiOk(first.context().request.post(`/api/tickets/${ticket.id}/assign`), 'assumir inicialmente')
    initial = await read()
    expect(initial.numbers.inProgress.value).toBe(1)
    expect(initial.assignees.map(r => r.user.id)).toEqual([sector.agents[0].id])
    const [row] = t.sql(`select assigned_at, round(greatest(extract(epoch from assigned_at - arrived_at), 0))::int as wait from tickets where id = ${ticket.id}`)
    assigned = row.assigned_at
    expect(initial.numbers.averageWaitSeconds.value).toBe(row.wait)
    t.observe('Primeira espera', row)
  })
  await t.step('Devolução muda os números atuais e preserva a espera inicial', async () => {
    await t.apiOk(first.context().request.post(`/api/tickets/${ticket.id}/return`), 'devolver à fila')
    const data = await read()
    expect(data.numbers.queued.value).toBe(1)
    expect(data.numbers.inProgress.value).toBe(0)
    expect(data.numbers.averageWaitSeconds).toEqual(initial.numbers.averageWaitSeconds)
    expect(data.assignees).toEqual([])
    await t.shot(supervisor, 'devolvido-a-fila')
  })
  await t.step('Nova atribuição troca a linha do atendente e mantém a espera', async () => {
    await t.apiOk(second.context().request.post(`/api/tickets/${ticket.id}/assign`), 'segundo atendente assume')
    const data = await read()
    expect(data.numbers.queued.value).toBe(0)
    expect(data.numbers.inProgress.value).toBe(1)
    expect(data.numbers.averageWaitSeconds).toEqual(initial.numbers.averageWaitSeconds)
    expect(data.assignees.map(r => r.user.id)).toEqual([sector.agents[1].id])
    await t.shot(supervisor, 'segundo-responsavel')
    t.observe('Dashboard depois da nova atribuição', data)
  })
  await t.step('Banco confirma responsável final, primeira atribuição e auditoria', async () => {
    const [row] = t.sql(`select status, assignee_id, assigned_at from tickets where id = ${ticket.id}`)
    expect(row).toEqual({status:'in_progress', assignee_id:sector.agents[1].id, assigned_at:assigned})
    const audit = t.sql(`select action from audit_logs where ticket_id = ${ticket.id} order by id`)
    expect(audit.map(r => r.action)).toContain('ticket_returned')
    t.observe('Estado final do chamado', row)
    t.observe('Auditoria', audit)
  })
})

```
