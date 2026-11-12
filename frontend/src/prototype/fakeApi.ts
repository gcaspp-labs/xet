// PROTÓTIPO #128 (base da #135) — descartável, não vai para a main.
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

const longSolution = [
  'Prezado(a), segue o passo a passo para a emissão da certidão negativa de débitos pelo portal:',
  '',
  '1. Acesse o portal com o usuário e a senha do órgão.',
  '2. No menu Tributos, clique em Certidões e depois em Emitir certidão.',
  '3. Informe o CNPJ do contribuinte, sem pontos nem barras, e o período de referência.',
  '4. Confira os dados exibidos e clique em Gerar. O documento abre em PDF numa nova aba.',
  '5. Se aparecer a mensagem "Existem pendências", abra o relatório de pendências no mesmo menu e envie para o setor de Tributos.',
  '',
  'A certidão tem validade de 30 dias. Qualquer dúvida, estamos à disposição.',
].join('\n')

const subjects = [
  {
    id: 11,
    name: 'Acesso ao portal',
    solutions: [
      {
        id: 111,
        body: 'Orientado a usar a opção "Esqueci minha senha" na tela de entrada. O link chega no e-mail cadastrado em até 10 minutos.',
      },
      {
        id: 112,
        body: 'Usuário bloqueado após 5 tentativas. Desbloqueado pelo painel administrativo e orientado a trocar a senha no primeiro acesso.',
      },
      {
        id: 113,
        body: 'Navegador desatualizado. Orientado a limpar o cache ou usar outro navegador.',
      },
    ],
  },
  {
    id: 12,
    name: 'Emissão de certidão',
    solutions: [
      { id: 121, body: longSolution },
      {
        id: 122,
        body: 'Certidão positiva com efeito de negativa: explicado que o documento é válido para licitações enquanto o parcelamento estiver em dia.',
      },
    ],
  },
  {
    id: 13,
    name: 'Nota fiscal eletrônica',
    solutions: [
      {
        id: 131,
        body: 'Rejeição por CNPJ inválido. Orientado a conferir o cadastro do tomador e reenviar a nota.',
      },
      {
        id: 132,
        body: 'Cancelamento fora do prazo: orientado a abrir solicitação de cancelamento extemporâneo com a justificativa.',
      },
    ],
  },
  {
    id: 14,
    name: 'Folha de pagamento',
    solutions: [
      {
        id: 141,
        body: 'Holerite indisponível: o fechamento da folha acontece no dia 25. Orientado a consultar de novo após essa data.',
      },
    ],
  },
  {
    id: 15,
    name: 'Relatórios gerenciais',
    solutions: [
      {
        id: 151,
        body: 'Relatório em branco: o filtro de período estava fora do exercício. Orientado a ajustar as datas de início e fim.',
      },
      {
        id: 152,
        body: 'Exportação para planilha: usar o botão Exportar no canto superior direito do relatório.',
      },
    ],
  },
]

type Msg = Record<string, unknown>
const msg = (id: number, ticketId: number, inbound: boolean, body: string, min: number): Msg => ({
  id,
  ticketId,
  direction: inbound ? 'inbound' : 'outbound',
  origin: inbound ? 'customer' : 'agent',
  type: 'text',
  body,
  status: inbound ? null : 'read',
  failureReason: null,
  sentAt: ago(min),
  author: inbound ? null : { id: 1, name: 'Marina Teste' },
  media: null,
})

const contacts: Record<number, { id: number; name: string; org: string; mun: string }> = {
  101: { id: 201, name: 'João Exemplo', org: 'Prefeitura de Vila Fictícia', mun: 'Vila Fictícia' },
  102: { id: 202, name: 'Ana Modelo', org: 'Câmara de Serra Imaginária', mun: 'Serra Imaginária' },
  103: {
    id: 203,
    name: 'Pedro Amostra',
    org: 'Prefeitura de Lagoa Inventada',
    mun: 'Lagoa Inventada',
  },
}

const messages: Record<number, Msg[]> = {
  101: [
    msg(
      1,
      101,
      true,
      'Bom dia! Preciso emitir a certidão negativa do município e não estou achando onde fica no portal.',
      14,
    ),
    msg(2, 101, false, 'Bom dia, João! Vou te ajudar com isso.', 12),
    msg(3, 101, true, 'Obrigado. É para uma licitação que fecha amanhã.', 11),
  ],
  102: [
    msg(4, 102, true, 'Olá, meu usuário foi bloqueado depois que errei a senha.', 30),
    msg(5, 102, false, 'Olá, Ana! Vou verificar o seu acesso.', 28),
  ],
  103: [msg(6, 103, true, 'O relatório de despesas está saindo em branco.', 5)],
}

function ticket(id: number) {
  const c = contacts[id]
  if (!c) return undefined
  const queued = id === 103
  return {
    id,
    protocol: `2026.11.${String(id).padStart(5, '0')}`,
    status: queued ? 'queued' : 'in_progress',
    sector,
    spokeWith: null,
    arrivedAt: ago(20),
    assignedAt: queued ? null : ago(18),
    startedAt: ago(20),
    endedAt: null,
    closedAt: null,
    subject: null,
    resolution: null,
    contact: { id: c.id, name: c.name, phone: '+55 00 90000-0000', registered: true },
    organization: { id: c.id + 100, name: c.org, municipality: { id: c.id + 500, name: c.mun } },
    assignee: queued ? null : { id: 1, name: 'Marina Teste' },
    closedBy: null,
    closureType: null,
    previous: null,
    next: null,
  }
}

