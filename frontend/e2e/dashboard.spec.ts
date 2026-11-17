import { expect, request as apiRequest, test, type Locator, type Page } from '@playwright/test'
import {
  admin,
  defaultMunicipality,
  formatCnpj,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  uniqueCnpj,
  userPassword,
} from './fixtures'

type Sector = { id: number; name: string }

const notApplicable = 'Não se aplica ao filtro'

const kpi = (page: Page, label: string) => page.getByRole('group', { name: label, exact: true })

async function expectKpi(page: Page, label: string, value: string) {
  await expect(kpi(page, label).locator('.kpi-value')).toHaveText(value)
}

async function choose(page: Page, label: string, option: string | RegExp) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option }).click()
}

async function adminApi(baseURL: string) {
  const api = await apiRequest.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect(login.ok()).toBeTruthy()
  return api
}

async function receive(baseURL: string, sectorId: number, contactName: string, phone?: string) {
  const api = await apiRequest.newContext({ baseURL })
  const response = await api.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
    data: {
      externalMessageId: `E2E-${unique().id}`,
      phone: phone ?? unique().phone,
      contactName,
      body: 'Bom dia',
    },
  })
  expect(response.ok()).toBeTruthy()
  await api.dispose()
}

// Assume o chamado mais recente que está na fila, pela API, como o usuário informado.
async function assignNext(baseURL: string, sectorId: number, email: string) {
  const api = await apiRequest.newContext({ baseURL })
  const login = await api.post('/api/auth/login', { data: { email, password: userPassword } })
  expect(login.ok()).toBeTruthy()
  const tickets = (await (await api.get(`/api/sectors/${sectorId}/tickets`)).json()) as {
    id: number
    status: string
  }[]
  const ticket = tickets.find((item) => item.status === 'queued')!
  expect((await api.post(`/api/tickets/${ticket.id}/assign`)).ok()).toBeTruthy()
  return { api, ticketId: ticket.id }
}

async function assignAndClose(
  baseURL: string,
  sectorId: number,
  email: string,
  closing: { moduleId: number; organizationId: number },
) {
  const { api, ticketId } = await assignNext(baseURL, sectorId, email)
  const closed = await api.post(`/api/tickets/${ticketId}/close`, {
    data: {
      subject: 'Contracheque',
      resolution: 'Enviada a segunda via.',
      moduleIds: [closing.moduleId],
      organizationId: closing.organizationId,
    },
  })
  expect(closed.ok(), await closed.text()).toBeTruthy()
  await api.dispose()
}

async function createModule(baseURL: string, sector: Sector, name: string) {
  const api = await adminApi(baseURL)
  const response = await api.post(`/api/sectors/${sector.id}/modules`, { data: { name } })
  expect(response.ok()).toBeTruthy()
  const module = (await response.json()) as { id: number; name: string }
  await api.dispose()
  return module
}

// Nome do atendente criado por seedSector, a partir do e-mail (`agent.<id>@e2e.test`).
const nameOf = (email: string) => email.replace(/^(\w+)\.(\d+)@.*$/, '$1 $2')

// Sessão pela API como o usuário informado.
async function sessionOf(baseURL: string, email: string) {
  const api = await apiRequest.newContext({ baseURL })
  const login = await api.post('/api/auth/login', { data: { email, password: userPassword } })
  expect(login.ok()).toBeTruthy()
  return api
}

type ListedTicket = { id: number; status: string; protocol: string; contact: { name: string } }

// Chamado ativo do setor com o contato informado, como o usuário o vê.
async function ticketOf(baseURL: string, sectorId: number, email: string, contactName: string) {
  const api = await sessionOf(baseURL, email)
  const tickets = (await (
    await api.get(`/api/sectors/${sectorId}/tickets`)
  ).json()) as ListedTicket[]
  await api.dispose()
  const ticket = tickets.find((item) => item.contact.name === contactName)
  expect(ticket, `chamado de ${contactName}`).toBeDefined()
  return ticket!
}

