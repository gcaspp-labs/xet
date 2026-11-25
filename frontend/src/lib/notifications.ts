import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { type Sector, useSectors } from '@/lib/admin'
import { type Unread, alertNewMessage, alertQueueEntry, readStamp } from '@/lib/alerts'
import type { User } from '@/lib/auth'
import { type TicketSummary, ticketsQuery } from '@/lib/tickets'

export type QueuedTicket = TicketSummary & { sectorId: number }

// Chamados que o sino já conhece na fila, por setor. A comparação com a fila recarregada
// diz o que entrou (docs/architecture.md, Tempo real). Sem registro do setor, a carga é a
// primeira: só guarda, sem avisar.
const knownQueue = new Map<number, Set<number>>()

// Não lidas e momento da leitura que o sino já conhecia em cada chamado meu, por setor:
// `setor:chamado`. Quando a lista recarregada mostra mais não lidas, ou a mesma quantidade depois
// de uma leitura feita noutro aparelho, chegou mensagem nova (spec #310, #392). Sem registro, a
// carga é a primeira e só guarda, sem avisar.
const knownUnread = new Map<string, Unread>()

const unreadKey = (sectorId: number, ticketId: number) => `${sectorId}:${ticketId}`

// Chamado aberto em Chamados, informado pela tela. Com a aba visível, a mensagem nova nele não
// alerta: a pessoa já está vendo a conversa.
let openTicketId: number | null = null

export function setOpenTicket(ticketId: number | null) {
  openTicketId = ticketId
}

function isOpenAndVisible(ticketId: number) {
  return openTicketId === ticketId && document.visibilityState === 'visible'
}

// Esquece o que o sino conhecia: a próxima carga de cada setor vira a nova referência e
// não avisa. Chamado ao reconectar o WebSocket, porque o que chegou durante a queda não é novidade.
export function resetAlertBaselines() {
  knownQueue.clear()
  knownUnread.clear()
}

// Não lidas de um chamado em atendimento do próprio usuário; nulo nos que não são dele.
function myUnread(ticket: TicketSummary, userId: number) {
  return ticket.status === 'in_progress' && ticket.assignee?.id === userId
    ? ticket.unreadCount
    : undefined
}

function lastActivity(ticket: TicketSummary) {
  return new Date(lastMessageAt(ticket)).getTime()
}

