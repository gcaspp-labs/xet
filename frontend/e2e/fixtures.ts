import {
  type APIRequestContext,
  test as base,
  expect,
  type Locator,
  request,
  type Page,
} from '@playwright/test'

// Administrador de teste criado no banco próprio dos testes ponta a ponta.
export const admin = {
  name: 'Administrador E2E',
  email: 'admin@e2e.test',
  password: 'Senha@E2E1',
}

// Senha usada pelos usuários criados nos testes.
export const userPassword = 'Senha@Teste1'

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

// Entra e abre Chamados, o ponto de partida dos testes de atendimento.
export async function signIn(page: Page, email: string, password: string) {
  await login(page, email, password)
  await expect(page).not.toHaveURL(/\/login$/)
  await page.goto('/chamados')
  await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible()
}

// Troca de usuário: sai da página antes de limpar os cookies. Uma requisição ainda em andamento
// renovaria o cookie ao responder, e a tela de login redirecionaria o usuário anterior ao painel.
export async function clearSession(page: Page) {
  await page.goto('about:blank')
  await page.context().clearCookies()
}

// Os testes rodam em paralelo no mesmo banco: nomes, e-mails e números são únicos por teste.
export function unique() {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9)
  return { id, phone: `5511${id}` }
}

type SectorData = { id: number; name: string; phone: string | null }

// Prepara dados pela API como administrador, para testes que não são da tela de cadastro.
export async function seedSector(baseURL: string) {
  const api = await request.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect(login.ok()).toBeTruthy()
  const { id } = unique()
  const sector = await api.post('/api/sectors', { data: { name: `Setor ${id}` } })
  expect(sector.ok()).toBeTruthy()
  const data = (await sector.json()) as SectorData

  const createUser = async (role: 'agent' | 'supervisor') => {
    const email = `${role}.${id}@e2e.test`
    const response = await api.post('/api/users', {
      data: { name: `${role} ${id}`, email, role, sectorId: data.id, password: userPassword },
    })
    expect(response.ok()).toBeTruthy()
    return email
  }

  const result = {
    sector: data,
    supervisor: await createUser('supervisor'),
    agent: await createUser('agent'),
  }
  await api.dispose()
  return result
}

// Contato com um pendente e um chamado novo na fila, criados pela API: o chamado novo é o que as
// telas abrem para o aviso "Este contato tem N chamados pendentes" e a janela Retomar chamado, que
// precisam de um pendente do mesmo contato e setor (spec #332). O chamado novo fica na fila, para
// o teste decidir quando assumir.
export async function seedPendingWithNewTicket(baseURL: string) {
  const seed = await seedSector(baseURL)
  const adminApi = await request.newContext({ baseURL })
  await ok(
    await adminApi.post('/api/auth/login', {
      data: { email: admin.email, password: admin.password },
    }),
  )
  await ok(await adminApi.post(`/api/sectors/${seed.sector.id}/connection`))
  await ok(await adminApi.post(`/api/test/messaging/sectors/${seed.sector.id}/pair`))
  await adminApi.dispose()

  const api = await request.newContext({ baseURL })
  await ok(
    await api.post('/api/auth/login', { data: { email: seed.agent, password: userPassword } }),
  )
  const contact = `Cliente ${unique().id}`
  const phone = unique().phone
  const send = async (body: string) => {
    await ok(
      await api.post(`/api/test/messaging/sectors/${seed.sector.id}/receive`, {
        data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: contact, body },
      }),
    )
  }
  const queued = async () => {
    const tickets = await json<{ id: number; status: string; contact: { name: string } }[]>(
      await api.get(`/api/sectors/${seed.sector.id}/tickets`),
    )
    const found = tickets.find((item) => item.status === 'queued' && item.contact.name === contact)
    expect(found).toBeTruthy()
    return found!
  }
  await send('Preciso da nota fiscal do serviço')
  const pending = await queued()
  await ok(await api.post(`/api/tickets/${pending.id}/assign`))
  await ok(
    await api.post(`/api/tickets/${pending.id}/pending`, {
      data: { reason: 'Aguardando a nota fiscal do serviço' },
    }),
  )
  await send('Voltei com a nota fiscal')
  const ticket = await queued()
  await api.dispose()
  return { ...seed, contact, phone, pendingId: pending.id, ticketId: ticket.id }
}

