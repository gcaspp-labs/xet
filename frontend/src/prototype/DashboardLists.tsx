// PROTÓTIPO #160 — descartável, não vai para a main.
// Versão aprovada (C, quadro lado a lado): a fila e os chamados em atendimento no Dashboard,
// em duas colunas compactas, Fila | Em atendimento, logo depois dos números "Agora".
import { useQuery } from '@tanstack/react-query'
import { Inbox, MessagesSquare, UserCheck } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { useCurrentUser } from '@/lib/auth'
import { organizationLabel } from '@/lib/format'
import { type TicketSummary } from '@/lib/tickets'
import { cn } from 'cn'

export type LiveTicket = TicketSummary & { sector: { id: number; name: string } }
type Lists = { queued: LiveTicket[]; inProgress: LiveTicket[] }

// Mesmos filtros do Dashboard; a API falsa aplica só os que valem para as listas.
export function useLiveLists(search: string) {
  return useQuery({
    queryKey: ['dashboard', 'tickets', search],
    queryFn: () => api<Lists>(`/dashboard/tickets?${search}`),
  })
}

function waitingFor(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`
}

function ContactCell({ ticket, compact = false }: { ticket: LiveTicket; compact?: boolean }) {
  return (
    <TableCell className={cn('whitespace-normal', compact ? 'max-w-0 w-full' : 'min-w-[calc(240px*var(--text-scale))]')}>
      <Link
        to={`/chamados/${ticket.id}`}
        className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
      >
        {ticket.contact.name}
      </Link>
      <p className={cn('caption text-ink-faint', compact && 'truncate')}>
        <span className="mono-num">{ticket.protocol}</span>
        {' · '}
        {ticket.organizationName
          ? organizationLabel(ticket.organizationName, ticket.municipalityName)
          : 'Não cadastrado'}
      </p>
    </TableCell>
  )
}

function AssumeButton({ ticket, compact = false }: { ticket: LiveTicket; compact?: boolean }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="relative z-10"
      aria-label={`Assumir chamado de ${ticket.contact.name}`}
      onClick={() => toast.success('Chamado assumido. (Protótipo: aqui abriria em Conversas.)')}
    >
      <UserCheck strokeWidth={1.7} aria-hidden />
      {!compact && 'Assumir'}
      {compact && <span className="sr-only">Assumir</span>}
    </Button>
  )
}

function Assignee({ ticket, userId }: { ticket: LiveTicket; userId?: number }) {
  return ticket.assignee?.id === userId ? <Badge tone="success">Você</Badge> : <>{ticket.assignee?.name}</>
}

function EmptyQueue() {
  return (
    <Empty>
      <EmptyMedia>
        <Inbox strokeWidth={1.7} aria-hidden />
      </EmptyMedia>
      <EmptyDescription>Nenhum chamado na fila.</EmptyDescription>
    </Empty>
  )
}

function EmptyInProgress() {
  return (
    <Empty>
      <EmptyMedia>
        <MessagesSquare strokeWidth={1.7} aria-hidden />
      </EmptyMedia>
      <EmptyDescription>Nenhum chamado em atendimento.</EmptyDescription>
    </Empty>
  )
}

// Período e módulo não filtram as listas: avisa quando um deles está ativo.
export function ListsNote({ moduleOn }: { moduleOn: boolean }) {
  return (
    <p className="caption text-ink-faint">
      {moduleOn
        ? 'Módulo e período não filtram as listas: elas mostram todos os chamados de agora.'
        : 'Ao vivo. Período e módulo não filtram as listas.'}
    </p>
  )
}

function CountTitle({ id, title, count }: { id: string; title: string; count: number }) {
  return (
    <CardTitle id={id} className="flex items-center gap-2">
      {title}
      <span className="mono-num caption text-ink-faint">{count}</span>
    </CardTitle>
  )
}

// C: quadro de duas colunas compactas, Fila | Em atendimento, sem a última mensagem.
export function VariantC({ lists, showSector, moduleOn }: { lists: Lists; showSector: boolean; moduleOn: boolean }) {
  const { data: user } = useCurrentUser()
  return (
    <div className="flex flex-col gap-3">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card role="region" aria-labelledby="board-queue-title">
          <CardHeader>
            <CountTitle id="board-queue-title" title="Fila" count={lists.queued.length} />
          </CardHeader>
          {lists.queued.length === 0 ? (
            <EmptyQueue />
          ) : (
            <Table>
              <TableBody>
                {lists.queued.map((t) => (
                  <TableRow key={t.id} className="relative">
                    <ContactCell ticket={t} compact />
                    <TableCell className="whitespace-nowrap text-right">
                      <p className="mono-num">{waitingFor(t.arrivedAt)}</p>
                      {showSector && <p className="caption text-ink-faint">{t.sector.name}</p>}
                    </TableCell>
                    <TableCell className="w-0">
                      <AssumeButton ticket={t} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
        <Card role="region" aria-labelledby="board-progress-title">
          <CardHeader>
            <CountTitle id="board-progress-title" title="Em atendimento" count={lists.inProgress.length} />
          </CardHeader>
          {lists.inProgress.length === 0 ? (
            <EmptyInProgress />
          ) : (
            <Table>
              <TableBody>
                {lists.inProgress.map((t) => (
                  <TableRow key={t.id} className="relative">
                    <ContactCell ticket={t} compact />
                    <TableCell className="whitespace-nowrap text-right">
                      <p>
                        <Assignee ticket={t} userId={user?.id} />
                      </p>
                      <p className="caption text-ink-faint">
                        <span className="mono-num">{t.assignedAt && waitingFor(t.assignedAt)}</span>
                        {showSector && ` · ${t.sector.name}`}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
      <ListsNote moduleOn={moduleOn} />
    </div>
  )
}
