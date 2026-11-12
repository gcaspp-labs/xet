import { CircleAlert, MessagesSquare, UserCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { useIsProposal } from '@/prototype/p145'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import type { User } from '@/lib/auth'
import { useAssignTicket } from '@/lib/conversation'
import { formatMessageTime } from '@/lib/format'
import { lastMessagePreview, type TicketSummary, useTickets } from '@/lib/tickets'
import { cn } from '@/lib/utils'

function lastActivity(ticket: TicketSummary) {
  return new Date(ticket.lastMessage?.sentAt ?? ticket.arrivedAt).getTime()
}

function ConversationLink({ ticket, user }: { ticket: TicketSummary; user: User }) {
  const queued = ticket.status === 'queued'
  const { search } = useLocation()
  return (
    <NavLink
      to={`/chamados/${ticket.id}${search}`}
      className="flex flex-col gap-1 px-4 py-2.5 transition-colors hover:bg-muted aria-[current=page]:bg-accent-soft"
    >
      <span className="flex items-center gap-2">
        <span className="body-strong min-w-0 flex-1 truncate">{ticket.contact.name}</span>
        {ticket.lastMessage && (
          <span className="mono-num caption text-ink-faint">
            {formatMessageTime(ticket.lastMessage.sentAt)}
          </span>
        )}
      </span>
      <span className="caption truncate text-ink-soft">{lastMessagePreview(ticket)}</span>
      {/* Na fila, a altura dá lugar ao botão de assumir, que fica fora do link. */}
      <span className={cn('flex min-w-0 items-center gap-2', queued && 'min-h-7')}>
        <span className="mono-num caption text-ink-faint">{ticket.protocol}</span>
        {!queued && (
          <span className="ml-auto flex min-w-0">
            {ticket.assignee?.id === user.id ? (
              <Badge tone="success">Você</Badge>
            ) : (
              <span className="caption truncate text-ink-faint">{ticket.assignee?.name}</span>
            )}
          </span>
        )}
      </span>
    </NavLink>
  )
}

// Conversas abertas do setor ao lado da conversa, para trocar de chamado sem
// voltar ao painel. Atualizada pelo WebSocket, como o painel. A fila vem no topo;
// depois, os chamados do usuário e os dos colegas. Em cada grupo, a conversa com
// mensagem mais recente primeiro.
export function ConversationList({ sectorId, user }: { sectorId: number; user: User }) {
  const { data: tickets = [] } = useTickets(sectorId)
  const assign = useAssignTicket()
  const { pathname } = useLocation()
  const { reset } = assign
  // A lista continua montada ao trocar de conversa; o erro é só da tentativa anterior.
  useEffect(() => reset(), [pathname, reset])

  const recent = [...tickets].sort((a, b) => lastActivity(b) - lastActivity(a))
  const queued = recent.filter((t) => t.status === 'queued')
  const others = recent
    .filter((t) => t.status !== 'queued')
    .sort((a, b) => Number(b.assignee?.id === user.id) - Number(a.assignee?.id === user.id))

  const proposal = useIsProposal()
  const assignButton = (ticket: TicketSummary) => (
    <Button
      size="sm"
      variant={proposal ? 'default' : 'outline'}
      className="absolute right-4 bottom-2.5"
      disabled={assign.isPending}
      aria-label={`Assumir chamado de ${ticket.contact.name}`}
      onClick={() =>
        assign.mutate(
          { ticketId: ticket.id, sectorId },
          {
            onSuccess: () =>
              toast.success('Chamado assumido', {
                action: (
                  <Link
                    to={`/chamados/${ticket.id}`}
                    className="body-strong ml-auto whitespace-nowrap text-accent-strong underline underline-offset-2"
                  >
                    Abrir conversa
                  </Link>
                ),
              }),
          },
        )
      }
    >
      <UserCheck strokeWidth={1.7} aria-hidden />
      Assumir
    </Button>
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
      {/* Fora da seção da fila: quem perdeu a disputa pelo último chamado ainda vê o motivo. */}
      {assign.error && (
        <div className="px-4 pb-2.5">
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{assign.error.message}</AlertDescription>
          </Alert>
        </div>
      )}
      {proposal ? (
        // PROTÓTIPO #145: duas seções, sempre com título e contagem; A assumir em destaque.
        <nav aria-label="Conversas abertas" className="flex-1 overflow-y-auto">
          <section aria-labelledby="conversation-queue-title" className="border-y border-warning">
            <h3
              id="conversation-queue-title"
              className="overline sticky top-0 z-10 flex items-center gap-2 bg-warning-soft px-4 py-2 text-warning-ink"
            >
              <span className="size-2 rounded-full bg-warning" aria-hidden />
              A assumir ({queued.length})
            </h3>
            {queued.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line-soft">
                {queued.map((ticket) => (
                  <li key={ticket.id} className="relative">
                    <ConversationLink ticket={ticket} user={user} />
                    {assignButton(ticket)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="caption px-4 py-3 text-ink-soft">Nenhum chamado esperando.</p>
            )}
          </section>
          <section aria-labelledby="conversation-progress-title">
            <h3
              id="conversation-progress-title"
              className="overline sticky top-0 z-10 border-b border-line-soft bg-muted px-4 py-2 text-ink-soft"
            >
              Em atendimento ({others.length})
            </h3>
            {others.length > 0 ? (
              <ul className="flex flex-col divide-y divide-line-soft">
                {others.map((ticket) => (
                  <li key={ticket.id}>
                    <ConversationLink ticket={ticket} user={user} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="caption px-4 py-3 text-ink-soft">Nenhum chamado em atendimento.</p>
            )}
          </section>
        </nav>
      ) : tickets.length > 0 ? (
        <nav aria-label="Conversas abertas" className="flex-1 overflow-y-auto">
          {queued.length > 0 && (
            <section aria-labelledby="conversation-queue-title" className="border-b border-line">
              <h3 id="conversation-queue-title" className="overline px-4 py-2 text-ink-soft">
                Na fila ({queued.length})
              </h3>
              <ul className="flex flex-col divide-y divide-line-soft">
                {queued.map((ticket) => (
                  <li key={ticket.id} className="relative">
                    <ConversationLink ticket={ticket} user={user} />
                    {assignButton(ticket)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ul className="flex flex-col divide-y divide-line-soft">
            {others.map((ticket) => (
              <li key={ticket.id}>
                <ConversationLink ticket={ticket} user={user} />
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
