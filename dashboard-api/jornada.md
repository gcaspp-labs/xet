# Código da jornada dashboard-api

Jornada só deste PR. Para repetir: salve em `.verify-app/runs/<execução>/` e rode `drive.sh` com o caminho.

```js
// Jornada só deste PR: a T47 é a API; a tela vem na T48.
const { expect, journey } = await import(process.env.VERIFY_APP_LIB)

await journey('dashboard-api', async (t) => {
  const { a, b, org, modules } = await t.step('Preparar dois setores, módulos e um órgão', async () => {
    const a = await t.seedSector({ agents: 2, modules: ['Folha', 'Patrimônio'] })
    const b = await t.seedSector({ agents: 1 })
    const orgSeed = await t.seedOrganization()
    const [org] = t.sql(`select id from organizations where name = '${orgSeed.name}'`)
    const list = await (await t.apiOk(t.admin.get(`/api/sectors/${a.id}/modules`), 'listar módulos')).json()
    const modules = Object.fromEntries(list.map((m) => [m.name, m.id]))
    return { a, b, org, modules }
  })
  const [agent1, agent2] = a.agents

  const supervisorPage = await t.signIn(a.supervisor)
  const agent1Page = await t.signIn(agent1)
  const agent2Page = await t.signIn(agent2)
  const asSupervisor = supervisorPage.context().request
  const as1 = agent1Page.context().request
  const as2 = agent2Page.context().request
  const asAdmin = t.admin

  const get = async (api, url) => {
    const response = await api.get(url)
    const body = await response.json().catch(() => null)
    return { status: response.status(), body }
  }
  const dashboard = async (api, query = '') => {
    const { status, body } = await get(api, `/api/dashboard${query}`)
    expect(status, `GET /api/dashboard${query}`).toBe(200)
    return body
  }
  const values = (numbers) =>
    Object.fromEntries(
      Object.entries(numbers).map(([key, n]) => [key, n.applicable ? n.value : 'não se aplica']),
    )
  const counts = (numbers) => {
    const { averageWaitSeconds: _w, averageHandlingSeconds: _h, ...rest } = values(numbers)
    return rest
  }

  const ids = await t.step(
    'Gerar chamados pelas rotas do produto: fila, atendimento, iniciado, encerrado, cancelado e transferido',
    async () => {
      const phone = t.phone(a.id)
      const people = {
        ana: t.customer('Ana'), bia: t.customer('Bia'), caio: t.customer('Caio'),
        davi: t.customer('Davi'), eva: t.customer('Eva'),
      }
      for (const person of Object.values(people)) await phone.receive(person, `Olá, sou ${person.name}`)
      const ticketOf = (person) =>
        t.sql(`select t.id, t.contact_id from tickets t join contacts c on c.id = t.contact_id
                where c.phone = '${person.phone}' and t.sector_id = ${a.id}`)[0]
      const ticket = Object.fromEntries(Object.entries(people).map(([k, p]) => [k, ticketOf(p)]))
      const assign = (api, row) => t.apiOk(api.post(`/api/tickets/${row.id}/assign`), 'assumir')
      await assign(as1, ticket.ana)
      await assign(as1, ticket.bia)
      await assign(as2, ticket.davi)
      await assign(as2, ticket.eva)
      for (const key of ['ana', 'eva']) {
        await t.apiOk(
          t.admin.put(`/api/contacts/${ticket[key].contact_id}`, {
            data: { name: people[key].name, phone: people[key].phone, organizationId: org.id, sectorIds: [a.id] },
          }),
          'cadastrar contato',
        )
      }
      await t.apiOk(
        as1.post(`/api/tickets/${ticket.ana.id}/close`, {
          data: { subject: 'S', resolution: 'R', moduleIds: [modules.Folha, modules['Patrimônio']], organizationId: org.id },
        }),
        'encerrar com dois módulos',
      )
      await t.apiOk(as2.post(`/api/tickets/${ticket.davi.id}/cancel`, { data: { reason: 'Golpe' } }), 'cancelar')
      await t.apiOk(
        as2.post(`/api/tickets/${ticket.eva.id}/transfer-sector`, {
          data: { subject: 'S', resolution: 'R', moduleIds: [modules['Patrimônio']], organizationId: org.id, sectorId: b.id },
        }),
        'transferir de setor',
      )
      const started = t.customer('Gil')
      const contact = await (
        await t.apiOk(
          t.admin.post('/api/contacts', {
            data: { name: started.name, phone: started.phone, organizationId: org.id, sectorIds: [a.id] },
          }),
          'criar contato',
        )
      ).json()
      await t.apiOk(
        as1.post(`/api/sectors/${a.id}/conversations`, {
          data: { contactId: contact.id, clientRequestId: crypto.randomUUID(), body: 'Bom dia' },
        }),
        'iniciar conversa',
      )
      return { ana: ticket.ana.id }
    },
  )

  await t.step('Supervisor vê os números do próprio setor, sem pedir o setor', async () => {
    const data = await dashboard(asSupervisor, '?period=today')
    expect(data.sectorId).toBe(a.id)
    expect(counts(data.numbers)).toEqual({
      queued: 1, inProgress: 2, received: 5, started: 1, resolved: 1, transferred: 1, cancelled: 1,
    })
    expect(data.numbers.averageWaitSeconds.value).not.toBeNull()
    expect(data.numbers.averageHandlingSeconds.value).not.toBeNull()
    t.observe('Supervisor, hoje', values(data.numbers))
    await supervisorPage.goto('/api/dashboard?period=today')
    await t.shot(supervisorPage, 'resposta-do-supervisor')
  })

  await t.step('Tabela por atendente: responsável final e sem linhas zeradas', async () => {
    const data = await dashboard(asSupervisor, '?period=today')
    const row = (user) => {
      const found = data.assignees.find((item) => item.user.id === user.id)
      return found && values(found)
    }
    const pick = ({ inProgress, started, resolved, transferred, cancelled }) => ({
      inProgress, started, resolved, transferred, cancelled,
    })
    expect(data.assignees).toHaveLength(2)
    expect(pick(row(agent1))).toEqual({ inProgress: 2, started: 1, resolved: 1, transferred: 0, cancelled: 0 })
    expect(pick(row(agent2))).toEqual({ inProgress: 0, started: 0, resolved: 0, transferred: 1, cancelled: 1 })
    t.observe('Tabela do setor', data.assignees.map((item) => ({ nome: item.user.name, setor: item.sector.name, ...pick(values(item)) })))
  })

  await t.step('Administrador vê todos os setores, e a transferência conta na origem e no destino', async () => {
    const all = await dashboard(asAdmin, '?period=today')
    expect(all.sectorId).toBeNull()
    expect(counts(all.numbers)).toEqual({
      queued: 2, inProgress: 2, received: 6, started: 1, resolved: 1, transferred: 1, cancelled: 1,
    })
    t.observe('Administrador, todos os setores', values(all.numbers))
    const one = await dashboard(asAdmin, `?period=today&sectorId=${a.id}`)
    expect(one.sectorId).toBe(a.id)
    expect(counts(one.numbers)).toEqual(counts((await dashboard(asSupervisor, '?period=today')).numbers))
    const target = await dashboard(asAdmin, `?period=today&sectorId=${b.id}`)
    expect(counts(target.numbers)).toEqual({
      queued: 1, inProgress: 0, received: 1, started: 0, resolved: 0, transferred: 0, cancelled: 0,
    })
    t.observe('Administrador, setor de destino', values(target.numbers))
  })

  await t.step('Período: "agora" não muda; o que depende de data muda, e média sem dados vem vazia', async () => {
    const week = await dashboard(asSupervisor, '?period=7d')
    const month = await dashboard(asSupervisor, '?period=30d')
    expect(counts(week.numbers)).toEqual(counts(month.numbers))
    expect(week.numbers.received.value).toBe(5)
    const past = await dashboard(asSupervisor, '?from=2000-01-01&to=2000-01-02')
    expect(past.period).toEqual({ from: '2000-01-01', to: '2000-01-02' })
    expect(counts(past.numbers)).toEqual({
      queued: 1, inProgress: 2, received: 0, started: 0, resolved: 0, transferred: 0, cancelled: 0,
    })
    expect(past.numbers.averageWaitSeconds).toEqual({ applicable: true, value: null })
    expect(past.numbers.averageHandlingSeconds).toEqual({ applicable: true, value: null })
    expect(past.assignees.map((item) => item.user.id)).toEqual([agent1.id])
    t.observe('Período de 2000', values(past.numbers))
  })

  await t.step('Filtros seguem a tabela da spec, com "não se aplica"', async () => {
    const byAgent = await dashboard(asSupervisor, `?period=today&assigneeId=${agent1.id}`)
    expect(counts(byAgent.numbers)).toEqual({
      queued: 'não se aplica', inProgress: 2, received: 'não se aplica', started: 1, resolved: 1, transferred: 0, cancelled: 0,
    })
    expect(byAgent.numbers.averageWaitSeconds).toEqual({ applicable: false, value: null })
    expect(byAgent.numbers.averageHandlingSeconds.applicable).toBe(true)
    t.observe('Filtro de atendente', values(byAgent.numbers))

    const byOrg = await dashboard(asSupervisor, `?period=today&organizationId=${org.id}`)
    expect(counts(byOrg.numbers)).toEqual({
      queued: 0, inProgress: 1, received: 2, started: 1, resolved: 1, transferred: 1, cancelled: 0,
    })
    t.observe('Filtro de órgão', values(byOrg.numbers))

    const notApplicable = {
      queued: 'não se aplica', inProgress: 'não se aplica', received: 'não se aplica',
      started: 'não se aplica', cancelled: 'não se aplica',
    }
    const folha = await dashboard(asSupervisor, `?period=today&moduleId=${modules.Folha}`)
    expect(counts(folha.numbers)).toEqual({ ...notApplicable, resolved: 1, transferred: 0 })
    const patrimonio = await dashboard(asSupervisor, `?period=today&moduleId=${modules['Patrimônio']}`)
    expect(counts(patrimonio.numbers)).toEqual({ ...notApplicable, resolved: 1, transferred: 1 })
    t.observe('Filtro de módulo: Folha', values(folha.numbers))
    t.observe('Filtro de módulo: Patrimônio', values(patrimonio.numbers))
  })

  await t.step('Correção de módulos muda os números', async () => {
    const now = Date.now()
    await t.apiOk(
      as1.post(`/api/tickets/${ids.ana}/correct`, {
        data: {
          subject: 'S', resolution: 'R', moduleIds: [modules['Patrimônio']], organizationId: org.id,
          startedAt: new Date(now - 60_000).toISOString(), endedAt: new Date(now - 1_000).toISOString(),
          reason: 'Módulo errado',
        },
      }),
      'corrigir encerramento',
    )
    const folha = await dashboard(asSupervisor, `?period=today&moduleId=${modules.Folha}`)
    expect(folha.numbers.resolved.value).toBe(0)
    const patrimonio = await dashboard(asSupervisor, `?period=today&moduleId=${modules['Patrimônio']}`)
    expect(patrimonio.numbers.resolved.value).toBe(1)
  })

  await t.step('Opções do filtro de atendente', async () => {
    const options = await get(asSupervisor, `/api/sectors/${a.id}/dashboard/assignees`)
    expect(options.status).toBe(200)
    const names = options.body.map((item) => item.name)
    expect(names).toEqual(expect.arrayContaining([agent1.name, agent2.name]))
    t.observe('Opções do setor', options.body.map(({ name, active }) => ({ name, active })))
    expect((await get(asSupervisor, `/api/sectors/${b.id}/dashboard/assignees`)).status).toBe(403)
    expect((await get(as1, `/api/sectors/${a.id}/dashboard/assignees`)).status).toBe(403)
    expect((await get(asAdmin, `/api/sectors/${b.id}/dashboard/assignees`)).status).toBe(200)
  })

  await t.step('Permissões e filtros inválidos são recusados', async () => {
    const cases = [
      ['Atendente', as1, '', 403],
      ['Supervisor pedindo outro setor', asSupervisor, `?sectorId=${b.id}`, 403],
      ['Início depois do fim', asSupervisor, '?from=2026-02-02&to=2026-02-01', 400],
      ['Data inválida', asSupervisor, '?from=2026-13-40&to=2026-13-41', 400],
      ['Só uma data', asSupervisor, '?from=2026-02-02', 400],
      ['Período desconhecido', asSupervisor, '?period=ontem', 400],
      ['Atendente de outro setor', asSupervisor, `?assigneeId=${b.agents[0].id}`, 400],
      ['Atendente sem setor (administrador)', asAdmin, `?assigneeId=${agent1.id}`, 400],
      ['Módulo sem setor (administrador)', asAdmin, `?moduleId=${modules.Folha}`, 400],
      ['Módulo de outro setor (administrador)', asAdmin, `?sectorId=${b.id}&moduleId=${modules.Folha}`, 400],
      ['Filtro que não é número', asSupervisor, '?organizationId=abc', 400],
    ]
    const results = []
    for (const [name, api, query, expected] of cases) {
      const { status } = await get(api, `/api/dashboard${query}`)
      results.push({ caso: name, esperado: expected, recebido: status })
    }
    t.observe('Recusas', results)
    expect(results.filter((item) => item.esperado !== item.recebido)).toEqual([])
  })

  await t.step('Estado final no banco bate com os números da API', async () => {
    const rows = t.sql(`select sector_id, status, closure_type, count(*)::int as total from tickets
                         group by 1, 2, 3 order by 1, 2, 3`)
    t.observe('Chamados no banco', rows)
    const count = (sector, status, closure) =>
      rows.filter((r) => r.sector_id === sector && r.status === status && r.closure_type === closure)
        .reduce((sum, r) => sum + r.total, 0)
    expect(count(a.id, 'queued', null)).toBe(1)
    expect(count(a.id, 'in_progress', null)).toBe(2)
    expect(count(a.id, 'closed', 'resolved')).toBe(1)
    expect(count(a.id, 'closed', 'cancelled')).toBe(1)
    expect(count(a.id, 'closed', 'transferred')).toBe(1)
    expect(count(b.id, 'queued', null)).toBe(1)
    const moved = t.sql(`select count(*)::int as total from tickets where previous_ticket_id is not null and sector_id = ${b.id}`)
    expect(moved[0].total).toBe(1)
  })
})
```
