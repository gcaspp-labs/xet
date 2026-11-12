import { useIsProposal } from '@/prototype/p145'
import {
  CheckCheck,
  CircleAlert,
  Inbox,
  MessageSquarePlus,
  MessagesSquare,
  UserCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { NewConversationSheet } from '@/components/NewConversationSheet'
import { PageContent, Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSectors } from '@/lib/admin'
import { type User, useCurrentUser } from '@/lib/auth'
import { useAssignTicket } from '@/lib/conversation'
import {
  closureTypeLabels,
  formatMessageTime,
  formatPhone,
  organizationLabel,
  roleLabels,
} from '@/lib/format'
import {
  type ClosedTicket,
  lastMessagePreview,
  type TicketSummary,
  useClosedToday,
  useTickets,
  useWorkload,
} from '@/lib/tickets'

// O link se estica sobre a linha, que precisa ser `relative`: a linha inteira abre
// o chamado, e o teclado e o leitor de tela continuam num link de verdade.
function ContactCell({ ticket }: { ticket: TicketSummary | ClosedTicket }) {
  const { contact } = ticket
  return (
    <TableCell>
      <Link
        to={`/chamados/${ticket.id}`}
        className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
      >
        {contact.name}
      </Link>
      <p className="caption text-ink-faint">
        <span className="mono-num">{ticket.protocol}</span>
        {' · '}
        {contact.phone ? (
          <span className="mono-num">{formatPhone(contact.phone)}</span>
        ) : (
          'Sem telefone'
        )}
        {' · '}
        {ticket.organizationName
          ? organizationLabel(ticket.organizationName, ticket.municipalityName)
          : 'Não cadastrado'}
      </p>
    </TableCell>
  )
}

function MessageCell({ ticket }: { ticket: TicketSummary }) {
  return (
    <TableCell className="max-w-0 w-full">
      <p className="truncate">{lastMessagePreview(ticket)}</p>
      {ticket.lastMessage && (
        <p className="mono-num caption text-ink-faint">
          {formatMessageTime(ticket.lastMessage.sentAt)}
        </p>
      )}
    </TableCell>
  )
}

function QueueCard({ sectorId, tickets }: { sectorId: number; tickets: TicketSummary[] }) {
  const assign = useAssignTicket()
  const proposal = useIsProposal()
  const navigate = useNavigate()

  return (
    <Card role="region" aria-labelledby="queue-title">
      <CardHeader>
        <CardTitle id="queue-title">Fila do setor</CardTitle>
      </CardHeader>
      {assign.error && (
        <div className="px-4">
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{assign.error.message}</AlertDescription>
          </Alert>
        </div>
      )}
      {tickets.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contato</TableHead>
              <TableHead>Última mensagem</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id} className="relative">
                <ContactCell ticket={ticket} />
                <MessageCell ticket={ticket} />
                <TableCell>
                  <Button
                    size="sm"
                    variant={proposal ? 'default' : 'outline'}
                    className="relative z-10"
                    disabled={assign.isPending}
                    aria-label={`Assumir chamado de ${ticket.contact.name}`}
                    onClick={() =>
                      assign.mutate(
                        { ticketId: ticket.id, sectorId },
                        {
                          onSuccess: () => {
                            toast.success('Chamado assumido')
                            void navigate(`/chamados/${ticket.id}`)
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
  )
}

function InProgressCard({ tickets, user }: { tickets: TicketSummary[]; user: User }) {
  // Agrupados por responsável, com os chamados do próprio usuário primeiro.
  const sorted = [...tickets].sort((a, b) => {
    const mine = Number(b.assignee?.id === user.id) - Number(a.assignee?.id === user.id)
    return mine || (a.assignee?.name ?? '').localeCompare(b.assignee?.name ?? '', 'pt-BR')
  })

  return (
    <Card role="region" aria-labelledby="in-progress-title">
      <CardHeader>
        <CardTitle id="in-progress-title">Em atendimento</CardTitle>
      </CardHeader>
      {sorted.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contato</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Última mensagem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((ticket) => (
              <TableRow key={ticket.id} className="relative">
                <ContactCell ticket={ticket} />
                <TableCell className="whitespace-nowrap">
                  {ticket.assignee?.id === user.id ? (
                    <Badge tone="success">Você</Badge>
                  ) : (
                    ticket.assignee?.name
                  )}
                </TableCell>
                <MessageCell ticket={ticket} />
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
  )
}

function ClosedTodayCard({ sectorId, user }: { sectorId: number; user: User }) {
  const { data: tickets = [] } = useClosedToday(sectorId)

  return (
    <Card role="region" aria-labelledby="closed-today-title">
      <CardHeader>
        <CardTitle id="closed-today-title">Realizados hoje</CardTitle>
      </CardHeader>
      {tickets.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-full">Contato</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Hora</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TableRow key={ticket.id} className="relative">
                <ContactCell ticket={ticket} />
                <TableCell className="whitespace-nowrap">
                  {ticket.closedBy.id === user.id ? (
                    <Badge tone="success">Você</Badge>
                  ) : (
                    ticket.closedBy.name
                  )}
                </TableCell>
                <TableCell>
                  <Badge>{closureTypeLabels[ticket.closureType]}</Badge>
                </TableCell>
                <TableCell className="mono-num text-right">
                  {formatMessageTime(ticket.closedAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Empty>
          <EmptyMedia>
            <CheckCheck strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>Nenhum atendimento realizado hoje.</EmptyDescription>
        </Empty>
      )}
    </Card>
  )
}

function WorkloadCard({ sectorId }: { sectorId: number }) {
  const { data: workload = [] } = useWorkload(sectorId)

  return (
    <Card role="region" aria-labelledby="workload-title">
      <CardHeader>
        <CardTitle id="workload-title">Chamados por atendente</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Atendente</TableHead>
            <TableHead className="text-right">Ativos</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workload.map((person) => (
            <TableRow key={person.id}>
              <TableCell>
                <p className="body-strong">{person.name}</p>
                <p className="caption text-ink-faint">{roleLabels[person.role]}</p>
              </TableCell>
              <TableCell className="mono-num text-right">{person.activeTickets}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function SectorPanel({ sectorId, user }: { sectorId: number; user: User }) {
  const { data: tickets = [] } = useTickets(sectorId)
  const queued = tickets.filter((t) => t.status === 'queued')
  const inProgress = tickets.filter((t) => t.status === 'in_progress')

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_280px] scaled-text:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-4">
        <QueueCard sectorId={sectorId} tickets={queued} />
        <InProgressCard tickets={inProgress} user={user} />
        <ClosedTodayCard sectorId={sectorId} user={user} />
      </div>
      <WorkloadCard sectorId={sectorId} />
    </div>
  )
}

export default function PanelPage() {
  const { data: user } = useCurrentUser()
  const { data: sectors = [], isPending } = useSectors()
  // Atendentes e supervisores veem o próprio setor; o administrador escolhe entre todos.
  const [chosen, setChosen] = useState<number | null>(null)
  const sectorId = user?.sectorId ?? chosen ?? sectors[0]?.id
  const sector = sectors.find((s) => s.id === sectorId)
  const sectorItems = sectors.map((s) => ({ value: s.id.toString(), label: s.name }))
  const [starting, setStarting] = useState(false)

  return (
    <>
      <Topbar
        breadcrumb={sector?.name}
        title="Atendimento"
        action={
          sector && (
            <Button onClick={() => setStarting(true)}>
              <MessageSquarePlus strokeWidth={1.7} aria-hidden />
              Nova conversa
            </Button>
          )
        }
      />
      {sector && (
        <NewConversationSheet
          key={`${sector.id}-${starting}`}
          sectorId={sector.id}
          open={starting}
          onOpenChange={setStarting}
        />
      )}
      <PageContent>
        {user?.role === 'admin' && sectors.length > 0 && (
          <Field className="max-w-[260px]">
            <FieldLabel htmlFor="panel-sector">Setor</FieldLabel>
            <Select
              items={sectorItems}
              value={sectorId?.toString() ?? null}
              onValueChange={(value) => value && setChosen(Number(value))}
            >
              <SelectTrigger id="panel-sector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sectorItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {user && sector ? (
          <SectorPanel key={sector.id} sectorId={sector.id} user={user} />
        ) : (
          !isPending && (
            <Card>
              <Empty>
                <EmptyMedia>
                  <MessagesSquare strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>Cadastre um setor para começar o atendimento.</EmptyDescription>
              </Empty>
            </Card>
          )
        )}
      </PageContent>
    </>
  )
}
