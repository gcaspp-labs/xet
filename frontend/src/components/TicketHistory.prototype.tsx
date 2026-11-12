// PROTÓTIPO #128 — descartável, não vai para a main.
// Histórico do contato e do órgão em páginas de 20 e ordenável. A janela dos
// cadastros vira tabela (padrão de Contatos, #126). A aba Histórico do chamado
// ficou só na versão C aprovada: 5 recentes e o resto na janela grande.
// Página e ordem ficam em memória aqui; na implementação vão para o endereço.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Pagination } from '@/components/Pagination'
import { SortableTableHead } from '@/components/SortableTableHead'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import type { HistoryEntry } from '@/lib/conversation'
import { formatDateTime, organizationLabel, ticketStatusLabel } from '@/lib/format'
import type { Page, SortDirection } from '@/lib/paging'
import { cn } from '@/lib/utils'

type Kind = 'contact' | 'organization'

const apiSort: Record<string, string> = {
  chegada: 'arrived',
  protocolo: 'protocol',
  situacao: 'status',
  setor: 'sector',
  responsavel: 'assignee',
  contato: 'contact',
}

// Ordem padrão: chegada, do mais novo para o mais antigo.
function useHistoryList() {
  const [column, setColumn] = useState('chegada')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)
  return {
    column,
    direction,
    page,
    setPage,
    toggleSort: (next: string) => {
      if (next === column) {
        setDirection(direction === 'asc' ? 'desc' : 'asc')
      } else {
        setColumn(next)
        setDirection(next === 'chegada' ? 'desc' : 'asc')
      }
      setPage(1)
    },
  }
}
type HistoryList = ReturnType<typeof useHistoryList>

function useHistoryPage(kind: Kind, id: number | undefined, list: HistoryList, limit?: number) {
  const base = kind === 'contact' ? 'contacts' : 'organizations'
  const params = new URLSearchParams({
    page: String(list.page),
    sort: apiSort[list.column],
    direction: list.direction,
  })
  if (limit) params.set('limit', String(limit))
  return useQuery({
    queryKey: ['prototype-128', kind, id, list.page, list.column, list.direction, limit],
    queryFn: () => api<Page<HistoryEntry>>(`/${base}/${id}/tickets?${params}`),
    enabled: id !== undefined,
    placeholderData: keepPreviousData,
  })
}

function EmptyHistory() {
  return (
    <Empty>
      <EmptyMedia>
        <History strokeWidth={1.7} aria-hidden />
      </EmptyMedia>
      <EmptyDescription>Nenhum chamado no histórico.</EmptyDescription>
    </Empty>
  )
}

function StatusBadge({ entry }: { entry: HistoryEntry }) {
  const status = ticketStatusLabel(entry.status, entry.closureType)
  return <Badge tone={status.tone}>{status.label}</Badge>
}

function ProtocolLink({ entry, onOpen }: { entry: HistoryEntry; onOpen?: () => void }) {
  return (
    <Link
      to={`/chamados/${entry.id}`}
      onClick={onOpen}
      className="mono-num body-strong text-accent-strong underline-offset-2 hover:underline"
    >
      {entry.protocol}
    </Link>
  )
}

function HistoryTable({
  kind,
  id,
  currentTicketId,
  onOpen,
}: {
  kind: Kind
  id: number
  currentTicketId?: number
  onOpen?: () => void
}) {
  const list = useHistoryList()
  const { data } = useHistoryPage(kind, id, list)
  if (!data) {
    return null
  }
  if (data.total === 0) {
    return <EmptyHistory />
  }
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead label="Protocolo" column="protocolo" list={list} />
              <SortableTableHead label="Chegada" column="chegada" list={list} />
              {kind === 'organization' && (
                <SortableTableHead label="Contato" column="contato" list={list} />
              )}
              <SortableTableHead label="Setor" column="setor" list={list} />
              <SortableTableHead label="Responsável" column="responsavel" list={list} />
              <SortableTableHead label="Situação" column="situacao" list={list} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  <ProtocolLink entry={entry} onOpen={onOpen} />
                  <p className="caption text-ink-faint">
                    {entry.id === currentTicketId
                      ? 'Este chamado'
                      : (entry.subject ?? 'Sem assunto')}
                  </p>
                </TableCell>
                <TableCell className="mono-num">{formatDateTime(entry.arrivedAt)}</TableCell>
                {kind === 'organization' && <TableCell>{entry.contactName}</TableCell>}
                <TableCell>{entry.sectorName}</TableCell>
                <TableCell>
                  {entry.assigneeName ?? <span className="text-ink-faint">Ninguém</span>}
                </TableCell>
                <TableCell>
                  <StatusBadge entry={entry} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        noun={['chamado', 'chamados']}
        onPage={list.setPage}
      />
    </>
  )
}