const summary = (id: number) => {
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

let nextId = 100

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
  if ((m = path.match(/^\/sectors\/\d+\/tickets$/))) return { data: [101, 102, 103].map(summary) }
  if (path.match(/^\/sectors\/\d+\/(workload|closed-today)$/)) return { data: [] }
  if ((m = path.match(/^\/tickets\/(\d+)$/))) {
    const t = ticket(Number(m[1]))
    if (!t) throw new Error('Chamado não encontrado (protótipo).')
    return { data: t }
  }
  if ((m = path.match(/^\/tickets\/(\d+)\/messages$/))) {
    const id = Number(m[1])
    if (method === 'POST') {
      const body = (init?.body as { body?: string } | undefined)?.body ?? ''
      const sent = msg(++nextId, id, false, body, 0)
      messages[id].push(sent)
      return { data: { id: sent.id, status: 'sent', failureReason: null } }
    }
    return { data: [...(messages[id] ?? [])] }
  }
  if (path.match(/^\/tickets\/\d+\/(assignments|notes|corrections|modules)$/)) return { data: [] }
  if (path.match(/^\/tickets\/\d+\/closing-form$/))
    return {
      data: {
        modules: [{ id: 1, name: 'Tributos' }],
        subjects,
        contactModuleIds: [],
        organization: null,
        startedAt: ago(20),
      },
    }
  if ((m = path.match(/^\/(contacts|organizations)\/(\d+)\/tickets(\?.*)?$/)))
    return { data: historyPage(m[1], Number(m[2]), new URLSearchParams(m[3]?.slice(1) ?? '')) }
  if ((m = path.match(/^\/organizations(\?.*)?$/)))
    return {
      data: {
        items: directoryContacts.map((c) => c.organization),
        total: directoryContacts.length,
        page: 1,
        pageSize: 20,
      },
    }
  if ((m = path.match(/^\/contacts(\?.*)?$/)))
    return {
      data: { items: directoryContacts, total: directoryContacts.length, page: 1, pageSize: 20 },
    }
  return { data: method === 'GET' ? [] : undefined }
}

// PROTÓTIPO #128: histórico grande, para mostrar as páginas além dos 200.
const directoryContacts = Object.values(contacts).map((c) => ({
  id: c.id,
  name: c.name,
  phone: '+5500900000000',
  registered: true,
  organization: {
    id: c.id + 100,
    name: c.org,
    cnpj: '00000000000191',
    municipality: { id: c.id + 500, name: c.mun },
  },
  sectors: [sector],
  modules: [],
}))

const histSectors = ['Suporte Sistemas', 'Tributos']
const histAgents = ['Marina Teste', 'Rafael Exemplo', 'Clara Fictícia', null]
const histSubjects = [
  'Acesso ao portal',
  'Emissão de certidão',
  'Nota fiscal eletrônica',
  'Folha de pagamento',
  'Relatórios gerenciais',
  null,
]
const histContacts = ['João Exemplo', 'Maria Inventada', 'Carlos Amostra', 'Lúcia Modelo']

function buildHistory(kind: string, id: number) {
  const count = kind === 'contacts' ? 237 : 412
  const c =
    Object.values(contacts).find((x) => (kind === 'contacts' ? x.id : x.id + 100) === id) ??
    contacts[101]
  return Array.from({ length: count }, (_, i) => {
    const n = count - i
    const ticketId = i === 0 ? 101 : 5000 + n
    const open = i === 0
    const closure = n % 9 === 0 ? 'cancelled' : n % 7 === 0 ? 'transferred' : 'resolved'
    const arrived = new Date(now - (60 * 24 * 4 * i + 37 * n) * 60_000)
    return {
      id: ticketId,
      protocol: open
        ? '2026.11.00101'
        : `${arrived.getFullYear()}.${String(arrived.getMonth() + 1).padStart(2, '0')}.${String(n * 37).padStart(5, '0')}`,
      status: open ? 'in_progress' : 'closed',
      closureType: open ? null : closure,
      sectorName: histSectors[n % 2],
      arrivedAt: open ? ago(20) : ago(60 * 24 * 4 * i + 37 * n),
      closedAt: open ? null : ago(60 * 24 * 4 * i),
      subject: open ? null : histSubjects[n % histSubjects.length],
      contactName: kind === 'contacts' ? c.name : histContacts[n % histContacts.length],
      organizationName: c.org,
      municipalityName: c.mun,
      assigneeName: open ? 'Marina Teste' : histAgents[n % histAgents.length],
    }
  })
}

const fold = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

function historyPage(kind: string, id: number, q: URLSearchParams) {
  const pageSize = 20
  const all = buildHistory(kind, id)
  const sort = q.get('sort') ?? 'arrived'
  const dir = q.get('direction') === 'asc' ? 1 : -1
  const key: Record<string, (e: (typeof all)[number]) => string> = {
    arrived: (e) => e.arrivedAt,
    protocol: (e) => e.protocol,
    status: (e) => fold(e.closureType ?? e.status),
    sector: (e) => fold(e.sectorName),
    assignee: (e) => fold(e.assigneeName),
    contact: (e) => fold(e.contactName),
  }
  const k = key[sort] ?? key.arrived
  const sorted = [...all].sort((a, b) => {
    const x = k(a),
      y = k(b)
    return (x < y ? -1 : x > y ? 1 : a.id - b.id) * dir
  })
  const last = Math.max(1, Math.ceil(sorted.length / pageSize))
  const page = Math.min(last, Math.max(1, Number(q.get('page')) || 1))
  const limit = Number(q.get('limit')) || pageSize
  return {
    items: sorted.slice((page - 1) * pageSize, (page - 1) * pageSize + limit),
    total: sorted.length,
    page,
    pageSize,
  }
}
