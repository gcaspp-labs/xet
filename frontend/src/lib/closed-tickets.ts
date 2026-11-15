import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@/lib/api'
import { useCurrentUser } from '@/lib/auth'
import { type Page, pageParams, type PageRequest, useQueryState } from '@/lib/paging'

export type ClosureType = 'resolved' | 'transferred' | 'cancelled'

type Ref = { id: number; name: string }

// Um chamado encerrado da lista de Atendimentos. `closedAt` é o momento real do
// encerramento, também nos transferidos e cancelados.
export type ClosedTicket = {
  id: number
  protocol: string
  closureType: ClosureType | null
  closedAt: string | null
  subject: string | null
  contact: { id: number; name: string; phone: string | null; registered: boolean }
  organizationName: string | null
  municipalityName: string | null
  sector: Ref
  assignee: Ref | null
  // Setor de destino de um transferido.
  transferredTo: Ref | null
  modules: string[]
}

export type ClosedTicketSort =
  'protocol' | 'date' | 'contact' | 'organization' | 'sector' | 'assignee' | 'subject' | 'situation'

// Colunas da tela (no endereço) ligadas às da API; Módulos não ordena.
export const closedTicketColumns: Record<string, ClosedTicketSort> = {
  protocolo: 'protocol',
  data: 'date',
  contato: 'contact',
  orgao: 'organization',
  setor: 'sector',
  responsavel: 'assignee',
  assunto: 'subject',
  situacao: 'situation',
}

// Abre pelo encerramento mais recente.
export const defaultClosedTicketColumn = 'data'

export type PeriodChoice = 'all' | 'today' | '7d' | '30d' | 'custom'

// Valor de cada período no endereço; "todo o período" é a ausência dele.
const periodParams: Record<Exclude<PeriodChoice, 'all'>, string> = {
  today: 'hoje',
  '7d': '7d',
  '30d': '30d',
  custom: 'datas',
}

export const closedTicketsKey = ['closed-tickets']

export type ClosedTicketFilterOptions = {
  assignees: { id: number; name: string; active: boolean }[]
  modules: { id: number; name: string; active: boolean }[]
}

function positiveId(raw: string | null) {
  return raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : undefined
}

