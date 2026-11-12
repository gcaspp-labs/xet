// PROTÓTIPO #145 — descartável, não vai para a main.
// API falsa em memória, só em desenvolvimento: dados fictícios para as capturas
// (o repositório é público). Nada é gravado; recarregar a página zera tudo.

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()

const user = {
  id: 1,
  name: 'Marina Teste',
  email: 'marina@exemplo.test',
  role: 'agent',
  sectorId: 1,
}
const sector = { id: 1, name: 'Suporte Sistemas' }
const colleagues = { 2: 'Rafael Exemplo', 3: 'Clara Fictícia' } as Record<number, string>

type Seed = {
  id: number
  contact: string
  org: string
  mun: string
  assignee: number | null
  msgs: [boolean, string, number][] // [recebida, texto, minutos atrás]
}

const seeds: Seed[] = [
  {
    id: 101,
    contact: 'João Exemplo',
    org: 'Prefeitura de Vila Fictícia',
    mun: 'Vila Fictícia',
    assignee: 1,
    msgs: [
      [true, 'Bom dia! Preciso emitir a certidão negativa do município e não acho onde fica no portal.', 16],
      [false, 'Bom dia, João! Vou te ajudar com isso.', 13],
      [false, 'No menu Tributos, clique em Certidões e depois em Emitir certidão.', 12],
      [true, 'Achei. Ele pede o CNPJ com ou sem pontuação?', 9],
      [false, 'Pode digitar só os números, sem pontos nem barras.', 8],
      [true, 'Deu certo, obrigado! É para uma licitação que fecha amanhã.', 3],
    ],
  },
  {
    id: 102,
    contact: 'Ana Modelo',
    org: 'Câmara de Serra Imaginária',
    mun: 'Serra Imaginária',
    assignee: 1,
    msgs: [
      [true, 'Olá, meu usuário foi bloqueado depois que errei a senha.', 30],
      [false, 'Olá, Ana! Vou verificar o seu acesso.', 28],
    ],
  },
  {
    id: 103,
    contact: 'Pedro Amostra',
    org: 'Prefeitura de Lagoa Inventada',
    mun: 'Lagoa Inventada',
    assignee: null,
    msgs: [[true, 'O relatório de despesas está saindo em branco.', 4]],
  },
  {
    id: 104,
    contact: 'Lúcia Modelo',
    org: 'Prefeitura de Morro Fictício',
    mun: 'Morro Fictício',
    assignee: null,
    msgs: [[true, 'Boa tarde, a nota fiscal foi rejeitada por CNPJ inválido.', 7]],
  },
  {
    id: 105,
    contact: 'Carlos Amostra',
    org: 'Consórcio Vale Inventado',
    mun: 'Vale Inventado',
    assignee: null,
    msgs: [[true, 'Quando sai o holerite deste mês?', 22]],
  },
  {
    id: 106,
    contact: 'Beatriz Teste',
    org: 'Prefeitura de Rio Imaginário',
    mun: 'Rio Imaginário',
    assignee: 2,
    msgs: [
      [true, 'Não consigo exportar o relatório para planilha.', 40],
      [false, 'Use o botão Exportar no canto superior direito.', 35],
    ],
  },
  {
    id: 107,
    contact: 'Rodrigo Exemplo',
    org: 'Câmara de Ponte Fictícia',
    mun: 'Ponte Fictícia',
    assignee: 3,
    msgs: [[true, 'Preciso cancelar uma nota emitida ontem.', 55]],
  },
]

// Estado "Sem atendimentos disponíveis": ?vazio=1 tira as conversas da Marina.
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('vazio')) {
  for (const s of seeds) if (s.assignee === 1) s.assignee = 2
}

const subjects = [
  {
    id: 1,
    name: 'Certidão negativa',
    solutions: [
      { id: 11, body: 'Menu Tributos > Certidões > Emitir certidão. Informar o CNPJ só com números.' },
      { id: 12, body: 'Se a certidão sair positiva, conferir débitos em Tributos > Extrato.' },
    ],
  },
  {
    id: 2,
    name: 'Usuário bloqueado',
    solutions: [{ id: 21, body: 'Em Usuários, localizar o login e clicar em Desbloquear acesso.' }],
  },
  {
    id: 3,
    name: 'Relatório em branco',
    solutions: [{ id: 31, body: 'Conferir o período do filtro e o exercício selecionado.' }],
  },
]

