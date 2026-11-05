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
    const filters = { sectorId, assigneeId, moduleId, organizationId }
    for (const [name, value] of Object.entries(filters)) {
      if (value !== undefined) {
        query.set(name, String(value))
      }
    }
    return query.toString()
  }, [custom, from, to, named, sectorId, assigneeId, moduleId, organizationId])

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

  const update = (change: (next: URLSearchParams) => void) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        change(next)
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
