import { useQuery } from '@tanstack/react-query'
import { CircleAlert, Inbox, MessagesSquare, UserCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Pagination } from '@/components/Pagination'
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
import { useQueryState } from '@/lib/paging'
import type { TicketSummary } from '@/lib/tickets'

type LiveTicket = TicketSummary & { sector: { id: number; name: string } }
type Lists = { queued: LiveTicket[]; inProgress: LiveTicket[] }

// As listas do Dashboard paginam no navegador, de 5 em 5 (exceção à regra 7 de
// interface.md, registrada em dashboard.md).
const pageSize = 5

// A página de cada lista fica no endereço, com parâmetro próprio (regra 9 de
// interface.md): recarregar, voltar de outra tela ou abrir o link devolve a mesma
// página, e recolher a seção não a perde.
const pageParams = { queue: 'paginaFila', progress: 'paginaAtendimento' } as const

function pageIn(params: URLSearchParams, name: string) {
  const page = Math.trunc(Number(params.get(name)))
  return page >= 1 ? page : 1
}

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

// A quantidade substitui o card "Agora": entre parênteses, em destaque no título.
function Count({ value }: { value: number }) {
  return <span className="mono-num font-semibold text-accent-strong">({value})</span>
}

// A última página tem menos de 5 linhas: as vazias mantêm a altura da tabela igual
// entre as páginas, sem borda nem conteúdo para o leitor de tela.
function FillerRow({ action }: { action: boolean }) {
  return (
    <TableRow aria-hidden className="border-b border-transparent hover:bg-transparent">
      <TableCell className="w-full max-w-0 whitespace-normal">
        <span className="body-strong">&nbsp;</span>
        <p className="caption truncate text-ink-faint">
          <span className="mono-num">&nbsp;</span>
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">
        <p className="mono-num">&nbsp;</p>
        <p className="caption text-ink-faint">&nbsp;</p>
      </TableCell>
      {action && <TableCell className="w-0" />}
    </TableRow>
  )
}

function ListCard({
  titleId,
  title,
  count,
  empty,
  tickets,
  page,
  onPage,
  action,
  row,
}: {
  titleId: string
  title: string
  count: number
  empty: ReactNode
  tickets: LiveTicket[]
  page: number
  onPage: (page: number) => void
  action: boolean
  row: (ticket: LiveTicket) => ReactNode
}) {
  // Os mais recentes primeiro: a API devolve a lista por chegada, crescente.
  const sorted = useMemo(
    () => [...tickets].sort((a, b) => b.arrivedAt.localeCompare(a.arrivedAt)),
    [tickets],
  )
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, totalPages)
  const shown = sorted.slice((current - 1) * pageSize, current * pageSize)
  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader className="bg-muted">
        <CardTitle id={titleId}>
          {title} <Count value={count} />
        </CardTitle>
      </CardHeader>
      {sorted.length > 0 ? (
        <>
          <Table>
            <TableBody>
              {shown.map((ticket) => row(ticket))}
              {Array.from({ length: pageSize - shown.length }, (_, index) => (
                <FillerRow key={`filler-${index}`} action={action} />
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={current}
            pageSize={pageSize}
            total={sorted.length}
            noun={['chamado', 'chamados']}
            onPage={onPage}
          />
        </>
      ) : (
        empty
      )}
    </Card>
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
  const { params: url, update } = useQueryState()
  const queuePage = pageIn(url, pageParams.queue)
  const progressPage = pageIn(url, pageParams.progress)
  const setPage = (name: string, page: number) =>
    update({ [name]: page === 1 ? null : String(page) })
  // Mudar um filtro volta as duas listas à primeira página.
  const filtered = useRef(search)
  useEffect(() => {
    if (filtered.current === search) {
      return
    }
    filtered.current = search
    if (url.has(pageParams.queue) || url.has(pageParams.progress)) {
      update({ [pageParams.queue]: null, [pageParams.progress]: null }, true)
    }
  }, [search, url, update])
  const { data, error } = useQuery({
    queryKey: ['dashboard', 'tickets', search],
    queryFn: () => api<Lists>(`/dashboard/tickets?${search}`),
  })
  // Página além da última mostra a última, e o endereço é corrigido (regra 9 de
  // interface.md).
  useEffect(() => {
    if (!data) {
      return
    }
    const last = (count: number) => Math.max(1, Math.ceil(count / pageSize))
    const fix: Record<string, string | null> = {}
    const queueLast = last(data.queued.length)
    if (queuePage > queueLast) {
      fix[pageParams.queue] = queueLast === 1 ? null : String(queueLast)
    }
    const progressLast = last(data.inProgress.length)
    if (progressPage > progressLast) {
      fix[pageParams.progress] = progressLast === 1 ? null : String(progressLast)
    }
    if (Object.keys(fix).length > 0) {
      update(fix, true)
    }
  }, [data, queuePage, progressPage, update])
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
          <ListCard
            titleId="board-queue-title"
            title="Fila"
            count={data.queued.length}
            tickets={data.queued}
            page={queuePage}
            onPage={(page) => setPage(pageParams.queue, page)}
            action
            empty={
              <Empty>
                <EmptyMedia>
                  <Inbox strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>Nenhum chamado na fila.</EmptyDescription>
              </Empty>
            }
            row={(ticket) => (
              <TableRow key={ticket.id} className="relative">
                <Contact ticket={ticket} />
                <TableCell className="whitespace-nowrap text-right">
                  <p className="mono-num">{elapsed(ticket.arrivedAt)}</p>
                  {showSector && <p className="caption text-ink-faint">{ticket.sector.name}</p>}
                </TableCell>
                <TableCell className="w-0">
                  <Button
                    size="sm"
                    className="relative z-10"
                    disabled={assign.isPending}
                    aria-label={`Assumir chamado de ${ticket.contact.name}`}
                    onClick={() =>
                      assign.mutate(
                        { ticketId: ticket.id, sectorId: ticket.sector.id },
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
            )}
          />
          <ListCard
            titleId="board-progress-title"
            title="Em atendimento"
            count={data.inProgress.length}
            tickets={data.inProgress}
            page={progressPage}
            onPage={(page) => setPage(pageParams.progress, page)}
            action={false}
            empty={
              <Empty>
                <EmptyMedia>
                  <MessagesSquare strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>Nenhum chamado em atendimento.</EmptyDescription>
              </Empty>
            }
            row={(ticket) => (
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
            )}
          />
        </div>
      )}
      <p className="caption text-ink-faint">Ao vivo. Período e módulo não filtram as listas.</p>
    </div>
  )
}
