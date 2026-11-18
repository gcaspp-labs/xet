import {
  type APIRequestContext,
  expect,
  type Page,
  request as apiRequest,
  test,
} from '@playwright/test'
import {
  admin,
  json,
  login,
  ok,
  seedDirectory,
  seedSector,
  seedTransferredTicket,
  unique,
  userPassword,
} from './fixtures'

type Ticket = { id: number; protocol: string; contact: { name: string } }

async function adminApi(baseURL: string) {
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  return api
}

async function agentApi(baseURL: string, email: string) {
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email, password: userPassword } }))
  return api
}

// Mensagem de um contato, simulada pelo adaptador falso do backend.
async function receive(api: APIRequestContext, sectorId: number, phone: string, name: string) {
  ok(
    await api.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
      data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: name, body: 'Olá' },
    }),
  )
}

// O chamado aberto do contato na fila do setor.
async function queued(api: APIRequestContext, sectorId: number, name: string) {
  const tickets = await json<Ticket[]>(await api.get(`/api/sectors/${sectorId}/tickets`))
  return tickets.find((ticket) => ticket.contact.name === name)!
}

// Telefone único por teste: o id do teste mais um deslocamento, com 9 dígitos.
const phoneOf = (id: string, offset: number) =>
  `5511${String(Number(id) + offset).padStart(9, '0')}`

// Os chamados de um setor, na ordem em que foram encerrados: o mais recente é o último.
async function seedHistory(baseURL: string) {
  const origin = await seedSector(baseURL)
  const destination = await seedSector(baseURL)
  const { id } = unique()

  const admins = await adminApi(baseURL)
  for (const sectorId of [origin.sector.id, destination.sector.id]) {
    ok(await admins.post(`/api/sectors/${sectorId}/connection`))
    ok(await admins.post(`/api/test/messaging/sectors/${sectorId}/pair`))
  }
  const modules: { id: number; name: string }[] = []
  for (const name of ['Folha', 'Patrimônio']) {
    modules.push(
      await json(await admins.post(`/api/sectors/${origin.sector.id}/modules`, { data: { name } })),
    )
  }
  const otherAgent = `bruno.${id}@e2e.test`
  ok(
    await admins.post('/api/users', {
      data: {
        name: `Bruno Atendente ${id}`,
        email: otherAgent,
        role: 'agent',
        sectorId: origin.sector.id,
        password: userPassword,
      },
    }),
  )
  await admins.dispose()

  const people = [
    { name: `Rita Souza ${id}`, phone: phoneOf(id, 0), org: 0 },
    { name: `Paulo Dias ${id}`, phone: phoneOf(id, 1), org: 1 },
    { name: `Lúcia Alves ${id}`, phone: phoneOf(id, 2), org: 0 },
    { name: `Marcos Lima ${id}`, phone: phoneOf(id, 3), org: 1 },
  ]
  // O quinto contato continua com o chamado aberto.
  const openPerson = { name: `Aberto Pereira ${id}`, phone: phoneOf(id, 4), org: 0 }
  const organizations = await seedDirectory(
    baseURL,
    [{ name: `Prefeitura de Itu ${id}` }, { name: `Prefeitura de Salto ${id}` }],
    [...people, openPerson].map((person) => ({
      name: person.name,
      phone: person.phone,
      organization: person.org,
      sector: origin.sector.id,
    })),
  )

  const system = await apiRequest.newContext({ baseURL })
  for (const person of [...people, openPerson]) {
    await receive(system, origin.sector.id, person.phone, person.name)
  }
  await system.dispose()

  const first = await agentApi(baseURL, origin.agent)
  const second = await agentApi(baseURL, otherAgent)
  const closing = (index: number, subject: string, moduleIds: number[]) => ({
    subject,
    resolution: 'Resolvido.',
    moduleIds,
    organizationId: organizations[people[index].org].id,
  })
  const tickets: Ticket[] = []
  const step = async (
    api: APIRequestContext,
    index: number,
    act: (ticket: Ticket) => Promise<unknown>,
  ) => {
    const ticket = await queued(api, origin.sector.id, people[index].name)
    ok(await api.post(`/api/tickets/${ticket.id}/assign`))
    await act(ticket)
    tickets[index] = ticket
  }
  await step(first, 0, async (ticket) =>
    ok(
      await first.post(`/api/tickets/${ticket.id}/close`, {
        data: closing(0, 'Contracheque', [modules[0].id]),
      }),
    ),
  )
  await step(second, 1, async (ticket) =>
    ok(
      await second.post(`/api/tickets/${ticket.id}/close`, {
        data: closing(1, 'Férias do servidor', [modules[0].id, modules[1].id]),
      }),
    ),
  )
  await step(first, 2, async (ticket) =>
    ok(await first.post(`/api/tickets/${ticket.id}/cancel`, { data: { reason: 'Engano.' } })),
  )
  await step(first, 3, async (ticket) =>
    ok(
      await first.post(`/api/tickets/${ticket.id}/transfer-sector`, {
        data: {
          ...closing(3, 'Folha de março', [modules[1].id]),
          sectorId: destination.sector.id,
        },
      }),
    ),
  )
  return {
    origin,
    destination,
    id,
    people,
    openPerson,
    tickets,
    modules,
    organizations,
    otherAgent,
    firstApi: first,
    secondApi: second,
    firstName: origin.agent.replace(/^agent\.(\d+)@.*$/, 'agent $1'),
    secondName: `Bruno Atendente ${id}`,
  }
}