// Assume pela API, como o usuário informado, o chamado do contato indicado.
async function assignContact(baseURL: string, sectorId: number, email: string, name: string) {
  const { id } = await ticketOf(baseURL, sectorId, email, name)
  const api = await sessionOf(baseURL, email)
  expect((await api.post(`/api/tickets/${id}/assign`)).ok()).toBeTruthy()
  await api.dispose()
  return id
}

// Clique de mouse no centro do elemento. Diferente de `click({ force: true })`, o clique vai para
// o que realmente está naquele ponto da tela, como o de uma pessoa. O elemento precisa estar fora
// do link: o link esticado da linha é que recebe o clique.
async function clickOutsideLink(page: Page, target: Locator) {
  expect(await target.evaluate((element) => element.closest('a'))).toBeNull()
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
}

// Ontem, no horário de Brasília: antes de qualquer chamado criado pelo teste.
function yesterday() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const day = new Date(`${today}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

test('listas ao vivo permitem abrir e assumir chamados', async ({ page, baseURL }) => {
  const own = await seedSector(baseURL!)
  const first = `Fila ${unique().id}`
  const second = `Atendimento ${unique().id}`
  await receive(baseURL!, own.sector.id, second)
  const assigned = await assignNext(baseURL!, own.sector.id, own.agent)
  await assigned.api.dispose()
  await receive(baseURL!, own.sector.id, first)
  await signIn(page, own.supervisor, userPassword)
  await page.goto('/dashboard')
  const queue = page.getByRole('region', { name: /^Fila/ })
  const progress = page.getByRole('region', { name: /^Em atendimento/ })
  await expect(queue.getByText(first)).toBeVisible()
  await expect(progress.getByText(second)).toBeVisible()
  await progress.getByRole('link', { name: second }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+/)
  await page.goto('/dashboard')
  await queue.getByRole('button', { name: `Assumir chamado de ${first}` }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+/)
  await page.goto('/dashboard')
  await expect(queue.getByText(first)).toHaveCount(0)
  await expect(progress.getByText(first)).toBeVisible()
  const live = `Ao vivo ${unique().id}`
  await receive(baseURL!, own.sector.id, live)
  await expect(queue.getByText(live)).toBeVisible()
})

test('chamados ativos mostram protocolo e órgão, ou "Não cadastrado", na fila e em atendimento', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor, agent } = await seedSector(baseURL!)
  const { id } = unique()
  const registered = unique().phone
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura de Chamados ${id}` }],
    [{ name: 'Ana Cadastrada', phone: registered, organization: 0, sector: sector.id }],
  )
  await receive(baseURL!, sector.id, 'Ana Cadastrada', registered)
  await receive(baseURL!, sector.id, 'Bia Desconhecida')
  await receive(baseURL!, sector.id, 'Caio Desconhecido')
  await assignContact(baseURL!, sector.id, agent, 'Caio Desconhecido')
  const protocols: Record<string, string> = {}
  for (const name of ['Ana Cadastrada', 'Bia Desconhecida', 'Caio Desconhecido']) {
    protocols[name] = (await ticketOf(baseURL!, sector.id, supervisor, name)).protocol
    expect(protocols[name]).toMatch(/^\d{4}-\d{6}$/)
  }

  await signIn(page, supervisor, userPassword)
  await page.goto('/dashboard')
  const queue = page.getByRole('region', { name: /^Fila/ })
  const progress = page.getByRole('region', { name: /^Em atendimento/ })

  // Com cadastro, o órgão aparece no lugar de "Não cadastrado".
  const registeredRow = queue.getByRole('row', { name: /Ana Cadastrada/ })
  await expect(registeredRow).toContainText(protocols['Ana Cadastrada'])
  await expect(registeredRow).toContainText(`Prefeitura de Chamados ${id}`)
  await expect(registeredRow).not.toContainText('Não cadastrado')

  // Sem cadastro, a linha mostra o protocolo e "Não cadastrado", na fila e em atendimento.
  const queuedRow = queue.getByRole('row', { name: /Bia Desconhecida/ })
  await expect(queuedRow).toContainText(protocols['Bia Desconhecida'])
  await expect(queuedRow).toContainText('Não cadastrado')
  const progressRow = progress.getByRole('row', { name: /Caio Desconhecido/ })
  await expect(progressRow).toContainText(protocols['Caio Desconhecido'])
  await expect(progressRow).toContainText('Não cadastrado')
})

