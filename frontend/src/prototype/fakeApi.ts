// PROTÓTIPO #150 — descartável, não vai para a main.
// Plano: uma versão (ajuste de telas existentes) da tela Assuntos (/assuntos), do formulário
// compartilhado (Encerrar em /chamados/101) e da aba Assuntos do chamado, com estes dados.
// API falsa em memória, só em desenvolvimento: dados fictícios para as capturas
// (o repositório é público). Nada é gravado; recarregar a página zera tudo.

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()

const user = {
  id: 1,
  name: 'Marina Teste',
  email: 'marina@exemplo.test',
  // Supervisora: abre a tela Assuntos e atende os próprios chamados.
  role: 'supervisor',
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

// Módulos do setor; o último está desativado.
const modules = [
  { id: 1, sectorId: 1, name: 'Tributos', active: true },
  { id: 2, sectorId: 1, name: 'Folha de pagamento', active: true },
  { id: 3, sectorId: 1, name: 'Portal do contribuinte', active: true },
  { id: 4, sectorId: 1, name: 'Protocolo antigo', active: false },
]

type FakeSubject = {
  id: number
  sectorId: number
  moduleId: number | null
  name: string
  solutions: { id: number; subjectId: number; body: string }[]
}

const sol = (subjectId: number, id: number, body: string) => ({ id, subjectId, body })

let subjects: FakeSubject[] = [
  {
    id: 11,
    sectorId: 1,
    moduleId: 3,
    name: 'Acesso ao portal',
    solutions: [
      sol(
        11,
        111,
        'Orientado a usar a opção "Esqueci minha senha" na tela de entrada. O link chega no e-mail cadastrado em até 10 minutos.',
      ),
      sol(
        11,
        112,
        'Usuário bloqueado após 5 tentativas. Desbloqueado pelo painel administrativo e orientado a trocar a senha no primeiro acesso.',
      ),
    ],
  },
  {
    id: 12,
    sectorId: 1,
    moduleId: 3,
    name: 'Senha',
    solutions: [
      sol(
        12,
        121,
        'Senha do portal redefinida pelo painel. Orientado a trocar no primeiro acesso.',
      ),
    ],
  },
  {
    id: 13,
    sectorId: 1,
    moduleId: 2,
    name: 'Senha',
    solutions: [
      sol(
        13,
        131,
        'Senha do contracheque: a mesma do sistema de folha. Redefinida pelo RH do órgão.',
      ),
    ],
  },
  {
    id: 14,
    sectorId: 1,
    moduleId: 1,
    name: 'Emissão de certidão',
    solutions: [
      sol(14, 141, longSolution),
      sol(
        14,
        142,
        'Certidão positiva com efeito de negativa: explicado que o documento é válido para licitações enquanto o parcelamento estiver em dia.',
      ),
    ],
  },
  {
    id: 15,
    sectorId: 1,
    moduleId: 1,
    name: 'Nota fiscal eletrônica',
    solutions: [
      sol(
        15,
        151,
        'Rejeição por CNPJ inválido. Orientado a conferir o cadastro do tomador e reenviar a nota.',
      ),
    ],
  },
  {
    id: 16,
    sectorId: 1,
    moduleId: 2,
    name: 'Holerite indisponível',
    solutions: [
      sol(
        16,
        161,
        'O fechamento da folha acontece no dia 25. Orientado a consultar de novo após essa data.',
      ),
    ],
  },
  {
    id: 17,
    sectorId: 1,
    moduleId: 4,
    name: 'Digitalização de processos',
    solutions: [
      sol(
        17,
        171,
        'Processos anteriores a 2020 ficam no arquivo físico. Orientado a pedir cópia ao protocolo.',
      ),
    ],
  },
  // Assuntos antigos, sem módulo: ficam fora do atendimento até serem classificados.
  {
    id: 18,
    sectorId: 1,
    moduleId: null,
    name: 'Relatórios gerenciais',
    solutions: [sol(18, 181, 'Relatório em branco: filtro de período fora do exercício.')],
  },
  { id: 19, sectorId: 1, moduleId: null, name: 'Cadastro de usuário', solutions: [] },
  { id: 20, sectorId: 1, moduleId: null, name: 'Dúvida geral', solutions: [] },
]

const withModule = (s: FakeSubject) => {
  const m = modules.find((item) => item.id === s.moduleId)
  return { ...s, module: m ? { id: m.id, name: m.name, active: m.active } : null }
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'pt-BR')

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
        modules: modules.filter((m) => m.active).map(({ id, name }) => ({ id, name })),
        // Com o módulo de cada assunto; os sem módulo não vêm.
        subjects: subjects
          .filter((s) => s.moduleId !== null)
          .map((s) => ({
            id: s.id,
            moduleId: s.moduleId,
            moduleName: withModule(s).module!.name,
            name: s.name,
            solutions: s.solutions,
          }))
          .sort(byName),
        contactModuleIds: [],
        organization: {
          id: 301,
          name: 'Prefeitura de Vila Fictícia',
          municipality: { id: 701, name: 'Vila Fictícia' },
        },
        startedAt: ago(20),
      },
    }
  if (path.match(/^\/sectors\/\d+\/modules$/)) return { data: modules }
  if ((m = path.match(/^\/sectors\/\d+\/subjects(?:\?module=(\w+))?$/))) {
    if (method === 'POST') {
      const body = init?.body as { name: string; moduleId: number }
      const created = {
        id: ++nextId,
        sectorId: 1,
        moduleId: body.moduleId,
        name: body.name.trim(),
        solutions: [],
      }
      subjects.push(created)
      return { data: withModule(created) }
    }
    const filter = m[1]
    const list = subjects
      .filter(
        (s) => !filter || (filter === 'none' ? s.moduleId === null : s.moduleId === Number(filter)),
      )
      .map(withModule)
      .sort(byName)
    return { data: list }
  }
  if ((m = path.match(/^\/sectors\/\d+\/subjects\/(\d+)$/))) {
    const id = Number(m[1])
    if (method === 'PUT') {
      const body = init?.body as { name: string; moduleId: number }
      subjects = subjects.map((s) =>
        s.id === id ? { ...s, name: body.name.trim(), moduleId: body.moduleId } : s,
      )
      return { data: withModule(subjects.find((s) => s.id === id)!) }
    }
    if (method === 'DELETE') {
      subjects = subjects.filter((s) => s.id !== id)
      return { data: undefined }
    }
  }
  if (path.match(/^\/(contacts|organizations)\/\d+\/tickets$/)) return { data: [] }
  return { data: method === 'GET' ? [] : undefined }
}