// Horário da última mensagem, como veio do servidor, para ordenar a fila e "Meus chamados".
function lastMessageAt(ticket: TicketSummary) {
  return ticket.lastMessage?.sentAt ?? ticket.arrivedAt
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
// na fila do setor do usuário. Também avisa com um toast quando um chamado entra na fila. O
// administrador não acompanha fila nenhuma (spec.md › Notificações): sem setor acompanhado, não
// há item, contador, aviso, som nem notificação de chamados.
export function useNotifications(user: User) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: sectors = [] } = useSectors()
  const isAdmin = user.role === 'admin'
  const canConnect = isAdmin || user.role === 'supervisor'

  const watched = useMemo(
    () => sectors.filter((s) => !isAdmin && s.active && s.id === user.sectorId),
    [sectors, isAdmin, user.sectorId],
  )
  const results = useQueries({ queries: watched.map((s) => ticketsQuery(s.id)) })

  const queue = useMemo(() => {
    const items: QueuedTicket[] = []
    watched.forEach((sector, index) => {
      for (const ticket of results[index]?.data ?? []) {
        if (ticket.status === 'queued') {
          items.push({ ...ticket, sectorId: sector.id })
        }
      }
    })
    return items.sort((a, b) => lastActivity(b) - lastActivity(a))
  }, [watched, results])

  const down = useMemo(() => (canConnect ? sectors.filter(isDown) : []), [sectors, canConnect])

  // Não lidas dos meus chamados: somadas ao contador do sino no título da aba (spec #310). O sino
  // em si continua só com fila e número desconectado.
  const unread = useMemo(
    () =>
      watched.reduce(
        (total, _, index) =>
          total +
          (results[index]?.data ?? []).reduce(
            (sum, ticket) => sum + (myUnread(ticket, user.id) ?? 0),
            0,
          ),
        0,
      ),
    [watched, results, user.id],
  )

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
    // A carga de um setor vira a referência: fila e não lidas. Sem referência anterior, é a
    // primeira depois de abrir a tela (ou de reconectar), e não avisa.
    const seed = (sectorId: number, tickets: TicketSummary[]) => {
      knownQueue.set(
        sectorId,
        new Set(tickets.filter((t) => t.status === 'queued').map((t) => t.id)),
      )
      for (const ticket of tickets) {
        const count = myUnread(ticket, user.id)
        if (count !== undefined) {
          knownUnread.set(unreadKey(sectorId, ticket.id), {
            count,
            readAt: readStamp(ticket.readAt),
          })
        }
      }
    }
    // Filas que já estavam no cache ao montar (a tela pode ser remontada com dados em dia):
    // viram a referência, para o primeiro aviso depois delas não ser perdido.
    for (const [key, data] of queryClient.getQueriesData<TicketSummary[]>({
      queryKey: ['sectors'],
    })) {
      const sectorId = sectorOfTicketsKey(key)
      if (sectorId !== undefined && data) {
        seed(sectorId, data)
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
      const tickets = (event.query.state.data as TicketSummary[] | undefined) ?? []
      const queued = tickets.filter((t) => t.status === 'queued')
      const before = knownQueue.get(sectorId)
      if (!before) {
        seed(sectorId, tickets)
        return
      }
      knownQueue.set(sectorId, new Set(queued.map((t) => t.id)))
      for (const ticket of queued) {
        if (!before.has(ticket.id)) {
          toast(`Chamado recebido: ${ticket.contact.name}`, { id: `queue-${ticket.id}` })
          alertQueueEntry(ticket.id, ticket.contact.name, () => {
            void navigateRef.current(`/chamados/${ticket.id}`)
          })
        }
      }
      // Mensagem nova num chamado meu: mais não lidas do que na carga anterior. O chamado aberto
      // com a aba visível não alerta, porque a pessoa está vendo a conversa.
      const seen = new Set<string>()
      for (const ticket of tickets) {
        const count = myUnread(ticket, user.id)
        if (count === undefined) {
          continue
        }
        const key = unreadKey(sectorId, ticket.id)
        seen.add(key)
        const previous = knownUnread.get(key)
        const current: Unread = { count, readAt: readStamp(ticket.readAt) }
        // Lista pedida antes da leitura: o momento da leitura é anterior ao que o sino já viu.
        // Ela não avisa nem volta a referência, para o alerta de uma mensagem já lida não repetir
        // (#392).
        if (previous !== undefined && current.readAt < previous.readAt) {
          continue
        }
        knownUnread.set(key, current)
        // Mais não lidas, ou a mesma quantidade depois de uma leitura feita noutro aparelho: nos
        // dois casos, a mensagem que aparece é outra, e alerta (#392).
        if (
          previous !== undefined &&
          (count > previous.count || (count > 0 && current.readAt > previous.readAt)) &&
          !isOpenAndVisible(ticket.id)
        ) {
          alertNewMessage(ticket.id, current, ticket.contact.name, () => {
            void navigateRef.current(`/chamados/${ticket.id}`)
          })
        }
      }
      // Chamado que saiu de "Meus chamados" (encerrado, devolvido ou transferido) não guarda mais
      // não lidas: se voltar, recomeça como na primeira carga.
      for (const key of knownUnread.keys()) {
        if (key.startsWith(`${sectorId}:`) && !seen.has(key)) {
          knownUnread.delete(key)
        }
      }
    })
    return () => {
      unsubscribe()
      knownQueue.clear()
      knownUnread.clear()
    }
  }, [queryClient, user.id])

  return { queue, down, count: queue.length + down.length, unread }
}