// Uma resposta interceptada que chega depois do fim do teste faz o Playwright acusar
// "route.fetch: Test ended" no teste seguinte, que nem roda (#403). `unrouteAfterEach()` desliga
// as interceptações no fim de cada teste do arquivo; `unrouteRoutes` faz o mesmo para as abas
// extras, que a fixture não alcança. Só os erros dessas respostas tardias são ignorados.
export function unrouteAfterEach() {
  test.afterEach(async ({ page }) => {
    await unrouteRoutes(page)
  })
}

export async function unrouteRoutes(...pages: Page[]) {
  await Promise.all(
    pages.map((page) =>
      page.unrouteAll({ behavior: 'ignoreErrors' }).catch((error: unknown) => {
        // O teste pode ter fechado a aba antes do fim; aí não há mais rota a desligar.
        if (!String(error).includes('has been closed')) throw error
      }),
    ),
  )
}

// O banco é compartilhado entre os testes, que rodam em paralelo e deixam números desconectados.
// `onlySectors(...ids)` limita a lista de setores da página aos do teste, para a contagem do sino do
// administrador ser exata. O restante, inclusive a fila e o tempo real, continua vindo do backend.
// Um aviso em tempo real no fim do teste refaz a busca de setores, e a interceptação dessa busca
// pode continuar depois do teste, com o navegador fechando: a resposta já foi descartada ("Response
// has been disposed") ou a requisição já foi liberada ("Route is already handled"). Ao terminar, o
// teste encerra a interceptação e ignora só os erros dessas buscas tardias, que nenhuma conferência
// espera mais.
export const test = base.extend<{ onlySectors: (...ids: number[]) => Promise<void> }>({
  onlySectors: async ({ page }, provide) => {
    let routed = false
    await provide(async (...ids) => {
      routed = true
      await page.route('**/api/sectors', async (route) => {
        const response = await route.fetch()
        const sectors = (await response.json()) as SectorData[]
        await route.fulfill({ response, json: sectors.filter((s) => ids.includes(s.id)) })
      })
    })
    if (routed) {
      await unrouteRoutes(page)
    }
  },
})

declare global {
  interface Window {
    __toasts: string[]
    __socketOpen: boolean
  }
}

// Marca quando o canal de avisos em tempo real abre: o chamado que chega antes disso não gera
// aviso nenhum. Chame antes de abrir a página; vale para cada documento, inclusive depois de
// recarregar. Usado com openWhenLive.
export async function trackSocket(page: Page) {
  await page.addInitScript(() => {
    window.__socketOpen = false
    const Real = window.WebSocket
    class Tracked extends Real {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols)
        this.addEventListener('open', () => {
          window.__socketOpen = true
        })
      }
    }
    window.WebSocket = Tracked
  })
}

// Abre a página inteira (o endereço, ou recarrega sem endereço) e só volta quando, nesse documento,
// a primeira carga da fila do setor terminou e o canal de avisos abriu. Antes disso, um chamado que
// chega entra na primeira carga, que é a referência do sino e não avisa (docs/features/
// notifications.md, regra 7), e "Nenhum chamado esperando." já aparece enquanto a fila carrega.
// A espera pela fila começa depois de a navegação trocar de documento: o documento anterior também
// busca a fila (o login já leva a Chamados), e a resposta dele não serve de referência. Precisa de
// trackSocket antes.
export async function openWhenLive(page: Page, sectorId: number, url?: string) {
  if (url) {
    await page.goto(url, { waitUntil: 'commit' })
  } else {
    await page.reload({ waitUntil: 'commit' })
  }
  const queue = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname === `/api/sectors/${sectorId}/tickets`,
  )
  await (await queue).finished()
  await page.waitForFunction(() => window.__socketOpen)
}

