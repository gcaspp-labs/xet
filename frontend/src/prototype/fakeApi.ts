// PROTÓTIPO #177: descartável, não vai para a main.
// Plano: uma versão (ajuste de tela existente) da ficha só leitura em /atendimentos/:id, para
// os três tipos de encerramento:
//   /atendimentos/500  encerrado (resolvido), com correções
//   /atendimentos/510  transferido para outro setor, com origem (505) e destino
//   /atendimentos/505  o chamado anterior da cadeia (também transferido)
//   /atendimentos/520  cancelado
// ?as=agent mostra a visão de um atendente que NÃO encerrou (sem Corrigir).
// ?as=closer mostra a visão do atendente que encerrou (com Corrigir).
// Padrão: administrador (com Corrigir, exceto no cancelado).
// API falsa em memória, só em desenvolvimento: dados fictícios (o repositório é público).
// Nada é gravado; recarregar a página zera tudo.

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()
const params = () => new URLSearchParams(window.location.search)
const as = () => params().get('as')

const paula = { id: 3, name: 'Paula Atendente' }
const rui = { id: 4, name: 'Rui Atendente' }
const carla = { id: 7, name: 'Carla Supervisora' }

const me = () =>
  as() === 'agent'
    ? { ...rui, email: 'rui@exemplo.test', role: 'agent', sectorId: 1 }
    : as() === 'closer'
      ? { ...paula, email: 'paula@exemplo.test', role: 'agent', sectorId: 1 }
      : { id: 1, name: 'Ana Admin', email: 'admin@exemplo.test', role: 'admin', sectorId: null }

const sectors = [
  { id: 1, name: 'Suporte Sistemas' },
  { id: 2, name: 'Tributos Municipais' },
  { id: 3, name: 'Folha de Pagamento' },
]
const sectorOf = (id: number) => sectors.find((s) => s.id === id)!

const contact = {
  id: 1500,
  name: 'João da Silva Exemplo',
  phone: '5500900000000',
  registered: true,
}
const organization = {
  id: 31,
  name: 'Prefeitura de Vila Fictícia',
  municipality: { id: 1, name: 'Vila Fictícia' },
}

type Kind = 'resolved' | 'transferred' | 'cancelled'
const base = (
  id: number,
  sectorId: number,
  kind: Kind,
  t0: number,
  by: { id: number; name: string },
) => ({
  id,
  protocol: `2026111300${id}`,
  status: 'closed',
  sector: { id: sectorId, name: sectorOf(sectorId).name },
  arrivedAt: ago(t0),
  assignedAt: kind === 'cancelled' ? null : ago(t0 - 4),
  startedAt: ago(t0 - 4),
  endedAt: kind === 'cancelled' ? null : ago(t0 - 50),
  closedAt: ago(t0 - 52),
  subject: null as string | null,
  resolution: null as string | null,
  contact,
  organization,
  assignee: kind === 'cancelled' ? null : by,
  closedBy: by,
  closureType: kind,
  previous: null as unknown,
  next: null as unknown,
})

const tickets: Record<number, () => ReturnType<typeof base>> = {
  500: () => ({
    ...base(500, 1, 'resolved', 300, paula),
    subject: 'Certidão negativa com pendência',
    resolution: 'Guia de setembro baixada manualmente após conferir o comprovante enviado.',
  }),
  505: () => ({
    ...base(505, 1, 'transferred', 900, paula),
    subject: 'Guia do ISS com valor errado',
    resolution: 'Cálculo do ISS é do setor de Tributos; cliente orientado sobre o encaminhamento.',
    next: { protocol: '2026111300510', sectorName: 'Tributos Municipais' },
  }),
  510: () => ({
    ...base(510, 2, 'transferred', 840, carla),
    subject: 'Guia do ISS com valor errado',
    resolution: 'Alíquota conferida; o desconto da folha é da Folha de Pagamento.',
    previous: {
      id: 505,
      protocol: '2026111300505',
      sectorName: 'Suporte Sistemas',
      subject: 'Guia do ISS com valor errado',
      resolution:
        'Cálculo do ISS é do setor de Tributos; cliente orientado sobre o encaminhamento.',
      closedByName: paula.name,
    },
    next: { protocol: '2026111300515', sectorName: 'Folha de Pagamento' },
  }),
  520: () => ({ ...base(520, 1, 'cancelled', 200, rui) }),
}

