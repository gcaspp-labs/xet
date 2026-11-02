import { MessagesSquare } from 'lucide-react'
import { NavLink } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import type { User } from '@/lib/auth'
import { formatMessageTime } from '@/lib/format'
import { lastMessagePreview, type TicketSummary, useTickets } from '@/lib/tickets'

// Ordem da lista: os chamados do usuário, a fila e os dos colegas; em cada
// grupo, a conversa com mensagem mais recente primeiro.
function group(ticket: TicketSummary, user: User) {
  if (ticket.assignee?.id === user.id) {
    return 0
  }
  return ticket.status === 'queued' ? 1 : 2
}

function lastActivity(ticket: TicketSummary) {
  return new Date(ticket.lastMessage?.sentAt ?? ticket.arrivedAt).getTime()
}

function Assignee({ ticket, user }: { ticket: TicketSummary; user: User }) {
  if (ticket.status === 'queued') {
    return <Badge tone="warning">Na fila</Badge>
  }
  if (ticket.assignee?.id === user.id) {
    return <Badge tone="success">Você</Badge>
  }
  return <span className="caption truncate text-ink-faint">{ticket.assignee?.name}</span>
}

// Conversas abertas do setor ao lado da conversa, para trocar de chamado sem
// voltar ao painel. Atualizada pelo WebSocket, como o painel.
export function ConversationList({ sectorId, user }: { sectorId: number; user: User }) {
  const { data: tickets = [] } = useTickets(sectorId)
  const sorted = [...tickets].sort(
    (a, b) => group(a, user) - group(b, user) || lastActivity(b) - lastActivity(a),
  )

  return (
    <Card
      role="region"
      aria-labelledby="conversation-list-title"
      className="h-[calc(100dvh-150px-var(--header-height))]"
    >
      <CardHeader>
        <CardTitle id="conversation-list-title">Conversas do setor</CardTitle>
      </CardHeader>
      {sorted.length > 0 ? (
        <nav aria-label="Conversas abertas" className="flex-1 overflow-y-auto">
          <ul className="flex flex-col divide-y divide-line-soft">
            {sorted.map((ticket) => (
              <li key={ticket.id}>
                <NavLink
                  to={`/chamados/${ticket.id}`}
                  className="flex flex-col gap-1 px-4 py-2.5 transition-colors hover:bg-muted aria-[current=page]:bg-accent-soft"
                >
                  <span className="flex items-center gap-2">
                    <span className="body-strong min-w-0 flex-1 truncate">
                      {ticket.contact.name}
                    </span>
                    {ticket.lastMessage && (
                      <span className="mono-num caption text-ink-faint">
                        {formatMessageTime(ticket.lastMessage.sentAt)}
                      </span>
                    )}
                  </span>
                  <span className="caption truncate text-ink-soft">
                    {lastMessagePreview(ticket)}
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="mono-num caption text-ink-faint">{ticket.protocol}</span>
                    <span className="ml-auto flex min-w-0">
                      <Assignee ticket={ticket} user={user} />
                    </span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <Empty>
          <EmptyMedia>
            <MessagesSquare strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>Nenhuma conversa aberta.</EmptyDescription>
        </Empty>
      )}
    </Card>
  )
}