// Os avisos (toasts) somem em 2,5 s. Com o swap cheio, o processo dos testes pode parar por mais
// tempo que isso, e o aviso some antes de ser conferido. Registra no navegador o texto de cada aviso
// que ficou visível; a função devolvida lê o registro, para o teste conferir o que apareceu sem
// precisar estar olhando na hora. Chame antes de abrir a página.
// Visível tem o mesmo critério do toBeVisible() do Playwright: caixa com tamanho e sem
// visibility:hidden nem display:none (no próprio aviso ou num ancestral). Um aviso presente no DOM
// mas oculto não entra no registro. A conferência roda a cada mudança no DOM (inclusive de atributo
// e estilo) e a cada 50 ms, para pegar também o aviso que fica visível só por uma transição de CSS.
export async function recordToasts(page: Page) {
  await page.addInitScript(() => {
    window.__toasts = []
    const check = () => {
      for (const toast of document.querySelectorAll('[data-sonner-toast]')) {
        const box = toast.getBoundingClientRect()
        const visible =
          box.width > 0 && box.height > 0 && toast.checkVisibility({ visibilityProperty: true })
        const text = toast.textContent ?? ''
        if (visible && !window.__toasts.includes(text)) {
          window.__toasts.push(text)
        }
      }
    }
    new MutationObserver(check).observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
    })
    setInterval(check, 50)
  })
  return () => page.evaluate(() => window.__toasts)
}