type Msg = Record<string, unknown>
let nextId = 1000
const messages: Record<number, Msg[]> = {}
for (const s of seeds) {
  messages[s.id] = s.msgs.map(([inbound, body, min]) => ({
    id: ++nextId,
    ticketId: s.id,
    direction: inbound ? 'inbound' : 'outbound',
    origin: inbound ? 'customer' : 'agent',
    type: 'text',
    body,
    status: inbound ? null : 'read',
    failureReason: null,
    sentAt: ago(min),
    author: inbound ? null : { id: s.assignee ?? 1, name: colleagues[s.assignee ?? 0] ?? user.name },
    media: null,
  }))
}

const seed = (id: number) => seeds.find((s) => s.id === id)
const assigneeOf = (s: Seed) =>
  s.assignee === null
    ? null
    : { id: s.assignee, name: s.assignee === 1 ? user.name : colleagues[s.assignee] }

function ticket(id: number) {
  const s = seed(id)
  if (!s) return undefined
  const queued = s.assignee === null
  const first = s.msgs[0][2] + 1
  return {
    id,
    protocol: `2026.11.${String(id * 37).padStart(5, '0')}`,
    status: queued ? 'queued' : 'in_progress',
    sector,
    spokeWith: null,
    arrivedAt: ago(first),
    assignedAt: queued ? null : ago(first - 1),
    startedAt: ago(first),
    endedAt: null,
    closedAt: null,
    subject: null,
    resolution: null,
    contact: { id: id + 100, name: s.contact, phone: '+55 00 90000-0000', registered: true },
    organization: { id: id + 200, name: s.org, municipality: { id: id + 500, name: s.mun } },
    assignee: assigneeOf(s),
    closedBy: null,
    closureType: null,
    previous: null,
    next: null,
  }
}

function summary(id: number) {
  const t = ticket(id)!
  const last = messages[id].at(-1)!
  return {
    id,
    protocol: t.protocol,
    status: t.status,
    arrivedAt: t.arrivedAt,
    assignedAt: t.assignedAt,
    contact: t.contact,
    organizationName: t.organization.name,
    municipalityName: t.organization.municipality.name,
    assignee: t.assignee,
    lastMessage: { type: 'text', body: last.body, origin: last.origin, sentAt: last.sentAt },
  }
}

function assignments(id: number) {
  const s = seed(id)
  if (!s || s.assignee === null) return []
  return [
    {
      id: id * 10,
      action: 'ticket_assigned',
      createdAt: ago(s.msgs[0][2] - 1),
      actor: assigneeOf(s),
      fromName: null,
      toName: assigneeOf(s)!.name,
      reason: null,
    },
  ]
}

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown } | null {
  const method = init?.method ?? 'GET'
  let m: RegExpMatchArray | null
  if (path === '/auth/me') return { data: user }
  if (path === '/sectors')
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
  if (path.match(/^\/sectors\/\d+\/tickets$/)) return { data: seeds.map((s) => summary(s.id)) }
  if (path.match(/^\/sectors\/\d+\/(workload|closed-today)$/)) return { data: [] }
  if ((m = path.match(/^\/tickets\/(\d+)\/assign$/))) {
    const s = seed(Number(m[1]))
    if (s) s.assignee = 1
    return { data: undefined }
  }
  if ((m = path.match(/^\/tickets\/(\d+)$/))) {
    const t = ticket(Number(m[1]))
    if (!t) throw new Error('Chamado não encontrado (protótipo).')
    return { data: t }
  }
  if ((m = path.match(/^\/tickets\/(\d+)\/messages$/))) {
    const id = Number(m[1])
    if (method === 'POST') return { data: { id: ++nextId, status: 'sent', failureReason: null } }
    return { data: [...(messages[id] ?? [])] }
  }
  if ((m = path.match(/^\/tickets\/(\d+)\/assignments$/)))
    return { data: assignments(Number(m[1])) }
  if (path.match(/^\/tickets\/\d+\/(notes|corrections|modules)$/)) return { data: [] }
  if (path.match(/^\/tickets\/\d+\/closing-form$/))
    return {
      data: { modules: [], subjects, contactModuleIds: [], organization: null, startedAt: ago(20) },
    }
  return { data: method === 'GET' ? [] : undefined }
}
