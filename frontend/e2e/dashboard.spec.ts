import { expect, request as apiRequest, test, type Locator, type Page } from '@playwright/test'
import {
  admin,
  adminApi,
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

// As listas ao vivo: o título do card traz a quantidade entre parênteses.
const listRegion = (page: Page, name: 'Fila' | 'Em atendimento') =>
  page.getByRole('region', { name: new RegExp(`^${name} \\(`) })

async function expectListCount(page: Page, name: 'Fila' | 'Em atendimento', value: string) {
  await expect(
    page.getByRole('region', { name: new RegExp(`^${name} \\(${value}\\)$`) }),
  ).toBeVisible()
}

// A linha "Do setor" traz Recebidos e Tempo médio de espera.
const sectorRow = (page: Page) => page.getByRole('row', { name: /^Do setor/ })

async function expectSectorNumber(page: Page, label: string, value: string) {
  await expect(sectorRow(page)).toContainText(`${label} ${value}`)
}

// Uma coluna da linha TOTAL da tabela por atendente, pelo rótulo do cabeçalho.
async function expectTotal(page: Page, label: string, value: string) {
  const table = page.getByRole('region', { name: 'Por atendente' })
  await expect(table.getByRole('columnheader', { name: label })).toBeVisible()
  const headers = await table.getByRole('columnheader').allTextContents()
  const column = headers.indexOf(label)
  expect(column, `coluna ${label}`).toBeGreaterThan(0)
  const lead = headers.includes('Setor') ? 2 : 1
  await expect(
    table
      .getByRole('row', { name: /^Total/ })
      .getByRole('cell')
      .nth(column - lead + 1),
  ).toHaveText(value)
}

async function choose(page: Page, label: string, option: string | RegExp) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option }).click()
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

// Id do contato cadastrado com o nome informado, pela busca da lista.
async function contactId(baseURL: string, name: string) {
  const api = await adminApi(baseURL)
  const response = await api.get(`/api/contacts?q=${encodeURIComponent(name)}`)
  expect(response.ok()).toBeTruthy()
  const listed = (await response.json()) as { items: { id: number; name: string }[] }
  await api.dispose()
  const contact = listed.items.find((item) => item.name === name)
  expect(contact, `contato ${name}`).toBeDefined()
  return contact!.id
}

