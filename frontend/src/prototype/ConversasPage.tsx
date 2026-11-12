// PROTÓTIPO #145 — descartável, não vai para a main.
// Tela nova Conversas: à esquerda só as conversas ativas do usuário, ao centro a
// conversa, à direita as abas Fila e Assuntos (contador na Fila quando outra aba
// está aberta). As ações do topo não gravam nada: só levam ao estado sem conversa.
import {
  ArrowRightLeft,
  Ban,
  CircleCheck,
  FileText,
  Inbox,
  MessagesSquare,
  Undo2,
  UserCheck,
  UserRoundCog,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Topbar } from '@/components/Topbar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type User, useCurrentUser } from '@/lib/auth'
import { useAssignTicket, useTicket } from '@/lib/conversation'
import { formatMessageTime } from '@/lib/format'
import { lastMessagePreview, type TicketSummary, useTickets } from '@/lib/tickets'
import { cn } from '@/lib/utils'
import { SubjectsTab } from '@/pages/ticket/SubjectsTab'
import { ConversationCard } from '@/pages/ticket/TicketPage'

const columnHeight = 'xl:h-[calc(100dvh-150px-var(--header-height))]'

function lastActivity(ticket: TicketSummary) {
  return new Date(ticket.lastMessage?.sentAt ?? ticket.arrivedAt).getTime()
}

function TicketLine({ ticket }: { ticket: TicketSummary }) {
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="body-strong min-w-0 flex-1 truncate">{ticket.contact.name}</span>
        {ticket.lastMessage && (
          <span className="mono-num caption text-ink-soft">
            {formatMessageTime(ticket.lastMessage.sentAt)}
          </span>
        )}
      </span>
      <span className="caption truncate text-ink-soft">{lastMessagePreview(ticket)}</span>
      <span className="mono-num caption text-ink-faint">{ticket.protocol}</span>
    </>
  )
}

