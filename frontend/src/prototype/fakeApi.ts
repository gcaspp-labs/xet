// PROTÓTIPO #262: cópia da API falsa do #247, só pra ter telas com dados fictícios nas capturas.
// PROTÓTIPO #239 (base: #203 e: API falsa do #178/#199): descartável, não vai para a main.
// API falsa em memória, só em desenvolvimento: dados fictícios para as capturas
// (o repositório é público). Nada é gravado; recarregar a página zera tudo.
// ?as=agent (padrão) atendente; ?as=supervisor supervisor do setor; ?as=admin administrador.
// /chamados/300 chamado meu em atendimento; /chamados/400 chamado na fila;
// /chamados/500 chamado em atendimento de outra pessoa (Carlos Colega).
import { ApiError } from '@/lib/api'

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()
const params = () => new URLSearchParams(window.location.search)
const role = () => params().get('as') ?? 'agent'
const asAgent = () => role() !== 'admin'
const few = () => params().get('poucos') === '1'

const admin = {
  id: 1,
  name: 'Paula Admin',
  email: 'paula@exemplo.test',
  role: 'admin',
  sectorId: null,
}
const agent = {
  id: 1,
  name: 'Paula Souza',
  email: 'paula.souza@exemplo.test',
  role: 'agent',
  sectorId: 1,
}
const supervisor = { ...agent, role: 'supervisor' }
const me = () => (role() === 'admin' ? admin : role() === 'supervisor' ? supervisor : agent)
const colleague = { id: 2, name: 'Carlos Colega' }

const sectors = [
  { id: 1, name: 'Suporte Sistemas' },
  { id: 2, name: 'Tributos Municipais' },
]

