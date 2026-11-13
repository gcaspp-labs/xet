import { History } from 'lucide-react'
import { useEffect } from 'react'
import { Pagination } from '@/components/Pagination'
import { SortableTableHead } from '@/components/SortableTableHead'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Link, useLocation } from 'react-router'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { type HistoryEntry, useContactHistory, useOrganizationHistory } from '@/lib/conversation'
import { formatDateTime, organizationLabel, ticketStatusLabel } from '@/lib/format'
import { useQueryState, type SortDirection } from '@/lib/paging'
import type { HistorySort } from '@/lib/conversation'

// Chamados do contato ou do órgão, do mais recente ao mais antigo, só dos
// setores do usuário (o backend filtra). Cada um abre a conversa completa.
export function TicketHistoryList({
  label,
  entries,
  currentTicketId,
  onOpen,
}: {
  label: string
  entries: HistoryEntry[] | undefined
  currentTicketId?: number
  onOpen?: () => void
}) {
  const location = useLocation()
  if (!entries) {
    return null
  }
  if (entries.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <History strokeWidth={1.7} aria-hidden />
        </EmptyMedia>
        <EmptyDescription>Nenhum chamado no histórico.</EmptyDescription>
      </Empty>
    )
  }
  return (
    <ul aria-label={label} className="flex flex-col divide-y divide-line-soft">
      {entries.map((entry) => {
        const status = ticketStatusLabel(entry.status, entry.closureType)
        return (
          <li key={entry.id} className="flex flex-col gap-1 py-2.5">
            <div className="flex items-center gap-2">
              <Link
                to={`/chamados/${entry.id}`}
                state={{ historyReturn: location.pathname + location.search }}
                onClick={onOpen}
                className="mono-num body-strong text-accent-strong underline-offset-2 hover:underline"
              >
                {entry.protocol}
              </Link>
              {entry.id === currentTicketId && (
                <span className="caption text-ink-faint">Este chamado</span>
              )}
              <Badge tone={status.tone} className="ml-auto">
                {status.label}
              </Badge>
            </div>
            <p className="caption text-ink-faint">
              {entry.sectorName} · {entry.contactName}
              {entry.organizationName &&
                ` · ${organizationLabel(entry.organizationName, entry.municipalityName)}`}
            </p>
            <p className="caption text-ink-faint">
              <span className="mono-num">{formatDateTime(entry.arrivedAt)}</span>
              {entry.assigneeName && ` · ${entry.assigneeName}`}
            </p>
            {entry.subject && <p className="body-sm">{entry.subject}</p>}
          </li>
        )
      })}
    </ul>
  )
}

type HistoryTarget = { kind: 'contact' | 'organization'; id: number; name: string }

const columns: Record<string, HistorySort> = {
  chegada: 'arrived',
  protocolo: 'protocol',
  contato: 'contact',
  setor: 'sector',
  responsavel: 'assignee',
  situacao: 'status',
}

// Os parâmetros do histórico são independentes dos parâmetros da lista de cadastro.
export function useHistoryTarget() {
  const { params, update } = useQueryState()
  const kind = params.get('historico')
  const id = Number(params.get('historicoId'))
  const target: HistoryTarget | null =
    (kind === 'contact' || kind === 'organization') && Number.isSafeInteger(id) && id > 0
      ? { kind, id, name: params.get('historicoNome') ?? '' }
      : null
  const open = (next: HistoryTarget) =>
    update({
      historico: next.kind,
      historicoId: String(next.id),
      historicoNome: next.name,
      historicoPagina: null,
      historicoOrdem: null,
      historicoDirecao: null,
    })
  const close = () =>
    update({
      historico: null,
      historicoId: null,
      historicoNome: null,
      historicoPagina: null,
      historicoOrdem: null,
      historicoDirecao: null,
    })
  return { target, open, close }
}

export function HistorySheet({
  target,
  onClose,
  currentTicketId,
}: {
  target: HistoryTarget | null
  onClose: () => void
  currentTicketId?: number
}) {
  const { params, update } = useQueryState()
  const location = useLocation()
  const chosen = params.get('historicoOrdem') ?? 'chegada'
  const column = Object.hasOwn(columns, chosen) ? chosen : 'chegada'
  const direction: SortDirection = Object.hasOwn(columns, chosen)
    ? params.get('historicoDirecao') === 'asc'
      ? 'asc'
      : 'desc'
    : 'desc'
  const page = Math.max(1, Math.trunc(Number(params.get('historicoPagina'))) || 1)
  const request = { page, sort: columns[column], direction }
  const contact = useContactHistory(target?.kind === 'contact' ? target.id : undefined, request)
  const organization = useOrganizationHistory(
    target?.kind === 'organization' ? target.id : undefined,
    request,
  )
  const data = target?.kind === 'contact' ? contact.data : organization.data
  const served = data?.page
  useEffect(() => {
    if (served !== undefined && served !== page) {
      update({ historicoPagina: served === 1 ? null : String(served) }, true)
    }
  }, [served, page, update])
  const list = {
    column,
    direction,
    toggleSort: (next: string) => {
      const nextDirection =
        next === column
          ? direction === 'asc'
            ? 'desc'
            : 'asc'
          : next === 'chegada'
            ? 'desc'
            : 'asc'
      update({
        historicoOrdem: next === 'chegada' ? null : next,
        historicoDirecao: nextDirection,
        historicoPagina: null,
      })
    },
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[980px]">
        <DialogHeader className="pr-12">
          <DialogTitle>Histórico</DialogTitle>
          <DialogDescription>{target?.name}</DialogDescription>
        </DialogHeader>
        {data &&
          (data.total === 0 ? (
            <TicketHistoryList label="Histórico" entries={[]} />
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead label="Protocolo" column="protocolo" list={list} />
                      <SortableTableHead label="Chegada" column="chegada" list={list} />
                      {target?.kind === 'organization' && (
                        <SortableTableHead label="Contato" column="contato" list={list} />
                      )}
                      <SortableTableHead label="Setor" column="setor" list={list} />
                      <SortableTableHead label="Responsável" column="responsavel" list={list} />
                      <SortableTableHead label="Situação" column="situacao" list={list} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((entry) => {
                      const status = ticketStatusLabel(entry.status, entry.closureType)
                      return (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Link
                              to={`/chamados/${entry.id}`}
                              state={{ historyReturn: location.pathname + location.search }}
                              className="mono-num body-strong text-accent-strong underline-offset-2 hover:underline"
                            >
                              {entry.protocol}
                            </Link>
                            <p className="caption text-ink-faint">
                              {entry.id === currentTicketId
                                ? 'Este chamado'
                                : (entry.subject ?? 'Sem assunto')}
                            </p>
                          </TableCell>
                          <TableCell className="mono-num">
                            {formatDateTime(entry.arrivedAt)}
                          </TableCell>
                          {target?.kind === 'organization' && (
                            <TableCell>{entry.contactName}</TableCell>
                          )}
                          <TableCell>{entry.sectorName}</TableCell>
                          <TableCell>
                            {entry.assigneeName ?? <span className="text-ink-faint">Ninguém</span>}
                          </TableCell>
                          <TableCell>
                            <Badge tone={status.tone}>{status.label}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                noun={['chamado', 'chamados']}
                onPage={(next) => update({ historicoPagina: next === 1 ? null : String(next) })}
              />
            </>
          ))}
      </DialogContent>
    </Dialog>
  )
}
