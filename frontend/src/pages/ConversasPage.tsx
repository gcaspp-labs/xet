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
  MoreHorizontal,
  Plus,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PrototypeSwitcher, useHeader178, useVariant } from '@/prototype/p172'
import { cn } from '@/lib/utils'
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

type SectorTicket = TicketSummary & { sectorId: number }
// PROTÓTIPO #172: sem altura fixa presumida, em todos os tamanhos. A tela ocupa a altura
// da janela abaixo da barra do topo; o cabeçalho fica com o que precisar e os blocos com o
// resto. Abaixo de xl, ver as versões em `@/prototype/p172`.
type Panel = 'mine' | 'conversation' | 'queue'

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
  const variant = useVariant()
  const header178 = useHeader178()
  // Bloco visível quando só cabe um (A: abaixo de xl; B: abaixo de lg).
  const [panel, setPanel] = useState<Panel>(ticketId ? 'conversation' : 'mine')
  const [previousTicketId, setPreviousTicketId] = useState(ticketId)
  if (previousTicketId !== ticketId) {
    setPreviousTicketId(ticketId)
    setTab('queue')
    setPanel(ticketId ? 'conversation' : 'mine')
  }
  const [chosen, setChosen] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)
  const sectorId = user?.sectorId ?? chosen ?? sectors[0]?.id
  const sector = sectors.find((item) => item.id === sectorId)
  const sectorItems = sectors.map((item) => ({ value: item.id.toString(), label: item.name }))
  const [query, setQuery] = useState('')
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
  const queue = tickets.filter((item) => item.status === 'queued')
  const showSubjects = !!ticket && !!user && canClose(ticket, user)
  const currentTab = showSubjects ? tab : 'queue'
  const leave = () => void navigate('/conversas')
  // Só um bloco por vez: A abaixo de xl, B abaixo de lg.
  const show = (which: Panel) =>
    panel === which ? undefined : variant === 'A' ? 'max-xl:hidden' : 'max-lg:hidden'
  const conversationPlace =
    variant === 'B' ? 'lg:col-start-2 lg:row-span-2 lg:row-start-1 xl:row-span-1' : undefined
  if (!user) return null

  return (
    <div className="flex h-[calc(100dvh-var(--header-height))] flex-col overflow-clip [&>header]:shrink-0">
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
            {sector && !header178 && (
              <Button onClick={() => setStarting(true)}>
                <MessageSquarePlus strokeWidth={1.7} aria-hidden />
                Nova conversa
              </Button>
            )}
            {ticket && header178 && (
              <>
                {ticket.status === 'queued' && (
                  <Button>
                    <UserCheck strokeWidth={1.7} aria-hidden />
                    Assumir
                  </Button>
                )}
                {showSubjects && (
                  <Button>
                    <CircleCheck strokeWidth={1.7} aria-hidden />
                    Encerrar
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="outline" size="icon" aria-label="Mais ações" />}
                  >
                    <MoreHorizontal strokeWidth={1.7} aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-48">
                    <DropdownMenuItem>
                      <Undo2 strokeWidth={1.7} aria-hidden />
                      Devolver à fila
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <UserRoundCog strokeWidth={1.7} aria-hidden />
                      Transferir
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <ArrowRightLeft strokeWidth={1.7} aria-hidden />
                      Outro setor
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      <Ban strokeWidth={1.7} aria-hidden />
                      Cancelar chamado
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            {ticket && !header178 && (
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
      <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 py-3 md:px-[30px] md:py-[30px]">
        <Tabs
          value={panel}
          onValueChange={(value) => setPanel(value as Panel)}
          className={cn('shrink-0', variant === 'A' ? 'xl:hidden' : 'lg:hidden')}
        >
          <TabsList aria-label="Mostrar" className="w-full">
            <TabsTrigger value="mine" className="flex-1">
              Meus <span className="mono-num ml-1">({mine.length})</span>
            </TabsTrigger>
            <TabsTrigger value="conversation" className="flex-1">
              Conversa
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex-1">
              Fila <span className="mono-num ml-1">({queue.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div
          className={cn(
            'grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-4',
            variant === 'B' &&
              'lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]',
            'xl:grid-cols-[260px_minmax(0,1fr)_320px] xl:grid-rows-[minmax(0,1fr)]',
          )}
        >
          <Card
            role="region"
            aria-labelledby="my-conversations-title"
            className={cn(
              'min-h-0',
              show('mine'),
              variant === 'B' && 'lg:col-start-1 lg:row-start-1',
            )}
          >
            <CardHeader className={header178 ? 'grid-cols-[1fr_auto] items-center' : undefined}>
              <CardTitle id="my-conversations-title">Meus atendimentos ({mine.length})</CardTitle>
              {header178 && sector && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Nova conversa"
                  className="-my-1"
                  onClick={() => setStarting(true)}
                >
                  <Plus strokeWidth={1.7} aria-hidden />
                </Button>
              )}
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
            <Alert variant="warning" className={cn('self-start', show('conversation'))}>
              <CircleAlert strokeWidth={1.7} aria-hidden />
              <AlertDescription>{ticketError.message}</AlertDescription>
            </Alert>
          ) : ticket ? (
            <ConversationCard
              ticket={ticket}
              user={user}
              modern
              className={cn('h-full min-h-0 lg:h-full', show('conversation'), conversationPlace)}
              onRegister={() => setAction('register')}
            />
          ) : (
            <Card className={cn('min-h-0 justify-center', show('conversation'), conversationPlace)}>
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
          <Card
            role="region"
            aria-label="Fila e assuntos"
            className={cn(
              'min-h-0',
              show('queue'),
              variant === 'B' && 'lg:col-start-1 lg:row-start-2 xl:col-start-3 xl:row-start-1',
            )}
          >
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
      </div>
      <PrototypeSwitcher />
    </div>
  )
}