test('outra sessão assume chamados: responsável na linha e carga do atendente mudam sem recarregar', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor, agent } = await seedSector(baseURL!)
  const first = `Primeiro ${unique().id}`
  const second = `Segundo ${unique().id}`
  await receive(baseURL!, sector.id, first)
  await receive(baseURL!, sector.id, second)
  await signIn(page, supervisor, userPassword)
  await page.goto('/dashboard')
  const queue = page.getByRole('region', { name: /^Fila/ })
  const progress = page.getByRole('region', { name: /^Em atendimento/ })
  const table = page.getByRole('region', { name: 'Por atendente' })
  const agentName = nameOf(agent)
  const agentRow = table.getByRole('row', { name: new RegExp(`^${agentName}`) })
  // Coluna "Em atendimento" da tabela: a carga individual do atendente.
  const load = agentRow.getByRole('cell').nth(1)
  await expect(queue.getByText(first)).toBeVisible()
  await expect(queue.getByText(second)).toBeVisible()
  // Sem ninguém atendendo, o atendente ainda não tem linha na tabela.
  await expect(table.getByText('Nenhum atendente com números nestes filtros.')).toBeVisible()

  // O atendente assume o primeiro em outra sessão: a tela do supervisor muda sozinha.
  await assignContact(baseURL!, sector.id, agent, first)
  await expect(queue.getByText(first)).toHaveCount(0)
  await expect(queue.getByText(second)).toBeVisible()
  const assigned = progress.getByRole('row', { name: new RegExp(first) })
  await expect(assigned).toContainText(agentName)
  await expect(assigned).not.toContainText('Você')
  await expect(table.getByRole('columnheader').nth(1)).toHaveText('Em atendimento')
  await expect(agentRow).toHaveCount(1)
  await expect(load).toHaveText('1')

  // O segundo também: a carga acompanha cada atribuição.
  await assignContact(baseURL!, sector.id, agent, second)
  await expect(queue.getByText(second)).toHaveCount(0)
  await expect(progress.getByRole('row', { name: new RegExp(second) })).toContainText(agentName)
  await expect(load).toHaveText('2')
})

