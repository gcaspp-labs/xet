// PROTÓTIPO #126, descartável. Não levar para a main.
// Três versões da paginação e da ordenação na lista de Contatos, trocadas por `?variant=`, na rota `/contatos`.
// Dados fictícios em memória; ordenação e recorte feitos aqui só para o protótipo (na implementação, é no servidor).
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookUser,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ContactFilters } from '@/components/ContactFilters'
import { SearchBox } from '@/components/SearchBox'
import { PageContent, Topbar } from '@/components/Topbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useContactFilter } from '@/lib/directory'
import { cn } from '@/lib/utils'

const pageSize = 20

type FakeContact = {
  id: number
  name: string
  phone: string
  organization: string
  municipality: string
  cnpj: string
  sectors: { name: string; module?: string }[]
}

const firstNames = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gisele', 'Hugo', 'Íris', 'João', 'Karina', 'Lucas', 'Marta', 'Nelson', 'Olívia', 'Paulo', 'Quésia', 'Rafael', 'Sílvia', 'Tiago', 'Úrsula', 'Vítor', 'Wagner', 'Yara']
const lastNames = ['Almeida', 'Barros', 'Cardoso', 'Dias', 'Esteves', 'Farias', 'Gomes', 'Hora', 'Lima', 'Moura', 'Nunes', 'Prado', 'Queiroz', 'Rocha', 'Souza', 'Teles', 'Vieira']
const towns = ['Araraquara', 'Bauru', 'Campinas', 'Franca', 'Marília', 'Ribeirão Preto', 'Santos', 'Sorocaba']
const orgKinds = ['Prefeitura Municipal de', 'Câmara Municipal de', 'SAAE de']
const sectorPool = [
  { name: 'Contabilidade', module: 'Folha' },
  { name: 'Tributos', module: 'IPTU' },
  { name: 'Licitações' },
  { name: 'Contabilidade', module: 'Empenho' },
  { name: 'Patrimônio' },
]

const contacts: FakeContact[] = Array.from({ length: 137 }, (_, i) => {
  const town = towns[(i * 7) % towns.length]
  const kind = orgKinds[(i * 5) % orgKinds.length]
  const sectorCount = (i % 3) + 1
  return {
    id: i + 1,
    name: `${firstNames[(i * 11) % firstNames.length]} ${lastNames[(i * 13) % lastNames.length]}`,
    phone: `(11) 9${String(1000 + ((i * 3761) % 9000))}-${String(1000 + ((i * 917) % 9000))}`,
    organization: `${kind} ${town}`,
    municipality: town,
    cnpj: `00.${String(100 + i).padStart(3, '0')}.000/0001-${String(10 + (i % 89))}`,
    sectors: Array.from({ length: sectorCount }, (_, s) => sectorPool[(i + s * 2) % sectorPool.length]),
  }
})

type SortKey = 'nome' | 'orgao' | 'municipio'
type Direction = 'asc' | 'desc'

const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function sortValue(contact: FakeContact, key: SortKey) {
  if (key === 'orgao') return contact.organization
  if (key === 'municipio') return contact.municipality
  return contact.name
}

// Estado da lista no endereço: ?pagina=2&ordem=nome&direcao=desc
function useListState() {
  const [params, setParams] = useSearchParams()
  const order = (['nome', 'orgao', 'municipio'] as const).find((k) => k === params.get('ordem')) ?? 'nome'
  const direction: Direction = params.get('direcao') === 'desc' ? 'desc' : 'asc'
  const page = Math.max(1, Number(params.get('pagina')) || 1)
  const update = (next: Record<string, string | null>) => {
    const copy = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) copy.delete(k)
      else copy.set(k, v)
    }
    setParams(copy, { replace: false })
  }
  return {
    order,
    direction,
    page,
    setPage: (p: number) => update({ pagina: p === 1 ? null : String(p) }),
    toggleSort: (key: SortKey) => {
      const nextDirection = order === key && direction === 'asc' ? 'desc' : 'asc'
      update({ ordem: key === 'nome' ? null : key, direcao: nextDirection === 'asc' ? null : 'desc', pagina: null })
    },
    resetPage: () => update({ pagina: null }),
  }
}

// --- Cabeçalho ordenável (o mesmo nas três versões) ---