// Entra e abre Atendimentos.
async function openList(page: Page, email: string, password: string) {
  await login(page, email, password)
  await expect(page).not.toHaveURL(/\/login$/)
  await page.goto('/atendimentos')
  await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
}

const rows = (page: Page) => page.getByRole('table').getByRole('row')
const bodyRows = (page: Page) => page.getByRole('table').locator('tbody').getByRole('row')

async function choose(page: Page, label: string, option: string | RegExp) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option }).click()
}

test('abre com todos os chamados encerrados, do mais recente ao mais antigo, sem situação aberta nem Novo chamado', async ({
  page,
  baseURL,
}) => {
  const h = await seedHistory(baseURL!)
  await openList(page, h.origin.agent, userPassword)
  await expect(page).toHaveURL(/\/atendimentos$/)
  await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()

  // Encerrado pelo atendente, cancelado e transferido; o chamado aberto não entra.
  // O mais recente primeiro: transferido, cancelado, Paulo e Rita.
  const names = h.people.map((person) => person.name)
  await expect(bodyRows(page)).toHaveCount(4)
  await expect(bodyRows(page).nth(0)).toContainText(names[3])
  await expect(bodyRows(page).nth(1)).toContainText(names[2])
  await expect(bodyRows(page).nth(2)).toContainText(names[1])
  await expect(bodyRows(page).nth(3)).toContainText(names[0])
  await expect(page.getByText(h.openPerson.name)).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Paginação' })).toHaveCount(0)

  // Cada linha traz protocolo, data do encerramento, contato, órgão, responsável, assunto, módulos e situação.
  const rita = bodyRows(page).nth(3)
  await expect(rita).toContainText(h.tickets[0].protocol)
  await expect(rita).toContainText(/Hoje \d{2}:\d{2}/)
  await expect(rita).toContainText(names[0])
  await expect(rita).toContainText(`Prefeitura de Itu ${h.id}`)
  await expect(rita).toContainText(h.firstName)
  await expect(rita).toContainText('Contracheque')
  await expect(rita).toContainText('Folha')
  await expect(rita).toContainText('Encerrado')
  await expect(bodyRows(page).nth(2)).toContainText(h.secondName)
  await expect(bodyRows(page).nth(2)).toContainText('Patrimônio')
  await expect(bodyRows(page).nth(1)).toContainText('Cancelado')
  await expect(bodyRows(page).nth(0)).toContainText('Transferido')
  await expect(bodyRows(page).nth(0)).toContainText(`para ${h.destination.sector.name}`)
  // Atendente não vê a coluna Setor, e as colunas ordenam, menos Módulos.
  const header = page.getByRole('table').locator('thead')
  await expect(header.getByRole('columnheader', { name: 'Setor' })).toHaveCount(0)
  for (const name of [
    'Protocolo',
    'Data',
    'Contato',
    'Órgão',
    'Responsável',
    'Assunto',
    'Situação',
  ]) {
    await expect(header.getByRole('button', { name })).toBeVisible()
  }
  await expect(header.getByRole('columnheader', { name: 'Módulos' })).toBeVisible()
  await expect(header.getByRole('button', { name: 'Módulos' })).toHaveCount(0)

  // Sem seletor de situação, sem Novo chamado e sem os cartões antigos.
  await expect(page.getByRole('combobox', { name: 'Situação' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Novo chamado|Nova conversa/ })).toHaveCount(0)
  for (const title of [
    'Fila do setor',
    'Em atendimento',
    'Realizados hoje',
    'Chamados por atendente',
  ]) {
    await expect(page.getByRole('region', { name: title })).toHaveCount(0)
  }
  // Abre em todo o período.
  await expect(page.getByRole('button', { name: 'Todo o período' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Outro atendente do mesmo setor vê a mesma lista; o endereço não troca de setor.
  await page.goto(`/atendimentos?setor=${h.destination.sector.id}`)
  await expect(bodyRows(page)).toHaveCount(4)
  await expect(page.getByRole('combobox', { name: 'Setor' })).toHaveCount(0)
  await h.firstApi.dispose()
  await h.secondApi.dispose()
})

test('atendente de outro setor não vê o histórico deste', async ({ page, baseURL }) => {
  const h = await seedHistory(baseURL!)
  await openList(page, h.destination.agent, userPassword)
  await expect(page.getByText('Nenhum chamado encontrado.')).toBeVisible()
  await expect(rows(page)).toHaveCount(0)
  // A API recusa o setor dos outros, por mais que o endereço peça.
  const response = await page.request.get(`/api/closed-tickets?sectorId=${h.origin.sector.id}`)
  expect(response.status()).toBe(403)
  await h.firstApi.dispose()
  await h.secondApi.dispose()
})

test('busca e filtros no servidor, sem diferenciar acentos e maiúsculas, guardados no endereço', async ({
  page,
  baseURL,
}) => {
  const h = await seedHistory(baseURL!)
  await openList(page, h.origin.supervisor, userPassword)
  const [rita, paulo, lucia, marcos] = h.people
  const search = page.getByRole('searchbox', { name: 'Buscar chamados' })

  // Busca: protocolo, contato, telefone ou órgão.
  await search.fill(h.tickets[1].protocol)
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(bodyRows(page).first()).toContainText(paulo.name)
  await search.fill(`lucia alves ${h.id}`)
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(bodyRows(page).first()).toContainText(lucia.name)
  await search.fill(`(11) ${rita.phone.slice(4, 9)}-${rita.phone.slice(9)}`)
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(bodyRows(page).first()).toContainText(rita.name)
  await search.fill(`PREFEITURA DE SALTO ${h.id}`)
  await expect(bodyRows(page)).toHaveCount(2)
  await expect(page).toHaveURL(/busca=PREFEITURA/)
  await search.fill('')
  await expect(bodyRows(page)).toHaveCount(4)
  await expect(page).not.toHaveURL(/busca/)

  // Responsável.
  await choose(page, 'Responsável', h.secondName)
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(bodyRows(page).first()).toContainText(paulo.name)
  await choose(page, 'Responsável', 'Todos os responsáveis')
  await expect(bodyRows(page)).toHaveCount(4)

  // Módulo: texto contido, com sugestões, sem acentos nem maiúsculas; basta um dos módulos do chamado.
  const module = page.getByRole('combobox', { name: 'Módulo' })
  await module.fill('FOL')
  await expect(page.getByRole('option', { name: 'Folha' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Patrimônio' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Folha' }).click()
  await expect(page).toHaveURL(/modulo=Folha/)
  await expect(bodyRows(page)).toHaveCount(2)
  await module.fill('patrimonio')
  await expect(page.getByRole('option', { name: 'Patrimônio' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(bodyRows(page)).toHaveCount(2)
  await expect(bodyRows(page).first()).toContainText(marcos.name)
  await expect(bodyRows(page).last()).toContainText(paulo.name)
  // Um texto que está no nome de mais de um módulo traz os chamados de qualquer um deles, uma vez só.
  await module.fill('o')
  await page.keyboard.press('Escape')
  await expect(bodyRows(page)).toHaveCount(3)
  await module.fill('')
  await page.keyboard.press('Escape')
  await expect(bodyRows(page)).toHaveCount(4)
  await expect(page).not.toHaveURL(/modulo/)

  // Assunto: texto contido, com sugestões, sem acentos nem maiúsculas.
  const subject = page.getByRole('combobox', { name: 'Assunto' })
  await subject.fill('FERIAS')
  // Com a lista de sugestões aberta, o resto da página fica fora da árvore de acessibilidade.
  await expect(page.getByRole('option', { name: 'Férias do servidor' })).toBeVisible()
  await page.getByRole('option', { name: 'Férias do servidor' }).click()
  await expect(page).toHaveURL(/assunto=F%C3%A9rias/)
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(bodyRows(page).first()).toContainText(paulo.name)
  await subject.fill('')
  await page.keyboard.press('Escape')
  await expect(bodyRows(page)).toHaveCount(4)

  // Período: o encerramento foi agora, então Hoje traz tudo; um dia passado, nada.
  await page.getByRole('button', { name: 'Hoje', exact: true }).click()
  await expect(page).toHaveURL(/periodo=hoje/)
  await expect(bodyRows(page)).toHaveCount(4)
  await page.getByRole('button', { name: '7 dias' }).click()
  await expect(bodyRows(page)).toHaveCount(4)
  await page.getByRole('button', { name: '30 dias' }).click()
  await expect(bodyRows(page)).toHaveCount(4)
  await page.getByRole('button', { name: 'Datas' }).click()
  await page.getByLabel('Início').fill('2020-01-01')
  await expect(page.getByLabel('Início')).toHaveValue('2020-01-01')
  await page.getByLabel('Fim').fill('2020-01-31')
  await expect(page.getByText('Nenhum chamado encontrado.')).toBeVisible()
  await expect(page).toHaveURL(/periodo=datas/)
  await expect(page).toHaveURL(/de=2020-01-01/)
  await expect(page).toHaveURL(/ate=2020-01-31/)
  await page.getByLabel('Início').fill('2020-02-01')
  await expect(page.getByText('Período invertido')).toBeVisible()
  await page.getByLabel('Início').fill('2020-01-01')
  await expect(page.getByLabel('Início')).toHaveValue('2020-01-01')
  await page.getByLabel('Fim').fill('')
  await expect(page.getByLabel('Fim')).toHaveValue('')
  await expect(bodyRows(page)).toHaveCount(4)

  // Tudo junto, e o endereço guarda: recarregar traz a mesma lista e os mesmos campos.
  // A tela monta o endereço novo a partir do que já desenhou, então cada mudança espera a tela
  // mostrar a anterior: uma mudança feita antes disso apagaria a anterior do endereço.
  await page.getByRole('button', { name: '7 dias' }).click()
  await expect(page.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('combobox', { name: 'Módulo' }).fill('folha')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('combobox', { name: 'Módulo' })).toHaveValue('folha')
  await choose(page, 'Responsável', h.firstName)
  await expect(page.getByRole('combobox', { name: 'Responsável' })).toHaveText(
    new RegExp(h.firstName),
  )
  await search.fill(`prefeitura de itu ${h.id}`)
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(bodyRows(page).first()).toContainText(rita.name)
  await page.reload()
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(bodyRows(page).first()).toContainText(rita.name)
  await expect(search).toHaveValue(`prefeitura de itu ${h.id}`)
  await expect(page.getByRole('combobox', { name: 'Módulo' })).toHaveValue('folha')
  await expect(page.getByRole('combobox', { name: 'Responsável' })).toHaveText(
    new RegExp(h.firstName),
  )
  await expect(page.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true')
  await h.firstApi.dispose()
  await h.secondApi.dispose()
})

test('colunas ordenam no servidor e a ordem fica no endereço', async ({ page, baseURL }) => {
  const h = await seedHistory(baseURL!)
  await openList(page, h.origin.agent, userPassword)
  const [rita, paulo, lucia, marcos] = h.people.map((person) => person.name)
  const order = async (...names: string[]) => {
    await expect(bodyRows(page)).toHaveCount(names.length)
    for (const [index, name] of names.entries()) {
      await expect(bodyRows(page).nth(index)).toContainText(name)
    }
  }
  const header = (name: string) => page.getByRole('table').getByRole('button', { name })

  // Padrão: Data, mais recente primeiro; clicar inverte.
  await expect(page.getByRole('columnheader', { name: 'Data' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )
  await header('Data').click()
  await expect(page).toHaveURL(/direcao=asc/)
  await order(rita, paulo, lucia, marcos)
  await header('Data').click()
  await expect(page).not.toHaveURL(/direcao/)
  await order(marcos, lucia, paulo, rita)

  // Outra coluna começa crescente; o nome do contato desempata a ordem alfabética: Lúcia, Marcos, Paulo, Rita.
  await header('Contato').click()
  await expect(page).toHaveURL(/ordem=contato/)
  await expect(page.getByRole('columnheader', { name: 'Contato' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  await order(lucia, marcos, paulo, rita)
  await header('Contato').click()
  await expect(page).toHaveURL(/direcao=desc/)
  await order(rita, paulo, marcos, lucia)
  // Voltar para Data, vindo de outra coluna, começa crescente; a abertura decrescente é só a inicial.
  await header('Data').click()
  await expect(page).not.toHaveURL(/ordem=/)
  await expect(page).toHaveURL(/direcao=asc/)
  await expect(page.getByRole('columnheader', { name: 'Data' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  await order(rita, paulo, lucia, marcos)

  // Situação: Cancelado, Encerrado e Encerrado, Transferido.
  await header('Situação').click()
  await expect(bodyRows(page).first()).toContainText('Cancelado')
  await expect(bodyRows(page).last()).toContainText('Transferido')
  // Assunto: os sem assunto (cancelado) ficam por último.
  await header('Assunto').click()
  await order(rita, paulo, marcos, lucia)
  // Responsável e órgão.
  await header('Órgão').click()
  await expect(bodyRows(page).first()).toContainText(`Prefeitura de Itu ${h.id}`)
  await header('Órgão').click()
  await expect(bodyRows(page).first()).toContainText(`Prefeitura de Salto ${h.id}`)
  await header('Responsável').click()
  await expect(page).toHaveURL(/ordem=responsavel/)
  await h.firstApi.dispose()
  await h.secondApi.dispose()
})

test('20 por página, e página e filtro sobrevivem ao recarregar', async ({ page, baseURL }) => {
  const origin = await seedSector(baseURL!)
  const { id } = unique()
  const admins = await adminApi(baseURL!)
  ok(await admins.post(`/api/sectors/${origin.sector.id}/connection`))
  ok(await admins.post(`/api/test/messaging/sectors/${origin.sector.id}/pair`))
  const sectorModule = await json<{ id: number }>(
    await admins.post(`/api/sectors/${origin.sector.id}/modules`, { data: { name: 'Folha' } }),
  )
  await admins.dispose()
  const people = Array.from({ length: 21 }, (_, index) => ({
    name: `Contato ${String(index + 1).padStart(2, '0')} ${id}`,
    phone: phoneOf(id, index),
    organization: 0,
    sector: origin.sector.id,
  }))
  const [organization] = await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura de Paginação ${id}` }],
    people,
  )
  const system = await apiRequest.newContext({ baseURL })
  for (const person of people) {
    await receive(system, origin.sector.id, person.phone, person.name)
  }
  await system.dispose()
  const api = await agentApi(baseURL!, origin.agent)
  for (const person of people) {
    const ticket = await queued(api, origin.sector.id, person.name)
    ok(await api.post(`/api/tickets/${ticket.id}/assign`))
    ok(
      await api.post(`/api/tickets/${ticket.id}/close`, {
        data: {
          subject: 'Assunto',
          resolution: 'Resolvido.',
          moduleIds: [sectorModule.id],
          organizationId: organization.id,
        },
      }),
    )
  }
  await api.dispose()

  await openList(page, origin.agent, userPassword)
  await expect(bodyRows(page)).toHaveCount(20)
  await expect(page.getByText('Página 1 de 2 · 21 chamados')).toBeVisible()
  // O mais recente primeiro: o último encerrado abre a primeira página; o primeiro, a segunda.
  await expect(bodyRows(page).first()).toContainText(people[20].name)
  await page.getByRole('button', { name: 'Próxima' }).click()
  await expect(page).toHaveURL(/pagina=2/)
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(bodyRows(page).first()).toContainText(people[0].name)
  await page.reload()
  await expect(page).toHaveURL(/pagina=2/)
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(page.getByText('Página 2 de 2 · 21 chamados')).toBeVisible()

  // Mudar o filtro ou a ordem volta à primeira página; página além da última cai na última.
  await page.getByRole('searchbox', { name: 'Buscar chamados' }).fill('Contato 0')
  await expect(page).not.toHaveURL(/pagina/)
  await expect(bodyRows(page)).toHaveCount(9)
  await page.goto('/atendimentos?pagina=99')
  await expect(page).toHaveURL(/pagina=2$/)
  await expect(bodyRows(page)).toHaveCount(1)
  await page.getByRole('table').getByRole('button', { name: 'Contato' }).click()
  await expect(page).not.toHaveURL(/pagina=/)
  await expect(bodyRows(page)).toHaveCount(20)
})

test('administrador vê o setor, e responsável e módulo só abrem depois de escolher um setor', async ({
  page,
  baseURL,
}) => {
  const h = await seedHistory(baseURL!)
  await openList(page, admin.email, admin.password)
  await page.goto('/atendimentos')
  const sector = page.getByRole('combobox', { name: 'Setor' })
  const assignee = page.getByRole('combobox', { name: 'Responsável' })
  const module = page.getByRole('combobox', { name: 'Módulo' })

  // Todos os setores: os dois travados, com a dica, e a coluna Setor na tabela.
  await expect(sector).toHaveText(/Todos os setores/)
  await expect(assignee).toBeDisabled()
  await expect(assignee).toHaveText(/Escolha um setor/)
  await expect(module).toBeDisabled()
  await expect(module).toHaveAttribute('placeholder', 'Escolha um setor')
  await expect(page.getByRole('table').getByRole('columnheader', { name: 'Setor' })).toBeVisible()

  // Um setor: a lista é dele, e os dois filtros abrem.
  await choose(page, 'Setor', h.origin.sector.name)
  await expect(page).toHaveURL(new RegExp(`setor=${h.origin.sector.id}`))
  await expect(bodyRows(page)).toHaveCount(4)
  await expect(bodyRows(page).first()).toContainText(h.origin.sector.name)
  await expect(assignee).toBeEnabled()
  await expect(module).toBeEnabled()
  await choose(page, 'Responsável', h.secondName)
  // A tela monta o endereço novo a partir do que já desenhou: o módulo só vem depois de ela
  // mostrar o responsável, ou o apagaria do endereço.
  await expect(assignee).toHaveText(new RegExp(h.secondName))
  await module.fill('folha')
  await page.keyboard.press('Escape')
  await expect(bodyRows(page)).toHaveCount(1)
  await expect(page).toHaveURL(/responsavel=\d+/)
  await expect(page).toHaveURL(/modulo=folha/)

  // Trocar de setor limpa os dois.
  await choose(page, 'Setor', h.destination.sector.name)
  await expect(assignee).toHaveText(/Todos os responsáveis/)
  await expect(module).toHaveValue('')
  await expect(page).not.toHaveURL(/responsavel|modulo/)
  await expect(page.getByText('Nenhum chamado encontrado.')).toBeVisible()

  // De volta a todos os setores, os dois travam de novo.
  await choose(page, 'Setor', 'Todos os setores')
  await expect(assignee).toBeDisabled()
  await expect(module).toBeDisabled()
  await expect(page).not.toHaveURL(/setor=/)

  // Endereço com responsável e sem setor não vale: a API recusaria, e a tela ignora.
  await page.goto('/atendimentos?responsavel=1&modulo=folha')
  await expect(assignee).toBeDisabled()
  await expect(module).toBeDisabled()
  await expect(module).toHaveValue('')
  await expect(page.getByRole('alert').filter({ hasText: 'Filtro inválido' })).toHaveCount(0)
  await h.firstApi.dispose()
  await h.secondApi.dispose()
})

test('clicar na linha abre a ficha só leitura em /atendimentos/:id, e voltar mantém a busca', async ({
  page,
  baseURL,
}) => {
  const h = await seedHistory(baseURL!)
  await openList(page, h.origin.agent, userPassword)
  const search = page.getByRole('searchbox', { name: 'Buscar chamados' })
  await search.fill(h.people[1].name)
  await expect(bodyRows(page)).toHaveCount(1)

  // Um clique fora do link, na célula do órgão, também abre: a linha inteira é clicável.
  await bodyRows(page).first().getByText(`Prefeitura de Salto ${h.id}`).click({ force: true })
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${h.tickets[1].id}$`))
  await expect(page.getByRole('status', { name: 'Só leitura' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)

  // Voltar traz a mesma busca e a mesma lista.
  await page.goBack()
  await expect(page).toHaveURL(/busca=/)
  await expect(search).toHaveValue(h.people[1].name)
  await expect(bodyRows(page)).toHaveCount(1)

  // Pelo teclado, o protocolo é um link de verdade.
  await bodyRows(page).first().getByRole('link', { name: h.tickets[1].protocol }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${h.tickets[1].id}$`))
  await h.firstApi.dispose()
  await h.secondApi.dispose()
})

test('o chamado encerrado entra na lista aberta, sem recarregar', async ({ page, baseURL }) => {
  const h = await seedHistory(baseURL!)
  await openList(page, h.origin.supervisor, userPassword)
  await expect(bodyRows(page)).toHaveCount(4)

  const ticket = await queued(h.firstApi, h.origin.sector.id, h.openPerson.name)
  ok(await h.firstApi.post(`/api/tickets/${ticket.id}/assign`))
  await expect(bodyRows(page)).toHaveCount(4)
  ok(
    await h.firstApi.post(`/api/tickets/${ticket.id}/close`, {
      data: {
        subject: 'Novo assunto',
        resolution: 'Resolvido.',
        moduleIds: [h.modules[0].id],
        organizationId: h.organizations[0].id,
      },
    }),
  )
  await expect(bodyRows(page)).toHaveCount(5)
  await expect(bodyRows(page).first()).toContainText(h.openPerson.name)
  await expect(bodyRows(page).first()).toContainText('Novo assunto')
  await h.firstApi.dispose()
  await h.secondApi.dispose()
})

test('a imagem do chamado encerrado também abre ampliada em /atendimentos/:id', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const [organization] = await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name: `Rita ${id}`, phone, organization: 0, sector: sector.id }],
  )
  const admins = await adminApi(baseURL!)
  ok(await admins.post(`/api/sectors/${sector.id}/connection`))
  ok(await admins.post(`/api/test/messaging/sectors/${sector.id}/pair`))
  const sectorModule = await json<{ id: number }>(
    await admins.post(`/api/sectors/${sector.id}/modules`, { data: { name: 'Folha' } }),
  )
  ok(
    await admins.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: {
        externalMessageId: `E2E-${id}`,
        phone,
        contactName: `Rita ${id}`,
        type: 'image',
        body: 'Foto do recibo',
        // PNG de 1×1 pixel, para a imagem carregar de verdade.
        media: {
          data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          mimeType: 'image/png',
        },
      },
    }),
  )
  await admins.dispose()
  const agents = await agentApi(baseURL!, agent)
  const ticket = await queued(agents, sector.id, `Rita ${id}`)
  ok(await agents.post(`/api/tickets/${ticket.id}/assign`))
  ok(
    await agents.post(`/api/tickets/${ticket.id}/close`, {
      data: {
        subject: 'Recibo',
        resolution: 'Resolvido.',
        moduleIds: [sectorModule.id],
        organizationId: organization.id,
      },
    }),
  )
  await agents.dispose()

  await login(page, agent, userPassword)
  await expect(page).not.toHaveURL(/\/login$/)
  await page.goto(`/atendimentos/${ticket.id}`)
  await expect(page.getByRole('status', { name: 'Só leitura' })).toBeVisible()
  await page.getByRole('button', { name: 'Ampliar imagem' }).click()
  const viewer = page.getByRole('dialog', { name: 'Imagem ampliada' })
  await expect(viewer).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ticket.id}$`))
  await viewer.getByRole('button', { name: 'Aumentar zoom' }).click()
  await expect(viewer.getByLabel('Zoom atual')).toHaveText('150%')
  await page.keyboard.press('Escape')
  await expect(viewer).toBeHidden()
})

test('etapa transferida sem formulário aparece com Transferido e o destino, sem assunto e módulos', async ({
  page,
  baseURL,
}) => {
  const { contact, origin, destination } = await seedTransferredTicket(baseURL!)
  await openList(page, origin.agent, userPassword)

  // A linha traz a situação e o setor de destino; assunto e módulos ficam vazios.
  await expect(bodyRows(page)).toHaveCount(1)
  const row = bodyRows(page).first()
  await expect(row).toContainText(contact)
  await expect(row).toContainText('Transferido')
  await expect(row).toContainText(`para ${destination.sector.name}`)
  const cells = row.getByRole('cell')
  await expect(cells.nth(5)).toHaveText('—')
  await expect(cells.nth(6)).toHaveText('—')

  // Os filtros de assunto e de módulo não encontram a etapa.
  await page.getByRole('combobox', { name: 'Assunto' }).fill('folha')
  await page.keyboard.press('Escape')
  await expect(bodyRows(page).filter({ hasText: contact })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Assunto' }).fill('')
  await page.keyboard.press('Escape')
  await expect(bodyRows(page).filter({ hasText: contact })).toHaveCount(1)
  await page.getByRole('combobox', { name: 'Módulo' }).fill('folha')
  await page.keyboard.press('Escape')
  await expect(bodyRows(page).filter({ hasText: contact })).toHaveCount(0)
})
