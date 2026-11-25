import { ArrowRight, CircleAlert, CirclePause } from 'lucide-react'
import { Link } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
// O período dos números não muda o quadro; o setor, sim. Sem dados não há quantidade nem "Nenhum
// chamado pendente": quem não carregou vê o aviso do erro, como nas listas ao vivo.
export function DashboardPending({
  sectorId,
  showSector,
}: {
  sectorId?: number
  showSector: boolean
}) {
  const { data, error } = useDashboardPending(sectorId)
  const tickets = data?.tickets ?? []
  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="warning">
          <CircleAlert strokeWidth={1.7} aria-hidden />
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      <Card role="region" aria-labelledby="board-pending-title">
        <CardHeader className="bg-muted">
          <CardTitle id="board-pending-title">
            Pendentes{' '}
            {data && (
              <span className="mono-num font-semibold text-accent-strong">({data.count})</span>
            )}
          </CardTitle>
          <CardDescription>Os 10 parados há mais tempo</CardDescription>
          <CardAction>
            <Link
              to="/chamados?aba=pendentes"
              className="caption inline-flex items-center gap-1 whitespace-nowrap text-accent-strong underline-offset-2 hover:underline"
            >
              Ver todos
              <ArrowRight strokeWidth={1.7} className="size-3.5" aria-hidden />
            </Link>
          </CardAction>
        </CardHeader>
        {data && tickets.length === 0 && (
          <Empty>
            <EmptyMedia>
              <CirclePause strokeWidth={1.7} aria-hidden />
            </EmptyMedia>
            <EmptyDescription>Nenhum chamado pendente</EmptyDescription>
          </Empty>
        )}
        {data && tickets.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[260px] text-ink">Chamado</TableHead>
                  <TableHead className="text-ink">Motivo</TableHead>
                  {showSector && <TableHead className="w-[180px] text-ink">Setor</TableHead>}
                  <TableHead className="w-[120px] whitespace-nowrap text-right text-ink">
                    Parado há
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="relative">
                    <TableCell className="w-[260px] max-w-0 whitespace-normal">
                      <Link
                        to={`/chamados/${ticket.id}`}
                        className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline"
                      >
                        {ticket.contact.name}
                      </Link>
                      <p className="caption mono-num text-ink-faint">{ticket.protocol}</p>
                    </TableCell>
                    <TableCell className="max-w-0 whitespace-normal">
                      <p className="body">{ticket.reason ?? '—'}</p>
                    </TableCell>
                    {showSector && (
                      <TableCell className="w-[180px]">{ticket.sector.name}</TableCell>
                    )}
                    <TableCell className="w-[120px] whitespace-nowrap text-right">
                      <p className="mono-num">
                        {ticket.pendingAt ? formatIdleTime(ticket.pendingAt) : '—'}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="caption border-t border-line-soft px-5 py-3 text-ink-faint">
              Ao vivo. O período não muda o quadro; os 10 parados há mais tempo, primeiro.
            </p>
          </>
        )}
      </Card>
    </div>
  )
}