test('a linha inteira abre o chamado, por clique fora do link e por Enter, e Assumir continua assumindo', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor, agent } = await seedSector(baseURL!)
  const names = ['Ana Primeira', 'Bruno Segundo', 'Carla Terceira', 'Davi Quarto']
  for (const name of names) await receive(baseURL!, sector.id, name)
  await assignContact(baseURL!, sector.id, agent, 'Davi Quarto')
  const ids: Record<string, number> = {}
  for (const name of names) {
    ids[name] = (await ticketOf(baseURL!, sector.id, supervisor, name)).id
  }
  await signIn(page, supervisor, userPassword)
  await page.goto('/dashboard')
  const queue = page.getByRole('region', { name: /^Fila/ })
  const progress = page.getByRole('region', { name: /^Em atendimento/ })

  // Clique no protocolo e órgão, fora do nome do contato: abre o chamado da linha, sem assumir.
  await clickOutsideLink(
    page,
    queue.getByRole('row', { name: /Bruno Segundo/ }).getByText('Não cadastrado'),
  )
  await expect(page).toHaveURL(new RegExp(`/chamados/${ids['Bruno Segundo']}$`))
  await expect(page.getByRole('heading', { name: 'Bruno Segundo' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Chamado na fila.',
  )
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await page.goBack()

  // Em atendimento, o clique na célula do responsável, também fora do link, abre o chamado.
  await clickOutsideLink(
    page,
    progress
      .getByRole('row', { name: /Davi Quarto/ })
      .getByRole('cell')
      .last(),
  )
  await expect(page).toHaveURL(new RegExp(`/chamados/${ids['Davi Quarto']}$`))
  await expect(page.getByRole('heading', { name: 'Davi Quarto' })).toBeVisible()
  await page.goBack()

  // Pelo teclado, o nome do contato é um link: foco e Enter abrem o chamado.
  await queue.getByRole('link', { name: 'Carla Terceira' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`/chamados/${ids['Carla Terceira']}$`))
  await expect(page.getByRole('heading', { name: 'Carla Terceira' })).toBeVisible()
  await page.goBack()

  // O botão fica acima do link: assume de fato, em vez de só abrir.
  await queue.getByRole('button', { name: 'Assumir chamado de Ana Primeira' }).click()
  await expect(page).toHaveURL(new RegExp(`/chamados/${ids['Ana Primeira']}$`))
  await expect(page.getByRole('heading', { name: 'Ana Primeira' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
})

test('supervisor abre pelo menu, vê só o próprio setor e não tem filtro de setor', async ({
  page,
  baseURL,
}) => {
  const own = await seedSector(baseURL!)
  const other = await seedSector(baseURL!)
  await receive(baseURL!, own.sector.id, 'Ana Cliente')
  await receive(baseURL!, other.sector.id, 'Bia Cliente')
  await receive(baseURL!, other.sector.id, 'Caio Cliente')

  await signIn(page, own.supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText(own.sector.name, { exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Setor' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hoje' })).toHaveAttribute('aria-pressed', 'true')
  await expectKpi(page, 'Na fila', '1')
  await expectKpi(page, 'Recebidos', '1')

  // Outro setor no endereço não muda o que ele vê.
  await page.goto(`/dashboard?sectorId=${other.sector.id}`)
  await expectKpi(page, 'Na fila', '1')
  await expect(page.getByText(own.sector.name, { exact: true })).toBeVisible()
})

test('administrador alterna entre todos os setores e um setor; atendente e módulo dependem do setor', async ({
  page,
  baseURL,
}) => {
  const first = await seedSector(baseURL!)
  const second = await seedSector(baseURL!)
  const module = await createModule(baseURL!, first.sector, 'Folha')
  await receive(baseURL!, first.sector.id, 'Ana Cliente')
  await receive(baseURL!, first.sector.id, 'Bia Cliente')
  const assigned = await assignNext(baseURL!, first.sector.id, first.agent)
  await assigned.api.dispose()

  await signIn(page, admin.email, admin.password)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const sectorFilter = page.getByRole('combobox', { name: 'Setor' })
  const assigneeFilter = page.getByRole('combobox', { name: 'Atendente' })
  const moduleFilter = page.getByRole('combobox', { name: 'Módulo' })

  // Todos os setores: atendente e módulo desabilitados, e a tabela mostra o setor.
  await expect(sectorFilter).toHaveText(/Todos os setores/)
  await expect(assigneeFilter).toBeDisabled()
  await expect(moduleFilter).toBeDisabled()
  const table = page.getByRole('region', { name: 'Por atendente' })
  await expect(table.getByRole('columnheader', { name: 'Setor' })).toBeVisible()
  await expect(table.getByRole('row', { name: new RegExp(first.sector.name) })).toBeVisible()

  // Um setor: os números são dele, a coluna sai e os dois filtros abrem.
  await choose(page, 'Setor', first.sector.name)
  await expect(page).toHaveURL(new RegExp(`sectorId=${first.sector.id}`))
  await expectKpi(page, 'Na fila', '1')
  await expectKpi(page, 'Em atendimento', '1')
  await expect(table.getByRole('columnheader', { name: 'Setor' })).toHaveCount(0)
  await expect(table.getByRole('row', { name: /^agent / })).toBeVisible()
  await expect(assigneeFilter).toBeEnabled()
  await expect(moduleFilter).toBeEnabled()

  // Trocar de setor limpa atendente e módulo.
  await choose(page, 'Atendente', /^agent /)
  await choose(page, 'Módulo', module.name)
  await expect(page).toHaveURL(/assigneeId=.*moduleId=|moduleId=.*assigneeId=/)
  await choose(page, 'Setor', second.sector.name)
  await expect(assigneeFilter).toHaveText(/Todos os atendentes/)
  await expect(moduleFilter).toHaveText(/Todos os módulos/)
  await expect(page).not.toHaveURL(/assigneeId|moduleId/)
  await expectKpi(page, 'Na fila', '0')
  await expect(table.getByText('Nenhum atendente com números nestes filtros.')).toBeVisible()

  // Voltar a todos os setores desabilita de novo.
  await choose(page, 'Setor', 'Todos os setores')
  await expect(assigneeFilter).toBeDisabled()
  await expect(moduleFilter).toBeDisabled()
})

test('atendente não vê o item e, pelo endereço, volta a Chamados', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0)

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Chamados', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/chamados$/)
})

test('chamado novo muda "Na fila" e "Recebidos" sem recarregar', async ({ page, baseURL }) => {
  const { sector, supervisor, agent } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expectKpi(page, 'Na fila', '0')
  await expectKpi(page, 'Recebidos', '0')
  await expectKpi(page, 'Tempo médio de espera', '—')
  await expect(kpi(page, 'Tempo médio de espera')).not.toContainText(notApplicable)

  await receive(baseURL!, sector.id, 'Ana Cliente')
  await expectKpi(page, 'Na fila', '1')
  await expectKpi(page, 'Recebidos', '1')

  const assigned = await assignNext(baseURL!, sector.id, agent)
  await assigned.api.dispose()
  await expectKpi(page, 'Na fila', '0')
  await expectKpi(page, 'Em atendimento', '1')
  await expectKpi(page, 'Tempo médio de espera', 'menos de 1 min')
})

test('recarrega os números ao reconectar o tempo real', async ({ page, baseURL }) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  let reconnected = false
  let dropConnection = () => {}
  await page.routeWebSocket(/\/api\/ws$/, (socket) => {
    if (!reconnected) {
      // Primeira conexão: nenhum aviso chega à tela até ela cair.
      dropConnection = () => {
        reconnected = true
        void socket.close()
      }
      return
    }
    socket.connectToServer()
  })
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expectKpi(page, 'Na fila', '0')

  await receive(baseURL!, sector.id, 'Ana Cliente')
  await page.waitForTimeout(300)
  await expectKpi(page, 'Na fila', '0')

  dropConnection()
  await expectKpi(page, 'Na fila', '1')
})

