// PROTÓTIPO #162 — descartável, não vai para a main.
// Plano: uma versão (ajuste de tela existente) do resumo no topo de /chamados/:id,
// mostrada em cinco chamados fictícios: 101 em atendimento, 102 na fila, 103 encerrado,
// 104 transferido para outro setor e 105 cancelado.
// API falsa em memória, só em desenvolvimento: dados fictícios (o repositório é público).

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()

const user = {
  id: 1,
  name: 'Marina Teste',
  email: 'marina@exemplo.test',
  role: 'supervisor',
  sectorId: 1,
}
const sector = { id: 1, name: 'Suporte Sistemas' }

const longResolution = [
  'Orientado a emitir a certidão pelo portal: menu Tributos › Certidões › Emitir certidão, informando o CNPJ sem pontos e o período de referência.',
  'A certidão saiu positiva com efeito de negativa por causa de um parcelamento em dia; explicado que o documento vale para a licitação.',
  'Enviado o passo a passo por mensagem e confirmado que o contato conseguiu baixar o PDF.',
].join(' ')

type Fake = {
  name: string
  phone: string
  org: string | null
  mun: string
  status: 'queued' | 'in_progress' | 'closed'
  closureType: 'resolved' | 'transferred' | 'cancelled' | null
  assignee: string | null
  subject: string | null
  resolution: string | null
  modules: string[]
  next?: { protocol: string; sectorName: string }
  msgs: [boolean, string][]
}

const tickets: Record<number, Fake> = {
  101: {
    name: 'João Exemplo',
    phone: '5500900000001',
    org: 'Prefeitura de Vila Fictícia',
    mun: 'Vila Fictícia',
    status: 'in_progress',
    closureType: null,
    assignee: 'Marina Teste',
    subject: null,
    resolution: null,
    modules: [],
    msgs: [
      [true, 'Bom dia! Não estou conseguindo emitir a certidão negativa pelo portal.'],
      [false, 'Bom dia, João! Vou te ajudar com isso.'],
      [true, 'Obrigado. É para uma licitação que fecha amanhã.'],
    ],
  },
  102: {
    name: 'Ana Modelo',
    phone: '5500900000002',
    org: null,
    mun: '',
    status: 'queued',
    closureType: null,
    assignee: null,
    subject: null,
    resolution: null,
    modules: [],
    msgs: [[true, 'Olá, meu usuário foi bloqueado depois que errei a senha.']],
  },
  103: {
    name: 'Pedro Amostra',
    phone: '5500900000003',
    org: 'Câmara de Serra Imaginária',
    mun: 'Serra Imaginária',
    status: 'closed',
    closureType: 'resolved',
    assignee: 'Carla Fictícia',
    subject: 'Emissão de certidão',
    resolution: longResolution,
    modules: ['Tributos', 'Portal do contribuinte'],
    msgs: [
      [true, 'Preciso da certidão negativa para uma licitação.'],
      [false, 'Certo, Pedro. Segue o passo a passo para emitir pelo portal.'],
      [true, 'Consegui, obrigado!'],
    ],
  },
  104: {
    name: 'Lúcia Teste',
    phone: '5500900000004',
    org: 'Prefeitura de Lagoa Inventada',
    mun: 'Lagoa Inventada',
    status: 'closed',
    closureType: 'transferred',
    assignee: 'Marina Teste',
    subject: 'Holerite indisponível',
    resolution:
      'A dúvida é sobre o cálculo da folha, não sobre o sistema. Transferido para o setor de Folha.',
    modules: ['Folha de pagamento'],
    next: { protocol: '2026-000231', sectorName: 'Folha de Pagamento' },
    msgs: [[true, 'O desconto do meu holerite veio diferente este mês.']],
  },
  105: {
    name: 'Carlos Amostra',
    phone: '5500900000005',
    org: 'Prefeitura de Vila Fictícia',
    mun: 'Vila Fictícia',
    status: 'closed',
    closureType: 'cancelled',
    assignee: 'Marina Teste',
    subject: null,
    resolution: null,
    modules: [],
    msgs: [[true, 'oi']],
  },
}

function ticket(id: number) {
  const t = tickets[id]
  if (!t) return undefined
  const closed = t.status === 'closed'
  return {
    id,
    protocol: `2026-000${id}`,
    status: t.status,
    sector,
    spokeWith: null,
    arrivedAt: ago(90),
    assignedAt: t.assignee ? ago(80) : null,
    startedAt: ago(90),
    endedAt: closed ? ago(10) : null,
    closedAt: closed ? ago(10) : null,
    subject: t.subject,
    resolution: t.resolution,
    contact: { id: id + 100, name: t.name, phone: t.phone, registered: t.org !== null },
    organization: t.org
      ? { id: id + 200, name: t.org, municipality: { id: id + 300, name: t.mun } }
      : null,
    assignee: t.assignee ? { id: 1, name: t.assignee } : null,
    closedBy: closed ? { id: 1, name: t.assignee } : null,
    closureType: t.closureType,
    previous: null,
    next: t.next ?? null,
  }
}

const messages = (id: number) =>
  (tickets[id]?.msgs ?? []).map(([inbound, body], i, all) => ({
    id: id * 10 + i,
    ticketId: id,
    direction: inbound ? 'inbound' : 'outbound',
    origin: inbound ? 'customer' : 'agent',
    type: 'text',
    body,
    status: inbound ? null : 'read',
    failureReason: null,
    sentAt: ago((all.length - i) * 5 + 15),
    author: inbound ? null : { id: 1, name: tickets[id].assignee },
    media: null,
  }))

const summary = (id: number) => {
  const t = ticket(id)!
  const last = messages(id).at(-1)!
  return {
    id,
    protocol: t.protocol,
    status: t.status,
    arrivedAt: t.arrivedAt,
    assignedAt: t.assignedAt,
    contact: t.contact,
    organizationName: t.organization?.name ?? null,
    municipalityName: t.organization?.municipality.name ?? null,
    assignee: t.assignee,
    lastMessage: { type: 'text', body: last.body, origin: last.origin, sentAt: last.sentAt },
  }
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
  if (path.match(/^\/sectors\/\d+\/tickets$/)) return { data: [101, 102].map(summary) }
  if ((m = path.match(/^\/tickets\/(\d+)$/))) {
    const t = ticket(Number(m[1]))
    if (!t) throw new Error('Chamado não encontrado (protótipo).')
    return { data: t }
  }
  if ((m = path.match(/^\/tickets\/(\d+)\/messages$/))) return { data: messages(Number(m[1])) }
  if ((m = path.match(/^\/tickets\/(\d+)\/modules$/)))
    return {
      data: (tickets[Number(m[1])]?.modules ?? []).map((name, i) => ({ id: i + 1, name })),
    }
  if (method !== 'GET') return { data: undefined }
  return { data: [] }
}