// Dígito verificador do CNPJ (módulo 11, cada caractere vale o código ASCII menos 48).
function cnpjCheckDigit(prefix: string) {
  let sum = 0
  let weight = 2
  for (let i = prefix.length - 1; i >= 0; i--) {
    sum += (prefix.charCodeAt(i) - 48) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const rest = sum % 11
  return rest < 2 ? '0' : String(11 - rest)
}

// CNPJ válido e único por teste; com letras, gera um CNPJ alfanumérico.
export function uniqueCnpj(alphanumeric = false) {
  const digits = unique().id.slice(-8)
  const base = alphanumeric
    ? `${digits.slice(0, 2)}AB${digits.slice(2, 6)}C${digits.slice(6)}1`
    : `${digits}0001`
  const first = cnpjCheckDigit(base)
  return base + first + cnpjCheckDigit(base + first)
}

export function formatCnpj(cnpj: string) {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}

// Define a resposta da API de CNPJ falsa para um CNPJ; sem resposta definida, ela devolve 404.
export async function fakeCnpjResponse(cnpj: string, status: number, body: unknown = {}) {
  const response = await fetch(`http://localhost:18081/responses/${cnpj}`, {
    method: 'PUT',
    body: JSON.stringify({ status, body }),
  })
  expect(response.ok).toBeTruthy()
}

type OrganizationData = {
  id: number
  name: string
  cnpj: string | null
  municipality: { id: number; name: string }
}

// Município usado pelos testes que não tratam da cidade do órgão.
export const defaultMunicipality = 'Itu'

// Id de um município carregado pela migração; o contexto precisa estar logado.
export async function municipalityId(api: APIRequestContext, name = defaultMunicipality) {
  const response = await api.get('/api/municipalities')
  expect(response.ok()).toBeTruthy()
  const municipalities = (await response.json()) as { id: number; name: string }[]
  return municipalities.find((municipality) => municipality.name === name)!.id
}

// Cadastra órgãos e contatos pela API como administrador.
export async function seedDirectory(
  baseURL: string,
  organizations: { name: string; cnpj?: string; municipality?: string }[],
  contacts: { name: string; phone: string; organization: number; sector: number }[],
) {
  const api = await request.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect(login.ok()).toBeTruthy()
  const created: OrganizationData[] = []
  for (const { municipality, ...org } of organizations) {
    const response = await api.post('/api/organizations', {
      data: { ...org, municipalityId: await municipalityId(api, municipality) },
    })
    expect(response.ok()).toBeTruthy()
    created.push((await response.json()) as OrganizationData)
  }
  for (const contact of contacts) {
    const response = await api.post('/api/contacts', {
      data: {
        name: contact.name,
        phone: contact.phone,
        organizationId: created[contact.organization].id,
        sectorIds: [contact.sector],
      },
    })
    expect(response.ok()).toBeTruthy()
  }
  await api.dispose()
  return created
}

// Janela com bloqueio (spec.md, Janelas de formulário): sem X, Esc e clique fora não fecham, o
// texto digitado continua, e o botão do rodapé fecha. Sem `field`, a janela não tem texto a digitar.
export async function expectLockedDialog(
  page: Page,
  dialog: Locator,
  { field, cancel = 'Cancelar' }: { field?: string; cancel?: string } = {},
) {
  const text = 'Texto digitado antes de tentar fechar'
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toHaveCount(0)
  if (field) {
    await dialog.getByLabel(field).fill(text)
  }
  await page.keyboard.press('Escape')
  await page.mouse.click(10, 300)
  await expect(dialog).toBeVisible()
  if (field) {
    await expect(dialog.getByLabel(field)).toHaveValue(text)
  }
  await dialog.getByRole('button', { name: cancel, exact: true }).click()
  await expect(dialog).toBeHidden()
}

// Janela com fechamento normal: X, Esc e clique fora fecham.
export async function expectClosableDialog(page: Page, dialog: Locator, open: () => Promise<void>) {
  await open()
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(dialog).toBeHidden()
  await open()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await open()
  await expect(dialog).toBeVisible()
  await page.mouse.click(10, 300)
  await expect(dialog).toBeHidden()
}

type Response = { ok(): boolean; json(): Promise<unknown> }

export const ok = (response: Response) => expect(response.ok()).toBeTruthy()

export const json = async <T>(response: Response) => {
  ok(response)
  return (await response.json()) as T
}

// Entra como administrador pela API e devolve o contexto de requisição, que o chamador encerra com
// `dispose()`.
export async function adminApi(baseURL: string) {
  const api = await request.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  return api
}

// Contato do diretório num órgão novo de Itu, ligado ao setor, cadastrado pela API como
// administrador; devolve o id do contato e o do órgão, com o nome dele.
export async function seedContact(
  baseURL: string,
  sectorId: number,
  name: string,
  phoneNumber: string,
) {
  const api = await adminApi(baseURL)
  const { id } = unique()
  const organization = await json<{ id: number; name: string }>(
    await api.post('/api/organizations', {
      data: { name: `Órgão ${id}`, municipalityId: await municipalityId(api) },
    }),
  )
  const contact = await json<{ id: number }>(
    await api.post('/api/contacts', {
      data: { name, phone: phoneNumber, organizationId: organization.id, sectorIds: [sectorId] },
    }),
  )
  await api.dispose()
  return { id: contact.id, organizationId: organization.id, organizationName: organization.name }
}

// Acha o assunto do setor pela busca da lista, percorrendo as páginas, porque ele pode estar
// depois dos primeiros vinte itens.
async function subjectId(api: APIRequestContext, sectorId: number, name: string) {
  for (let page = 1; ; page++) {
    const list = await json<{
      items: { id: number; name: string }[]
      total: number
      pageSize: number
    }>(await api.get(`/api/sectors/${sectorId}/subjects`, { params: { q: name, page } }))
    const found = list.items.find((item) => item.name === name)
    if (found) return found.id
    if (page * list.pageSize >= list.total) throw new Error(`Assunto não encontrado: ${name}`)
  }
}

// Acrescenta soluções a um assunto do setor, pela API como administrador.
export async function addSolutions(
  baseURL: string,
  sectorId: number,
  subject: string,
  bodies: string[],
) {
  const api = await adminApi(baseURL)
  const id = await subjectId(api, sectorId, subject)
  for (const body of bodies) {
    ok(await api.post(`/api/sectors/${sectorId}/subjects/${id}/solutions`, { data: { body } }))
  }
  await api.dispose()
}

// Setor com um módulo e os assuntos dados, cada um com as suas soluções, criados pela API como
// administrador.
export async function seedSubjects(
  baseURL: string,
  sectorId: number,
  list: Record<string, string[]>,
) {
  const api = await adminApi(baseURL)
  const module = await json<{ id: number }>(
    await api.post(`/api/sectors/${sectorId}/modules`, { data: { name: 'Sistema' } }),
  )
  for (const name of Object.keys(list)) {
    ok(await api.post(`/api/sectors/${sectorId}/subjects`, { data: { name, moduleId: module.id } }))
  }
  await api.dispose()
  for (const [name, bodies] of Object.entries(list)) {
    await addSolutions(baseURL, sectorId, name, bodies)
  }
}

// Atendimento de um contato cadastrado, encerrado pelo atendente pela API, e
// um segundo atendente do setor, que não encerrou.
export async function seedClosedTicket(baseURL: string) {
  const { sector, agent, supervisor } = await seedSector(baseURL)
  const { id, phone } = unique()
  const [organization] = await seedDirectory(
    baseURL,
    [{ name: `Prefeitura ${id}` }],
    [{ name: `Rita ${id}`, phone, organization: 0, sector: sector.id }],
  )

  const api = await request.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  ok(await api.post(`/api/sectors/${sector.id}/connection`))
  ok(await api.post(`/api/test/messaging/sectors/${sector.id}/pair`))
  const modules: { id: number }[] = []
  for (const name of ['Folha', 'Patrimônio']) {
    modules.push(
      await json(await api.post(`/api/sectors/${sector.id}/modules`, { data: { name } })),
    )
  }
  const otherAgent = `agent2.${id}@e2e.test`
  ok(
    await api.post('/api/users', {
      data: {
        name: `agent2 ${id}`,
        email: otherAgent,
        role: 'agent',
        sectorId: sector.id,
        password: userPassword,
      },
    }),
  )
  ok(
    await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: 'Rita', body: 'Contracheque' },
    }),
  )
  await api.dispose()

  const agentApi = await request.newContext({ baseURL })
  ok(await agentApi.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const [ticket] = await json<{ id: number }[]>(
    await agentApi.get(`/api/sectors/${sector.id}/tickets`),
  )
  ok(await agentApi.post(`/api/tickets/${ticket.id}/assign`))
  ok(
    await agentApi.post(`/api/tickets/${ticket.id}/close`, {
      data: {
        subject: 'Contracheque',
        resolution: 'Enviada a segunda via.',
        moduleIds: modules.map((module) => module.id),
        organizationId: organization.id,
      },
    }),
  )
  await agentApi.dispose()
  return { ticketId: ticket.id, agent, otherAgent, supervisor, sector, modules }
}