test('filtros mudam os números, indicam o que não se aplica e sobrevivem ao recarregar', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor, agent } = await seedSector(baseURL!)
  const { id } = unique()
  const anaPhone = unique().phone
  const biaPhone = unique().phone
  const [cityHall, chamber] = await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }, { name: `Câmara ${id}` }],
    [
      { name: 'Ana Cliente', phone: anaPhone, organization: 0, sector: sector.id },
      { name: 'Bia Cliente', phone: biaPhone, organization: 1, sector: sector.id },
    ],
  )
  const payroll = await createModule(baseURL!, sector, 'Folha')
  const assets = await createModule(baseURL!, sector, 'Patrimônio')
  const api = await adminApi(baseURL!)
  const secondEmail = `agent2.${id}@e2e.test`
  const created = await api.post('/api/users', {
    data: {
      name: `Segundo ${id}`,
      email: secondEmail,
      role: 'agent',
      sectorId: sector.id,
      password: userPassword,
    },
  })
  expect(created.ok()).toBeTruthy()
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  expect((await api.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  await api.dispose()

  await receive(baseURL!, sector.id, 'Ana Cliente', anaPhone)
  await assignAndClose(baseURL!, sector.id, agent, {
    moduleId: payroll.id,
    organizationId: cityHall.id,
  })
  await receive(baseURL!, sector.id, 'Bia Cliente', biaPhone)
  await assignAndClose(baseURL!, sector.id, secondEmail, {
    moduleId: assets.id,
    organizationId: chamber.id,
  })
  await receive(baseURL!, sector.id, 'Caio Cliente')

  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const table = page.getByRole('region', { name: 'Por atendente' })
  await expectKpi(page, 'Encerrados', '2')
  await expectKpi(page, 'Recebidos', '3')
  await expectKpi(page, 'Na fila', '1')
  await expect(table.getByRole('row', { name: /^agent / })).toContainText('1')
  await expect(table.getByRole('row', { name: new RegExp(`^Segundo ${id}`) })).toContainText('1')

  // Período: "Na fila" não muda; os números do período, sim.
  await page.getByRole('button', { name: '7 dias' }).click()
  await expect(page).toHaveURL(/period=7d/)
  await expectKpi(page, 'Encerrados', '2')
  await page.getByRole('button', { name: 'Datas' }).click()
  await expect(page.getByLabel('Início')).toBeVisible()
  await page.getByLabel('Início').fill(yesterday())
  await page.getByLabel('Fim').fill(yesterday())
  await expectKpi(page, 'Encerrados', '0')
  await expectKpi(page, 'Recebidos', '0')
  await expectKpi(page, 'Na fila', '1')
  await expect(page.getByRole('region', { name: /^Fila/ }).getByText('Caio Cliente')).toBeVisible()
  await expect(page.getByText('Nenhum atendente com números nestes filtros.')).toBeVisible()

  // Início depois do fim: avisa e não consulta a API.
  await page.getByLabel('Fim').fill('2020-01-01')
  await expect(page.getByText(/Período incompleto ou invertido/)).toBeVisible()
  await page.getByRole('button', { name: 'Hoje' }).click()
  await expect(page.getByText(/Período incompleto ou invertido/)).toHaveCount(0)
  await expect(page).not.toHaveURL(/from=|period=/)
  await expectKpi(page, 'Encerrados', '2')

  // Atendente: só os dele, e "Na fila", "Recebidos" e a espera não se aplicam.
  await choose(page, 'Atendente', new RegExp(`^Segundo ${id}`))
  await expectKpi(page, 'Encerrados', '1')
  for (const label of ['Na fila', 'Recebidos', 'Tempo médio de espera']) {
    await expectKpi(page, label, '—')
    await expect(kpi(page, label)).toContainText(notApplicable)
  }
  await expect(kpi(page, 'Encerrados')).not.toContainText(notApplicable)
  await expect(table.getByRole('row')).toHaveCount(2)
  await expect(page.getByRole('region', { name: /^Fila/ }).getByText('Caio Cliente')).toBeVisible()
  await choose(page, 'Atendente', 'Todos os atendentes')
  await expectKpi(page, 'Na fila', '1')

  // Módulo: os números sem módulo não se aplicam, no card e na tabela.
  await choose(page, 'Módulo', 'Folha')
  await expectKpi(page, 'Encerrados', '1')
  for (const label of ['Na fila', 'Em atendimento', 'Recebidos', 'Iniciados', 'Cancelados']) {
    await expect(kpi(page, label)).toContainText(notApplicable)
  }
  await expect(table).toContainText(`${notApplicable}: Em atendimento, Iniciados e Cancelados.`)
  await expect(page.getByRole('region', { name: /^Fila/ }).getByText('Caio Cliente')).toBeVisible()
  await choose(page, 'Módulo', 'Todos os módulos')

  // Órgão: chamado sem órgão fica de fora.
  const organization = page.getByRole('combobox', { name: 'Órgão' })
  await organization.fill(`Prefeitura ${id}`)
  await page.getByRole('option', { name: new RegExp(`Prefeitura ${id}`) }).click()
  await expectKpi(page, 'Encerrados', '1')
  await expectKpi(page, 'Na fila', '0')
  await expect(page.getByRole('region', { name: /^Fila/ }).getByText('Caio Cliente')).toHaveCount(0)

  // Tudo junto, no endereço, sobrevive ao recarregar.
  await choose(page, 'Atendente', /^agent /)
  await choose(page, 'Módulo', 'Folha')
  await page.getByRole('button', { name: '30 dias' }).click()
  await expectKpi(page, 'Encerrados', '1')
  await page.reload()
  await expect(page.getByRole('button', { name: '30 dias' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('combobox', { name: 'Atendente' })).toHaveText(/^agent /)
  await expect(page.getByRole('combobox', { name: 'Módulo' })).toHaveText(/Folha/)
  await expect(organization).toHaveValue(new RegExp(`Prefeitura ${id}`))
  await expectKpi(page, 'Encerrados', '1')

  // Datas também sobrevivem.
  await page.getByRole('button', { name: 'Datas' }).click()
  await page.getByLabel('Início').fill(yesterday())
  await page.reload()
  await expect(page.getByRole('button', { name: 'Datas' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Início')).toHaveValue(yesterday())

  // Limpar o órgão tira o filtro do endereço.
  await page.getByRole('button', { name: 'Limpar órgão' }).click()
  await expect(page).not.toHaveURL(/organizationId/)
})

test('o seletor de órgão do filtro mostra o nome inteiro e município · CNPJ em uma lista mais larga', async ({
  page,
  baseURL,
}) => {
  const { supervisor } = await seedSector(baseURL!)
  const { id } = unique()
  const cnpj = uniqueCnpj()
  const longName = `Fundação Municipal de Amparo ao Desenvolvimento Científico, Cultural e Tecnológico ${id}`
  await seedDirectory(baseURL!, [{ name: longName, cnpj }, { name: `Sem CNPJ ${id}` }], [])
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()

  const field = page.getByRole('combobox', { name: 'Órgão' })
  await field.fill(id)
  const long = page.getByRole('option', { name: new RegExp(longName) })
  await expect(long).toBeVisible()

  // O nome aparece inteiro, quebrado em linhas e sem corte com reticências.
  const name = long.getByText(longName, { exact: true })
  await expect(name).toBeVisible()
  expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(await name.evaluate((el) => getComputedStyle(el).textOverflow)).not.toBe('ellipsis')
  // Abaixo, município · CNPJ formatado.
  await expect(long.getByText(`${defaultMunicipality} · ${formatCnpj(cnpj)}`)).toBeVisible()

  // Órgão sem CNPJ mostra só o município.
  const bare = page.getByRole('option', { name: new RegExp(`Sem CNPJ ${id}`) })
  await expect(bare.getByText(defaultMunicipality, { exact: true })).toBeVisible()
  await expect(bare).not.toContainText('·')

  // A lista é mais larga que o campo estreito, até 32rem.
  const fieldWidth = (await field.boundingBox())!.width
  const listWidth = (await page.getByRole('listbox').boundingBox())!.width
  expect(listWidth).toBeGreaterThan(fieldWidth)
  expect(listWidth).toBeLessThanOrEqual(512)
})

test('cada seção recolhe e abre, por clique e por teclado, sem afetar a outra', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await createModule(baseURL!, sector, 'Folha')
  await receive(baseURL!, sector.id, 'Ana Cliente')
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()

  const now = page.getByRole('region', { name: 'Agora', exact: true })
  const period = page.getByRole('region', { name: 'No período', exact: true })
  const table = page.getByRole('region', { name: 'Por atendente' })

  // Sem escolha salva, as duas começam abertas.
  await expect(now.getByRole('button', { name: 'Recolher Agora' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expect(period.getByRole('button', { name: 'Recolher No período' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await expectKpi(page, 'Na fila', '1')
  await expectKpi(page, 'Recebidos', '1')

  // Filtro ativo, para mostrar que recolher não mexe nele nem na tabela.
  await choose(page, 'Módulo', 'Folha')
  await page.getByRole('button', { name: '7 dias' }).click()
  await expect(page).toHaveURL(/moduleId=.*period=7d|period=7d.*moduleId=/)
  // As datas de "7 dias" mostram que a resposta com o novo período já chegou à tela.
  const detail = period.locator('p.caption.mono-num')
  await expect(detail).toContainText(' a ')
  const address = page.url()
  const tableBefore = await table.innerText()
  const dates = await detail.innerText()

  // Por clique: "Agora" recolhe e "No período" continua aberta.
  await now.getByRole('button', { name: 'Recolher Agora' }).click()
  await expect(now.getByRole('button', { name: 'Abrir Agora' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  await expect(kpi(page, 'Na fila')).toHaveCount(0)
  await expect(kpi(page, 'Em atendimento')).toHaveCount(0)
  await expect(now.getByRole('heading', { name: 'Agora' })).toBeVisible()
  await expect(kpi(page, 'Recebidos')).toBeVisible()

  // Por teclado: "No período" recolhe com Enter, mantém título e datas, e o foco fica no botão.
  await period.getByRole('button', { name: 'Recolher No período' }).focus()
  await page.keyboard.press('Enter')
  const openPeriod = period.getByRole('button', { name: 'Abrir No período' })
  await expect(openPeriod).toBeFocused()
  await expect(kpi(page, 'Recebidos')).toHaveCount(0)
  await expect(kpi(page, 'Tempo médio de atendimento')).toHaveCount(0)
  await expect(period.getByRole('heading', { name: 'No período' })).toBeVisible()
  await expect(detail).toHaveText(dates)

  // Recolher não mudou filtros nem tabela.
  expect(page.url()).toBe(address)
  await expect(page.getByRole('combobox', { name: 'Módulo' })).toHaveText(/Folha/)
  await expect(page.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true')
  expect(await table.innerText()).toBe(tableBefore)

  // A escolha sobrevive ao recarregar.
  await page.reload()
  await expect(now.getByRole('button', { name: 'Abrir Agora' })).toBeVisible()
  await expect(period.getByRole('button', { name: 'Abrir No período' })).toBeVisible()
  await expect(kpi(page, 'Na fila')).toHaveCount(0)
  await expect(kpi(page, 'Recebidos')).toHaveCount(0)

  // Por teclado, com espaço, "Agora" abre sem abrir a outra.
  await now.getByRole('button', { name: 'Abrir Agora' }).focus()
  await page.keyboard.press('Space')
  await expect(now.getByRole('button', { name: 'Recolher Agora' })).toBeFocused()
  await expect(kpi(page, 'Na fila')).toBeVisible()
  await expect(kpi(page, 'Recebidos')).toHaveCount(0)

  // Por clique, "No período" abre, e aberta também sobrevive ao recarregar.
  await period.getByRole('button', { name: 'Abrir No período' }).click()
  await expect(kpi(page, 'Recebidos')).toBeVisible()
  await page.reload()
  await expect(kpi(page, 'Na fila')).toBeVisible()
  await expect(kpi(page, 'Recebidos')).toBeVisible()
})

test('sem acesso ao armazenamento, recolher vale até recarregar', async ({ page, baseURL }) => {
  const { supervisor } = await seedSector(baseURL!)
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('Armazenamento indisponível', 'SecurityError')
    }
    Storage.prototype.getItem = blocked
    Storage.prototype.setItem = blocked
    Storage.prototype.removeItem = blocked
  })
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()

  await page.getByRole('button', { name: 'Recolher Agora' }).click()
  await expect(kpi(page, 'Na fila')).toHaveCount(0)

  // Trocar de tela não perde a escolha.
  await page.getByRole('link', { name: 'Atendimentos' }).click()
  await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('button', { name: 'Abrir Agora' })).toBeVisible()
  await expect(kpi(page, 'Na fila')).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Recolher Agora' })).toBeVisible()
  await expect(kpi(page, 'Na fila')).toBeVisible()
})

for (const viewport of [
  { width: 375, height: 700 },
  { width: 1280, height: 800 },
]) {
  test(`com o texto "Maior", a página não rola para o lado na largura ${viewport.width}`, async ({
    browser,
    baseURL,
  }) => {
    const { sector, supervisor, agent } = await seedSector(baseURL!)
    await receive(baseURL!, sector.id, 'Ana Cliente')
    const assigned = await assignNext(baseURL!, sector.id, agent)
    await assigned.api.dispose()

    const context = await browser.newContext({ viewport })
    await context.addInitScript(() => localStorage.setItem('text-size', 'larger'))
    const page = await context.newPage()
    await signIn(page, supervisor, userPassword)
    await page.goto('/dashboard?from=2026-01-01&to=2026-01-31')
    const table = page.getByRole('region', { name: 'Por atendente' })
    await expect(table.getByRole('row')).toHaveCount(2)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await context.close()
  })
}
