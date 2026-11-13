// PROTÓTIPO #160 — descartável, não vai para a main.
// Plano: três versões da nova seção "Fila" e "Em atendimento" do Dashboard (/dashboard),
// trocadas por ?variant=A|B|C, na própria rota do Dashboard.
// API falsa em memória, só em desenvolvimento: dados fictícios para as capturas
// (o repositório é público). Nada é gravado; recarregar a página zera tudo.
// ?as=supervisor mostra a visão da supervisora (padrão: administrador).

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()

const asSupervisor = () => new URLSearchParams(window.location.search).get('as') === 'supervisor'

const admin = { id: 1, name: 'Paula Admin', email: 'paula@exemplo.test', role: 'admin', sectorId: null }
const supervisor = {
  id: 2,
  name: 'Marina Teste',
  email: 'marina@exemplo.test',
  role: 'supervisor',
  sectorId: 1,
}

const sectors = [
  { id: 1, name: 'Suporte Sistemas' },
  { id: 2, name: 'Tributos Municipais' },
]
const sectorById = (id: number) => sectors.find((s) => s.id === id)!

const people = [
  { id: 2, name: 'Marina Teste', sectorId: 1 },
  { id: 3, name: 'Carlos Exemplo', sectorId: 1 },
  { id: 4, name: 'Beatriz Fictícia', sectorId: 1 },
  { id: 5, name: 'Rafael Demo', sectorId: 2 },
  { id: 6, name: 'Lúcia Amostra', sectorId: 2 },
]
const person = (id: number) => {
  const p = people.find((x) => x.id === id)!
  return { id: p.id, name: p.name }
}

type Row = {
  id: number
  sectorId: number
  organizationId: number
  status: 'queued' | 'in_progress'
  contact: string
  org: string
  mun: string
  arrived: number
  assigned?: number
  assigneeId?: number
  last: string
  lastOrigin: 'customer' | 'agent'
  lastAgo: number
}

let rows: Row[] = [
  { id: 201, sectorId: 1, organizationId: 31, status: 'queued', contact: 'João da Silva Exemplo', org: 'Prefeitura de Vila Fictícia', mun: 'Vila Fictícia', arrived: 27, last: 'Bom dia, não consigo emitir a certidão negativa pelo portal.', lastOrigin: 'customer', lastAgo: 26 },
  { id: 202, sectorId: 2, organizationId: 32, status: 'queued', contact: 'Ana Pereira Teste', org: 'Câmara de Monte Imaginário', mun: 'Monte Imaginário', arrived: 18, last: 'A guia do ISS está vindo com o valor errado.', lastOrigin: 'customer', lastAgo: 17 },
  { id: 203, sectorId: 1, organizationId: 33, status: 'queued', contact: 'Pedro Amostra', org: 'Secretaria de Saúde de Rio Inventado', mun: 'Rio Inventado', arrived: 9, last: 'Imagem', lastOrigin: 'customer', lastAgo: 9 },
  { id: 204, sectorId: 1, organizationId: 31, status: 'queued', contact: 'Fernanda Lima Demo', org: 'Prefeitura de Vila Fictícia', mun: 'Vila Fictícia', arrived: 3, last: 'Olá, o contracheque de outubro não aparece.', lastOrigin: 'customer', lastAgo: 3 },
  { id: 211, sectorId: 1, organizationId: 34, status: 'in_progress', contact: 'Roberto Fictício', org: 'Prefeitura de Serra Modelo', mun: 'Serra Modelo', arrived: 64, assigned: 58, assigneeId: 3, last: 'Pode tentar de novo agora, por favor?', lastOrigin: 'agent', lastAgo: 4 },
  { id: 212, sectorId: 1, organizationId: 33, status: 'in_progress', contact: 'Cláudia Exemplo', org: 'Secretaria de Saúde de Rio Inventado', mun: 'Rio Inventado', arrived: 41, assigned: 35, assigneeId: 2, last: 'Funcionou, obrigada!', lastOrigin: 'customer', lastAgo: 1 },
  { id: 213, sectorId: 2, organizationId: 32, status: 'in_progress', contact: 'Marcos Teste', org: 'Câmara de Monte Imaginário', mun: 'Monte Imaginário', arrived: 52, assigned: 50, assigneeId: 5, last: 'Vou verificar o lançamento e já retorno.', lastOrigin: 'agent', lastAgo: 12 },
  { id: 214, sectorId: 1, organizationId: 35, status: 'in_progress', contact: 'Sandra Modelo', org: 'Autarquia de Águas de Lago Falso', mun: 'Lago Falso', arrived: 22, assigned: 20, assigneeId: 4, last: 'Documento', lastOrigin: 'customer', lastAgo: 6 },
  { id: 215, sectorId: 2, organizationId: 36, status: 'in_progress', contact: 'Tiago Demonstração', org: 'Prefeitura de Campo Ilustrativo', mun: 'Campo Ilustrativo', arrived: 15, assigned: 11, assigneeId: 6, last: 'Qual é o número da inscrição municipal?', lastOrigin: 'agent', lastAgo: 2 },
]