// Um chamado da origem transferido para outro setor pela rota `sector-transfer`, sem formulário.
export async function seedTransferredTicket(baseURL: string) {
  const origin = await seedSector(baseURL)
  const destination = await seedSector(baseURL)
  const { id, phone } = unique()
  const contact = `Lúcia ${id}`
  await seedDirectory(
    baseURL,
    [{ name: `Prefeitura ${id}` }],
    [{ name: contact, phone, organization: 0, sector: origin.sector.id }],
  )

  const api = await request.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  for (const sectorId of [origin.sector.id, destination.sector.id]) {
    ok(await api.post(`/api/sectors/${sectorId}/connection`))
    ok(await api.post(`/api/test/messaging/sectors/${sectorId}/pair`))
  }
  ok(
    await api.post(`/api/test/messaging/sectors/${origin.sector.id}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: contact, body: 'Folha de março' },
    }),
  )
  await api.dispose()

  const agentApi = await request.newContext({ baseURL })
  ok(
    await agentApi.post('/api/auth/login', {
      data: { email: origin.agent, password: userPassword },
    }),
  )
  const [ticket] = await json<{ id: number }[]>(
    await agentApi.get(`/api/sectors/${origin.sector.id}/tickets`),
  )
  ok(await agentApi.post(`/api/tickets/${ticket.id}/assign`))
  ok(
    await agentApi.post(`/api/tickets/${ticket.id}/sector-transfer`, {
      data: { sectorId: destination.sector.id },
    }),
  )
  await agentApi.dispose()
  return { ticketId: ticket.id, contact, origin, destination }
}

// Um chamado mesclado num pendente do mesmo contato e setor: as mensagens foram para o pendente e
// o mesclado fica com a situação Mesclado e o link para ele (spec #332). `resumed` usa o Retomar
// chamado a partir do chamado novo, e o pendente volta a ser atendido; sem ele, a mesclagem pela
// correção do encerrado, e o pendente fica encerrado com os dados do mesclado.
export async function seedMergedTicket(
  baseURL: string,
  { resumed = false }: { resumed?: boolean } = {},
) {
  const { sector, agent } = await seedSector(baseURL)
  const { id, phone } = unique()
  const contact = `Cliente ${id}`
  const [organization] = await seedDirectory(
    baseURL,
    [{ name: `Prefeitura ${id}` }],
    [{ name: contact, phone, organization: 0, sector: sector.id }],
  )

  const admins = await request.newContext({ baseURL })
  ok(
    await admins.post('/api/auth/login', {
      data: { email: admin.email, password: admin.password },
    }),
  )
  ok(await admins.post(`/api/sectors/${sector.id}/connection`))
  ok(await admins.post(`/api/test/messaging/sectors/${sector.id}/pair`))
  const module = await json<{ id: number }>(
    await admins.post(`/api/sectors/${sector.id}/modules`, { data: { name: 'Folha' } }),
  )
  await admins.dispose()

  const api = await request.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const receive = async (body: string) =>
    ok(
      await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: contact, body },
      }),
    )
  const queued = async () => {
    const tickets = await json<
      { id: number; protocol: string; status: string; contact: { name: string } }[]
    >(await api.get(`/api/sectors/${sector.id}/tickets`))
    const found = tickets.find(
      (ticket) => ticket.status === 'queued' && ticket.contact.name === contact,
    )
    expect(found).toBeTruthy()
    return found!
  }

  if (resumed) {
    // O pendente nasce primeiro; o chamado novo do contato, assumido, é retomado a partir dele.
    await receive('Preciso da segunda via do contracheque')
    const original = await queued()
    ok(await api.post(`/api/tickets/${original.id}/assign`))
    ok(
      await api.post(`/api/tickets/${original.id}/pending`, {
        data: { reason: 'Aguardando o cliente' },
      }),
    )
    await receive('Agora preciso do comprovante de férias')
    const merged = await queued()
    ok(await api.post(`/api/tickets/${merged.id}/assign`))
    ok(
      await api.post(`/api/tickets/${merged.id}/resume-pending`, {
        data: { pendingTicketId: original.id },
      }),
    )
    await api.dispose()
    return { sector, agent, contact, merged, original }
  }

  // O pendente nasce primeiro, com o cliente esperando. Ele volta a escrever e abre o chamado
  // novo, que o atendente assume, encerra e mescla no pendente pela correção.
  await receive('Preciso da segunda via do contracheque')
  const original = await queued()
  ok(await api.post(`/api/tickets/${original.id}/assign`))
  ok(
    await api.post(`/api/tickets/${original.id}/pending`, {
      data: { reason: 'Aguardando o cliente' },
    }),
  )
  await receive('Agora preciso do comprovante de férias')
  const merged = await queued()
  ok(await api.post(`/api/tickets/${merged.id}/assign`))
  ok(
    await api.post(`/api/tickets/${merged.id}/close`, {
      data: {
        subject: 'Segunda via',
        resolution: 'Enviada por e-mail.',
        moduleIds: [module.id],
        organizationId: organization.id,
      },
    }),
  )
  ok(
    await api.post(`/api/tickets/${merged.id}/merge-into-pending`, {
      data: { pendingTicketId: original.id },
    }),
  )
  await api.dispose()
  return { sector, agent, contact, merged, original }
}

// Um atendimento encerrado (ou cancelado) B e o pendente A do mesmo contato e setor, criados pela
// API: a ficha de B oferece a janela Mesclar em pendente, que passa as mensagens de B para A
// (spec #332, #343). `cancelled` cancela o B com o motivo, que a conversa de A mostra depois da
// mesclagem. `secondPending` deixa um segundo pendente do contato, criado também antes de B
// terminar: só os pendentes que já existiam no fim de B são as escolhas da janela (#440). Fica um
// segundo atendente do setor, que não encerrou o B e, por isso, não mescla.
export async function seedTicketToMergeIntoPending(
  baseURL: string,
  {
    cancelled = false,
    secondPending = false,
  }: { cancelled?: boolean; secondPending?: boolean } = {},
) {
  const { sector, agent } = await seedSector(baseURL)
  const { id, phone } = unique()
  const contact = `Cliente ${id}`
  const reason = 'Aguardando a nota fiscal do serviço'
  const [organization] = await seedDirectory(
    baseURL,
    [{ name: `Prefeitura ${id}` }],
    [{ name: contact, phone, organization: 0, sector: sector.id }],
  )

  const admins = await request.newContext({ baseURL })
  ok(
    await admins.post('/api/auth/login', {
      data: { email: admin.email, password: admin.password },
    }),
  )
  ok(await admins.post(`/api/sectors/${sector.id}/connection`))
  ok(await admins.post(`/api/test/messaging/sectors/${sector.id}/pair`))
  const module = await json<{ id: number }>(
    await admins.post(`/api/sectors/${sector.id}/modules`, { data: { name: 'Folha' } }),
  )
  const otherAgent = `agent2.${id}@e2e.test`
  ok(
    await admins.post('/api/users', {
      data: {
        name: `agent2 ${id}`,
        email: otherAgent,
        role: 'agent',
        sectorId: sector.id,
        password: userPassword,
      },
    }),
  )
  await admins.dispose()

  const api = await request.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const receive = async (body: string) =>
    ok(
      await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: contact, body },
      }),
    )
  const queued = async () => {
    const tickets = await json<
      { id: number; protocol: string; status: string; contact: { name: string } }[]
    >(await api.get(`/api/sectors/${sector.id}/tickets`))
    const found = tickets.find(
      (ticket) => ticket.status === 'queued' && ticket.contact.name === contact,
    )
    expect(found).toBeTruthy()
    return found!
  }

  // O pendente nasce primeiro, com o cliente esperando. Ele volta a escrever e abre o atendimento
  // novo, que o mesmo atendente assume e encerra (ou cancela) — é ele que a ficha vai mesclar.
  await receive('Preciso da segunda via do contracheque')
  const pending = await queued()
  ok(await api.post(`/api/tickets/${pending.id}/assign`))
  ok(
    await api.post(`/api/tickets/${pending.id}/pending`, {
      data: { reason },
    }),
  )
  // O segundo pendente do contato nasce antes do B terminar, para ser uma escolha válida.
  let secondPendingId: number | undefined
  if (secondPending) {
    await receive('Ainda estou esperando a nota fiscal')
    const second = await queued()
    ok(await api.post(`/api/tickets/${second.id}/assign`))
    ok(
      await api.post(`/api/tickets/${second.id}/pending`, {
        data: { reason: `${reason} (segundo)` },
      }),
    )
    secondPendingId = second.id
  }
  await receive('Voltei, o comprovante veio errado')
  const closed = await queued()
  ok(await api.post(`/api/tickets/${closed.id}/assign`))
  const cancelReason = 'Cliente desistiu do comprovante'
  if (cancelled) {
    ok(await api.post(`/api/tickets/${closed.id}/cancel`, { data: { reason: cancelReason } }))
  } else {
    ok(
      await api.post(`/api/tickets/${closed.id}/close`, {
        data: {
          subject: 'Segunda via',
          resolution: 'Enviada por e-mail.',
          moduleIds: [module.id],
          organizationId: organization.id,
        },
      }),
    )
  }
  await api.dispose()
  return {
    sector,
    agent,
    otherAgent,
    contact,
    phone,
    organization,
    module,
    pendingId: pending.id,
    secondPendingId,
    ticketId: closed.id,
    reason,
    cancelReason,
  }
}

// Abre o menu "Mais ações" (⋯) do cabeçalho de Chamados e escolhe um item.
export async function chooseAction(page: Page, name: string) {
  await page.getByRole('button', { name: 'Mais ações' }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

// O menu (⋯) entra no DOM depois do clique. Sem esperar por ele, um Esc cairia na regra da tela
// (com nada por cima, volta para Chamados) e fecharia o chamado no meio do teste. Abrir e fechar
// sempre por aqui deixa a espera num lugar só (#389).
export async function openMenuAndWait(trigger: Locator) {
  await trigger.click()
  await expect(trigger.page().getByRole('menu')).toBeVisible()
}

export async function closeMenuWithEsc(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
}

// Número do chamado de um contato que está na fila. Chamados só abre pelo endereço o chamado da
// fila que ninguém assumiu, então o teste busca o número na API da própria sessão. Sem `sectorId`,
// usa o setor da pessoa; o administrador informa o setor.
export async function queuedTicketId(page: Page, contactName: string, sectorId?: number) {
  const sectors = sectorId
    ? [sectorId]
    : [(await json<{ sectorId: number }>(await page.request.get('/api/auth/me'))).sectorId]
  let ticketId = 0
  await expect
    .poll(async () => {
      for (const id of sectors) {
        const tickets = await json<{ id: number; contact: { name: string } }[]>(
          await page.request.get(`/api/sectors/${id}/tickets`),
        )
        ticketId = tickets.find((ticket) => ticket.contact.name === contactName)?.id ?? 0
        if (ticketId) {
          return true
        }
      }
      return false
    })
    .toBe(true)
  return ticketId
}

// Abre em Chamados o chamado de um contato que está na fila, sem assumir.
export async function openQueued(page: Page, contactName: string, sectorId?: number) {
  await page.goto(`/chamados/${await queuedTicketId(page, contactName, sectorId)}`)
  await expect(page.getByRole('heading', { name: contactName })).toBeVisible()
}
