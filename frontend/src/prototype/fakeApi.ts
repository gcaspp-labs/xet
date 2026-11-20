// PROTÓTIPO #130: descartável, não vai para a main.
// API falsa em memória, só em desenvolvimento: dados fictícios para as capturas
// (o repositório é público). Nada é gravado; recarregar a página zera tudo.
// A paginação e a ordenação acontecem aqui, no "servidor", para o protótipo mostrar
// o contrato real: só os itens da página, o total filtrado e a página devolvida.

const params = () => new URLSearchParams(window.location.search)

const admin = {
  id: 1,
  name: 'Paula Admin',
  email: 'paula@exemplo.test',
  role: 'admin',
  sectorId: null,
}

const sectors = [
  {
    id: 1,
    name: 'Tributos Municipais',
    email: 'tributos@exemplo.test',
    phone: null,
    provider: 'whatsapp',
    connectionStatus: 'connected',
    lastConnectedAt: null,
    active: true,
  },
  {
    id: 2,
    name: 'Suporte Sistemas',
    email: 'suporte@exemplo.test',
    phone: null,
    provider: 'whatsapp',
    connectionStatus: 'connected',
    lastConnectedAt: null,
    active: true,
  },
  {
    id: 3,
    name: 'Licenciamento',
    email: 'licenciamento@exemplo.test',
    phone: null,
    provider: 'whatsapp',
    connectionStatus: 'disconnected',
    lastConnectedAt: null,
    active: true,
  },
]

type Row = [
  name: string,
  role: 'admin' | 'supervisor' | 'agent',
  sectorId: number | null,
  active: boolean,
]

// Nomes fictícios; papel e setor variados, com gente inativa misturada.
const rows: Row[] = [
  ['Adriana Ferraz', 'agent', 1, true],
  ['Alessandra Bastos', 'supervisor', 2, true],
  ['Alexandre Prado', 'agent', 3, false],
  ['Aline Queiroz', 'agent', 1, true],
  ['André Sampaio', 'agent', 2, true],
  ['Beatriz Nogueira', 'agent', 1, true],
  ['Bruno Tavares', 'agent', 3, true],
  ['Camila Rondon', 'agent', 2, false],
  ['Carla Vasconcelos', 'supervisor', 1, true],
  ['Cláudio Meireles', 'agent', 3, true],
  ['Daniela Furtado', 'agent', 2, true],
  ['Diego Anchieta', 'agent', 1, false],
  ['Eduardo Salles', 'agent', 3, true],
  ['Elaine Portela', 'agent', 2, true],
  ['Fábio Junqueira', 'agent', 1, true],
  ['Fernanda Moura', 'supervisor', 3, true],
  ['Gabriel Peixoto', 'agent', 2, true],
  ['Giovana Rezende', 'agent', 1, true],
  ['Helena Cordeiro', 'admin', null, true],
  ['Hugo Marchetti', 'agent', 3, false],
  ['Isabela Fontes', 'agent', 2, true],
  ['Jéssica Antunes', 'agent', 1, true],
  ['João Vitor Assis', 'agent', 3, true],
  ['Juliana Espósito', 'agent', 2, true],
  ['Leandro Coutinho', 'agent', 1, true],
  ['Lúcia Brandão', 'agent', 3, true],
  ['Marcelo Vidigal', 'agent', 2, false],
  ['Mariana Prado', 'supervisor', 1, true],
  ['Nelson Kubitschek', 'agent', 3, true],
  ['Patrícia Amaral', 'agent', 2, true],
  ['Rafael Bittencourt', 'agent', 1, true],
  ['Renata Salgado', 'agent', 3, true],
  ['Rodrigo Vilela', 'agent', 2, true],
  ['Sandra Lemos', 'agent', 1, false],
  ['Thiago Bastos', 'admin', null, true],
  ['Vanessa Rios', 'agent', 3, true],
]

const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/ /g, '.')

const users = rows.map(([name, role, sectorId, active], index) => ({
  id: index + 1,
  name,
  nickname: name.split(' ')[0],
  email: `${slug(name)}@exemplo.test`,
  role,
  sectorId,
  active,
}))

const roleRank: Record<string, number> = { admin: 0, supervisor: 1, agent: 2 }
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
const sectorName = (id: number | null) =>
  id === null ? '' : (sectors.find((sector) => sector.id === id)?.name ?? '')

// Mesmo contrato dos Contatos: itens da página, total, página devolvida (a última,
// se a pedida passou dela) e 20 por página. A busca (?q=) filtra por nome, apelido ou
// e-mail antes de contar e paginar.
function userPage(query: URLSearchParams) {
  // Nomes que a API recebe do frontend (pageParams): page, sort, direction; e a busca, q.
  const sort = query.get('sort') ?? 'name'
  const direction = query.get('direction') === 'desc' ? 'desc' : 'asc'
  const term = normalize(query.get('q') ?? '')
  const pageSize = 20
  const sign = direction === 'asc' ? 1 : -1

  const found =
    term === ''
      ? users
      : users.filter((user) =>
          [user.name, user.nickname, user.email].some((field) => normalize(field).includes(term)),
        )

  const sorted = [...found].sort((a, b) => {
    let by = 0
    if (sort === 'role') {
      by = roleRank[a.role] - roleRank[b.role]
    } else if (sort === 'sector') {
      // Quem não tem setor (administrador) fica por último na ordem crescente.
      if (a.sectorId === null && b.sectorId !== null) return 1
      if (b.sectorId === null && a.sectorId !== null) return -1
      by = normalize(sectorName(a.sectorId)).localeCompare(normalize(sectorName(b.sectorId)))
    } else if (sort === 'status') {
      // Crescente: ativos primeiro; decrescente: inativos primeiro.
      by = a.active === b.active ? 0 : a.active ? -1 : 1
    } else {
      by = normalize(a.name).localeCompare(normalize(b.name))
    }
    if (by !== 0) return by * sign
    return (a.id - b.id) * sign
  })

  const total = sorted.length
  const last = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, Number(query.get('page')) || 1), last)
  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
  }
}

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown } | null {
  const method = init?.method ?? 'GET'
  const [route, search] = path.split('?')
  if (route === '/auth/me') return { data: admin }
  if (route === '/sectors') return { data: sectors }
  if (route === '/users' && method === 'GET') {
    // PROTÓTIPO: ?vazio=1 zera a lista, para a captura do estado vazio.
    if (params().get('vazio') === '1') {
      return { data: { items: [], total: 0, page: 1, pageSize: 20 } }
    }
    return { data: userPage(new URLSearchParams(search ?? '')) }
  }
  return { data: method === 'GET' ? [] : undefined }
}
