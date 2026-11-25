import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '@/lib/api'
import { useCurrentUser } from '@/lib/auth'
import type { Organization } from '@/lib/directory'

// Sem applicable, o filtro ativo não vale para o número. Com applicable e sem
// value, uma média não tem chamados para calcular.
export type DashboardNumber = { applicable: boolean; value: number | null }

type Ref = { id: number; name: string }

export type DashboardAssignee = {
  user: Ref
  sector: Ref
  inProgress: DashboardNumber
  started: DashboardNumber
  resolved: DashboardNumber
  transferred: DashboardNumber
  cancelled: DashboardNumber
  averageHandlingSeconds: DashboardNumber
}

export type Dashboard = {
  period: { from: string; to: string }
  sectorId: number | null
  numbers: {
    queued: DashboardNumber
    inProgress: DashboardNumber
    received: DashboardNumber
    started: DashboardNumber
    resolved: DashboardNumber
    transferred: DashboardNumber
    cancelled: DashboardNumber
    averageWaitSeconds: DashboardNumber
    averageHandlingSeconds: DashboardNumber
  }
  assignees: DashboardAssignee[]
}

export type DashboardAssigneeOption = { id: number; name: string; active: boolean }

export const dashboardKey = ['dashboard']
export const dashboardAssigneesKey = (sectorId: number) => [
  'sectors',
  sectorId,
  'dashboard-assignees',
]

// Números do dashboard, recarregados pelos avisos de chamado do WebSocket.
export function useDashboard(search: string, enabled: boolean) {
  return useQuery({
    queryKey: [...dashboardKey, search],
    queryFn: () => api<Dashboard>(`/dashboard?${search}`),
    enabled,
    placeholderData: keepPreviousData,
  })
}

// Um chamado parado no quadro Pendentes do Dashboard: o contato, o motivo, desde quando e quem o
// marcou, com o setor para o administrador que vê todos (spec #332, #342).
export type DashboardPendingTicket = {
  id: number
  protocol: string
  contact: { id: number; name: string; phone: string | null; registered: boolean }
  reason: string | null
  pendingAt: string | null
  pendingBy: { id: number; name: string } | null
  sector: Ref
}

export type DashboardPendingBoard = { count: number; tickets: DashboardPendingTicket[] }

// O quadro Pendentes: os de agora, os que estão parados há mais tempo primeiro. O período dos
// números não o muda, e o recorte de setor é o mesmo do resto do Dashboard.
export function useDashboardPending(sectorId: number | undefined) {
  const search = sectorId === undefined ? '' : `?sectorId=${sectorId}`
  return useQuery({
    queryKey: [...dashboardKey, 'pending', search],
    queryFn: () => api<DashboardPendingBoard>(`/dashboard/pending${search}`),
    placeholderData: keepPreviousData,
  })
}

// Quem é do setor, ativo ou não, e quem já foi responsável por chamado dele.
export function useDashboardAssignees(sectorId: number | undefined) {
  return useQuery({
    queryKey: dashboardAssigneesKey(sectorId ?? 0),
    queryFn: () => api<DashboardAssigneeOption[]>(`/sectors/${sectorId}/dashboard/assignees`),
    enabled: sectorId !== undefined,
  })
}

const namedPeriods = ['today', '7d', '30d'] as const
export type PeriodChoice = (typeof namedPeriods)[number] | 'custom'

// Canal do atendimento: por onde ele aconteceu. Sem escolha, todos os canais.
const dashboardChannels = ['whatsapp', 'phone'] as const
export type DashboardChannel = (typeof dashboardChannels)[number]

function positiveId(raw: string | null) {
  return raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : undefined
}