// Esquerda: só os chamados em atendimento de que o usuário é o responsável.
function MyConversations({ mine }: { mine: TicketSummary[] }) {
  return (
    <Card role="region" aria-labelledby="my-conversations-title" className={columnHeight}>
      <CardHeader>
        <CardTitle id="my-conversations-title">Meus atendimentos ({mine.length})</CardTitle>
      </CardHeader>
      {mine.length > 0 ? (
        <nav aria-label="Meus atendimentos" className="flex-1 overflow-y-auto">
          <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
            {mine.map((ticket) => (
              <li key={ticket.id}>
                <NavLink
                  to={`/conversas/${ticket.id}`}
                  className="flex flex-col gap-1 border-l-3 border-transparent px-4 py-2.5 transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-accent-soft"
                >
                  <TicketLine ticket={ticket} />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <p className="caption border-t border-line-soft px-4 py-3 text-ink-soft">
          Você não tem atendimentos ativos.
        </p>
      )}
    </Card>
  )
}

// Contador no estilo do sino.
function Counter({ count }: { count: number }) {
  return (
    <span
      aria-hidden
      className="mono-num ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[calc(10px*var(--text-scale))] leading-none font-medium text-primary-foreground"
    >
      {count}
    </span>
  )
}

function QueueTab({ queue, sectorId }: { queue: TicketSummary[]; sectorId: number }) {
  const assign = useAssignTicket()
  const navigate = useNavigate()
  if (queue.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Inbox strokeWidth={1.7} aria-hidden />
        </EmptyMedia>
        <EmptyDescription>Nenhum chamado esperando.</EmptyDescription>
      </Empty>
    )
  }
  return (
    <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
      {queue.map((ticket) => (
        <li key={ticket.id} className="flex flex-col gap-2 py-3">
          <div className="flex min-w-0 flex-col gap-1">
            <TicketLine ticket={ticket} />
            <span className="caption truncate text-ink-faint">{ticket.organizationName}</span>
          </div>
          <Button
            className="self-start"
            disabled={assign.isPending}
            aria-label={`Assumir chamado de ${ticket.contact.name}`}
            onClick={() =>
              assign.mutate(
                { ticketId: ticket.id, sectorId },
                { onSuccess: () => void navigate(`/conversas/${ticket.id}`) },
              )
            }
          >
            <UserCheck strokeWidth={1.7} aria-hidden />
            Assumir
          </Button>
        </li>
      ))}
    </ul>
  )
}

function SidePanel({
  queue,
  sectorId,
  ticketId,
}: {
  queue: TicketSummary[]
  sectorId: number
  ticketId?: number
}) {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(ticketId && params.get('aba') === 'assuntos' ? 'subjects' : 'queue')
  const current = ticketId ? tab : 'queue'
  const showCounter = current !== 'queue' && queue.length > 0
  return (
    <Card role="region" aria-labelledby="side-panel-title" className={columnHeight}>
      <CardHeader className="sr-only">
        <CardTitle id="side-panel-title">Fila e assuntos</CardTitle>
      </CardHeader>
      <Tabs value={current} onValueChange={(v) => setTab(String(v))} className="min-h-0 flex-1 p-5">
        <TabsList>
          <TabsTrigger
            value="queue"
            aria-label={queue.length > 0 ? `Fila, ${queue.length} a assumir` : 'Fila'}
          >
            Fila
            {showCounter && <Counter count={queue.length} />}
          </TabsTrigger>
          {ticketId && <TabsTrigger value="subjects">Assuntos</TabsTrigger>}
        </TabsList>
        <TabsContent value="queue" className="min-h-0 overflow-x-hidden overflow-y-auto">
          <QueueTab queue={queue} sectorId={sectorId} />
        </TabsContent>
        {ticketId && (
          <TabsContent value="subjects" className="flex min-h-0 flex-col overflow-y-auto">
            <SubjectsTab key={ticketId} ticketId={ticketId} query="" onQueryChange={() => {}} />
          </TabsContent>
        )}
      </Tabs>
    </Card>
  )
}

// Topo da conversa, na barra da página (largura toda): Encerrar principal,
// secundárias com contorno, Cancelar destrutivo e separado.
function ConversationTop({ ticketId }: { ticketId: number }) {
  const { data: ticket } = useTicket(ticketId)
  const navigate = useNavigate()
  if (!ticket) return <Topbar breadcrumb="Helpdesk" title="Conversas" />
  // Protótipo: nada é gravado; a ação só mostra para onde a tela volta.
  const leave = (what: string) => () => {
    toast.success(`${what} (protótipo: nada foi gravado)`)
    void navigate('/conversas')
  }
  return (
    <Topbar
      breadcrumb={`Conversas · ${ticket.organization?.name} · ${ticket.protocol}`}
      title={ticket.contact.name}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link to={`/chamados/${ticket.id}`} className={buttonVariants({ variant: 'ghost' })}>
            <FileText strokeWidth={1.7} aria-hidden />
            Ver chamado
          </Link>
          <Button variant="destructive" onClick={leave('Chamado cancelado')}>
            <Ban strokeWidth={1.7} aria-hidden />
            Cancelar chamado
          </Button>
          <span aria-hidden className="mx-1 h-6 w-px bg-line" />
          <Button variant="outline" onClick={leave('Chamado devolvido à fila')}>
            <Undo2 strokeWidth={1.7} aria-hidden />
            Devolver à fila
          </Button>
          <Button variant="outline" onClick={leave('Chamado transferido')}>
            <UserRoundCog strokeWidth={1.7} aria-hidden />
            Transferir
          </Button>
          <Button variant="outline" onClick={leave('Chamado enviado a outro setor')}>
            <ArrowRightLeft strokeWidth={1.7} aria-hidden />
            Outro setor
          </Button>
          <Button onClick={leave('Chamado encerrado')}>
            <CircleCheck strokeWidth={1.7} aria-hidden />
            Encerrar
          </Button>
        </div>
      }
    />
  )
}

function OpenConversation({ ticketId, user }: { ticketId: number; user: User }) {
  const { data: ticket } = useTicket(ticketId)
  if (!ticket) return null
  return (
    <div className={cn('flex min-w-0 flex-col [&>*]:h-full!', columnHeight)}>
      <ConversationCard ticket={ticket} user={user} onRegister={() => {}} />
    </div>
  )
}

function NoConversation({ hasMine }: { hasMine: boolean }) {
  return (
    <Card className={cn('justify-center', columnHeight)}>
      <Empty>
        <EmptyMedia>
          <MessagesSquare strokeWidth={1.7} aria-hidden />
        </EmptyMedia>
        {hasMine ? (
          <EmptyDescription>
            <span className="body-strong block text-ink">Selecione um atendimento</span>
            Escolha uma conversa à esquerda para continuar.
          </EmptyDescription>
        ) : (
          <EmptyDescription>
            <span className="body-strong block text-ink">Sem atendimentos disponíveis</span>
            Assuma um chamado na Fila, à direita.
          </EmptyDescription>
        )}
      </Empty>
    </Card>
  )
}

export default function ConversasPage() {
  const { ticketId: param } = useParams()
  const ticketId = param ? Number(param) : undefined
  const { data: user } = useCurrentUser()
  const sectorId = user?.sectorId ?? 1
  const { data: tickets = [] } = useTickets(sectorId)
  if (!user) return null

  const recent = [...tickets].sort((a, b) => lastActivity(b) - lastActivity(a))
  const mine = recent.filter((t) => t.status === 'in_progress' && t.assignee?.id === user.id)
  const queue = recent.filter((t) => t.status === 'queued')

  return (
    <>
      {ticketId ? (
        <ConversationTop key={ticketId} ticketId={ticketId} />
      ) : (
        <Topbar breadcrumb="Helpdesk" title="Conversas" />
      )}
      <div className="grid w-full items-start gap-4 px-4 py-4 md:px-[30px] md:py-[30px] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <MyConversations mine={mine} />
        {ticketId ? (
          <OpenConversation key={ticketId} ticketId={ticketId} user={user} />
        ) : (
          <NoConversation hasMine={mine.length > 0} />
        )}
        <SidePanel key={ticketId ?? 0} queue={queue} sectorId={sectorId} ticketId={ticketId} />
      </div>
    </>
  )
}