// Busca e filtros guardados no endereço (?busca=, ?periodo=, ?de=, ?ate=, ?setor=,
// ?responsavel=, ?modulo=, ?assunto=), para voltar à mesma lista; mudar qualquer um volta
// à página 1. Atendente e supervisor ficam no próprio setor, seja o que for que o endereço
// diga; responsável e módulo pertencem a um setor, então o administrador só os usa depois
// de escolher um, e trocar de setor limpa os dois.
export function useClosedTicketsFilter() {
  const { data: user } = useCurrentUser()
  const { params, update } = useQueryState()
  const isAdmin = user?.role === 'admin'

  const sectorId = isAdmin ? positiveId(params.get('setor')) : undefined
  // O servidor usa o setor da pessoa quando não vem nenhum.
  const hasSector = isAdmin ? sectorId !== undefined : user !== undefined
  const assigneeId = hasSector ? positiveId(params.get('responsavel')) : undefined
  const moduleId = hasSector ? positiveId(params.get('modulo')) : undefined
  const query = params.get('busca') ?? ''
  const subject = params.get('assunto') ?? ''

  const periodParam = params.get('periodo')
  const period: PeriodChoice =
    (Object.entries(periodParams).find(([, value]) => value === periodParam)?.[0] as
      Exclude<PeriodChoice, 'all'> | undefined) ?? 'all'
  const from = period === 'custom' ? (params.get('de') ?? '') : ''
  const to = period === 'custom' ? (params.get('ate') ?? '') : ''
  // Datas no formato do campo (AAAA-MM-DD) comparam certo como texto; falta uma ou as duas é válido.
  const datesValid = !from || !to || from <= to

  const search = useMemo(() => {
    const next = new URLSearchParams()
    if (query.trim()) {
      next.set('q', query.trim())
    }
    if (period === 'custom') {
      if (from) {
        next.set('from', from)
      }
      if (to) {
        next.set('to', to)
      }
    } else if (period !== 'all') {
      next.set('period', period)
    }
    if (sectorId !== undefined) {
      next.set('sectorId', String(sectorId))
    }
    if (assigneeId !== undefined) {
      next.set('assigneeId', String(assigneeId))
    }
    if (moduleId !== undefined) {
      next.set('moduleId', String(moduleId))
    }
    if (subject.trim()) {
      next.set('subject', subject.trim())
    }
    return next
  }, [query, period, from, to, sectorId, assigneeId, moduleId, subject])

  return {
    isAdmin,
    hasSector,
    sectorId,
    assigneeId,
    moduleId,
    query,
    subject,
    period,
    from,
    to,
    datesValid,
    search,
    // Digitar não enche o histórico do navegador: cada tecla troca a entrada atual.
    setQuery: (value: string) => update({ busca: value === '' ? null : value, pagina: null }, true),
    setSubject: (value: string) =>
      update({ assunto: value === '' ? null : value, pagina: null }, true),
    setSector: (value: number | undefined) =>
      update({
        setor: value === undefined ? null : String(value),
        responsavel: null,
        modulo: null,
        pagina: null,
      }),
    setAssignee: (value: number | undefined) =>
      update({ responsavel: value === undefined ? null : String(value), pagina: null }),
    setModule: (value: number | undefined) =>
      update({ modulo: value === undefined ? null : String(value), pagina: null }),
    setPeriod: (value: PeriodChoice) =>
      update({
        periodo: value === 'all' ? null : periodParams[value],
        de: null,
        ate: null,
        pagina: null,
      }),
    setDate: (name: 'de' | 'ate', value: string) =>
      update({ [name]: value === '' ? null : value, pagina: null }),
  }
}

export type ClosedTicketsFilter = ReturnType<typeof useClosedTicketsFilter>

// Chamados encerrados da lista de Atendimentos, recarregados pelos avisos de chamado do WebSocket.
export function useClosedTickets(
  filter: ClosedTicketsFilter,
  request: PageRequest<ClosedTicketSort>,
) {
  const query = new URLSearchParams(filter.search)
  for (const [name, value] of Object.entries(pageParams(request))) {
    query.set(name, value)
  }
  return useQuery({
    queryKey: [...closedTicketsKey, 'list', query.toString()],
    queryFn: () => api<Page<ClosedTicket>>(`/closed-tickets?${query.toString()}`),
    enabled: filter.datesValid,
    placeholderData: keepPreviousData,
  })
}

// Responsáveis e módulos do setor, para os filtros. O administrador só os tem depois de
// escolher o setor.
export function useClosedTicketFilterOptions(filter: ClosedTicketsFilter) {
  return useQuery({
    queryKey: [...closedTicketsKey, 'filters', filter.sectorId ?? 'own'],
    queryFn: () =>
      api<ClosedTicketFilterOptions>(
        `/closed-tickets/filters${filter.sectorId === undefined ? '' : `?sectorId=${filter.sectorId}`}`,
      ),
    enabled: filter.hasSector,
  })
}

// Sugestões do filtro de assunto: assuntos de chamados encerrados que contêm o texto, no
// setor da pessoa ou, para o administrador, no setor escolhido (ou em todos).
export function useClosedTicketSubjects(filter: ClosedTicketsFilter, text: string) {
  const query = new URLSearchParams()
  if (filter.sectorId !== undefined) {
    query.set('sectorId', String(filter.sectorId))
  }
  if (text.trim()) {
    query.set('q', text.trim())
  }
  return useQuery({
    queryKey: [...closedTicketsKey, 'subjects', query.toString()],
    queryFn: () => api<string[]>(`/closed-tickets/subjects?${query.toString()}`),
    placeholderData: keepPreviousData,
  })
}
