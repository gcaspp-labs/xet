// PROTÓTIPO #164 — descartável. Chamados fictícios para a lista Atendimento.
// Filtro, busca, ordem e página são feitos aqui no navegador só para o protótipo;
// na implementação, tudo isso é do servidor.

export type Situation = 'queued' | 'in_progress' | 'resolved' | 'transferred' | 'cancelled'

export const situationLabels: Record<
  Situation,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  queued: { label: 'Na fila', tone: 'warning' },
  in_progress: { label: 'Em atendimento', tone: 'success' },
  resolved: { label: 'Encerrado', tone: 'neutral' },
  transferred: { label: 'Transferido', tone: 'neutral' },
  cancelled: { label: 'Cancelado', tone: 'danger' },
}

export const sectors = [
  { id: 1, name: 'Suporte Sistemas' },
  { id: 2, name: 'Tributos' },
  { id: 3, name: 'Ouvidoria' },
]

export const people = [
  { id: 1, name: 'Marina Teste', sectorId: 1 },
  { id: 2, name: 'João Exemplo', sectorId: 1 },
  { id: 3, name: 'Carla Fictícia', sectorId: 1 },
  { id: 4, name: 'Rui Modelo', sectorId: 2 },
  { id: 5, name: 'Lia Amostra', sectorId: 2 },
  { id: 6, name: 'Davi Ensaio', sectorId: 3 },
]

export const modules = [
  { id: 1, name: 'Portal do contribuinte', sectorId: 1 },
  { id: 2, name: 'Folha de pagamento', sectorId: 1 },
  { id: 3, name: 'Protocolo', sectorId: 1 },
  { id: 4, name: 'IPTU', sectorId: 2 },
  { id: 5, name: 'ISS', sectorId: 2 },
  { id: 6, name: 'Reclamações', sectorId: 3 },
]

const subjectsBySector: Record<number, string[]> = {
  1: ['Acesso ao portal', 'Senha', 'Emissão de contracheque', 'Erro ao gerar relatório', 'Cadastro de servidor'],
  2: ['Certidão negativa', 'Segunda via de boleto', 'Parcelamento', 'Nota fiscal de serviço'],
  3: ['Reclamação de atendimento', 'Sugestão'],
}

const organizations = [
  'Prefeitura de Vila Fictícia',
  'Câmara de Monte Exemplo',
  'Prefeitura de São Teste',
  'Instituto de Previdência de Lagoa Modelo',
  'Prefeitura de Rio Amostra',
  'Consórcio Intermunicipal Ensaio',
]

const contacts = [
  'Ana Souza Teste',
  'Bruno Lima Exemplo',
  'Cecília Ramos',
  'Diego Fictício',
  'Elisa Moura',
  'Fábio Nunes Teste',
  'Gabriela Prado',
  'Heitor Amostra',
  'Isabela Costa',
  'Jorge Modelo',
  'Karen Dias',
  'Lucas Ensaio',
]

export type ProtoTicket = {
  id: number
  protocol: string
  contact: { name: string; phone: string }
  organization: string | null
  sectorId: number
  sectorName: string
  assignee: string | null
  subject: string | null
  modules: string[]
  situation: Situation
  transferredTo?: string
  arrivedAt: Date
  closedAt: Date | null
  // Data da linha, do filtro e da ordem: chegada para abertos, encerramento para os demais.
  date: Date
}

// Gerador determinístico: as capturas saem iguais a cada execução.
let seed = 7
function rand() {
  seed = (seed * 9301 + 49297) % 233280
  return seed / 233280
}
function pick<T>(list: T[]) {
  return list[Math.floor(rand() * list.length)]
}

const now = new Date('2026-11-13T15:40:00-03:00')

function build(): ProtoTicket[] {
  const list: ProtoTicket[] = []
  for (let i = 0; i < 68; i++) {
    const sectorId = i % 5 === 3 ? 2 : i % 7 === 5 ? 3 : 1
    const sector = sectors.find((s) => s.id === sectorId)!
    // Os mais recentes ainda estão abertos.
    const ageMin = i < 4 ? 8 + i * 11 : i < 9 ? 30 + i * 9 : 60 * (i * 3 + rand() * 5)
    const arrivedAt = new Date(now.getTime() - ageMin * 60_000)
    let situation: Situation
    if (i < 4) situation = 'queued'
    else if (i < 9) situation = 'in_progress'
    else situation = pick<Situation>(['resolved', 'resolved', 'resolved', 'resolved', 'transferred', 'cancelled'])
    const open = situation === 'queued' || situation === 'in_progress'
    const closedAt = open ? null : new Date(arrivedAt.getTime() + (20 + rand() * 600) * 60_000)
    const sectorPeople = people.filter((p) => p.sectorId === sectorId)
    const sectorModules = modules.filter((m) => m.sectorId === sectorId).map((m) => m.name)
    const mods =
      situation === 'queued'
        ? []
        : rand() < 0.25 && sectorModules.length > 1
          ? sectorModules.slice(0, 2)
          : [pick(sectorModules)]
    list.push({
      id: 1000 + i,
      protocol: `2026${String(11130 - i * 3).padStart(6, '0')}`,
      contact: {
        name: pick(contacts),
        phone: `(00) 9${String(Math.floor(rand() * 9000) + 1000)}-${String(Math.floor(rand() * 9000) + 1000)}`,
      },
      organization: rand() < 0.1 ? null : pick(organizations),
      sectorId,
      sectorName: sector.name,
      assignee: situation === 'queued' ? null : pick(sectorPeople).name,
      subject: open && situation === 'queued' ? null : open ? null : pick(subjectsBySector[sectorId]),
      modules: mods,
      situation,
      transferredTo:
        situation === 'transferred' ? pick(sectors.filter((s) => s.id !== sectorId)).name : undefined,
      arrivedAt,
      closedAt,
      date: closedAt ?? arrivedAt,
    })
  }
  // Um chamado que chegou ontem e foi encerrado hoje (critério da #164).
  const t = list[9]
  t.arrivedAt = new Date('2026-11-12T17:50:00-03:00')
  t.closedAt = new Date('2026-11-13T09:12:00-03:00')
  t.date = t.closedAt
  t.situation = 'resolved'
  t.transferredTo = undefined
  t.subject = 'Senha'
  return list
}

export const tickets = build()

export const allSubjects = Object.values(subjectsBySector).flat()

export const today = now