function SortableHead({
  label,
  column,
  state,
  className,
}: {
  label: string
  column: SortKey
  state: ReturnType<typeof useListState>
  className?: string
}) {
  const active = state.order === column
  const Icon = !active ? ArrowUpDown : state.direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={className}
      aria-sort={active ? (state.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => state.toggleSort(column)}
        className={cn(
          'table-head -ml-2 inline-flex items-center gap-1 rounded-(--radius-7) px-2 py-1 hover:bg-muted',
          active ? 'text-ink' : 'text-ink-soft',
        )}
      >
        {label}
        <Icon
          strokeWidth={1.7}
          aria-hidden
          className={cn('size-[13px]', active ? 'text-accent-strong' : 'text-ink-faint')}
        />
      </button>
    </TableHead>
  )
}

// --- Números das páginas, com reticências ---

function pageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '…')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push('…')
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < total - 1) pages.push('…')
  pages.push(total)
  return pages
}

function PageButtons({
  page,
  totalPages,
  onPage,
  compact,
}: {
  page: number
  totalPages: number
  onPage: (p: number) => void
  compact?: boolean
}) {
  return (
    <nav aria-label="Paginação" className="flex items-center gap-1">
      <Button variant="outline" size="sm" disabled={page === 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft strokeWidth={1.7} aria-hidden />
        {!compact && 'Anterior'}
        {compact && <span className="sr-only">Anterior</span>}
      </Button>
      {pageNumbers(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-ink-faint">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'ghost'}
            size="sm"
            aria-current={p === page ? 'page' : undefined}
            className="mono-num min-w-8"
            onClick={() => onPage(p)}
          >
            {p}
          </Button>
        ),
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={page === totalPages}
        onClick={() => onPage(page + 1)}
      >
        {!compact && 'Próxima'}
        {compact && <span className="sr-only">Próxima</span>}
        <ChevronRight strokeWidth={1.7} aria-hidden />
      </Button>
    </nav>
  )
}

// --- Tabela (estrutura igual à de hoje, com cabeçalhos ordenáveis) ---

function ContactsTable({
  rows,
  state,
  withMunicipality,
}: {
  rows: FakeContact[]
  state: ReturnType<typeof useListState>
  withMunicipality?: boolean
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead label="Contato" column="nome" state={state} />
          <SortableHead label="Órgão" column="orgao" state={state} />
          {withMunicipality && <SortableHead label="Município" column="municipio" state={state} />}
          <TableHead>Setores e módulos</TableHead>
          <TableHead className="w-0">
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell>
              <p className="body-strong">{c.name}</p>
              <p className="mono-num caption text-ink-faint">{c.phone}</p>
            </TableCell>
            <TableCell>
              <p>{withMunicipality ? c.organization : `${c.organization} (${c.municipality})`}</p>
              <p className="mono-num caption text-ink-faint">{c.cnpj}</p>
            </TableCell>
            {withMunicipality && <TableCell>{c.municipality}</TableCell>}
            <TableCell>
              <ul className="flex flex-col gap-1">
                {c.sectors.map((s, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    {s.name}
                    {s.module && <Badge variant="tag">{s.module}</Badge>}
                  </li>
                ))}
              </ul>
            </TableCell>
            <TableCell className="whitespace-nowrap">
              <Button variant="ghost" size="sm">
                Histórico
              </Button>
              <Button variant="ghost" size="sm">
                Editar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

type ViewProps = {
  rows: FakeContact[]
  total: number
  page: number
  totalPages: number
  state: ReturnType<typeof useListState>
}

const plural = (n: number) => `${n} ${n === 1 ? 'contato' : 'contatos'}`

// A (rodapé do painel): paginação dentro do Card, numa faixa embaixo da tabela.
function VariantA({ rows, total, page, totalPages, state }: ViewProps) {
  return (
    <Card className="gap-0 py-0">
      <ContactsTable rows={rows} state={state} />
      {total > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="caption text-ink-soft">
            Página <span className="mono-num">{page}</span> de{' '}
            <span className="mono-num">{totalPages}</span> · {plural(total)}
          </p>
          <PageButtons page={page} totalPages={totalPages} onPage={state.setPage} />
        </div>
      )}
    </Card>
  )
}

// B (resumo em cima, navegação embaixo): total e "Página X de Y" acima da tabela,
// com setas compactas; a paginação numerada completa fica centralizada abaixo do painel.
function VariantB({ rows, total, page, totalPages, state }: ViewProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="body-sm text-ink-soft">
          <span className="body-strong text-ink">{plural(total)}</span>
          {total > pageSize && (
            <>
              {' '}
              · Página <span className="mono-num">{page}</span> de{' '}
              <span className="mono-num">{totalPages}</span>
            </>
          )}
        </p>
        {total > pageSize && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Página anterior"
              disabled={page === 1}
              onClick={() => state.setPage(page - 1)}
            >
              <ChevronLeft strokeWidth={1.7} aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima página"
              disabled={page === totalPages}
              onClick={() => state.setPage(page + 1)}
            >
              <ChevronRight strokeWidth={1.7} aria-hidden />
            </Button>
          </div>
        )}
      </div>
      <Card className="gap-0 py-0">
        <ContactsTable rows={rows} state={state} />
      </Card>
      {total > pageSize && (
        <div className="flex justify-center">
          <PageButtons page={page} totalPages={totalPages} onPage={state.setPage} />
        </div>
      )}
    </>
  )
}

// C (tabela mais larga, contador de itens): Município vira coluna própria e ordenável;
// abaixo do painel, "Mostrando 21–40 de 137" à esquerda e a paginação compacta à direita.
function VariantC({ rows, total, page, totalPages, state }: ViewProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <>
      <Card className="gap-0 py-0">
        <ContactsTable rows={rows} state={state} withMunicipality />
      </Card>
      {total > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="caption text-ink-soft">
            Mostrando <span className="mono-num">{from}–{to}</span> de{' '}
            <span className="mono-num">{total}</span> · Página{' '}
            <span className="mono-num">{page}</span> de <span className="mono-num">{totalPages}</span>
          </p>
          <PageButtons page={page} totalPages={totalPages} onPage={state.setPage} compact />
        </div>
      )}
    </>
  )
}

