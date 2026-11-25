import { ArrowRight, CirclePause } from 'lucide-react'
import { Link } from 'react-router'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useDashboardPending } from '@/lib/dashboard'
import { formatIdleTime } from '@/lib/format'

// O quadro Pendentes do Dashboard: quantos chamados estão parados agora e os 10 há mais tempo,
// cada linha abrindo o chamado em Chamados e o "Ver todos" a aba Pendentes (spec #332, #342).
// O período dos números não muda o quadro; o setor, sim.
export function DashboardPending({
  sectorId,
  showSector,
}: {
  sectorId?: number
  showSector: boolean
}) {
  const { data } = useDashboardPending(sectorId)
  return (
    <Card role="region" aria-labelledby="board-pending-title">
      <CardHeader className="bg-muted">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle id="board-pending-title">
              Pendentes{' '}
              <span className="mono-num font-semibold text-accent-strong">
                ({data?.count ?? 0})
              </span>
            </CardTitle>
            <p className="caption text-ink-faint">Os 10 parados há mais tempo</p>
          </div>
          <Link
            to="/chamados?aba=pendentes"
            className="caption inline-flex items-center gap-1 text-accent-strong underline-offset-2 hover:underline"
          >
            Ver todos
            <ArrowRight strokeWidth={1.7} className="size-[14px]" aria-hidden />
          </Link>
        </div>
      </CardHeader>
      {data && data.tickets.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <CirclePause strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>Nenhum chamado pendente.</EmptyDescription>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-ink">Chamado</TableHead>
              <TableHead className="text-ink">Motivo</TableHead>
              {showSector && <TableHead className="text-ink">Setor</TableHead>}
              <TableHead className="whitespace-nowrap text-right text-ink">Parado há</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.tickets ?? []).map((ticket) => (
              <TableRow key={ticket.id} className="relative">
                <TableCell className="w-full max-w-0 whitespace-normal">
                  <Link
                    to={`/chamados/${ticket.id}`}
                    className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
                  >
                    {ticket.contact.name}
                  </Link>
                  <p className="caption truncate text-ink-faint">
                    <span className="mono-num">{ticket.protocol}</span>
                  </p>
                </TableCell>
                <TableCell className="whitespace-normal">{ticket.reason ?? '—'}</TableCell>
                {showSector && (
                  <TableCell className="whitespace-nowrap">{ticket.sector.name}</TableCell>
                )}
                <TableCell className="whitespace-nowrap text-right">
                  <p className="mono-num">{ticket.pendingAt && formatIdleTime(ticket.pendingAt)}</p>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="caption border-t border-line-soft px-4 py-3 text-ink-faint">
        Ao vivo. O período não muda o quadro; os 10 parados há mais tempo, primeiro.
      </p>
    </Card>
  )
}