function summary(r: Row) {
  return {
    id: r.id,
    protocol: `2026.11.${String(r.id).padStart(5, '0')}`,
    status: r.status,
    arrivedAt: ago(r.arrived),
    assignedAt: r.assigned ? ago(r.assigned) : null,
    contact: { id: r.id, name: r.contact, phone: '5500900000000', registered: true },
    organizationName: r.org,
    municipalityName: r.mun,
    assignee: r.assigneeId ? person(r.assigneeId) : null,
    lastMessage: {
      type: r.last === 'Imagem' ? 'image' : r.last === 'Documento' ? 'document' : 'text',
      body: r.last === 'Imagem' || r.last === 'Documento' ? null : r.last,
      origin: r.lastOrigin,
      sentAt: ago(r.lastAgo),
    },
    sector: sectorById(r.sectorId),
  }
}

const n = (value: number | null, applicable = true) => ({ applicable, value: applicable ? value : null })

function dashboard(q: URLSearchParams) {
  const sectorId = q.get('sectorId') ? Number(q.get('sectorId')) : asSupervisor() ? 1 : null
  const moduleOn = q.has('moduleId')
  const inSector = (r: Row) => sectorId === null || r.sectorId === sectorId
  const queued = rows.filter((r) => r.status === 'queued' && inSector(r)).length
  const inProgress = rows.filter((r) => r.status === 'in_progress' && inSector(r)).length
  const assignees = people
    .filter((p) => sectorId === null || p.sectorId === sectorId)
    .map((p, i) => ({
      user: { id: p.id, name: p.name },
      sector: sectorById(p.sectorId),
      inProgress: n(rows.filter((r) => r.status === 'in_progress' && r.assigneeId === p.id).length, !moduleOn),
      started: n(6 + i * 2),
      resolved: n(5 + i),
      transferred: n(i % 2),
      cancelled: n(i === 2 ? 1 : 0),
      averageHandlingSeconds: n(900 + i * 240),
    }))
  return {
    period: { from: '2026-11-13', to: '2026-11-13' },
    sectorId,
    numbers: {
      queued: n(queued, !moduleOn),
      inProgress: n(inProgress, !moduleOn),
      received: n(sectorId ? 31 : 48),
      started: n(sectorId ? 27 : 42),
      resolved: n(sectorId ? 22 : 35),
      transferred: n(2),
      cancelled: n(1),
      averageWaitSeconds: n(430),
      averageHandlingSeconds: n(1260),
    },
    assignees,
  }
}

// Listas novas do Dashboard: fila (setor e órgão) e em atendimento (setor, responsável
// atual e órgão). Período e módulo não as filtram.
function dashboardTickets(q: URLSearchParams) {
  const sectorId = q.get('sectorId') ? Number(q.get('sectorId')) : asSupervisor() ? 1 : null
  const assigneeId = q.get('assigneeId') ? Number(q.get('assigneeId')) : null
  const organizationId = q.get('organizationId') ? Number(q.get('organizationId')) : null
  const base = rows.filter(
    (r) =>
      (sectorId === null || r.sectorId === sectorId) &&
      (organizationId === null || r.organizationId === organizationId),
  )
  return {
    queued: base
      .filter((r) => r.status === 'queued')
      .sort((a, b) => b.arrived - a.arrived)
      .map(summary),
    inProgress: base
      .filter((r) => r.status === 'in_progress' && (assigneeId === null || r.assigneeId === assigneeId))
      .sort((a, b) => (b.assigned ?? 0) - (a.assigned ?? 0))
      .map(summary),
  }
}

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown } | null {
  const method = init?.method ?? 'GET'
  const [route, query = ''] = path.split('?')
  const q = new URLSearchParams(query)
  let m: RegExpMatchArray | null
  if (route === '/auth/me') return { data: asSupervisor() ? supervisor : admin }
  if (route === '/sectors')
    return {
      data: (asSupervisor() ? sectors.filter((s) => s.id === 1) : sectors).map((s) => ({
        ...s,
        email: null,
        phone: '+55 00 3000-0000',
        provider: 'fake',
        connectionStatus: 'connected',
        lastConnectedAt: ago(60),
        active: true,
      })),
    }
  if (route === '/dashboard') return { data: dashboard(q) }
  if (route === '/dashboard/tickets') return { data: dashboardTickets(q) }
  if ((m = route.match(/^\/sectors\/(\d+)\/dashboard\/assignees$/))) {
    const id = Number(m[1])
    return { data: people.filter((p) => p.sectorId === id).map((p) => ({ id: p.id, name: p.name, active: true })) }
  }
  if ((m = route.match(/^\/sectors\/(\d+)\/modules$/)))
    return {
      data: [
        { id: 1, sectorId: Number(m[1]), name: 'Tributos', active: true },
        { id: 2, sectorId: Number(m[1]), name: 'Folha de pagamento', active: true },
      ],
    }
  if ((m = route.match(/^\/tickets\/(\d+)\/assign$/)) && method === 'POST') {
    const id = Number(m[1])
    const me = asSupervisor() ? supervisor : admin
    rows = rows.map((r) =>
      r.id === id ? { ...r, status: 'in_progress', assigned: 0, assigneeId: me.id === 1 ? 3 : me.id } : r,
    )
    return { data: undefined }
  }
  if (route === '/organizations')
    return {
      data: {
        items: [
          { id: 31, name: 'Prefeitura de Vila Fictícia', cnpj: null, municipality: { id: 1, name: 'Vila Fictícia' } },
          { id: 32, name: 'Câmara de Monte Imaginário', cnpj: null, municipality: { id: 2, name: 'Monte Imaginário' } },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      },
    }
  return { data: method === 'GET' ? [] : undefined }
}
