import { useQuery } from '@tanstack/react-query'
import { CircleAlert, Inbox, MessagesSquare, UserCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { useCurrentUser } from '@/lib/auth'
import { useAssignTicket } from '@/lib/conversation'
import { organizationLabel } from '@/lib/format'
import type { TicketSummary } from '@/lib/tickets'

type LiveTicket = TicketSummary & { sector: { id: number; name: string } }
type Lists = { queued: LiveTicket[]; inProgress: LiveTicket[] }

function elapsed(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}

function Contact({ ticket }: { ticket: LiveTicket }) {
  return (
    <TableCell className="w-full max-w-0 whitespace-normal">
      <Link
        to={`/chamados/${ticket.id}`}
        className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
      >
        {ticket.contact.name}
      </Link>
      <p className="caption truncate text-ink-faint">
        <span className="mono-num">{ticket.protocol}</span>
        {' · '}
        {ticket.organizationName
          ? organizationLabel(ticket.organizationName, ticket.municipalityName)
          : 'Não cadastrado'}
      </p>
    </TableCell>
  )
}

export function DashboardLists({
  sectorId,
  assigneeId,
  organizationId,
  showSector,
}: {
  sectorId?: number
  assigneeId?: number
  organizationId?: number
  showSector: boolean
}) {
  const params = new URLSearchParams()
  if (sectorId !== undefined) params.set('sectorId', String(sectorId))
  if (assigneeId !== undefined) params.set('assigneeId', String(assigneeId))
  if (organizationId !== undefined) params.set('organizationId', String(organizationId))
  const search = params.toString()
  const { data, error } = useQuery({
    queryKey: ['dashboard', 'tickets', search],
    queryFn: () => api<Lists>(`/dashboard/tickets?${search}`),
  })
  const { data: user } = useCurrentUser()
  const assign = useAssignTicket()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-3">
      {(error || assign.error) && (
        <Alert variant="warning">
          <CircleAlert strokeWidth={1.7} aria-hidden />
          <AlertDescription>{(error || assign.error)?.message}</AlertDescription>
        </Alert>
      )}
      {data && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card role="region" aria-labelledby="board-queue-title">
            <CardHeader>
              <CardTitle id="board-queue-title">
                Fila <span className="mono-num caption text-ink-faint">{data.queued.length}</span>
              </CardTitle>
            </CardHeader>
            {data.queued.length ? (
              <Table>
                <TableBody>
                  {data.queued.map((ticket) => (
                    <TableRow key={ticket.id} className="relative">
                      <Contact ticket={ticket} />
                      <TableCell className="whitespace-nowrap text-right">
                        <p className="mono-num">{elapsed(ticket.arrivedAt)}</p>
                        {showSector && (
                          <p className="caption text-ink-faint">{ticket.sector.name}</p>
                        )}
                      </TableCell>
                      <TableCell className="w-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="relative z-10"
                          disabled={assign.isPending}
                          aria-label={`Assumir chamado de ${ticket.contact.name}`}
                          onClick={() =>
                            assign.mutate(
                              { ticketId: ticket.id, sectorId: ticket.sector.id },
                              {
                                onSuccess: () => {
                                  toast.success('Chamado assumido')
                                  void navigate(`/conversas/${ticket.id}`)
                                },
                              },
                            )
                          }
                        >
                          <UserCheck strokeWidth={1.7} aria-hidden />
                          Assumir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyMedia>
                  <Inbox strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>Nenhum chamado na fila.</EmptyDescription>
              </Empty>
            )}
          </Card>
          <Card role="region" aria-labelledby="board-progress-title">
            <CardHeader>
              <CardTitle id="board-progress-title">
                Em atendimento{' '}
                <span className="mono-num caption text-ink-faint">{data.inProgress.length}</span>
              </CardTitle>
            </CardHeader>
            {data.inProgress.length ? (
              <Table>
                <TableBody>
                  {data.inProgress.map((ticket) => (
                    <TableRow key={ticket.id} className="relative">
                      <Contact ticket={ticket} />
                      <TableCell className="whitespace-nowrap text-right">
                        <p>
                          {ticket.assignee?.id === user?.id ? (
                            <Badge tone="success">Você</Badge>
                          ) : (
                            ticket.assignee?.name
                          )}
                        </p>
                        <p className="caption text-ink-faint">
                          <span className="mono-num">
                            {ticket.assignedAt && elapsed(ticket.assignedAt)}
                          </span>
                          {showSector && ` · ${ticket.sector.name}`}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Empty>
                <EmptyMedia>
                  <MessagesSquare strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>Nenhum chamado em atendimento.</EmptyDescription>
              </Empty>
            )}
          </Card>
        </div>
      )}
      <p className="caption text-ink-faint">Ao vivo. Período e módulo não filtram as listas.</p>
    </div>
  )
}
