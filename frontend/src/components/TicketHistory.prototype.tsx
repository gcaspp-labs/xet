// PROTÓTIPO #128 — descartável, não vai para a main.
// Histórico do contato e do órgão em páginas de 20 e ordenável. A janela dos
// cadastros vira tabela (padrão de Contatos, #126). A aba Histórico do chamado
// tem três versões, trocadas por ?variant= (A, B ou C) ou pela barra amarela.
// Página e ordem ficam em memória aqui; na implementação vão para o endereço.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

// Paginação curta para a coluna estreita do chamado: setas e "X de Y".
function CompactPagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number
  total: number
  pageSize: number
  onPage: (page: number) => void
}) {
  if (total <= pageSize) {
    return null
  }
  const pages = Math.ceil(total / pageSize)
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-2 pt-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft strokeWidth={1.7} aria-hidden />
      </Button>
      <p className="caption text-ink-soft">
        Página <span className="mono-num">{page}</span> de <span className="mono-num">{pages}</span>{' '}
        · <span className="mono-num">{total}</span> chamados
      </p>
      <Button
        variant="outline"
        size="icon"
        aria-label="Próxima página"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight strokeWidth={1.7} aria-hidden />
      </Button>
    </nav>
  )
}

// ---------- Janela dos cadastros (todas as versões) ----------

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

// A: a lista de hoje, com uma linha "Ordenar por" e paginação curta.
function SortChips({ list }: { list: HistoryList }) {
  const options = [
    ['chegada', 'Chegada'],
    ['protocolo', 'Protocolo'],
    ['situacao', 'Situação'],
  ] as const
  return (
    <div className="flex items-center gap-0.5 pb-1">
      <span className="caption mr-1 text-ink-faint">Ordenar</span>
      {options.map(([column, label]) => {
        const active = list.column === column
        const Icon = list.direction === 'asc' ? ArrowUp : ArrowDown
        return (
          <Button
            key={column}
            variant={active ? 'outline' : 'ghost'}
            size="sm"
            className="h-7 px-2"
            aria-pressed={active}
            onClick={() => list.toggleSort(column)}
          >
            {label}
            {active && <Icon strokeWidth={1.7} aria-hidden className="text-accent-strong" />}
          </Button>
        )
      })}
    </div>
  )
}

function SectionA({
  title,
  kind,
  id,
  ticketId,
}: {
  title: string
  kind: Kind
  id: number
  ticketId: number
}) {
  const list = useHistoryList()
  const { data } = useHistoryPage(kind, id, list)
  return (
    <section>
      <h3 className="overline text-ink-soft">{title}</h3>
      {data && data.total === 0 && <EmptyHistory />}
      {data && data.total > 0 && (
        <>
          <SortChips list={list} />
          <ul className="flex flex-col divide-y divide-line-soft">
            {data.items.map((entry) => (
              <EntryCard key={entry.id} entry={entry} currentTicketId={ticketId} />
            ))}
          </ul>
          <CompactPagination {...data} onPage={list.setPage} />
        </>
      )}
    </section>
  )
}

function VariantA({ ticketId, contactId, organization }: TabProps) {
  return (
    <div className="flex flex-col gap-6">
      <SectionA title="Do contato" kind="contact" id={contactId} ticketId={ticketId} />
      {organization && (
        <SectionA title="Do órgão" kind="organization" id={organization.id} ticketId={ticketId} />
      )}
    </div>
  )
}

// B: tabela compacta, com contato/órgão num seletor, uma lista por vez.
function VariantB({ ticketId, contactId, organization }: TabProps) {
  const [kind, setKind] = useState<Kind>('contact')
  return (
    <div className="flex flex-col gap-3">
      {organization && (
        <Tabs value={kind} onValueChange={(value) => setKind(value as Kind)}>
          <TabsList>
            <TabsTrigger value="contact">Do contato</TabsTrigger>
            <TabsTrigger value="organization">Do órgão</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      <CompactTable
        key={kind}
        kind={kind}
        id={kind === 'contact' ? contactId : (organization?.id ?? contactId)}
        ticketId={ticketId}
      />
    </div>
  )
}

function CompactTable({ kind, id, ticketId }: { kind: Kind; id: number; ticketId: number }) {
  const list = useHistoryList()
  const { data } = useHistoryPage(kind, id, list)
  if (!data) {
    return null
  }
  if (data.total === 0) {
    return <EmptyHistory />
  }
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <SortableTableHead label="Protocolo" column="protocolo" list={list} />
            <SortableTableHead label="Chegada" column="chegada" list={list} />
            <SortableTableHead label="Situação" column="situacao" list={list} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="whitespace-normal">
                <ProtocolLink entry={entry} />
                <p className="caption text-ink-faint">
                  {entry.id === ticketId
                    ? 'Este chamado'
                    : [entry.subject, entry.assigneeName].filter(Boolean).join(' · ') ||
                      entry.sectorName}
                </p>
              </TableCell>
              <TableCell className="mono-num caption">{formatDateTime(entry.arrivedAt)}</TableCell>
              <TableCell>
                <StatusBadge entry={entry} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CompactPagination {...data} onPage={list.setPage} />
    </div>
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

const variants = [
  ['A', 'A (lista + ordenar por)'],
  ['B', 'B (tabela compacta)'],
  ['C', 'C (5 recentes + janela)'],
] as const

export function useHistoryVariant() {
  const [params] = useSearchParams()
  const v = params.get('variant')
  return v === 'B' || v === 'C' ? v : 'A'
}

export function HistoryTabPrototype(props: TabProps) {
  const variant = useHistoryVariant()
  return (
    <>
      {variant === 'A' && <VariantA {...props} />}
      {variant === 'B' && <VariantB {...props} />}
      {variant === 'C' && <VariantC {...props} />}
    </>
  )
}

// Barra de troca de versão: fixa embaixo, amarela, só em desenvolvimento.
export function PrototypeSwitcher() {
  const [, setParams] = useSearchParams()
  const current = useHistoryVariant()
  const index = variants.findIndex(([v]) => v === current)
  const go = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length][0]
    setParams((p) => {
      const copy = new URLSearchParams(p)
      copy.set('variant', next)
      return copy
    })
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.matches('input, textarea') || (el as HTMLElement).isContentEditable)) return
      if (event.key === 'ArrowLeft') go(-1)
      if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!import.meta.env.DEV) return null
  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-full',
        'border-2 border-dashed border-black bg-yellow-300 px-3 py-1.5 font-mono text-sm text-black shadow-lg',
      )}
    >
      <button type="button" aria-label="Versão anterior" onClick={() => go(-1)}>
        ←
      </button>
      <span>Protótipo #128 · {variants[index][1]}</span>
      <button type="button" aria-label="Próxima versão" onClick={() => go(1)}>
        →
      </button>
    </div>
  )
}
