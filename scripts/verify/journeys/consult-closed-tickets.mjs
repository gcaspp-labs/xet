// Consultar chamados encerrados em Atendimentos: ver features/consult-closed-tickets.md.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('consult-closed-tickets', async (t) => {
  const data = await t.step(
    'Preparar dois setores, órgãos, contatos e chamados encerrados',
    async () => {
      const origin = await t.seedSector({ agents: 2, modules: ['Folha', 'Patrimônio'] })
      const destination = await t.seedSector({ agents: 1 })
      const orgA = await t.seedOrganization()
      const orgB = await t.seedOrganization('Salto')
      const orgId = (org) =>
        Number(t.sql(`select id from organizations where name = '${org.name}'`)[0].id)
      const moduleId = (name) =>
        Number(
          t.sql(`select id from modules where sector_id = ${origin.id} and name = '${name}'`)[0].id,
        )
      const people = [
        { customer: t.customer('Rita Souza'), org: orgA },
        { customer: t.customer('Paulo Dias'), org: orgB },
        { customer: t.customer('Lúcia Alves'), org: orgA },
        { customer: t.customer('Marcos Lima'), org: orgB },
      ]
      for (const person of people) {
        await t.apiOk(
          t.admin.post('/api/contacts', {
            data: {
              name: person.customer.name,
              phone: person.customer.phone,
              organizationId: orgId(person.org),
              sectorIds: [origin.id],
            },
          }),
          `cadastrar ${person.customer.name}`,
        )
        await t.phone(origin.id).receive(person.customer, 'Bom dia')
      }
      const first = await t.apiAs(origin.agents[0])
      const second = await t.apiAs(origin.agents[1])
      const take = async (context, person) => {
        const tickets = await (await context.get(`/api/sectors/${origin.id}/tickets`)).json()
        const ticket = tickets.find((item) => item.contact.name === person.customer.name)
        await t.apiOk(context.post(`/api/tickets/${ticket.id}/assign`), 'assumir')
        return ticket
      }
      const form = (person, subject, modules) => ({
        subject,
        resolution: 'Resolvido.',
        moduleIds: modules.map(moduleId),
        organizationId: orgId(person.org),
      })
      const tickets = []
      tickets[0] = await take(first, people[0])
      await t.apiOk(
        first.post(`/api/tickets/${tickets[0].id}/close`, {
          data: form(people[0], 'Contracheque', ['Folha']),
        }),
        'encerrar Rita',
      )
      tickets[1] = await take(second, people[1])
      await t.apiOk(
        second.post(`/api/tickets/${tickets[1].id}/close`, {
          data: form(people[1], 'Férias do servidor', ['Folha', 'Patrimônio']),
        }),
        'encerrar Paulo',
      )
      tickets[2] = await take(first, people[2])
      await t.apiOk(
        first.post(`/api/tickets/${tickets[2].id}/cancel`, { data: { reason: 'Engano.' } }),
        'cancelar Lúcia',
      )
      tickets[3] = await take(first, people[3])
      await t.apiOk(
        first.post(`/api/tickets/${tickets[3].id}/sector-transfer`, {
          data: { sectorId: destination.id },
        }),
        'transferir Marcos',
      )
      // Um chamado ainda aberto, que não é histórico.
      await t.phone(origin.id).receive(t.customer('Aberto Pereira'), 'Olá')
      return { origin, destination, tickets }
    },
  )
  const { origin, destination, tickets } = data
  const rows = (page) => page.getByRole('table').locator('tbody').getByRole('row')
  const choose = async (page, label, option) => {
    await page.getByRole('combobox', { name: label }).click()
    await page.getByRole('option', { name: option }).click()
  }

  const agentPage = await t.signIn(origin.agents[0], { viewport: { width: 1440, height: 900 } })

  await t.step(
    'Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um',
    async () => {
      await agentPage.getByRole('link', { name: 'Atendimentos', exact: true }).click()
      await expect(agentPage).toHaveURL(/\/atendimentos$/)
      await expect(agentPage.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
      await expect(rows(agentPage)).toHaveCount(4)
      await expect(rows(agentPage).nth(0)).toContainText('Marcos Lima')
      await expect(rows(agentPage).nth(0)).toContainText('Transferido')
      await expect(rows(agentPage).nth(0)).toContainText(`para ${destination.name}`)
      await expect(rows(agentPage).nth(1)).toContainText('Cancelado')
      await expect(rows(agentPage).nth(2)).toContainText('Encerrado')
      await expect(rows(agentPage).nth(3)).toContainText('Rita Souza')
      await expect(agentPage.getByText('Aberto Pereira')).toHaveCount(0)
      await expect(agentPage.getByRole('combobox', { name: 'Situação' })).toHaveCount(0)
      await expect(
        agentPage.getByRole('button', { name: /Novo chamado|Nova conversa/ }),
      ).toHaveCount(0)
      await t.shot(agentPage, 'lista-atendente')
    },
  )

  await t.step(
    'Busca e filtros: texto sem acento, responsável, módulo, assunto e período',
    async () => {
      const search = agentPage.getByRole('searchbox', { name: 'Buscar chamados' })
      await search.fill('LUCIA')
      await expect(rows(agentPage)).toHaveCount(1)
      await search.fill('')
      await choose(agentPage, 'Responsável', origin.agents[1].name)
      await expect(rows(agentPage)).toHaveCount(1)
      await expect(rows(agentPage).first()).toContainText('Paulo Dias')
      await choose(agentPage, 'Responsável', 'Todos os responsáveis')
      // Módulo é texto contido, com sugestões, sem acentos nem maiúsculas; basta um dos módulos do chamado.
      const module = agentPage.getByRole('combobox', { name: 'Módulo' })
      await module.fill('patrimonio')
      await expect(agentPage.getByRole('option', { name: 'Patrimônio' })).toBeVisible()
      await agentPage.keyboard.press('Escape')
      // O transferido (Marcos) não tem módulos: só Paulo atendeu Patrimônio.
      await expect(rows(agentPage)).toHaveCount(1)
      // Um texto que está no nome dos dois módulos traz os chamados de qualquer um, uma vez só.
      await module.fill('o')
      await agentPage.keyboard.press('Escape')
      await expect(rows(agentPage)).toHaveCount(2)
      await module.fill('')
      await agentPage.keyboard.press('Escape')
      await expect(rows(agentPage)).toHaveCount(4)
      await agentPage.getByRole('combobox', { name: 'Assunto' }).fill('FERIAS')
      await expect(agentPage.getByRole('option', { name: 'Férias do servidor' })).toBeVisible()
      await t.shot(agentPage, 'assunto-com-sugestao')
      await agentPage.getByRole('option', { name: 'Férias do servidor' }).click()
      await expect(rows(agentPage)).toHaveCount(1)
      await agentPage.getByRole('combobox', { name: 'Assunto' }).fill('')
      await agentPage.keyboard.press('Escape')
      await agentPage.getByRole('button', { name: 'Hoje', exact: true }).click()
      await expect(rows(agentPage)).toHaveCount(4)
      await agentPage.getByRole('button', { name: 'Datas' }).click()
      await agentPage.getByLabel('Início').fill('2020-01-01')
      await agentPage.getByLabel('Fim').fill('2020-01-31')
      await expect(agentPage.getByText('Nenhum chamado encontrado.')).toBeVisible()
      await t.shot(agentPage, 'periodo-sem-resultado')
      await agentPage.getByRole('button', { name: 'Todo o período' }).click()
      await expect(rows(agentPage)).toHaveCount(4)
    },
  )

  await t.step(
    'Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém',
    async () => {
      await agentPage.getByRole('table').getByRole('button', { name: 'Contato' }).click()
      await expect(agentPage).toHaveURL(/ordem=contato/)
      await expect(rows(agentPage).first()).toContainText('Lúcia Alves')
      await agentPage.getByRole('searchbox', { name: 'Buscar chamados' }).fill('prefeitura')
      await agentPage.reload()
      await expect(agentPage).toHaveURL(/busca=prefeitura/)
      await expect(agentPage.getByRole('searchbox', { name: 'Buscar chamados' })).toHaveValue(
        'prefeitura',
      )
      await expect(rows(agentPage).first()).toContainText('Lúcia Alves')
      await t.shot(agentPage, 'ordem-e-busca-no-endereco')
      await agentPage.getByRole('searchbox', { name: 'Buscar chamados' }).fill('')
    },
  )

  await t.step('Clicar na linha abre a ficha só leitura em /atendimentos/:id', async () => {
    await rows(agentPage)
      .filter({ hasText: 'Paulo Dias' })
      .getByRole('cell', { name: 'Encerrado' })
      .click({ force: true })
    await expect(agentPage).toHaveURL(new RegExp(`/atendimentos/${tickets[1].id}$`))
    await expect(agentPage.getByRole('status', { name: 'Só leitura' })).toBeVisible()
    await expect(agentPage.getByRole('heading', { name: 'Paulo Dias' })).toBeVisible()
    await expect(agentPage.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
    await t.shot(agentPage, 'ficha')
    await agentPage.goBack()
    await expect(rows(agentPage)).toHaveCount(4)
  })

  const adminPage = await t.signIn(
    {
      key: 'admin',
      email: process.env.VERIFY_APP_ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
    { viewport: { width: 1440, height: 900 } },
  )
  await t.step(
    'Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor',
    async () => {
      await adminPage.goto('/atendimentos')
      await expect(adminPage.getByRole('combobox', { name: 'Responsável' })).toBeDisabled()
      await expect(adminPage.getByRole('combobox', { name: 'Módulo' })).toBeDisabled()
      await expect(
        adminPage.getByRole('table').getByRole('columnheader', { name: 'Setor' }),
      ).toBeVisible()
      await t.shot(adminPage, 'admin-travado')
      await choose(adminPage, 'Setor', origin.name)
      await expect(adminPage.getByRole('combobox', { name: 'Responsável' })).toBeEnabled()
      await expect(rows(adminPage)).toHaveCount(4)
      await choose(adminPage, 'Responsável', origin.agents[1].name)
      await adminPage.getByRole('combobox', { name: 'Módulo' }).fill('folha')
      await adminPage.keyboard.press('Escape')
      await expect(rows(adminPage)).toHaveCount(1)
      await t.shot(adminPage, 'admin-filtrado')
      await choose(adminPage, 'Setor', destination.name)
      await expect(adminPage.getByRole('combobox', { name: 'Responsável' })).toHaveText(
        /Todos os responsáveis/,
      )
      await expect(adminPage.getByRole('combobox', { name: 'Módulo' })).toHaveValue('')
      await expect(adminPage).not.toHaveURL(/responsavel|modulo/)
    },
  )

  await t.step('Estado final no banco e na API', async () => {
    const closed = t.sql(
      `select closure_type, closed_at is not null as has_closed_at from tickets where sector_id = ${origin.id} and status = 'closed' order by closed_at desc`,
    )
    t.observe('Chamados encerrados do setor (banco)', JSON.stringify(closed))
    expect(closed).toHaveLength(4)
    const open = t.sql(
      `select count(*)::int as n from tickets where sector_id = ${origin.id} and status <> 'closed'`,
    )
    t.observe('Chamados abertos do setor, fora da lista (banco)', JSON.stringify(open))
    const response = await agentPage.request.get('/api/closed-tickets?status=queued')
    t.observe('Filtro de situação na API', `HTTP ${response.status()}`)
    expect(response.status()).toBe(400)
    const other = await agentPage.request.get(`/api/closed-tickets?sectorId=${destination.id}`)
    t.observe('Setor de outro, para atendente', `HTTP ${other.status()}`)
    expect(other.status()).toBe(403)
  })
})