const log = (
  id: number,
  action: string,
  at: number,
  actor: { id: number; name: string },
  extra: Record<string, unknown> = {},
) => ({
  id,
  action,
  createdAt: ago(at),
  actor,
  fromName: null,
  toName: null,
  toSectorName: null,
  reason: null,
  ...extra,
})

const logs: Record<number, unknown[]> = {
  500: [
    log(1, 'ticket_assigned', 296, paula, { toName: paula.name }),
    log(2, 'ticket_closed', 248, paula),
    log(3, 'ticket_corrected', 200, carla),
  ],
  505: [
    log(1, 'ticket_assigned', 896, paula, { toName: paula.name }),
    log(2, 'ticket_transferred_sector', 848, paula, { toSectorName: 'Tributos Municipais' }),
  ],
  510: [
    log(1, 'ticket_assigned', 836, carla, { toName: carla.name }),
    log(2, 'ticket_transferred_sector', 788, carla, { toSectorName: 'Folha de Pagamento' }),
  ],
  520: [
    log(1, 'ticket_cancelled', 148, rui, {
      reason: 'Cliente escreveu no número errado; o assunto é de outra prefeitura.',
    }),
  ],
}

const chats: Record<number, string[]> = {
  500: [
    'Bom dia, não consigo emitir a certidão negativa pelo portal.',
    'Bom dia! Vou verificar. Aparece alguma mensagem de erro?',
    'Diz que existe pendência, mas já pagamos tudo.',
    'Encontrei uma guia de setembro ainda em aberto no sistema.',
    'Ela foi paga no dia 10, tenho o comprovante.',
    'Pode me enviar o comprovante por aqui?',
    'Enviado. Obrigado!',
    'Conferido e baixado. A certidão já pode ser emitida.',
  ],
  505: [
    'Olá, a guia do ISS de outubro veio com valor dobrado.',
    'Olá! O cálculo do ISS é feito pelo setor de Tributos. Vou transferir para eles.',
    'Tudo bem, obrigado.',
  ],
  510: [
    'Boa tarde, aqui é Tributos. Conferimos a alíquota e está correta.',
    'Mas o valor continua o dobro do mês passado.',
    'A diferença vem do desconto em folha. Vou passar para a Folha de Pagamento.',
    'Certo, aguardo.',
  ],
  520: ['Oi, queria saber do IPTU de Monte Imaginário.', 'Alô?'],
}

const messages = (ticketId: number) => {
  const t = tickets[ticketId]?.()
  if (!t) return []
  const start = Date.parse(t.arrivedAt)
  const by = t.closedBy as { id: number; name: string }
  return (chats[ticketId] ?? []).map((body, i) => {
    const inbound = ticketId === 520 || i % 2 === 0
    return {
      id: ticketId * 100 + i,
      ticketId,
      direction: inbound ? 'inbound' : 'outbound',
      origin: inbound ? 'customer' : 'agent',
      type: 'text',
      body,
      status: inbound ? null : 'read',
      failureReason: null,
      sentAt: new Date(start + (i * 6 + 1) * 60_000).toISOString(),
      author: inbound ? null : by,
      media: null,
    }
  })
}

const corrections: Record<number, unknown[]> = {
  500: [
    {
      id: 1,
      createdAt: ago(200),
      actor: carla,
      reason: 'Resolução incompleta.',
      changes: [
        {
          field: 'resolution',
          from: 'Guia baixada.',
          to: 'Guia de setembro baixada manualmente após conferir o comprovante enviado.',
        },
      ],
    },
  ],
}

