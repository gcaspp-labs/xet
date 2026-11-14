import { useQueries, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Ban,
  CircleAlert,
  CircleCheck,
  FileText,
  Inbox,
  MessageSquarePlus,
  MessagesSquare,
  PencilLine,
  Undo2,
  UserCheck,
  UserRoundCog,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { CancelSheet } from '@/components/CancelSheet'
import { ClosingSheet } from '@/components/ClosingSheet'
import { RegisterContactSheet } from '@/components/ContactSheet'
import { CorrectionSheet } from '@/components/CorrectionSheet'
import { NewConversationSheet } from '@/components/NewConversationSheet'
import { ReturnSheet } from '@/components/ReturnSheet'
import { Topbar } from '@/components/Topbar'
import { TransferSheet } from '@/components/TransferSheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSectors } from '@/lib/admin'
import { useCurrentUser } from '@/lib/auth'
import { ticketKey, useAssignTicket, useTicket, useTicketModules } from '@/lib/conversation'
import { formatMessageTime, organizationLabel } from '@/lib/format'
import { lastMessagePreview, ticketsQuery, type TicketSummary } from '@/lib/tickets'
import { SubjectsTab } from '@/pages/ticket/SubjectsTab'
import {
  canCancel,
  canClose,
  canCorrect,
  canReturn,
  canTransfer,
  ConversationCard,
} from '@/pages/ticket/TicketPage'
import { useConversasSearch } from '@/pages/ticket/useTicketView'

type SectorTicket = TicketSummary & { sectorId: number }
const height = 'xl:h-[calc(100dvh-150px-var(--header-height))]'

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

export default function ConversasPage() {
  const { ticketId: param } = useParams()
  const ticketId = param ? Number(param) : undefined
  const { data: user } = useCurrentUser()
  const { data: sectors = [] } = useSectors()
  const visible = sectors.filter((sector) => user?.role === 'admin' || sector.id === user?.sectorId)
  const results = useQueries({ queries: visible.map((sector) => ticketsQuery(sector.id)) })
  const { data: ticket, error: ticketError } = useTicket(ticketId ?? 0, !!ticketId)
  const { data: recordedModules } = useTicketModules(ticketId ?? 0, ticket?.status === 'closed')
  const queryClient = useQueryClient()
  const assign = useAssignTicket()
  const navigate = useNavigate()
  const [tab, setTab] = useState('queue')
  const [previousTicketId, setPreviousTicketId] = useState(ticketId)
  if (previousTicketId !== ticketId) {
    setPreviousTicketId(ticketId)
    setTab('queue')
  }
  const [chosen, setChosen] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)
  const sectorId = user?.sectorId ?? chosen ?? sectors[0]?.id
  const sector = sectors.find((item) => item.id === sectorId)
  const sectorItems = sectors.map((item) => ({ value: item.id.toString(), label: item.name }))
  const [query, setQuery] = useConversasSearch(ticketId ?? 0)
  const [action, setAction] = useState('')
  const [closingKey, setClosingKey] = useState(0)
  const tickets: SectorTicket[] = visible.flatMap((sector, i) =>
    (results[i]?.data ?? []).map((item) => ({ ...item, sectorId: sector.id })),
  )
  const mine = tickets
    .filter((item) => item.status === 'in_progress' && item.assignee?.id === user?.id)
    .sort(
      (a, b) =>
        new Date(b.lastMessage?.sentAt ?? b.arrivedAt).getTime() -
        new Date(a.lastMessage?.sentAt ?? a.arrivedAt).getTime(),
    )
  // A fila do administrador só tem setores ativos, como o sino; atendente e supervisor seguem com o
  // próprio setor, e "Meus atendimentos" não é filtrada.
  const activeSectorIds = new Set(sectors.filter((item) => item.active).map((item) => item.id))
  const queue = tickets.filter(
    (item) =>
      item.status === 'queued' && (user?.role !== 'admin' || activeSectorIds.has(item.sectorId)),
  )
  const showSubjects = !!ticket && !!user && canClose(ticket, user)
  const currentTab = showSubjects ? tab : 'queue'
  const leave = () => void navigate('/conversas')
  if (!user) return null

  return (
    <>
      <Topbar
        wrapTitle
        breadcrumb={ticket ? `Conversas · ${ticket.sector.name} · ${ticket.protocol}` : 'Helpdesk'}
        title={ticket?.contact.name ?? 'Conversas'}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {user.role === 'admin' && sectors.length > 0 && (
              <Field className="w-[200px]">
                <FieldLabel htmlFor="conversas-sector">Setor</FieldLabel>
                <Select
                  items={sectorItems}
                  value={sectorId?.toString() ?? null}
                  onValueChange={(value) => value && setChosen(Number(value))}
                >
                  <SelectTrigger id="conversas-sector">
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
            {sector && (
              <Button onClick={() => setStarting(true)}>
                <MessageSquarePlus strokeWidth={1.7} aria-hidden />
                Nova conversa
              </Button>
            )}
            {ticket && (
              <>
                <Link
                  to={`/chamados/${ticket.id}`}
                  className={buttonVariants({ variant: 'ghost' })}
                >
                  <FileText strokeWidth={1.7} aria-hidden />
                  Ver chamado
                </Link>
                {canCancel(ticket, user) && (
                  <>
                    <span aria-hidden className="h-6 border-l border-line" />
                    <Button variant="destructive" onClick={() => setAction('cancel')}>
                      <Ban strokeWidth={1.7} aria-hidden />
                      Cancelar chamado
                    </Button>
                  </>
                )}
                {canReturn(ticket, user) && (
                  <Button variant="outline" onClick={() => setAction('return')}>
                    <Undo2 strokeWidth={1.7} aria-hidden />
                    Devolver à fila
                  </Button>
                )}
                {ticket.status === 'queued' && (
                  <Button
                    disabled={assign.isPending}
                    onClick={() =>
                      assign.mutate(
                        { ticketId: ticket.id, sectorId: ticket.sector.id },
                        { onSuccess: () => toast.success('Chamado assumido') },
                      )
                    }
                  >
                    <UserCheck strokeWidth={1.7} aria-hidden />
                    Assumir
                  </Button>
                )}
                {canTransfer(ticket, user) && (
                  <Button variant="outline" onClick={() => setAction('transfer')}>
                    <UserRoundCog strokeWidth={1.7} aria-hidden />
                    Transferir
                  </Button>
                )}
                {canCorrect(ticket, user) && (
                  <Button onClick={() => setAction('correct')}>
                    <PencilLine strokeWidth={1.7} aria-hidden />
                    Corrigir
                  </Button>
                )}
                {showSubjects && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setClosingKey((n) => n + 1)
                      setAction('sector')
                    }}
                  >
                    <ArrowRightLeft strokeWidth={1.7} aria-hidden />
                    Outro setor
                  </Button>
                )}
                {showSubjects && (
                  <Button
                    onClick={() => {
                      setClosingKey((n) => n + 1)
                      setAction('close')
                    }}
                  >
                    <CircleCheck strokeWidth={1.7} aria-hidden />
                    Encerrar
                  </Button>
                )}
              </>
            )}
          </div>
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
      {ticket && (
        <>
          <CancelSheet
            ticket={ticket}
            open={action === 'cancel'}
            onOpenChange={(open) => !open && setAction('')}
            successTo="/conversas"
          />
          <ReturnSheet
            ticket={ticket}
            open={action === 'return'}
            onOpenChange={(open) => !open && setAction('')}
            successTo="/conversas"
          />
          <ClosingSheet
            key={closingKey}
            ticket={ticket}
            open={action === 'close'}
            onOpenChange={(open) => !open && setAction('')}
            successTo="/conversas"
          />
          <ClosingSheet
            key={`sector-${closingKey}`}
            ticket={ticket}
            open={action === 'sector'}
            onOpenChange={(open) => !open && setAction('')}
            successTo="/conversas"
            transfer
          />
          <TransferSheet
            ticket={ticket}
            open={action === 'transfer'}
            onOpenChange={(open) => !open && setAction('')}
            onSuccess={leave}
          />
          {action === 'correct' && recordedModules && (
            <CorrectionSheet
              ticket={ticket}
              recorded={recordedModules}
              onOpenChange={() => setAction('')}
            />
          )}
          {action === 'register' && (
            <RegisterContactSheet
              contactId={ticket.contact.id}
              organizationOptional
              onOpenChange={() => setAction('')}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ticketKey(ticket.id) })}
            />
          )}
        </>
      )}
      <div className="grid w-full items-start gap-4 px-4 py-4 md:px-[30px] md:py-[30px] xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <Card role="region" aria-labelledby="my-conversations-title" className={height}>
          <CardHeader>
            <CardTitle id="my-conversations-title">Meus atendimentos ({mine.length})</CardTitle>
          </CardHeader>
          {mine.length ? (
            <nav aria-label="Meus atendimentos" className="flex-1 overflow-y-auto">
              <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                {mine.map((item) => (
                  <li key={item.id}>
                    <NavLink
                      to={`/conversas/${item.id}`}
                      className="flex flex-col gap-1 border-l-3 border-transparent px-4 py-2.5 hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-accent-soft"
                    >
                      <TicketLine ticket={item} />
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
        {ticketError ? (
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{ticketError.message}</AlertDescription>
          </Alert>
        ) : ticket ? (
          <ConversationCard
            ticket={ticket}
            user={user}
            modern
            onRegister={() => setAction('register')}
          />
        ) : (
          <Card className={`justify-center ${height}`}>
            <Empty>
              <EmptyMedia>
                <MessagesSquare strokeWidth={1.7} aria-hidden />
              </EmptyMedia>
              <EmptyDescription>
                <span className="body-strong block text-ink">
                  {mine.length ? 'Selecione um atendimento' : 'Sem atendimentos disponíveis'}
                </span>
                {mine.length
                  ? 'Escolha uma conversa à esquerda para continuar.'
                  : 'Assuma um chamado na Fila, à direita.'}
              </EmptyDescription>
            </Empty>
          </Card>
        )}
        <Card role="region" aria-label="Fila e assuntos" className={height}>
          <Tabs
            value={currentTab}
            onValueChange={(value) => setTab(String(value))}
            className="min-h-0 flex-1 p-5"
          >
            <TabsList>
              <TabsTrigger
                value="queue"
                aria-label={queue.length ? `Fila, ${queue.length} a assumir` : 'Fila'}
              >
                Fila
                {currentTab !== 'queue' && queue.length > 0 && (
                  <span
                    aria-hidden
                    className="mono-num ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[calc(10px*var(--text-scale))] leading-none font-medium text-primary-foreground"
                  >
                    {queue.length}
                  </span>
                )}
              </TabsTrigger>
              {showSubjects && <TabsTrigger value="subjects">Assuntos</TabsTrigger>}
            </TabsList>
            <TabsContent value="queue" className="min-h-0 overflow-y-auto">
              {assign.error && (
                <Alert variant="warning">
                  <CircleAlert strokeWidth={1.7} aria-hidden />
                  <AlertDescription>{assign.error.message}</AlertDescription>
                </Alert>
              )}
              {queue.length === 0 ? (
                <Empty>
                  <EmptyMedia>
                    <Inbox strokeWidth={1.7} aria-hidden />
                  </EmptyMedia>
                  <EmptyDescription>Nenhum chamado esperando.</EmptyDescription>
                </Empty>
              ) : (
                <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                  {queue.map((item) => (
                    <li key={item.id} className="flex flex-col gap-2 py-3">
                      <TicketLine ticket={item} />
                      {item.organizationName && (
                        <span className="caption truncate text-ink-faint">
                          {organizationLabel(item.organizationName, item.municipalityName)}
                        </span>
                      )}
                      <Button
                        className="self-start"
                        disabled={assign.isPending}
                        aria-label={`Assumir chamado de ${item.contact.name}`}
                        onClick={() =>
                          assign.mutate(
                            { ticketId: item.id, sectorId: item.sectorId },
                            {
                              onSuccess: () => {
                                setTab('queue')
                                void navigate(`/conversas/${item.id}`)
                              },
                            },
                          )
                        }
                      >
                        <UserCheck strokeWidth={1.7} aria-hidden />
                        Assumir
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            {showSubjects && (
              <TabsContent value="subjects" className="flex min-h-0 flex-col overflow-y-auto">
                <SubjectsTab
                  key={ticket.id}
                  ticketId={ticket.id}
                  query={query}
                  onQueryChange={setQuery}
                />
              </TabsContent>
            )}
          </Tabs>
        </Card>
      </div>
    </>
  )
}