const variants = {
  A: { label: 'A (rodapé do painel)', View: VariantA },
  B: { label: 'B (resumo em cima)', View: VariantB },
  C: { label: 'C (coluna Município, contador)', View: VariantC },
} as const
type VariantKey = keyof typeof variants
const keys = Object.keys(variants) as VariantKey[]

function PrototypeSwitcher({ current }: { current: VariantKey }) {
  const [params, setParams] = useSearchParams()
  const go = (delta: number) => {
    const next = keys[(keys.indexOf(current) + delta + keys.length) % keys.length]
    const copy = new URLSearchParams(params)
    copy.set('variant', next)
    setParams(copy)
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
  if (import.meta.env.PROD || params.get('captura') === '1') return null
  return (
    <div
      style={{ background: '#111', color: '#ff0', fontFamily: 'monospace', border: '2px dashed #ff0' }}
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm"
    >
      <button type="button" onClick={() => go(-1)} aria-label="Versão anterior">
        ←
      </button>
      <span>PROTÓTIPO · {variants[current].label}</span>
      <button type="button" onClick={() => go(1)} aria-label="Próxima versão">
        →
      </button>
    </div>
  )
}

export default function ContactsPagePrototype() {
  const [params] = useSearchParams()
  const variantParam = params.get('variant') as VariantKey | null
  const variant: VariantKey = variantParam && variantParam in variants ? variantParam : 'A'
  const [query, setQuery] = useState('')
  const state = useListState()
  const contactFilter = useContactFilter()

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    const list = q
      ? contacts.filter((c) =>
          [c.name, c.organization, c.municipality, c.phone, c.cnpj].some((v) => normalize(v).includes(q)),
        )
      : contacts
    const sign = state.direction === 'asc' ? 1 : -1
    return [...list].sort(
      (a, b) =>
        sign * normalize(sortValue(a, state.order)).localeCompare(normalize(sortValue(b, state.order))) ||
        a.id - b.id,
    )
  }, [query, state.order, state.direction])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(state.page, totalPages)
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)
  const { View } = variants[variant]

  return (
    <>
      <Topbar
        breadcrumb="Helpdesk"
        title="Contatos"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline">
              <Download strokeWidth={1.7} aria-hidden />
              Importar contatos
            </Button>
            <Button>
              <Plus strokeWidth={1.7} aria-hidden />
              Novo contato
            </Button>
          </div>
        }
      />
      <PageContent>
        <SearchBox
          value={query}
          onChange={(v) => {
            setQuery(v)
            state.resetPage()
          }}
          label="Buscar contatos"
          placeholder="Nome, município, telefone ou CNPJ"
        />
        <ContactFilters {...contactFilter} />
        {total === 0 ? (
          <Card>
            <Empty>
              <EmptyMedia>
                <BookUser strokeWidth={1.7} aria-hidden />
              </EmptyMedia>
              <EmptyDescription>Nenhum contato encontrado.</EmptyDescription>
            </Empty>
          </Card>
        ) : (
          <View rows={rows} total={total} page={page} totalPages={totalPages} state={state} />
        )}
      </PageContent>
      <PrototypeSwitcher current={variant} />
    </>
  )
}
