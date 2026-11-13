// PROTÓTIPO #172: descartável, não vai para a main.
// Plano: uma versão (ajuste da tela existente) da rolagem da tela Conversas, em /conversas e
// /conversas/:id. Sem ?variant=: é um ajuste, não uma tela nova.
// API falsa em memória, só em desenvolvimento: dados fictícios para as capturas
// (o repositório é público). Nada é gravado; recarregar a página zera tudo.
// ?as=agent mostra a visão do atendente (padrão: administrador, com o seletor de Setor,
// o que deixa o cabeçalho mais cheio). ?poucos=1 deixa as listas curtas.

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()
const params = () => new URLSearchParams(window.location.search)
const asAgent = () => params().get('as') === 'agent'
const few = () => params().get('poucos') === '1'

const admin = { id: 1, name: 'Paula Admin', email: 'paula@exemplo.test', role: 'admin', sectorId: null }
const agent = { id: 1, name: 'Paula Admin', email: 'paula@exemplo.test', role: 'agent', sectorId: 1 }
const me = () => (asAgent() ? agent : admin)

const sectors = [
  { id: 1, name: 'Suporte Sistemas' },
  { id: 2, name: 'Tributos Municipais' },
]

const names = [
  'João da Silva Exemplo', 'Ana Pereira Teste', 'Pedro Amostra', 'Fernanda Lima Demo',
  'Ricardo Fictício', 'Juliana Modelo', 'Marcos Protótipo', 'Larissa Simulada',
  'Tiago Rascunho', 'Camila Ensaio', 'Bruno Hipotético', 'Patrícia Exemplar',
  'Diego Imaginário', 'Renata Provisória', 'Otávio Esboço', 'Sílvia Maquete',
]
const orgs = [
  ['Prefeitura de Vila Fictícia', 'Vila Fictícia'],
  ['Câmara de Monte Imaginário', 'Monte Imaginário'],
  ['Secretaria de Saúde de Rio Inventado', 'Rio Inventado'],
]
const lines = [
  'Bom dia, não consigo emitir a certidão negativa pelo portal.',
  'A guia do ISS está vindo com o valor errado.',
  'Olá, o contracheque de outubro não aparece.',
  'O sistema pede uma senha que eu não tenho.',
  'Consegue ver se o protocolo foi registrado?',
]

type Summary = {
  id: number
  sectorId: number
  status: 'queued' | 'in_progress'
  mine: boolean
  i: number
}
const rows: Summary[] = [
  ...Array.from({ length: 14 }, (_, i) => ({ id: 300 + i, sectorId: 1, status: 'in_progress' as const, mine: true, i })),
  ...Array.from({ length: 12 }, (_, i) => ({ id: 400 + i, sectorId: 1 + (i % 2), status: 'queued' as const, mine: false, i: i + 2 })),
]
const visibleRows = () => (few() ? rows.filter((r) => r.i < 3 || (r.status === 'queued' && r.i < 4)) : rows)

const summary = (r: Summary) => {
  const [org, mun] = orgs[r.i % orgs.length]
  return {
    id: r.id,
    protocol: `2026111300${r.id}`,
    status: r.status,
    arrivedAt: ago(5 + r.i * 7),
    assignedAt: r.status === 'in_progress' ? ago(4 + r.i * 7) : null,
    contact: { id: 1000 + r.id, name: names[r.i % names.length], phone: '+55 00 90000-0000', registered: true },
    organizationName: org,
    municipalityName: mun,
    assignee: r.status === 'in_progress' ? { id: me().id, name: me().name } : null,
    lastMessage: { type: 'text', body: lines[r.i % lines.length], origin: 'customer', sentAt: ago(2 + r.i * 6) },
  }
}

const detail = (id: number) => {
  const r = rows.find((x) => x.id === id)!
  const s = summary(r)
  const [org, mun] = orgs[r.i % orgs.length]
  return {
    id: r.id,
    protocol: s.protocol,
    status: r.status,
    sector: { id: r.sectorId, name: sectors.find((x) => x.id === r.sectorId)!.name },
    spokeWith: null,
    arrivedAt: s.arrivedAt,
    assignedAt: s.assignedAt,
    startedAt: s.arrivedAt,
    endedAt: null,
    closedAt: null,
    subject: null,
    resolution: null,
    contact: s.contact,
    organization: { id: 31, name: org, municipality: { id: 1, name: mun } },
    assignee: s.assignee,
    closedBy: null,
    closureType: null,
    previous: null,
    next: null,
  }
}

