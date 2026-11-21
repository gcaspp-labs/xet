// PROTÓTIPO #223: descartável, não vai para a main.
// API falsa em memória, só em desenvolvimento: dados fictícios para as capturas
// (o repositório é público). ?as=supervisor (padrão) ou ?as=admin.
// Os números do setor seguem a tabela "Filtros" de docs/features/dashboard.md:
// com um filtro que não se aplica, o número volta com applicable: false ("—").

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()
const params = () => new URLSearchParams(window.location.search)
const role = () => params().get('as') ?? 'supervisor'

const supervisor = {
  id: 1,
  name: 'Paula Souza',
  email: 'paula.souza@exemplo.test',
  role: 'supervisor',
  sectorId: 1,
}
const admin = { ...supervisor, name: 'Paula Admin', role: 'admin', sectorId: null }
const me = () => (role() === 'admin' ? admin : supervisor)

const sector = { id: 1, name: 'Suporte Sistemas' }
const people = [
  { id: 1, name: 'Paula Souza' },
  { id: 2, name: 'Carlos Colega' },
  { id: 3, name: 'Marina Teste' },
  { id: 4, name: 'Rafael Exemplo' },
]
// [em atendimento, iniciados, encerrados, transferidos, cancelados, tempo médio (min)]
const perPerson: Record<number, number[]> = {
  1: [3, 3, 9, 1, 0, 18],
  2: [2, 1, 7, 2, 1, 24],
  3: [0, 2, 5, 0, 1, 12],
  4: [1, 0, 4, 1, 0, 31],
}

type Key = 'sector' | 'assignee' | 'module' | 'organization'
// Tabela "Filtros": quais filtros cada número aceita (setor vale para todos).
const accepts: Record<string, Key[]> = {
  queued: ['organization'],
  inProgress: ['assignee', 'organization'],
  received: ['organization'],
  started: ['assignee', 'organization'],
  resolved: ['assignee', 'module', 'organization'],
  transferred: ['assignee', 'module', 'organization'],
  cancelled: ['assignee', 'organization'],
  averageWaitSeconds: ['organization'],
  averageHandlingSeconds: ['assignee', 'module', 'organization'],
}

function dashboard(query: URLSearchParams) {
  const active: Key[] = []
  if (query.has('assigneeId')) active.push('assignee')
  if (query.has('moduleId')) active.push('module')
  if (query.has('organizationId')) active.push('organization')
  const num = (name: string, value: number | null) =>
    active.every((key) => accepts[name].includes(key))
      ? { applicable: true, value }
      : { applicable: false, value: null }

  const assigneeId = Number(query.get('assigneeId')) || undefined
  const rows = people
    .filter((p) => assigneeId === undefined || p.id === assigneeId)
    .map((p) => {
      const [inProgress, started, resolved, transferred, cancelled, aht] = perPerson[p.id]
      return {
        user: p,
        sector,
        inProgress: num('inProgress', inProgress),
        started: num('started', started),
        resolved: num('resolved', resolved),
        transferred: num('transferred', transferred),
        cancelled: num('cancelled', cancelled),
        averageHandlingSeconds: num('averageHandlingSeconds', aht * 60),
      }
    })
  // O total do setor é o número que existe hoje (não uma soma feita na tela). Aqui, como
  // todo chamado tem responsável, ele coincide com a soma das linhas.
  const sum = (i: number) =>
    people
      .filter((p) => assigneeId === undefined || p.id === assigneeId)
      .reduce((total, p) => total + perPerson[p.id][i], 0)
  const weighted = () => {
    const list = people.filter((p) => assigneeId === undefined || p.id === assigneeId)
    const count = list.reduce((t, p) => t + perPerson[p.id][2] + perPerson[p.id][3], 0)
    const minutes = list.reduce(
      (t, p) => t + (perPerson[p.id][2] + perPerson[p.id][3]) * perPerson[p.id][5],
      0,
    )
    return Math.round((minutes / count) * 60)
  }
  const today = new Date(now).toISOString().slice(0, 10)
  const period = query.get('period')
  const from =
    period === '7d'
      ? new Date(now - 6 * 86_400_000).toISOString().slice(0, 10)
      : period === '30d'
        ? new Date(now - 29 * 86_400_000).toISOString().slice(0, 10)
        : today
  return {
    period: { from, to: today },
    sectorId: role() === 'admin' && !query.has('sectorId') ? null : 1,
    numbers: {
      queued: num('queued', 7),
      inProgress: num('inProgress', sum(0)),
      received: num('received', 31),
      started: num('started', sum(1)),
      resolved: num('resolved', sum(2)),
      transferred: num('transferred', sum(3)),
      cancelled: num('cancelled', sum(4)),
      averageWaitSeconds: num('averageWaitSeconds', 6 * 60 + 40),
      averageHandlingSeconds: num('averageHandlingSeconds', weighted()),
    },
    assignees: rows,
  }
}