// Registra um atendimento por telefone já encerrado, como a ação da API de #316.
async function registerPhone(
  baseURL: string,
  sectorId: number,
  email: string,
  data: { contact: string; organizationId: number; moduleId: number; minutes: [number, number] },
) {
  const api = await sessionOf(baseURL, email)
  const started = new Date(Date.now() - data.minutes[0] * 60_000)
  const ended = new Date(Date.now() - data.minutes[1] * 60_000)
  const response = await api.post(`/api/sectors/${sectorId}/phone-tickets`, {
    data: {
      contactId: await contactId(baseURL, data.contact),
      organizationId: data.organizationId,
      moduleIds: [data.moduleId],
      subject: 'Contracheque',
      resolution: 'Orientado por telefone.',
      startedAt: started.toISOString(),
      endedAt: ended.toISOString(),
      clientRequestId: crypto.randomUUID(),
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
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

// Inicia a conversa pela API, como a pessoa: o chamado nasce iniciado por ela, no sistema.
async function startBySystem(baseURL: string, sectorId: number, email: string, contact: number) {
  const api = await sessionOf(baseURL, email)
  const response = await api.post(`/api/sectors/${sectorId}/conversations`, {
    data: { contactId: contact, clientRequestId: crypto.randomUUID(), body: 'Bom dia' },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  await api.dispose()
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
  await expectListCount(page, 'Fila', '1')
  await expectSectorNumber(page, 'Recebidos', '1')

  // Outro setor no endereço não muda o que ele vê.
  await page.goto(`/dashboard?sectorId=${other.sector.id}`)
  await expectListCount(page, 'Fila', '1')
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
  await expectListCount(page, 'Fila', '1')
  await expectListCount(page, 'Em atendimento', '1')
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
  await expectListCount(page, 'Fila', '0')
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
  await expectListCount(page, 'Fila', '0')
  await expectSectorNumber(page, 'Recebidos', '0')
  await expectSectorNumber(page, 'Tempo médio de espera', '—')
  // Sem chamados para calcular, a média é "—", sem a indicação de filtro.
  await expect(sectorRow(page)).not.toContainText(notApplicable)

  await receive(baseURL!, sector.id, 'Ana Cliente')
  await expectListCount(page, 'Fila', '1')
  await expectSectorNumber(page, 'Recebidos', '1')

  const assigned = await assignNext(baseURL!, sector.id, agent)
  await assigned.api.dispose()
  await expectListCount(page, 'Fila', '0')
  await expectListCount(page, 'Em atendimento', '1')
  await expectSectorNumber(page, 'Tempo médio de espera', 'menos de 1 min')
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
  await expectListCount(page, 'Fila', '0')

  await receive(baseURL!, sector.id, 'Ana Cliente')
  await page.waitForTimeout(300)
  await expectListCount(page, 'Fila', '0')

  dropConnection()
  await expectListCount(page, 'Fila', '1')
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
  await expectTotal(page, 'Encerrados', '2')
  await expectSectorNumber(page, 'Recebidos', '3')
  await expectListCount(page, 'Fila', '1')
  await expect(table.getByRole('row', { name: /^agent / })).toContainText('1')
  await expect(table.getByRole('row', { name: new RegExp(`^Segundo ${id}`) })).toContainText('1')

  // Período: "Na fila" não muda; os números do período, sim.
  await page.getByRole('button', { name: '7 dias' }).click()
  await expect(page).toHaveURL(/period=7d/)
  await expectTotal(page, 'Encerrados', '2')
  await page.getByRole('button', { name: 'Datas' }).click()
  await expect(page.getByLabel('Início')).toBeVisible()
  await page.getByLabel('Início').fill(yesterday())
  await page.getByLabel('Fim').fill(yesterday())
  await expectTotal(page, 'Encerrados', '0')
  await expectSectorNumber(page, 'Recebidos', '0')
  await expectListCount(page, 'Fila', '1')
  await expect(listRegion(page, 'Fila').getByText('Caio Cliente')).toBeVisible()
  await expect(page.getByText('Nenhum atendente com números nestes filtros.')).toBeVisible()

  // Início depois do fim: avisa e não consulta a API.
  await page.getByLabel('Fim').fill('2020-01-01')
  await expect(page.getByText(/Período incompleto ou invertido/)).toBeVisible()
  await page.getByRole('button', { name: 'Hoje' }).click()
  await expect(page.getByText(/Período incompleto ou invertido/)).toHaveCount(0)
  await expect(page).not.toHaveURL(/from=|period=/)
  await expectTotal(page, 'Encerrados', '2')

  // Atendente: só os dele, e "Recebidos" e a espera não se aplicam.
  await choose(page, 'Atendente', new RegExp(`^Segundo ${id}`))
  await expectTotal(page, 'Encerrados', '1')
  for (const label of ['Recebidos', 'Tempo médio de espera']) {
    await expectSectorNumber(page, label, '—')
    await expect(sectorRow(page)).toContainText(notApplicable)
  }
  await expectTotal(page, 'Encerrados', '1')
  await expect(
    table
      .getByRole('row', { name: /^Total/ })
      .getByRole('cell')
      .last(),
  ).not.toContainText(notApplicable)
  await expect(table.getByRole('row')).toHaveCount(4)
  // A lista Fila não filtra por atendente: mostra a fila do setor, como antes.
  await expectListCount(page, 'Fila', '1')
  await expect(listRegion(page, 'Fila').getByText('Caio Cliente')).toBeVisible()
  await choose(page, 'Atendente', 'Todos os atendentes')
  await expectListCount(page, 'Fila', '1')

  // Módulo: os números sem módulo não se aplicam, no total e na tabela.
  await choose(page, 'Módulo', 'Folha')
  await expectTotal(page, 'Encerrados', '1')
  await expectTotal(page, 'Em atendimento', `— ${notApplicable}`)
  await expectTotal(page, 'Iniciados', `— ${notApplicable}`)
  for (const label of ['Em atendimento', 'Iniciados', 'Cancelados']) {
    await expect(table.getByText(new RegExp(`^${notApplicable}: `))).toContainText(label)
  }
  await expect(listRegion(page, 'Fila').getByText('Caio Cliente')).toBeVisible()
  await choose(page, 'Módulo', 'Todos os módulos')

  // Órgão: chamado sem órgão fica de fora.
  const organization = page.getByRole('combobox', { name: 'Órgão' })
  await organization.fill(`Prefeitura ${id}`)
  await page.getByRole('option', { name: new RegExp(`Prefeitura ${id}`) }).click()
  await expectTotal(page, 'Encerrados', '1')
  await expectListCount(page, 'Fila', '0')
  await expect(listRegion(page, 'Fila').getByText('Caio Cliente')).toHaveCount(0)

  // Tudo junto, no endereço, sobrevive ao recarregar.
  await choose(page, 'Atendente', /^agent /)
  await choose(page, 'Módulo', 'Folha')
  await page.getByRole('button', { name: '30 dias' }).click()
  await expectTotal(page, 'Encerrados', '1')
  await page.reload()
  await expect(page.getByRole('button', { name: '30 dias' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('combobox', { name: 'Atendente' })).toHaveText(/^agent /)
  await expect(page.getByRole('combobox', { name: 'Módulo' })).toHaveText(/Folha/)
  await expect(organization).toHaveValue(new RegExp(`Prefeitura ${id}`))
  await expectTotal(page, 'Encerrados', '1')

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

test('o filtro Canal separa WhatsApp de Telefone e não se aplica aos números da fila', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor, agent } = await seedSector(baseURL!)
  const { id } = unique()
  const anaPhone = unique().phone
  const ana = `Ana ${id}`
  const bia = `Bia ${id}`
  const caio = `Caio ${id}`
  const [cityHall] = await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [
      { name: ana, phone: anaPhone, organization: 0, sector: sector.id },
      { name: bia, phone: unique().phone, organization: 0, sector: sector.id },
    ],
  )
  const payroll = await createModule(baseURL!, sector, 'Folha')
  await receive(baseURL!, sector.id, ana, anaPhone)
  await assignAndClose(baseURL!, sector.id, agent, {
    moduleId: payroll.id,
    organizationId: cityHall.id,
  })
  await receive(baseURL!, sector.id, caio)
  await registerPhone(baseURL!, sector.id, agent, {
    contact: bia,
    organizationId: cityHall.id,
    moduleId: payroll.id,
    minutes: [40, 25],
  })

  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const table = page.getByRole('region', { name: 'Por atendente' })
  const queue = listRegion(page, 'Fila')
  await expect(page.getByRole('combobox', { name: 'Canal' })).toHaveText(/Todos os canais/)
  await expectTotal(page, 'Encerrados', '2')
  await expectSectorNumber(page, 'Recebidos', '2')
  await expectListCount(page, 'Fila', '1')

  // Telefone: só o registro por telefone conta, do início ao fim da ligação.
  await choose(page, 'Canal', 'Telefone')
  await expect(page).toHaveURL(/channel=phone/)
  await expectTotal(page, 'Encerrados', '1')
  await expectTotal(page, 'Transferidos', '0')
  await expectTotal(page, 'Cancelados', '0')
  await expectTotal(page, 'Tempo médio de atendimento', '15 min')
  for (const label of ['Em atendimento', 'Iniciados']) {
    await expectTotal(page, label, `— ${notApplicable}`)
  }
  for (const label of ['Recebidos', 'Tempo médio de espera']) {
    await expectSectorNumber(page, label, '—')
  }
  await expect(sectorRow(page)).toContainText(notApplicable)
  // As listas ao vivo continuam como estão: o canal não vale para elas.
  await expect(queue.getByText(caio)).toBeVisible()

  // Só quem tem registro por telefone aparece, com zero no lugar de "—" onde o canal vale.
  await expect(table.getByRole('row')).toHaveCount(4)
  const row = table.getByRole('row', { name: new RegExp(`^${nameOf(agent)}`) })
  const cells = row.getByRole('cell')
  await expect(cells.nth(1)).toHaveText(`— ${notApplicable}`)
  await expect(cells.nth(2)).toHaveText(`— ${notApplicable}`)
  await expect(cells.nth(3)).toHaveText('1')
  await expect(cells.nth(4)).toHaveText('0')
  await expect(cells.nth(5)).toHaveText('0')
  await expect(cells.nth(6)).toHaveText('15 min')
  await expect(table.getByText(new RegExp(`^${notApplicable}: `))).toContainText(
    'Em atendimento, Iniciados, Recebidos e Tempo médio de espera.',
  )

  // WhatsApp: o registro por telefone fica de fora, e os encerrados são só do WhatsApp.
  await choose(page, 'Canal', 'WhatsApp')
  await expect(page).toHaveURL(/channel=whatsapp/)
  await expectTotal(page, 'Encerrados', '1')
  await expectTotal(page, 'Transferidos', '0')
  await expectTotal(page, 'Cancelados', '0')
  await expectTotal(page, 'Tempo médio de atendimento', 'menos de 1 min')
  await expect(sectorRow(page)).toContainText(notApplicable)
  await expect(row.getByRole('cell').nth(3)).toHaveText('1')

  // O filtro fica no endereço e sobrevive ao recarregar.
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Canal' })).toHaveText(/WhatsApp/)
  await expectTotal(page, 'Encerrados', '1')

  // Todos os canais: os dois encerrados somam de novo.
  await choose(page, 'Canal', 'Todos os canais')
  await expect(page).not.toHaveURL(/channel=/)
  await expectTotal(page, 'Encerrados', '2')
  await expectListCount(page, 'Fila', '1')
  await expect(sectorRow(page)).not.toContainText(notApplicable)
  await expect(table).not.toContainText(notApplicable)
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
  await expectListCount(page, 'Fila', '1')
  await expectListCount(page, 'Em atendimento', '0')
  await expectSectorNumber(page, 'Recebidos', '1')

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
  await expect(listRegion(page, 'Fila')).toHaveCount(0)
  await expect(listRegion(page, 'Em atendimento')).toHaveCount(0)
  await expect(now.getByRole('heading', { name: 'Agora' })).toBeVisible()
  await expect(sectorRow(page)).toBeVisible()
  // Recolher "Agora" não mudou filtros nem tabela.
  expect(page.url()).toBe(address)
  await expect(page.getByRole('combobox', { name: 'Módulo' })).toHaveText(/Folha/)
  await expect(page.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true')
  expect(await table.innerText()).toBe(tableBefore)

  // Por teclado: "No período" recolhe com Enter, mantém título e datas, e o foco fica no botão.
  await period.getByRole('button', { name: 'Recolher No período' }).focus()
  await page.keyboard.press('Enter')
  const openPeriod = period.getByRole('button', { name: 'Abrir No período' })
  await expect(openPeriod).toBeFocused()
  await expect(sectorRow(page)).toHaveCount(0)
  await expect(table).toHaveCount(0)
  await expect(period.getByRole('heading', { name: 'No período' })).toBeVisible()
  await expect(detail).toHaveText(dates)

  expect(page.url()).toBe(address)

  // A escolha sobrevive ao recarregar.
  await page.reload()
  await expect(now.getByRole('button', { name: 'Abrir Agora' })).toBeVisible()
  await expect(period.getByRole('button', { name: 'Abrir No período' })).toBeVisible()
  await expect(listRegion(page, 'Fila')).toHaveCount(0)
  await expect(table).toHaveCount(0)

  // Por teclado, com espaço, "Agora" abre sem abrir a outra.
  await now.getByRole('button', { name: 'Abrir Agora' }).focus()
  await page.keyboard.press('Space')
  await expect(now.getByRole('button', { name: 'Recolher Agora' })).toBeFocused()
  await expect(listRegion(page, 'Fila')).toBeVisible()
  await expect(table).toHaveCount(0)

  // Por clique, "No período" abre, e aberta também sobrevive ao recarregar.
  await period.getByRole('button', { name: 'Abrir No período' }).click()
  await expect(table).toBeVisible()
  await page.reload()
  await expect(listRegion(page, 'Fila')).toBeVisible()
  await expect(table).toBeVisible()
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
  await expect(listRegion(page, 'Fila')).toHaveCount(0)

  // Trocar de tela não perde a escolha.
  await page.getByRole('link', { name: 'Atendimentos' }).click()
  await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('button', { name: 'Abrir Agora' })).toBeVisible()
  await expect(listRegion(page, 'Fila')).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Recolher Agora' })).toBeVisible()
  await expect(listRegion(page, 'Fila')).toBeVisible()
})

test('Fila e Em atendimento paginam de 5 em 5, os mais recentes primeiro e com a altura fixa', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor, agent } = await seedSector(baseURL!)
  const { id } = unique()
  const names = Array.from({ length: 7 }, (_, index) => `Fila Pag ${id} ${index + 1}`)
  for (const name of names) await receive(baseURL!, sector.id, name)

  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const queue = listRegion(page, 'Fila')
  await expect(queue).toHaveAccessibleName(/^Fila \(7\)$/)
  // A primeira página tem os 5 mais recentes, do mais novo para o mais antigo.
  await expect(queue.getByRole('row')).toHaveCount(5)
  for (const [index, name] of names.slice().reverse().slice(0, 5).entries()) {
    await expect(queue.getByRole('row').nth(index)).toContainText(name)
  }
  await expect(queue.getByText(names[1])).toHaveCount(0)
  const firstHeight = (await queue.boundingBox())!.height

  // A segunda página tem os 2 mais antigos, e a lista mantém a mesma altura.
  await queue.getByRole('button', { name: 'Próxima' }).click()
  await expect(queue.getByRole('row')).toHaveCount(2)
  await expect(queue.getByRole('row').nth(0)).toContainText(names[1])
  await expect(queue.getByRole('row').nth(1)).toContainText(names[0])
  expect((await queue.boundingBox())!.height).toBe(firstHeight)
  // Cada lista pagina sozinha: a Fila muda de página sem mexer em Em atendimento.
  await expect(listRegion(page, 'Em atendimento')).toHaveAccessibleName(/^Em atendimento \(0\)$/)

  // A página fica no endereço, com parâmetro próprio (regra 9 de interface.md):
  // recarregar e sair para um chamado e voltar devolvem a mesma página.
  await expect(page).toHaveURL(/[?&]paginaFila=2(&|$)/)
  await expect(page).not.toHaveURL(/paginaAtendimento/)
  await page.reload()
  await expect(queue.getByRole('row')).toHaveCount(2)
  await queue.getByRole('link').first().click()
  await expect(page).toHaveURL(/\/chamados\/\d+/)
  await page.goBack()
  await expect(page).toHaveURL(/[?&]paginaFila=2(&|$)/)
  await expect(queue.getByRole('row')).toHaveCount(2)

  // Seis assumidos: Em atendimento pagina de 5 em 5, também com a altura fixa.
  for (let index = 0; index < 6; index++) {
    const assigned = await assignNext(baseURL!, sector.id, agent)
    await assigned.api.dispose()
  }
  // A fila ficou com um chamado: a página 2 deixou de existir, e o endereço se corrige.
  await expect(page).not.toHaveURL(/paginaFila/)
  await expect(queue.getByRole('row')).toHaveCount(1)
  const progress = listRegion(page, 'Em atendimento')
  await expect(progress).toHaveAccessibleName(/^Em atendimento \(6\)$/)
  await expect(progress.getByRole('row')).toHaveCount(5)
  const progressHeight = (await progress.boundingBox())!.height
  await progress.getByRole('button', { name: 'Próxima' }).click()
  await expect(progress.getByRole('row')).toHaveCount(1)
  expect((await progress.boundingBox())!.height).toBe(progressHeight)

  // A página da outra lista também sobrevive ao recarregar, sem mexer na primeira.
  await expect(page).toHaveURL(/[?&]paginaAtendimento=2(&|$)/)
  await expect(page).not.toHaveURL(/paginaFila/)
  await page.reload()
  await expect(progress.getByRole('row')).toHaveCount(1)

  // Página além da última mostra a última, e o endereço é corrigido.
  await page.goto('/dashboard?paginaFila=9&paginaAtendimento=9')
  await expect(queue.getByRole('row')).toHaveCount(1)
  await expect(progress.getByRole('row')).toHaveCount(1)
  await expect(page).not.toHaveURL(/paginaFila/)
  await expect(page).toHaveURL(/[?&]paginaAtendimento=2(&|$)/)

  // Mudar um filtro volta as duas listas à primeira página.
  await choose(page, 'Atendente', nameOf(agent))
  await expect(page).not.toHaveURL(/paginaFila|paginaAtendimento/)
  // O filtro de atendente não vale para a fila (regra 20): ela segue com o chamado do setor.
  await expect(queue.getByRole('row')).toHaveCount(1)
  await expect(progress.getByRole('row')).toHaveCount(5)
})

test('trocar um filtro volta as duas listas à primeira página, inclusive com "Agora" recolhida', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  const { id } = unique()
  for (let index = 0; index < 7; index++) {
    await receive(baseURL!, sector.id, `Filtro ${id} ${index + 1}`)
  }
  const module = await createModule(baseURL!, sector, `Módulo ${id}`)

  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const queue = listRegion(page, 'Fila')
  await expect(queue).toHaveAccessibleName(/^Fila \(7\)$/)
  await queue.getByRole('button', { name: 'Próxima' }).click()
  await expect(page).toHaveURL(/[?&]paginaFila=2(&|$)/)

  // Recolhida, a seção desmonta as listas: a limpeza não pode depender delas.
  await page.getByRole('button', { name: 'Recolher Agora' }).click()
  await expect(listRegion(page, 'Fila')).toHaveCount(0)
  // O canal não filtra as listas, mas é um filtro: muda o número, e as páginas voltam.
  await choose(page, 'Canal', 'WhatsApp')
  await expect(page).toHaveURL(/[?&]channel=whatsapp(&|$)/)
  await expect(page).not.toHaveURL(/paginaFila|paginaAtendimento/)
  await page.getByRole('button', { name: 'Abrir Agora' }).click()
  await expect(queue.getByRole('row')).toHaveCount(5)

  // Período e módulo, com a seção aberta, também limpam as duas páginas.
  await queue.getByRole('button', { name: 'Próxima' }).click()
  await expect(page).toHaveURL(/[?&]paginaFila=2(&|$)/)
  await page.getByRole('button', { name: '30 dias' }).click()
  await expect(page).toHaveURL(/[?&]period=30d(&|$)/)
  await expect(page).not.toHaveURL(/paginaFila|paginaAtendimento/)
  await queue.getByRole('button', { name: 'Próxima' }).click()
  await expect(page).toHaveURL(/[?&]paginaFila=2(&|$)/)
  await choose(page, 'Módulo', module.name)
  await expect(page).toHaveURL(new RegExp(`[?&]moduleId=${module.id}(&|$)`))
  await expect(page).not.toHaveURL(/paginaFila|paginaAtendimento/)
  await expect(queue.getByRole('row')).toHaveCount(5)
})

test('a linha TOTAL soma as linhas e a média de atendimento é a geral; "Do setor" mostra recebidos e espera', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor, agent } = await seedSector(baseURL!)
  const { id } = unique()
  const ana = `Ana ${id}`
  const bia = `Bia ${id}`
  const [cityHall] = await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [
      { name: ana, phone: unique().phone, organization: 0, sector: sector.id },
      { name: bia, phone: unique().phone, organization: 0, sector: sector.id },
    ],
  )
  const payroll = await createModule(baseURL!, sector, 'Folha')
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
  await api.dispose()
  // Dois atendimentos por telefone, com 15 e 30 minutos de atendimento.
  await registerPhone(baseURL!, sector.id, agent, {
    contact: ana,
    organizationId: cityHall.id,
    moduleId: payroll.id,
    minutes: [40, 25],
  })
  await registerPhone(baseURL!, sector.id, secondEmail, {
    contact: bia,
    organizationId: cityHall.id,
    moduleId: payroll.id,
    minutes: [50, 20],
  })
  await receive(baseURL!, sector.id, 'Caio Cliente')
  await assignContact(baseURL!, sector.id, agent, 'Caio Cliente')

  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const table = page.getByRole('region', { name: 'Por atendente' })
  const first = table.getByRole('row', { name: new RegExp(`^${nameOf(agent)}`) })
  const second = table.getByRole('row', { name: new RegExp(`^Segundo ${id}`) })
  await expect(first.getByRole('cell').nth(1)).toHaveText('1')
  await expect(first.getByRole('cell').nth(3)).toHaveText('1')
  await expect(first.getByRole('cell').nth(6)).toHaveText('15 min')
  await expect(second.getByRole('cell').nth(3)).toHaveText('1')
  await expect(second.getByRole('cell').nth(6)).toHaveText('30 min')

  // O TOTAL é a soma das linhas...
  await expectTotal(page, 'Em atendimento', '1')
  await expectTotal(page, 'Encerrados', '2')
  // ...e a média de atendimento é a geral dos dois (22,5 min), não a soma (45 min).
  await expectTotal(page, 'Tempo médio de atendimento', '22 min')

  // "Do setor": os números que não pertencem a uma pessoa, no mesmo filtro.
  await expectSectorNumber(page, 'Recebidos', '1')
  await expectSectorNumber(page, 'Tempo médio de espera', 'menos de 1 min')
})