// Linhas da lista "Conversas do setor" (só aparecem no "antes").
const names = [
  'Ana Pereira Teste',
  'Pedro Amostra',
  'Fernanda Lima Demo',
  'Ricardo Fictício',
  'Juliana Modelo',
  'Marcos Protótipo',
]
const rows = names.map((name, i) => ({
  id: 300 + i,
  protocol: `2026111300${300 + i}`,
  status: i < 3 ? 'in_progress' : 'queued',
  arrivedAt: ago(5 + i * 7),
  assignedAt: i < 3 ? ago(4 + i * 7) : null,
  contact: { id: 1000 + i, name, phone: '5500900000000', registered: true },
  organizationName: organization.name,
  municipalityName: organization.municipality.name,
  assignee: i < 3 ? { id: me().id, name: me().name } : null,
  lastMessage: {
    type: 'text',
    body: 'Consegue ver se o protocolo foi registrado?',
    origin: 'customer',
    sentAt: ago(2 + i * 6),
  },
}))

const historyEntry = (
  id: number,
  subject: string | null,
  kind: Kind,
  sectorName: string,
  closedAgo: number,
) => ({
  id,
  protocol: `2026111300${id}`,
  status: 'closed',
  closureType: kind,
  sectorName,
  arrivedAt: ago(closedAgo + 50),
  closedAt: ago(closedAgo),
  subject,
  contactName: contact.name,
  organizationName: organization.name,
  municipalityName: organization.municipality.name,
  assigneeName: paula.name,
})

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown; status?: number } | null {
  const method = init?.method ?? 'GET'
  const [route] = path.split('?')
  let m: RegExpMatchArray | null
  if (route === '/auth/me') return { data: me() }
  if (route === '/sectors')
    return {
      data: sectors.map((s) => ({
        ...s,
        email: null,
        phone: '+55 00 3000-0000',
        provider: 'fake',
        connectionStatus: 'connected',
        lastConnectedAt: ago(60),
        active: true,
      })),
    }
  if ((m = route.match(/^\/sectors\/(\d+)\/tickets$/))) return { data: rows }
  if ((m = route.match(/^\/tickets\/(\d+)$/))) {
    const t = tickets[Number(m[1])]
    if (!t) return { data: null, status: 404 }
    return { data: t() }
  }
  if ((m = route.match(/^\/tickets\/(\d+)\/messages$/)) && method === 'GET')
    return { data: messages(Number(m[1])) }
  if ((m = route.match(/^\/tickets\/(\d+)\/assignments$/)))
    return { data: logs[Number(m[1])] ?? [] }
  if ((m = route.match(/^\/tickets\/(\d+)\/modules$/)))
    return {
      data: [
        { id: 1, name: 'Tributos' },
        { id: 2, name: 'Portal do contribuinte' },
      ],
    }
  if ((m = route.match(/^\/tickets\/(\d+)\/corrections$/)))
    return { data: corrections[Number(m[1])] ?? [] }
  if ((m = route.match(/^\/(contacts|organizations)\/(\d+)\/tickets$/))) {
    const items = [
      historyEntry(500, 'Certidão negativa com pendência', 'resolved', 'Suporte Sistemas', 248),
      historyEntry(520, null, 'cancelled', 'Suporte Sistemas', 148),
      historyEntry(510, 'Guia do ISS com valor errado', 'transferred', 'Tributos Municipais', 788),
      historyEntry(505, 'Guia do ISS com valor errado', 'transferred', 'Suporte Sistemas', 848),
    ]
    return { data: { items, total: items.length } }
  }
  if ((m = route.match(/^\/tickets\/(\d+)\/closing-form$/)))
    return {
      data: {
        modules: [
          { id: 1, name: 'Tributos' },
          { id: 2, name: 'Portal do contribuinte' },
        ],
        subjects: [
          'Certidão negativa com pendência',
          'Guia do ISS com valor errado',
          'Senha do portal',
        ].map((name, i) => ({
          id: i + 1,
          name,
          moduleId: 1,
          moduleName: 'Tributos',
          solutions: [{ id: i + 1, body: 'Solução de exemplo para consulta.' }],
        })),
        contactModuleIds: [],
        organization: null,
        startedAt: ago(296),
      },
    }
  return { data: method === 'GET' ? [] : undefined }
}
