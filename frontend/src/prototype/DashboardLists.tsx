// PROTÓTIPO #160 — descartável, não vai para a main.
// Três versões da seção nova do Dashboard com a fila e os chamados em atendimento,
// trocadas por ?variant=A|B|C (barra flutuante embaixo, ou ← e →):
// A (abaixo de "Agora"): duas tabelas largas, uma embaixo da outra, logo depois dos números "Agora".
// B (números viram abas): os cartões "Na fila" e "Em atendimento" escolhem a lista mostrada.
// C (quadro lado a lado): duas colunas compactas, Fila | Em atendimento, como um quadro.
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Inbox, MessagesSquare, UserCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { api } from '@/lib/api'
import { useCurrentUser } from '@/lib/auth'
import { organizationLabel } from '@/lib/format'
import { lastMessagePreview, type TicketSummary } from '@/lib/tickets'
import { cn } from 'cn'

export type LiveTicket = TicketSummary & { sector: { id: number; name: string } }
type Lists = { queued: LiveTicket[]; inProgress: LiveTicket[] }

export const variants = [
  { id: 'A', label: 'A (abaixo de "Agora")' },
  { id: 'B', label: 'B (números viram abas)' },
  { id: 'C', label: 'C (quadro lado a lado)' },
] as const
export type VariantId = (typeof variants)[number]['id']

export function useVariant(): VariantId {
  const [params] = useSearchParams()
  const v = params.get('variant')
  return variants.some((x) => x.id === v) ? (v as VariantId) : 'A'
}

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

function MessageCell({ ticket }: { ticket: LiveTicket }) {
  return (
    <TableCell className="max-w-0 w-full">
      <p className="truncate">{lastMessagePreview(ticket)}</p>
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

function QueueTable({ tickets, showSector }: { tickets: LiveTicket[]; showSector: boolean }) {
  if (tickets.length === 0) return <EmptyQueue />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contato</TableHead>
          {showSector && <TableHead>Setor</TableHead>}
          <TableHead>Última mensagem</TableHead>
          <TableHead className="text-right">Esperando</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((t) => (
          <TableRow key={t.id} className="relative">
            <ContactCell ticket={t} />
            {showSector && <TableCell className="whitespace-nowrap">{t.sector.name}</TableCell>}
            <MessageCell ticket={t} />
            <TableCell className="mono-num whitespace-nowrap text-right">{waitingFor(t.arrivedAt)}</TableCell>
            <TableCell>
              <AssumeButton ticket={t} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function InProgressTable({
  tickets,
  showSector,
  userId,
}: {
  tickets: LiveTicket[]
  showSector: boolean
  userId?: number
}) {
  if (tickets.length === 0) return <EmptyInProgress />
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contato</TableHead>
          {showSector && <TableHead>Setor</TableHead>}
          <TableHead>Responsável</TableHead>
          <TableHead>Última mensagem</TableHead>
          <TableHead className="text-right">Há</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((t) => (
          <TableRow key={t.id} className="relative">
            <ContactCell ticket={t} />
            {showSector && <TableCell className="whitespace-nowrap">{t.sector.name}</TableCell>}
            <TableCell className="whitespace-nowrap">
              <Assignee ticket={t} userId={userId} />
            </TableCell>
            <MessageCell ticket={t} />
            <TableCell className="mono-num whitespace-nowrap text-right">
              {t.assignedAt && waitingFor(t.assignedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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

// A: duas tabelas largas, empilhadas, logo depois dos números "Agora".
export function VariantA({ lists, showSector, moduleOn }: { lists: Lists; showSector: boolean; moduleOn: boolean }) {
  const { data: user } = useCurrentUser()
  return (
    <div className="flex flex-col gap-3">
      <ListsNote moduleOn={moduleOn} />
      <Card role="region" aria-labelledby="live-queue-title">
        <CardHeader>
          <CountTitle id="live-queue-title" title="Fila" count={lists.queued.length} />
        </CardHeader>
        <QueueTable tickets={lists.queued} showSector={showSector} />
      </Card>
      <Card role="region" aria-labelledby="live-progress-title">
        <CardHeader>
          <CountTitle id="live-progress-title" title="Em atendimento" count={lists.inProgress.length} />
        </CardHeader>
        <InProgressTable tickets={lists.inProgress} showSector={showSector} userId={user?.id} />
      </Card>
    </div>
  )
}

// B: os cartões de "Agora" viram abas; a lista escolhida aparece embaixo, numa só tabela.
export function VariantB({
  lists,
  showSector,
  moduleOn,
  kpis,
}: {
  lists: Lists
  showSector: boolean
  moduleOn: boolean
  kpis: { queued: ReactNode; inProgress: ReactNode }
}) {
  const { data: user } = useCurrentUser()
  const [tab, setTab] = useState<'queued' | 'inProgress'>('queued')
  const Tile = ({ id, label, value }: { id: 'queued' | 'inProgress'; label: string; value: ReactNode }) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={cn(
        'min-w-0 rounded-(--radius-12) border bg-card px-4 py-3 text-left transition-colors outline-none focus-visible:outline-2 focus-visible:outline-ring',
        tab === id ? 'border-primary shadow-[inset_0_-2px_0_var(--color-primary)]' : 'border-border hover:border-ink-faint',
      )}
    >
      <p className="overline text-ink-faint no-underline!">{label}</p>
      <p className="kpi-value">{value}</p>
      <p className="caption text-ink-faint">{tab === id ? 'Mostrando abaixo' : 'Ver lista'}</p>
    </button>
  )
  return (
    <section aria-labelledby="now-title" className="flex flex-col gap-2">
      <h2 id="now-title" className="title-panel">
        Agora
      </h2>
      <div role="tablist" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,calc(170px*var(--text-scale))),1fr))] gap-3">
        <Tile id="queued" label="Na fila" value={kpis.queued} />
        <Tile id="inProgress" label="Em atendimento" value={kpis.inProgress} />
      </div>
      <Card role="tabpanel">
        {tab === 'queued' ? (
          <QueueTable tickets={lists.queued} showSector={showSector} />
        ) : (
          <InProgressTable tickets={lists.inProgress} showSector={showSector} userId={user?.id} />
        )}
      </Card>
      <ListsNote moduleOn={moduleOn} />
    </section>
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

// Barra flutuante do protótipo: some no build de produção.
export function PrototypeSwitcher({ current }: { current: VariantId }) {
  const [, setParams] = useSearchParams()
  const index = variants.findIndex((v) => v.id === current)
  const go = (step: number) => {
    const next = variants[(index + step + variants.length) % variants.length]
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('variant', next.id)
      return n
    })
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (import.meta.env.PROD) return null
  return (
    <div
      data-prototype-switcher
      style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#111', color: '#ff0', fontFamily: 'monospace', fontSize: 13, borderRadius: 999, padding: '6px 10px', display: 'flex', gap: 10, alignItems: 'center', border: '2px dashed #ff0' }}
    >
      <button type="button" onClick={() => go(-1)} aria-label="Versão anterior" style={{ color: '#ff0' }}>
        <ArrowLeft size={16} />
      </button>
      <span>PROTÓTIPO #160 · {variants[index].label}</span>
      <button type="button" onClick={() => go(1)} aria-label="Próxima versão" style={{ color: '#ff0' }}>
        <ArrowRight size={16} />
      </button>
    </div>
  )
}
