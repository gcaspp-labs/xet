import { useQueries, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRightLeft,
  Ban,
  CircleAlert,
  CircleCheck,
  Inbox,
  MoreHorizontal,
  Plus,
  MessagesSquare,
  Undo2,
  UserCheck,
  UserRoundCog,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { CancelSheet } from '@/components/CancelSheet'
import { ClosingSheet } from '@/components/ClosingSheet'
import { RegisterContactSheet } from '@/components/ContactSheet'
import { PhoneCopy } from '@/components/PhoneCopy'
import { NewConversationSheet } from '@/components/NewConversationSheet'
import { ReturnSheet } from '@/components/ReturnSheet'
import { Topbar } from '@/components/Topbar'
import NotFoundPage from '@/pages/NotFoundPage'
import { SectorTransferSheet } from '@/components/SectorTransferSheet'
import { TransferSheet } from '@/components/TransferSheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { cn } from '@/lib/utils'
import { useSectors } from '@/lib/admin'
import { isNotFound } from '@/lib/api'
import { useCurrentUser } from '@/lib/auth'
import { ticketKey, useAssignTicket, useTicket } from '@/lib/conversation'
import { formatMessageTime, organizationLabel } from '@/lib/format'
import { lastMessagePreview, parseTicketId, ticketsQuery, type TicketSummary } from '@/lib/tickets'
import { SubjectsTab } from '@/pages/ticket/SubjectsTab'
import {
  canCancel,
  canClose,
  canReturn,
  canTransfer,
  ConversationCard,
} from '@/pages/ticket/TicketPage'
import { useConversasSearch } from '@/pages/ticket/useTicketView'

import type { TicketDetail } from '@/lib/conversation'
import type { User } from '@/lib/auth'

type Action = 'cancel' | 'return' | 'transfer' | 'sector' | 'close'

// Ação principal visível (Assumir na fila, Encerrar em atendimento) e o resto no menu "Mais ações" (⋯),
// com Cancelar chamado no fim, depois de um divisor. Cada item aparece só para quem pode.
function TicketActions({
  ticket,
  user,
  canSubjects,
  onAction,
  onAssign,
  assigning,
}: {
  ticket: TicketDetail
  user: User
  canSubjects: boolean
  onAction: (action: Action) => void
  onAssign: () => void
  assigning: boolean
}) {
  const main = [
    canReturn(ticket, user) && { id: 'return' as const, label: 'Devolver à fila', icon: Undo2 },
    canTransfer(ticket, user) && {
      id: 'transfer' as const,
      label: 'Transferir',
      icon: UserRoundCog,
    },
    canSubjects && { id: 'sector' as const, label: 'Outro setor', icon: ArrowRightLeft },
  ].filter((item) => !!item)
  const cancel = canCancel(ticket, user)
  const hasMenu = main.length > 0 || cancel
  return (
    <div className="flex items-center gap-2">
      {ticket.status === 'queued' && (
        <Button disabled={assigning} onClick={onAssign}>
          <UserCheck strokeWidth={1.7} aria-hidden />
          Assumir
        </Button>
      )}
      {canSubjects && (
        <Button onClick={() => onAction('close')}>
          <CircleCheck strokeWidth={1.7} aria-hidden />
          Encerrar
        </Button>
      )}
      {hasMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="icon" aria-label="Mais ações" title="Mais ações" />
            }
          >
            <MoreHorizontal strokeWidth={1.7} aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            {main.map((item) => (
              <DropdownMenuItem key={item.id} onClick={() => onAction(item.id)}>
                <item.icon strokeWidth={1.7} aria-hidden />
                {item.label}
              </DropdownMenuItem>
            ))}
            {cancel && main.length > 0 && <DropdownMenuSeparator />}
            {cancel && (
              <DropdownMenuItem variant="destructive" onClick={() => onAction('cancel')}>
                <Ban strokeWidth={1.7} aria-hidden />
                Cancelar chamado
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

type SectorTicket = TicketSummary & { sectorId: number }
// Abaixo de xl só um bloco aparece por vez; a partir de xl, os três ficam lado a lado.
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
  // Sem id é a tela sem seleção; com id que não é número, Não encontrado (sem chamar a API).
  const invalidId = param !== undefined && parseTicketId(param) === null
  const ticketId = parseTicketId(param) ?? undefined
  const { data: user } = useCurrentUser()
  const { data: sectors = [] } = useSectors()
  const visible = sectors.filter((sector) => user?.role === 'admin' || sector.id === user?.sectorId)
  const results = useQueries({ queries: visible.map((sector) => ticketsQuery(sector.id)) })
  const { data: ticket, error: ticketError } = useTicket(ticketId ?? 0, !!ticketId)
  const queryClient = useQueryClient()
  const assign = useAssignTicket()
  const navigate = useNavigate()
  const [tab, setTab] = useState('queue')
  // Bloco visível abaixo de xl: com chamado aberto começa em Conversa; sem chamado, em Meus.
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
  // próprio setor, e "Meus chamados" não é filtrada.
  const activeSectorIds = new Set(sectors.filter((item) => item.active).map((item) => item.id))
  const queue = tickets.filter(
    (item) =>
      item.status === 'queued' && (user?.role !== 'admin' || activeSectorIds.has(item.sectorId)),
  )
  const showSubjects = !!ticket && !!user && canClose(ticket, user)
  const currentTab = showSubjects ? tab : 'queue'
  const leave = () => void navigate('/chamados')
  const show = (which: Panel) => (panel === which ? undefined : 'max-xl:hidden')
  const location = useLocation()
  // Chamado encerrado (cancelado e transferido incluídos) não é desta tela: vai para Atendimentos,
  // substituindo o endereço no histórico. Vale para link antigo e para quem está com o chamado aberto
  // quando outra pessoa o encerra. Mas quem encerra, cancela ou transfere pela própria tela volta a
  // /chamados, e isso prevalece: não redireciona com um formulário aberto (a consulta já veio
  // encerrada antes de o formulário fechar) nem se a navegação da própria pessoa já foi pedida (o
  // endereço do navegador muda na hora, a tela do roteador depois).
  const closed = ticket?.status === 'closed' && ticket.id === ticketId
  useEffect(() => {
    if (closed && action === '' && window.location.pathname === location.pathname) {
      void navigate(`/atendimentos/${ticketId}`, { replace: true })
    }
  }, [closed, action, ticketId, location.pathname, navigate])
  if (invalidId || isNotFound(ticketError)) return <NotFoundPage />
  if (!user || (closed && action === '')) return null

  return (
    <div className="flex h-[calc(100dvh-var(--header-height)-var(--realtime-note-height,0px))] flex-col overflow-clip [&>header]:shrink-0">
      <Topbar
        wrapTitle
        breadcrumb={ticket ? `Chamados · ${ticket.sector.name} · ${ticket.protocol}` : 'Helpdesk'}
        title={ticket?.contact.name ?? 'Chamados'}
        subtitle={ticket && <PhoneCopy phone={ticket.contact.phone} />}
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
            {ticket && (
              <TicketActions
                ticket={ticket}
                user={user}
                onAction={(next) => {
                  if (next === 'close' || next === 'sector') setClosingKey((n) => n + 1)
                  setAction(next)
                }}
                canSubjects={showSubjects}
                onAssign={() =>
                  assign.mutate(
                    { ticketId: ticket.id, sectorId: ticket.sector.id },
                    { onSuccess: () => toast.success('Chamado assumido') },
                  )
                }
                assigning={assign.isPending}
              />
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
            successTo="/chamados"
          />
          <ReturnSheet
            ticket={ticket}
            open={action === 'return'}
            onOpenChange={(open) => !open && setAction('')}
            successTo="/chamados"
          />
          <ClosingSheet
            key={closingKey}
            ticket={ticket}
            open={action === 'close'}
            onOpenChange={(open) => !open && setAction('')}
            successTo="/chamados"
          />
          <SectorTransferSheet
            ticket={ticket}
            open={action === 'sector'}
            onOpenChange={(open) => !open && setAction('')}
            onSuccess={leave}
          />
          <TransferSheet
            ticket={ticket}
            open={action === 'transfer'}
            onOpenChange={(open) => !open && setAction('')}
            onSuccess={leave}
          />
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
          className="shrink-0 xl:hidden"
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
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
          <Card
            role="region"
            aria-labelledby="my-conversations-title"
            className={cn('min-h-0', show('mine'))}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle id="my-conversations-title">Meus chamados ({mine.length})</CardTitle>
              {sector && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Novo chamado"
                  title="Novo chamado"
                  onClick={() => setStarting(true)}
                >
                  <Plus strokeWidth={1.7} aria-hidden />
                </Button>
              )}
            </CardHeader>
            {mine.length ? (
              <nav aria-label="Meus chamados" className="flex-1 overflow-y-auto">
                <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                  {mine.map((item) => (
                    <li key={item.id}>
                      <NavLink
                        to={`/chamados/${item.id}`}
                        onClick={() => setPanel('conversation')}
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
              className={cn('h-full min-h-0 lg:h-full', show('conversation'))}
              onRegister={() => setAction('register')}
            />
          ) : (
            <Card className={cn('min-h-0 justify-center', show('conversation'))}>
              <Empty>
                <EmptyMedia>
                  <MessagesSquare strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>
                  <span className="body-strong block text-ink">
                    {mine.length ? 'Selecione um atendimento' : 'Sem atendimentos disponíveis'}
                  </span>
                  {mine.length
                    ? 'Escolha um chamado em Meus chamados para continuar.'
                    : 'Assuma um chamado na Fila.'}
                </EmptyDescription>
              </Empty>
            </Card>
          )}
          <Card role="region" aria-label="Fila e assuntos" className={cn('min-h-0', show('queue'))}>
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
                                  setPanel('conversation')
                                  void navigate(`/chamados/${item.id}`)
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
    </div>
  )
}