const orgs = [
  ['Prefeitura de Vila Fictícia', 'Vila Fictícia'],
  ['Câmara de Monte Imaginário', 'Monte Imaginário'],
  ['Secretaria de Saúde de Rio Inventado', 'Rio Inventado'],
]
const contacts = [
  'João da Silva Exemplo',
  'Ana Pereira Teste',
  'Pedro Amostra',
  'Fernanda Lima Demo',
  'Ricardo Fictício',
  'Juliana Modelo',
  'Marcos Protótipo',
  'Carla Fictícia',
  'Luiz Modelo',
  'Beatriz Exemplo',
  'Paulo Amostra',
  'Sofia Teste',
  'Daniel Demo',
]
function live(
  i: number,
  status: 'queued' | 'in_progress',
  assignee?: { id: number; name: string },
  minutes = 5,
) {
  const org = i % 4 === 3 ? null : orgs[i % 3]
  return {
    id: 300 + i,
    protocol: `2026111900${String(i + 1).padStart(2, '0')}`,
    status,
    arrivedAt: ago(minutes + 3),
    assignedAt: status === 'in_progress' ? ago(minutes) : null,
    contact: { id: i + 1, name: contacts[i], phone: null, registered: true },
    organizationName: org?.[0] ?? null,
    municipalityName: org?.[1] ?? null,
    assignee: assignee ?? null,
    lastMessage: null,
    sector,
  }
}
function lists(query: URLSearchParams) {
  const assigneeId = Number(query.get('assigneeId')) || undefined
  const inProgress = [
    live(3, 'in_progress', people[0], 42),
    live(4, 'in_progress', people[0], 15),
    live(5, 'in_progress', people[1], 27),
    live(6, 'in_progress', people[3], 8),
    live(7, 'in_progress', people[0], 6),
    live(8, 'in_progress', people[1], 3),
  ].filter((t) => assigneeId === undefined || t.assignee?.id === assigneeId)
  return {
    queued: [
      live(0, 'queued', undefined, 12),
      live(1, 'queued', undefined, 4),
      live(2, 'queued', undefined, 1),
      live(9, 'queued', undefined, 20),
      live(10, 'queued', undefined, 18),
      live(11, 'queued', undefined, 16),
      live(12, 'queued', undefined, 14),
    ],
    inProgress,
  }
}