// Abre a conversa pelo celular do setor, fora do sistema: o chamado nasce iniciado pelo
// celular, sem pessoa atribuída.
async function sendOutside(baseURL: string, sectorId: number, contactName: string, phone?: string) {
  const api = await apiRequest.newContext({ baseURL })
  const response = await api.post(`/api/test/messaging/sectors/${sectorId}/send-outside`, {
    data: {
      externalMessageId: `E2E-OUT-${unique().id}`,
      phone: phone ?? unique().phone,
      contactName,
      body: 'Bom dia',
    },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  await api.dispose()
}

test('iniciados pelo celular do setor, sem pessoa, ficam em "Sem atendente" e o Total bate', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor, agent } = await seedSector(baseURL!)
  const { id } = unique()
  const contact = `Iniciado ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name: contact, phone: unique().phone, organization: 0, sector: sector.id }],
  )
  const admins = await adminApi(baseURL!)
  expect((await admins.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  expect((await admins.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  await admins.dispose()
  // Um iniciado no sistema, pela pessoa: é o que a linha dela mostra.
  await startBySystem(baseURL!, sector.id, agent, await contactId(baseURL, contact))
  // Outro iniciado pelo celular do setor, pelo adaptador falso: conta no Total e não tem
  // linha por atendente. A resposta do Dashboard é a do backend, sem alteração.
  await sendOutside(baseURL!, sector.id, `Celular ${id}`)

  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Dashboard' }).click()
  const table = page.getByRole('region', { name: 'Por atendente' })
  await expect(
    table
      .getByRole('row', { name: new RegExp(`^${nameOf(agent)}`) })
      .getByRole('cell')
      .nth(2),
  ).toHaveText('1')

  // A linha sem pessoa mostra a diferença, para a soma das linhas bater com o Total.
  const withoutPerson = table.getByRole('row', { name: /^Sem atendente/ })
  await expect(withoutPerson.getByRole('cell').nth(1)).toHaveText('0')
  await expect(withoutPerson.getByRole('cell').nth(2)).toHaveText('1')
  await expect(withoutPerson.getByRole('cell').nth(6)).toHaveText('—')
  await expectTotal(page, 'Iniciados', '2')
  await expect(table).toContainText(
    'Sem atendente: chamados iniciados pelo celular do setor, sem pessoa atribuída.',
  )
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
    await expect(table.getByRole('row')).toHaveCount(4)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await context.close()
  })
}

test('o X da lista Fila do Dashboard pede confirmação no item e cancela sem abrir o chamado', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  const name = `Cancelar ${unique().id}`
  await receive(baseURL!, sector.id, name)
  await signIn(page, supervisor, userPassword)
  await page.goto('/dashboard')
  const queue = page.getByRole('region', { name: /^Fila/ })
  const x = queue.getByRole('button', { name: `Cancelar chamado de ${name}` })
  await expect(x).toBeVisible()

  // O clique no X não abre o chamado: a linha troca pela confirmação, com o Voltar em foco.
  await x.click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(queue).toContainText(`Cancelar o chamado de ${name}? Ele não é reaberto.`)
  await expect(queue.getByRole('button', { name: 'Voltar' })).toBeFocused()
  await expect(page.getByRole('dialog', { name: 'Cancelar chamado' })).toHaveCount(0)

  // A linha fora do X continua abrindo o chamado.
  await page.keyboard.press('Escape')
  await queue.getByRole('link', { name }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/dashboard$/)

  // "Cancelar chamado" cancela direto, sem janela e sem motivo, e a linha sai da lista.
  await x.click()
  await queue.getByRole('button', { name: 'Cancelar chamado', exact: true }).click()
  await expect(page.getByText('Chamado cancelado', { exact: true })).toBeVisible()
  await expect(queue.getByText(name)).toHaveCount(0)

  // O Assumir continua na linha, ao lado do X, e assume de fato depois da mudança.
  const assumed = `Assumir ${unique().id}`
  await receive(baseURL!, sector.id, assumed)
  const assume = queue.getByRole('button', { name: `Assumir chamado de ${assumed}` })
  await expect(assume).toBeVisible()
  await assume.click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByRole('heading', { name: assumed })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
})

// O quadro Pendentes do Dashboard: quantidade, os parados há mais tempo, o clique na linha e o
// "Ver todos" na aba Pendentes de Chamados (spec #332, #342).
const pendingBoard = (page: Page) => page.getByRole('region', { name: /^Pendentes \(/ })

// Marca o chamado do contato como pendente pela API, como o atendente informado.
async function markPendingContact(
  baseURL: string,
  sectorId: number,
  email: string,
  contact: string,
) {
  await receive(baseURL, sectorId, contact)
  const ticket = await ticketOf(baseURL, sectorId, email, contact)
  const api = await sessionOf(baseURL, email)
  expect((await api.post(`/api/tickets/${ticket.id}/assign`)).ok()).toBeTruthy()
  const pending = await api.post(`/api/tickets/${ticket.id}/pending`, {
    data: { reason: 'Aguardando o retorno do órgão' },
  })
  expect(pending.ok(), await pending.text()).toBeTruthy()
  return { ticket, api }
}

test('o quadro Pendentes mostra a quantidade e os mais antigos, abre o chamado e a aba Pendentes', async ({
  page,
  baseURL,
}) => {
  const own = await seedSector(baseURL!)
  const contact = `Pendente ${unique().id}`
  const { ticket, api } = await markPendingContact(baseURL!, own.sector.id, own.agent, contact)
  await api.dispose()
  await signIn(page, own.supervisor, userPassword)
  await page.goto('/dashboard')

  const board = pendingBoard(page)
  await expect(board).toContainText(`Pendentes (1)`)
  await expect(board).toContainText('Os 10 parados há mais tempo')
  const row = board.getByRole('row').filter({ hasText: contact })
  await expect(row).toContainText(ticket.protocol)
  await expect(row).toContainText('Aguardando o retorno do órgão')
  // A coluna "Parado há" diz há quanto tempo ele espera.
  await expect(board.getByRole('columnheader', { name: 'Parado há' })).toBeVisible()
  await expect(row.getByRole('cell').last()).toContainText(/agora|\d+ min/)

  // A linha abre o chamado pendente em Chamados.
  await board.getByRole('link', { name: contact }).click()
  await expect(page).toHaveURL(new RegExp(`/chamados/${ticket.id}$`))

  // "Ver todos" abre Chamados já na aba Pendentes, sem mudar a aba padrão.
  await page.goto('/dashboard')
  await pendingBoard(page).getByRole('link', { name: 'Ver todos' }).click()
  await expect(page).toHaveURL(/\/chamados\?aba=pendentes$/)
  const panel = page.getByRole('region', { name: 'Fila, assuntos e pendentes' })
  await expect(panel.getByRole('tab', { name: /^Pendentes/ })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(panel.getByRole('tab', { name: /^Fila/ })).toHaveAttribute('aria-selected', 'false')
})

test('sem pendentes, o quadro diz "Nenhum chamado pendente"', async ({ page, baseURL }) => {
  const own = await seedSector(baseURL!)
  await signIn(page, own.supervisor, userPassword)
  await page.goto('/dashboard')
  await expect(pendingBoard(page)).toContainText('Nenhum chamado pendente.')
})

test('o quadro Pendentes se atualiza sozinho quando outro usuário marca e retoma', async ({
  page,
  baseURL,
}) => {
  const own = await seedSector(baseURL!)
  const contact = `Ao vivo ${unique().id}`
  await signIn(page, own.supervisor, userPassword)
  await page.goto('/dashboard')
  await expect(pendingBoard(page)).toContainText('Nenhum chamado pendente.')

  // A atendente marca como pendente, sem a tela do supervisor recarregar.
  const api = await sessionOf(baseURL!, own.agent)
  await receive(baseURL!, own.sector.id, contact)
  const ticket = await ticketOf(baseURL!, own.sector.id, own.agent, contact)
  expect((await api.post(`/api/tickets/${ticket.id}/assign`)).ok()).toBeTruthy()
  expect(
    (
      await api.post(`/api/tickets/${ticket.id}/pending`, {
        data: { reason: 'Aguardando o cliente' },
      })
    ).ok(),
  ).toBeTruthy()
  await expect(pendingBoard(page)).toContainText('Pendentes (1)')
  await expect(pendingBoard(page)).toContainText(contact)

  // Retomado, ele sai do quadro.
  expect((await api.post(`/api/tickets/${ticket.id}/resume`)).ok()).toBeTruthy()
  await expect(pendingBoard(page)).toContainText('Nenhum chamado pendente.')
  await api.dispose()
})