export function HistorySheetPrototype({
  target,
  onClose,
}: {
  target: { kind: Kind; id: number; name: string } | null
  onClose: () => void
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[980px]">
        <DialogHeader className="pr-12">
          <DialogTitle>Histórico</DialogTitle>
          <DialogDescription>{target?.name}</DialogDescription>
        </DialogHeader>
        {target && (
          <div className="flex min-h-0 flex-1 flex-col">
            <HistoryTable key={`${target.kind}-${target.id}`} {...target} onOpen={onClose} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------- Aba Histórico do chamado ----------

type TabProps = {
  ticketId: number
  contactId: number
  organization: { id: number; name: string } | null
  contactName: string
}

function EntryCard({ entry, currentTicketId }: { entry: HistoryEntry; currentTicketId: number }) {
  return (
    <li className="flex flex-col gap-1 py-2.5">
      <div className="flex items-center gap-2">
        <ProtocolLink entry={entry} />
        {entry.id === currentTicketId && (
          <span className="caption text-ink-faint">Este chamado</span>
        )}
        <span className="ml-auto">
          <StatusBadge entry={entry} />
        </span>
      </div>
      <p className="caption text-ink-faint">
        {entry.sectorName}
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
}

// C: só os 5 mais recentes na aba; o histórico inteiro abre na janela grande.
function RecentSection({
  title,
  kind,
  id,
  ticketId,
  onOpenAll,
}: {
  title: string
  kind: Kind
  id: number
  ticketId: number
  onOpenAll: () => void
}) {
  const list = useHistoryList()
  const { data } = useHistoryPage(kind, id, list, 5)
  return (
    <section>
      <h3 className="overline text-ink-soft">{title}</h3>
      {data && data.total === 0 && <EmptyHistory />}
      {data && data.total > 0 && (
        <>
          <ul className="flex flex-col divide-y divide-line-soft">
            {data.items.map((entry) => (
              <EntryCard key={entry.id} entry={entry} currentTicketId={ticketId} />
            ))}
          </ul>
          {data.total > 5 && (
            <Button variant="outline" className="mt-2 w-full" onClick={onOpenAll}>
              <History strokeWidth={1.7} aria-hidden />
              Ver os <span className="mono-num">{data.total}</span> chamados
            </Button>
          )}
        </>
      )}
    </section>
  )
}

function VariantC({ ticketId, contactId, organization, contactName }: TabProps) {
  const [target, setTarget] = useState<{ kind: Kind; id: number; name: string } | null>(null)
  return (
    <div className="flex flex-col gap-6">
      <RecentSection
        title="Do contato"
        kind="contact"
        id={contactId}
        ticketId={ticketId}
        onOpenAll={() => setTarget({ kind: 'contact', id: contactId, name: contactName })}
      />
      {organization && (
        <RecentSection
          title="Do órgão"
          kind="organization"
          id={organization.id}
          ticketId={ticketId}
          onOpenAll={() =>
            setTarget({ kind: 'organization', id: organization.id, name: organization.name })
          }
        />
      )}
      <HistorySheetPrototype target={target} onClose={() => setTarget(null)} />
    </div>
  )
}

export function HistoryTabPrototype(props: TabProps) {
  return <VariantC {...props} />
}

// Barra do protótipo: fixa embaixo, amarela, só em desenvolvimento.
export function PrototypeSwitcher() {
  if (!import.meta.env.DEV) return null
  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full',
        'border-2 border-dashed border-black bg-yellow-300 px-3 py-1.5 font-mono text-sm text-black shadow-lg',
      )}
    >
      <span>Protótipo #128 · C (5 recentes + janela) — aprovada</span>
    </div>
  )
}