const chat = [
  'Bom dia, não consigo emitir a certidão negativa pelo portal.',
  'Bom dia! Vou verificar. Qual é o CNPJ do órgão?',
  'É o da prefeitura, o cadastro é o mesmo de sempre.',
  'Certo. Aparece alguma mensagem de erro?',
  'Diz que existe pendência, mas já pagamos tudo.',
  'Vou olhar as guias do último trimestre.',
  'Obrigado, aguardo.',
  'Encontrei uma guia de setembro ainda em aberto no sistema.',
  'Mas ela foi paga no dia 10, tenho o comprovante.',
  'Pode me enviar o comprovante por aqui?',
]
const messages = (ticketId: number) =>
  Array.from({ length: 34 }, (_, i) => {
    const inbound = i % 2 === 0
    return {
      id: ticketId * 100 + i,
      ticketId,
      direction: inbound ? 'inbound' : 'outbound',
      origin: inbound ? 'customer' : 'agent',
      type: 'text',
      body: chat[i % chat.length],
      status: inbound ? null : 'read',
      failureReason: null,
      sentAt: ago(120 - i * 3),
      author: inbound ? null : { id: me().id, name: me().name },
      media: null,
    }
  })

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown } | null {
  const method = init?.method ?? 'GET'
  const [route] = path.split('?')
  let m: RegExpMatchArray | null
  if (route === '/auth/me') return { data: me() }
  if (route === '/sectors')
    return {
      data: (asAgent() ? sectors.filter((s) => s.id === 1) : sectors).map((s) => ({
        ...s,
        email: null,
        phone: '+55 00 3000-0000',
        provider: 'fake',
        connectionStatus: 'connected',
        lastConnectedAt: ago(60),
        active: true,
      })),
    }
  if ((m = route.match(/^\/sectors\/(\d+)\/tickets$/))) {
    const id = Number(m[1])
    return { data: visibleRows().filter((r) => r.sectorId === id).map(summary) }
  }
  if ((m = route.match(/^\/tickets\/(\d+)$/))) return { data: detail(Number(m[1])) }
  if ((m = route.match(/^\/tickets\/(\d+)\/messages$/)) && method === 'GET')
    return { data: few() ? messages(Number(m[1])).slice(0, 4) : messages(Number(m[1])) }
  if ((m = route.match(/^\/tickets\/(\d+)\/assignments$/)))
    return {
      data: [
        { id: 1, action: 'ticket_assigned', createdAt: ago(121), actor: { id: me().id, name: me().name }, fromName: null, toName: null, toSectorName: null, reason: null },
      ],
    }
  if ((m = route.match(/^\/tickets\/(\d+)\/closing-form$/)))
    return {
      data: {
        modules: [{ id: 1, name: 'Tributos' }],
        subjects: Array.from({ length: 18 }, (_, i) => ({
          id: i + 1,
          name: `Assunto fictício ${i + 1}`,
          moduleId: 1,
          moduleName: 'Tributos',
          solutions: [{ id: i + 1, body: 'Solução de exemplo para consulta.' }],
        })),
        contactModuleIds: [],
        organization: null,
        startedAt: ago(120),
      },
    }
  if ((m = route.match(/^\/sectors\/(\d+)\/subjects$/)))
    return {
      data: Array.from({ length: 18 }, (_, i) => ({
        id: i + 1,
        sectorId: Number(m![1]),
        name: `Assunto fictício ${i + 1}`,
        moduleId: 1,
        solutions: [{ id: i + 1, subjectId: i + 1, body: 'Solução de exemplo.' }],
      })),
    }
  if ((m = route.match(/^\/sectors\/(\d+)\/modules$/)))
    return { data: [{ id: 1, sectorId: Number(m[1]), name: 'Tributos', active: true }] }
  return { data: method === 'GET' ? [] : undefined }
}
