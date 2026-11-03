import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { type Sector, useSectors } from '@/lib/admin'
import { alertQueueEntry } from '@/lib/alerts'
import type { User } from '@/lib/auth'
import { type TicketSummary, ticketsQuery } from '@/lib/tickets'

export type QueuedTicket = TicketSummary & { sectorId: number; sectorName: string }

// Chamados que o sino já conhece na fila, por setor. A comparação com a fila recarregada
// diz o que entrou (arquitetura.md, Tempo real). Sem registro do setor, a carga é a
// primeira: só guarda, sem avisar.
const knownQueue = new Map<number, Set<number>>()

// Esquece o que o sino conhecia: a próxima carga de cada setor vira a nova referência e
// não avisa. Chamado ao reconectar o WebSocket, porque o que chegou durante a queda não é novidade.
export function resetQueueBaseline() {
  knownQueue.clear()
}

function lastActivity(ticket: TicketSummary) {
  return new Date(ticket.lastMessage?.sentAt ?? ticket.arrivedAt).getTime()
}

// Número que não está conectado, inclusive enquanto a conexão está em andamento.
export function isDown(sector: Sector) {
  return sector.active && sector.connectionStatus !== 'connected'
}

function sectorOfTicketsKey(key: readonly unknown[]) {
  return key.length === 3 &&
    key[0] === 'sectors' &&
    typeof key[1] === 'number' &&
    key[2] === 'tickets'
    ? key[1]
    : undefined
}

// Reúne o que o sino mostra: números desconectados (só supervisor e administrador) e chamados
// na fila (do setor do usuário; todos os setores ativos para o administrador). Também avisa
// com um toast quando um chamado entra na fila.
export function useNotifications(user: User) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: sectors = [] } = useSectors()
  const isAdmin = user.role === 'admin'
  const canConnect = isAdmin || user.role === 'supervisor'

  const watched = useMemo(
    () => sectors.filter((s) => s.active && (isAdmin || s.id === user.sectorId)),
    [sectors, isAdmin, user.sectorId],
  )
  const results = useQueries({ queries: watched.map((s) => ticketsQuery(s.id)) })

  const queue = useMemo(() => {
    const items: QueuedTicket[] = []
    watched.forEach((sector, index) => {
      for (const ticket of results[index]?.data ?? []) {
        if (ticket.status === 'queued') {
          items.push({ ...ticket, sectorId: sector.id, sectorName: sector.name })
        }
      }
    })
    return items.sort((a, b) => lastActivity(b) - lastActivity(a))
  }, [watched, results])

  const down = useMemo(() => (canConnect ? sectors.filter(isDown) : []), [sectors, canConnect])

  const watchedIds = useRef(new Set<number>())
  useEffect(() => {
    watchedIds.current = new Set(watched.map((s) => s.id))
  }, [watched])

  // A notificação do navegador pode ser clicada bem depois de criada, já em outra tela.
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  // Ouve o cache, e não a tela, para comparar cada carga com a anterior sem depender de renderização.
  useEffect(() => {
    // Filas que já estavam no cache ao montar (a tela pode ser remontada com dados em dia):
    // viram a referência, para o primeiro aviso depois delas não ser perdido.
    for (const [key, data] of queryClient.getQueriesData<TicketSummary[]>({
      queryKey: ['sectors'],
    })) {
      const sectorId = sectorOfTicketsKey(key)
      if (sectorId !== undefined && data) {
        knownQueue.set(
          sectorId,
          new Set(data.filter((t) => t.status === 'queued').map((t) => t.id)),
        )
      }
    }
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') {
        return
      }
      const sectorId = sectorOfTicketsKey(event.query.queryKey)
      if (sectorId === undefined || !watchedIds.current.has(sectorId)) {
        return
      }
      const queued = ((event.query.state.data as TicketSummary[] | undefined) ?? []).filter(
        (t) => t.status === 'queued',
      )
      const before = knownQueue.get(sectorId)
      knownQueue.set(sectorId, new Set(queued.map((t) => t.id)))
      if (!before) {
        return
      }
      for (const ticket of queued) {
        if (!before.has(ticket.id)) {
          toast(`Chamado recebido: ${ticket.contact.name}`, { id: `queue-${ticket.id}` })
          alertQueueEntry(ticket.id, ticket.contact.name, () => {
            void navigateRef.current(`/chamados/${ticket.id}`)
          })
        }
      }
    })
    return () => {
      unsubscribe()
      knownQueue.clear()
    }
  }, [queryClient])

  return { queue, down, count: queue.length + down.length, showSector: isAdmin }
}