// Filtros guardados no endereço da página, para sobreviver ao recarregar. Sem nada no
// endereço, abre em "Hoje" e, para o administrador, em todos os setores.
export function useDashboardFilter() {
  const { data: user } = useCurrentUser()
  const [params, setParams] = useSearchParams()
  const isAdmin = user?.role === 'admin'

  // O supervisor fica sempre no próprio setor, seja o que for que o endereço diga.
  const sectorId = isAdmin ? positiveId(params.get('sectorId')) : (user?.sectorId ?? undefined)
  // Atendente e módulo pertencem a um setor: sem ele, a API recusaria.
  const assigneeId = sectorId === undefined ? undefined : positiveId(params.get('assigneeId'))
  const moduleId = sectorId === undefined ? undefined : positiveId(params.get('moduleId'))
  const organizationId = positiveId(params.get('organizationId'))
  const organizationLabel = params.get('organization') ?? ''
  const channel = dashboardChannels.find((value) => value === params.get('channel'))

  const custom = params.has('from') || params.has('to')
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const named = namedPeriods.find((period) => period === params.get('period')) ?? 'today'
  const period: PeriodChoice = custom ? 'custom' : named
  // Datas no formato do campo (AAAA-MM-DD) comparam certo como texto.
  const datesValid = !custom || (from !== '' && to !== '' && from <= to)

  const search = useMemo(() => {
    const query = new URLSearchParams()
    if (custom) {
      query.set('from', from)
      query.set('to', to)
    } else {
      query.set('period', named)
    }
    const filters = { sectorId, channel, assigneeId, moduleId, organizationId }
    for (const [name, value] of Object.entries(filters)) {
      if (value !== undefined) {
        query.set(name, String(value))
      }
    }
    return query.toString()
  }, [custom, from, to, named, sectorId, channel, assigneeId, moduleId, organizationId])

  // A busca de órgãos não acha um órgão pelo id: o nome vem do endereço, só para mostrar no
  // campo. Os números seguem o id.
  const organization = useMemo(
    () =>
      organizationId === undefined
        ? null
        : ({
            id: organizationId,
            name: organizationLabel,
            cnpj: null,
            municipality: { id: 0, name: '' },
          } as Organization),
    [organizationId, organizationLabel],
  )

  // Toda mudança aqui é de um filtro, e mudar um filtro volta as duas listas à primeira
  // página (regra 22 de dashboard.md). A limpeza fica neste ponto, que continua montado
  // com a seção "Agora" recolhida, e não nas listas, que desmontam com ela.
  const update = (change: (next: URLSearchParams) => void) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        change(next)
        next.delete('paginaFila')
        next.delete('paginaAtendimento')
        return next
      },
      { replace: true },
    )
  const setOrDelete = (next: URLSearchParams, name: string, value: string | undefined) => {
    if (value) {
      next.set(name, value)
    } else {
      next.delete(name)
    }
  }

  return {
    isAdmin,
    sectorId,
    assigneeId,
    moduleId,
    organization,
    channel,
    period,
    from,
    to,
    datesValid,
    search,
    // Atendente e módulo são de um setor: trocar de setor limpa os dois.
    setSector: (value: number | undefined) =>
      update((next) => {
        setOrDelete(next, 'sectorId', value?.toString())
        next.delete('assigneeId')
        next.delete('moduleId')
      }),
    setAssignee: (value: number | undefined) =>
      update((next) => setOrDelete(next, 'assigneeId', value?.toString())),
    setChannel: (value: DashboardChannel | undefined) =>
      update((next) => setOrDelete(next, 'channel', value)),
    setModule: (value: number | undefined) =>
      update((next) => setOrDelete(next, 'moduleId', value?.toString())),
    setOrganization: (value: Organization | null, label: string) =>
      update((next) => {
        setOrDelete(next, 'organizationId', value?.id.toString())
        setOrDelete(next, 'organization', value ? label : undefined)
      }),
    // "Datas" parte do período em tela, que a pessoa ajusta.
    setPeriod: (value: PeriodChoice, shown: Dashboard['period'] | undefined) =>
      update((next) => {
        next.delete('period')
        next.delete('from')
        next.delete('to')
        if (value === 'custom') {
          const today = format(new Date(), 'yyyy-MM-dd')
          next.set('from', shown?.from ?? today)
          next.set('to', shown?.to ?? today)
        } else if (value !== 'today') {
          next.set('period', value)
        }
      }),
    setDate: (name: 'from' | 'to', value: string) => update((next) => next.set(name, value)),
  }
}

export type DashboardSection = 'now' | 'period'

const collapsedKeys: Record<DashboardSection, string> = {
  now: 'dashboard-now-collapsed',
  period: 'dashboard-period-collapsed',
}

function readCollapsed(section: DashboardSection) {
  try {
    return localStorage.getItem(collapsedKeys[section]) === 'on'
  } catch {
    return false
  }
}

// Mantém a escolha ao trocar de tela mesmo sem acesso ao armazenamento do navegador.
const collapsedSections: Record<DashboardSection, boolean> = {
  now: readCollapsed('now'),
  period: readCollapsed('period'),
}

function writeCollapsed(section: DashboardSection, collapsed: boolean) {
  try {
    if (collapsed) {
      localStorage.setItem(collapsedKeys[section], 'on')
    } else {
      localStorage.removeItem(collapsedKeys[section])
    }
  } catch {
    // Sem acesso ao armazenamento do navegador, a escolha vale até recarregar a página.
  }
}

export function useSectionCollapsed(section: DashboardSection) {
  const [collapsed, setCollapsed] = useState(collapsedSections[section])
  const toggle = useCallback(() => {
    const next = !collapsedSections[section]
    collapsedSections[section] = next
    writeCollapsed(section, next)
    setCollapsed(next)
  }, [section])
  return [collapsed, toggle] as const
}