// PROTÓTIPO #342: quadro Pendentes do Dashboard (spec #332). Pendentes fictícios;
// os quatro primeiros são os mesmos da aba Pendentes da #337, para o link da linha
// abrir um chamado que bate com a linha.
const suporte = { id: 1, name: 'Suporte Sistemas' }
const tributos = { id: 2, name: 'Tributos Municipais' }
const pendingPeople: {
  contato: string
  protocolo: string
  motivo: string
  minutos: number
  setor: { id: number; name: string }
}[] = [
  {
    contato: 'Maria Oliveira',
    protocolo: '2026-000118',
    motivo: 'Aguardando retorno do desenvolvimento sobre o erro no envio de anexos',
    minutos: 3 * 1440,
    setor: suporte,
  },
  {
    contato: 'Maria Oliveira',
    protocolo: '2026-000120',
    motivo: 'Cliente vai confirmar com o órgão o número do protocolo antigo',
    minutos: 2 * 1440,
    setor: suporte,
  },
  {
    contato: 'Tereza Nogueira',
    protocolo: '2026-000119',
    motivo: 'Aguardando a publicação da correção combinada com o desenvolvimento',
    minutos: 1440,
    setor: suporte,
  },
  {
    contato: 'José Carlos Ferreira',
    protocolo: '2026-000115',
    motivo: 'Cliente vai reunir os prints do erro na tela de tributos',
    minutos: 22 * 60,
    setor: tributos,
  },
  {
    contato: 'Sandra Bueno',
    protocolo: '2026-000116',
    motivo: 'Aguardando a autorização do órgão para alterar o cadastro da secretaria',
    minutos: 18 * 60,
    setor: suporte,
  },
  {
    contato: 'Luís Henrique Prado',
    protocolo: '2026-000117',
    motivo: 'Precisa do comprovante em PDF que o cliente ainda não enviou',
    minutos: 14 * 60,
    setor: suporte,
  },
  {
    contato: 'Cláudia Rezende',
    protocolo: '2026-000122',
    motivo: 'Vai testar de novo quando a internet do posto voltar',
    minutos: 12 * 60,
    setor: tributos,
  },
  {
    contato: 'Marcos Vinícius Teixeira',
    protocolo: '2026-000123',
    motivo: 'Aguardando a resposta do jurídico sobre a emissão da certidão',
    minutos: 10 * 60,
    setor: suporte,
  },
  {
    contato: 'Pedro Alves',
    protocolo: '2026-000121',
    motivo: 'Depende da liberação de acesso ao sistema pelo órgão',
    minutos: 9 * 60,
    setor: suporte,
  },
  {
    contato: 'Fernando Dias',
    protocolo: '2026-000124',
    motivo: 'Aguardando a nota fiscal do serviço para responder',
    minutos: 3 * 60,
    setor: suporte,
  },
  {
    contato: 'Patrícia Almeida',
    protocolo: '2026-000125',
    motivo: 'Cliente disse que retorna com a lista de servidores para importar',
    minutos: 60,
    setor: suporte,
  },
  {
    contato: 'Simone Pires',
    protocolo: '2026-000126',
    motivo: 'Esperando a nota fiscal do contrato para seguir com o cadastro',
    minutos: 30,
    setor: tributos,
  },
  {
    contato: 'Eduardo Siqueira',
    protocolo: '2026-000127',
    motivo: 'Aguardando o cliente confirmar qual unidade abriu o chamado',
    minutos: 20,
    setor: suporte,
  },
  {
    contato: 'Rafael Andrade',
    protocolo: '2026-000128',
    motivo: 'Erro depende de janela de manutenção do servidor do órgão',
    minutos: 12,
    setor: suporte,
  },
  {
    contato: 'Antônio Carlos Lopes',
    protocolo: '2026-000129',
    motivo: 'Aguardando o envio do arquivo correto no lugar do que veio em branco',
    minutos: 5,
    setor: suporte,
  },
]

function pending(query: URLSearchParams) {
  if (params().get('pendentes') === 'vazio') return { count: 0, items: [] }
  const sectorId = role() === 'admin' ? Number(query.get('sectorId')) || undefined : 1
  const items = pendingPeople
    .map((item, i) => ({
      id: 500 + i,
      protocol: item.protocolo,
      contact: { name: item.contato },
      reason: item.motivo,
      since: ago(item.minutos),
      sector: item.setor,
    }))
    .filter((item) => sectorId === undefined || item.sector.id === sectorId)
    .sort((a, b) => a.since.localeCompare(b.since))
  return { count: items.length, items: items.slice(0, 10) }
}

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown } | null {
  const method = init?.method ?? 'GET'
  const [route, search = ''] = path.split('?')
  const query = new URLSearchParams(search)
  if (route === '/auth/me') return { data: me() }
  if (route === '/organizations') return { data: { items: [], total: 0 } }
  if (route === '/dashboard') return { data: dashboard(query) }
  if (route === '/dashboard/tickets') return { data: lists(query) }
  if (route === '/dashboard/pending') return { data: pending(query) }
  if (route.match(/^\/sectors\/\d+\/dashboard\/assignees$/))
    return { data: people.map((p) => ({ ...p, active: true })) }
  if (route.match(/^\/sectors\/\d+\/modules$/))
    return { data: [{ id: 1, sectorId: 1, name: 'Tributos', active: true }] }
  if (route === '/sectors')
    return {
      data: [
        {
          ...sector,
          email: null,
          phone: '+55 00 3000-0000',
          provider: 'fake',
          connectionStatus: 'connected',
          lastConnectedAt: ago(60),
          active: true,
        },
      ],
    }
  return { data: method === 'GET' ? [] : undefined }
}