const names = [
  'João da Silva Exemplo',
  'Ana Pereira Teste',
  'Pedro Amostra',
  'Fernanda Lima Demo',
  'Ricardo Fictício',
  'Juliana Modelo',
  'Marcos Protótipo',
  'Larissa Simulada',
  'Tiago Rascunho',
  'Camila Ensaio',
  'Bruno Hipotético',
  'Patrícia Exemplar',
  'Diego Imaginário',
  'Renata Provisória',
  'Otávio Esboço',
  'Sílvia Maquete',
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
const other = { id: 500, sectorId: 1, status: 'in_progress' as const, mine: false, i: 5 }
const rows: Summary[] = [
  ...Array.from({ length: 14 }, (_, i) => ({
    id: 300 + i,
    sectorId: 1,
    status: 'in_progress' as const,
    mine: true,
    i,
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    id: 400 + i,
    sectorId: 1 + (i % 2),
    status: 'queued' as const,
    mine: false,
    i: i + 2,
  })),
]
const visibleRows = () =>
  few() ? rows.filter((r) => r.i < 3 || (r.status === 'queued' && r.i < 4)) : rows

const summary = (r: Summary) => {
  const [org, mun] = orgs[r.i % orgs.length]
  return {
    id: r.id,
    protocol: `2026111400${r.id}`,
    status: r.status,
    arrivedAt: ago(5 + r.i * 7),
    assignedAt: r.status === 'in_progress' ? ago(4 + r.i * 7) : null,
    contact: {
      id: 1000 + r.id,
      name: names[r.i % names.length],
      phone: r.id === 301 ? '' : '5500912345678',
      registered: true,
    },
    organizationName: org,
    municipalityName: mun,
    assignee:
      r.status === 'in_progress' ? (r.mine ? { id: me().id, name: me().name } : colleague) : null,
    lastMessage: {
      type: 'text',
      body: lines[r.i % lines.length],
      origin: 'customer',
      sentAt: ago(2 + r.i * 6),
    },
  }
}

// PROTÓTIPO #239: /atendimentos/600 encerrado com telefone; /atendimentos/601 encerrado sem telefone.
const closedDetail = (id: number) => {
  const base = detail(300 + (id - 600))
  return {
    ...base,
    id,
    protocol: `2026111400${id}`,
    status: 'closed',
    endedAt: ago(30),
    closedAt: ago(30),
    closedBy: { id: me().id, name: me().name },
    closureType: 'resolved',
    contact: { ...base.contact, id: 1000 + id },
  }
}

const detail = (id: number): ReturnType<typeof detailOf> => detailOf(id)
const detailOf = (id: number) => {
  const r = [...rows, other].find((x) => x.id === id)!
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

export const chat = [
  'Bom dia, não consigo emitir a certidão negativa pelo portal.',
  'Bom dia! 😊 Vou verificar. Qual é o CNPJ do órgão?',
  'É o da prefeitura, o cadastro é o mesmo de sempre.',
  'Certo. Aparece alguma mensagem de erro?',
  'Diz que existe pendência, mas já pagamos tudo.',
  'Vou olhar as guias do último trimestre.',
  'Obrigado, aguardo. 🙏',
  'Encontrei uma guia de setembro ainda em aberto no sistema.',
  'Mas ela foi paga no dia 10, tenho o comprovante 👍',
  'Pode me enviar o comprovante por aqui?',
]
// PROTÓTIPO #203: conversa curta com citações recebidas e enviadas, e os casos sem citar.
// Citação: de uma mensagem do XET (pelo id), do WhatsApp (trecho) ou indisponível.
export type Quote =
  | { source: 'xet'; messageId: number; author: string; preview: string }
  | { source: 'whatsapp'; author: string; preview: string }
  | { source: 'unavailable' }
type Seed = [dir: 'in' | 'out', body: string | null, extra?: Record<string, unknown>]
const pdf = { id: 1, mimeType: 'application/pdf', fileName: 'contrato-2026.pdf', sizeBytes: 182_000, durationSeconds: null }
const ogg = { id: 2, mimeType: 'audio/ogg', fileName: null, sizeBytes: 24_000, durationSeconds: 14 }
const seeds: Seed[] = [
  ['in', 'Bom dia, preciso da segunda via do contrato e do boleto de outubro.'],
  ['out', 'Bom dia! Vou separar os dois. Pode me mandar o contrato assinado?'],
  ['in', null, { type: 'document', media: pdf }],
  ['in', null, { type: 'audio', media: ogg }],
  ['out', 'Recebi o contrato, obrigada. Já vou ouvir o áudio.', { quote: { source: 'xet', messageId: 2, author: 'Cliente', preview: '📎 contrato-2026.pdf' } }],
  ['in', 'Aquele cadastro que vocês iam corrigir, já foi?', { quote: { source: 'whatsapp', author: 'Setor', preview: 'Vamos verificar o cadastro do órgão e retornamos até sexta-feira.' } }],
  ['in', null, { type: 'unsupported' }],
  ['out', 'Sim, já foi corrigido ontem à tarde.', { quote: { source: 'xet', messageId: 5, author: 'Cliente', preview: 'Aquele cadastro que vocês iam corrigir, já foi?' } }],
  ['in', 'Deu pra ouvir o áudio?', { quote: { source: 'xet', messageId: 3, author: 'Cliente', preview: '🎤 Áudio (0:14)' } }],
  ['in', 'Valeu!', { quote: { source: 'unavailable' } }],
  ['out', 'O boleto de outubro segue em anexo.', { status: 'failed', failureReason: 'Não enviada', quote: { source: 'xet', messageId: 0, author: 'Cliente', preview: 'Bom dia, preciso da segunda via do contrato e do boleto de outubro.' } }],
  ['out', 'Mais alguma coisa em que posso ajudar?', { status: 'pending' }],
]
const sent: Record<number, Record<string, unknown>[]> = {}
export const proto: { quote: Quote | null } = { quote: null }
const messages = (ticketId: number) => [
  ...seeds.map(([dir, body, extra], i) => {
    const inbound = dir === 'in'
    const { quote, ...rest } = (extra ?? {}) as { quote?: Quote }
    return {
      id: ticketId * 100 + i,
      ticketId,
      direction: inbound ? 'inbound' : 'outbound',
      origin: inbound ? 'customer' : 'agent',
      type: 'text',
      body,
      status: inbound ? null : 'read',
      failureReason: null,
      sentAt: ago(40 - i * 3),
      author: inbound ? null : ticketId === 500 ? colleague : { id: me().id, name: me().name },
      media: null,
      reactions: { customer: null, sector: null },
      quote: quote && quote.source === 'xet' ? { ...quote, messageId: ticketId * 100 + quote.messageId } : quote ?? null,
      ...rest,
    }
  }),
  ...(sent[ticketId] ?? []),
]

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown } | null {
  const method = init?.method ?? 'GET'
  const [route] = path.split('?')
  let m: RegExpMatchArray | null
  // PROTÓTIPO #262: ?deslogado=1 mostra a tela de login.
  if (route === '/auth/me' && params().has('deslogado')) throw new ApiError(401, 'Não autenticado')
  if (route === '/auth/me') return { data: me() }
  // PROTÓTIPO #247: setores de destino; ?estado=sem-setores devolve a lista vazia.
  if (route.match(/^\/tickets\/\d+\/transfer-sectors$/))
    return {
      data:
        params().get('estado') === 'sem-setores'
          ? []
          : [
              { id: 2, name: 'Tributos Municipais' },
              { id: 3, name: 'Recursos Humanos' },
              { id: 4, name: 'Contabilidade Pública' },
            ],
    }
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
    return {
      data: visibleRows()
        .filter((r) => r.sectorId === id)
        .map(summary),
    }
  }
  if ((m = route.match(/^\/tickets\/(\d+)$/)))
    return { data: Number(m[1]) >= 600 ? closedDetail(Number(m[1])) : detail(Number(m[1])) }
  if ((m = route.match(/^\/tickets\/(\d+)\/messages$/)) && method === 'POST') {
    const id = Number(m[1])
    const b = init?.body
    const text = b instanceof FormData ? String(b.get('caption') ?? '') : (b as { body: string }).body
    const message = {
      id: id * 100 + 50 + (sent[id]?.length ?? 0),
      ticketId: id,
      direction: 'outbound',
      origin: 'agent',
      type: b instanceof FormData ? (b.get('voice') ? 'audio' : 'document') : 'text',
      body: text || null,
      status: 'sent',
      failureReason: null,
      sentAt: new Date().toISOString(),
      author: { id: me().id, name: me().name },
      media: null,
      quote: proto.quote,
    }
    ;(sent[id] ??= []).push(message)
    return { data: message }
  }
  if ((m = route.match(/^\/tickets\/(\d+)\/messages$/)) && method === 'GET')
    return { data: few() ? messages(Number(m[1])).slice(0, 4) : messages(Number(m[1])) }
  if ((m = route.match(/^\/tickets\/(\d+)\/assignments$/)))
    return {
      data: [
        {
          id: 1,
          action: 'ticket_assigned',
          createdAt: ago(121),
          actor: { id: me().id, name: me().name },
          fromName: null,
          toName: null,
          toSectorName: null,
          reason: null,
        },
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
