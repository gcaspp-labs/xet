// PROTÓTIPO #135 — descartável, não vai para a main.
// Versão aprovada (C, soluções em cartões) da aba Assuntos no cartão Chamado,
// na rota /chamados/:ticketId. Dados fictícios (src/prototype/fakeApi.ts).
import { BookOpen, Copy, SearchX } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { SearchBox } from '@/components/SearchBox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { filterSubjects } from '@/lib/admin'
import type { FormSubject } from '@/lib/closing'
import { useClosingForm } from '@/lib/conversation'
import { cn } from '@/lib/utils'

export const variants = {
  C: {
    label: 'C (soluções em cartões)',
    width: 'lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[280px_minmax(0,1fr)_420px]',
  },
} as const
export type VariantKey = keyof typeof variants
const keys = Object.keys(variants) as VariantKey[]

export function useVariant(): VariantKey {
  const [params] = useSearchParams()
  const v = params.get('variant') as VariantKey | null
  return v && v in variants ? v : 'C'
}

// Estado por chamado, só na memória deste navegador: aba, busca e assunto aberto.
type View = { tab: string; query: string; open: number[] }
const views = new Map<number, View>()
const listeners = new Set<() => void>()
const defaultView: View = { tab: 'details', query: '', open: [] }
export function useTicketView(ticketId: number) {
  const view = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => views.get(ticketId) ?? defaultView,
  )
  const set = (patch: Partial<View>) => {
    views.set(ticketId, { ...(views.get(ticketId) ?? defaultView), ...patch })
    listeners.forEach((l) => l())
  }
  return [view, set] as const
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  toast.success('Solução copiada')
}

function CopyButton({ text }: { text: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => void copy(text)}>
      <Copy strokeWidth={1.7} aria-hidden />
      Copiar
    </Button>
  )
}

function NoSubjects() {
  return (
    <Empty>
      <EmptyMedia>
        <BookOpen strokeWidth={1.7} aria-hidden />
      </EmptyMedia>
      <EmptyDescription>Este setor ainda não tem assuntos cadastrados.</EmptyDescription>
    </Empty>
  )
}

function NoResults() {
  return (
    <Empty>
      <EmptyMedia>
        <SearchX strokeWidth={1.7} aria-hidden />
      </EmptyMedia>
      <EmptyDescription>Nenhum assunto ou solução encontrado.</EmptyDescription>
    </Empty>
  )
}

type Props = { list: FormSubject[]; view: View; set: (p: Partial<View>) => void }

// C: lista corrida de soluções, cada uma com a etiqueta do assunto; texto longo recolhido.
function VariantC({ list }: Props) {
  const [expanded, setExpanded] = useState<number[]>([])
  const items = list.flatMap((subject) =>
    subject.solutions.map((solution) => ({ subject, solution })),
  )
  return (
    <ul className="flex flex-col gap-2">
      {items.map(({ subject, solution }) => {
        const long = solution.body.length > 220
        const full = expanded.includes(solution.id)
        return (
          <li key={solution.id} className="rounded-(--radius-8) border border-line p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Badge variant="tag">{subject.name}</Badge>
              <CopyButton text={solution.body} />
            </div>
            <p className={cn('body whitespace-pre-line', long && !full && 'line-clamp-4')}>
              {solution.body}
            </p>
            {long && (
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0"
                onClick={() =>
                  setExpanded(
                    full ? expanded.filter((id) => id !== solution.id) : [...expanded, solution.id],
                  )
                }
              >
                {full ? 'Mostrar menos' : 'Ver texto inteiro'}
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function SubjectsTab({
  ticketId,
  view,
  set,
  emptySector,
}: {
  ticketId: number
  view: View
  set: (p: Partial<View>) => void
  emptySector?: boolean
}) {
  const variant = useVariant()
  const { data } = useClosingForm(ticketId, true)
  const all = emptySector ? [] : (data?.subjects ?? [])
  // A busca da tela Assuntos (regra 17); o tipo do closing-form não traz sectorId nem subjectId.
  const list = filterSubjects(
    all.map((s) => ({
      ...s,
      sectorId: 0,
      solutions: s.solutions.map((x) => ({ ...x, subjectId: s.id })),
    })),
    view.query,
  )
  const Variant = { C: VariantC }[variant]
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="caption text-ink-soft">
        Soluções do setor para consulta. Copie e adapte no chat.
      </p>
      <SearchBox
        value={view.query}
        onChange={(query) => set({ query })}
        label="Buscar assuntos e soluções"
        placeholder="Buscar assunto ou solução"
      />
      {data && all.length === 0 && <NoSubjects />}
      {data && all.length > 0 && list.length === 0 && <NoResults />}
      {list.length > 0 && <Variant list={list} view={view} set={set} />}
    </div>
  )
}

export function PrototypeSwitcher() {
  const current = useVariant()
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
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable))
        return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (import.meta.env.PROD || params.get('captura') === '1') return null
  return (
    <div
      style={{
        background: '#111',
        color: '#ff0',
        fontFamily: 'monospace',
        border: '2px dashed #ff0',
      }}
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm"
    >
      <button type="button" onClick={() => go(-1)} aria-label="Versão anterior">
        ←
      </button>
      <span>PROTÓTIPO #135 · {variants[current].label}</span>
      <button type="button" onClick={() => go(1)} aria-label="Próxima versão">
        →
      </button>
    </div>
  )
}
