// PROTÓTIPO #199: descartável, não vai para a main.
// Versão A aprovada em 15/11/2026 (balão com grade): seletor de emojis no campo de mensagem,
// na rota /chamados/:id (chamado meu em atendimento: /chamados/300). B e C foram descartadas
// (ficam no commit 6ba81a9).
// Dados de emoji: amostra fixa em português, só para as capturas (a implementação usa a biblioteca escolhida).
import { Search, Smile } from 'lucide-react'
import { type KeyboardEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from 'cn'

type Emoji = { e: string; n: string; k?: string }
type Category = { id: string; label: string; icon: string; items: Emoji[] }

const categories: Category[] = [
  {
    id: 'rostos',
    label: 'Rostos e emoções',
    icon: '😀',
    items: [
      { e: '😀', n: 'rosto sorrindo', k: 'feliz' },
      { e: '😃', n: 'rosto sorrindo com olhos grandes', k: 'feliz' },
      { e: '😄', n: 'rosto sorrindo com olhos sorridentes', k: 'feliz' },
      { e: '😁', n: 'rosto radiante', k: 'feliz' },
      { e: '😅', n: 'rosto sorrindo com gota de suor', k: 'alívio' },
      { e: '😂', n: 'rosto chorando de rir', k: 'risada' },
      { e: '🙂', n: 'rosto levemente sorridente' },
      { e: '😉', n: 'rosto piscando' },
      { e: '😊', n: 'rosto sorridente com olhos sorridentes', k: 'feliz' },
      { e: '😍', n: 'rosto sorridente com olhos de coração', k: 'amor' },
      { e: '🤔', n: 'rosto pensativo', k: 'dúvida' },
      { e: '😐', n: 'rosto neutro' },
      { e: '😮', n: 'rosto com boca aberta', k: 'surpresa' },
      { e: '😢', n: 'rosto chorando', k: 'triste' },
      { e: '😭', n: 'rosto chorando muito', k: 'triste' },
      { e: '😡', n: 'rosto furioso', k: 'raiva' },
      { e: '😴', n: 'rosto dormindo' },
      { e: '🤝', n: 'aperto de mãos', k: 'acordo' },
    ],
  },
  {
    id: 'gestos',
    label: 'Pessoas e gestos',
    icon: '👍',
    items: [
      { e: '👍', n: 'polegar para cima', k: 'joinha ok' },
      { e: '👎', n: 'polegar para baixo' },
      { e: '👏', n: 'mãos aplaudindo', k: 'palmas' },
      { e: '🙏', n: 'mãos juntas', k: 'obrigado por favor' },
      { e: '👋', n: 'mão acenando', k: 'oi tchau' },
      { e: '✌️', n: 'mão em v de vitória' },
      { e: '👌', n: 'mão fazendo ok' },
      { e: '💪', n: 'bíceps flexionado', k: 'força' },
      { e: '🙌', n: 'mãos para cima', k: 'comemoração' },
      { e: '👀', n: 'olhos', k: 'olhando' },
      { e: '🧑‍💻', n: 'tecnólogo', k: 'computador' },
      { e: '🙋', n: 'pessoa levantando a mão' },
    ],
  },
  {
    id: 'coracoes',
    label: 'Corações e símbolos',
    icon: '❤️',
    items: [
      { e: '❤️', n: 'coração vermelho', k: 'amor' },
      { e: '🧡', n: 'coração laranja' },
      { e: '💛', n: 'coração amarelo' },
      { e: '💚', n: 'coração verde' },
      { e: '💙', n: 'coração azul' },
      { e: '💜', n: 'coração roxo' },
      { e: '💔', n: 'coração partido' },
      { e: '✅', n: 'marca de seleção', k: 'feito certo ok' },
      { e: '❌', n: 'xis', k: 'errado não' },
      { e: '⚠️', n: 'aviso', k: 'atenção' },
      { e: '❓', n: 'ponto de interrogação', k: 'dúvida' },
      { e: '❗', n: 'ponto de exclamação' },
    ],
  },
  {
    id: 'objetos',
    label: 'Objetos',
    icon: '📄',
    items: [
      { e: '📄', n: 'página', k: 'documento' },
      { e: '📎', n: 'clipe de papel', k: 'anexo' },
      { e: '📅', n: 'calendário', k: 'data' },
      { e: '⏰', n: 'despertador', k: 'hora prazo' },
      { e: '📞', n: 'telefone', k: 'ligação' },
      { e: '💻', n: 'notebook', k: 'computador' },
      { e: '🖨️', n: 'impressora' },
      { e: '🔒', n: 'cadeado', k: 'senha' },
      { e: '🔑', n: 'chave', k: 'senha acesso' },
      { e: '💰', n: 'saco de dinheiro', k: 'pagamento' },
      { e: '📊', n: 'gráfico de barras' },
      { e: '✉️', n: 'envelope', k: 'email' },
    ],
  },
  {
    id: 'natureza',
    label: 'Natureza e comida',
    icon: '🌳',
    items: [
      { e: '☀️', n: 'sol' },
      { e: '🌧️', n: 'nuvem com chuva' },
      { e: '🌳', n: 'árvore' },
      { e: '🌻', n: 'girassol', k: 'flor' },
      { e: '☕', n: 'café', k: 'bebida quente' },
      { e: '🍕', n: 'pizza' },
      { e: '🎂', n: 'bolo de aniversário' },
      { e: '🎉', n: 'confete', k: 'festa parabéns' },
    ],
  },
]

const all = categories.flatMap((c) => c.items)
const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
const searchEmojis = (q: string) => {
  const t = normalize(q.trim())
  if (!t) return all
  const hits = all.filter((x) => normalize(`${x.n} ${x.k ?? ''}`).includes(t))
  return [...hits.filter((x) => normalize(x.n).startsWith(t)), ...hits.filter((x) => !normalize(x.n).startsWith(t))]
}

// ——— Grade navegável pelo teclado (A e B) ———
function EmojiGrid({
  query,
  columns,
  size,
  onPick,
  onHover,
  sections = true,
  categoryRef,
}: {
  query: string
  columns: number
  size: 'md' | 'lg'
  onPick: (e: string) => void
  onHover?: (x: Emoji | null) => void
  sections?: boolean
  categoryRef?: (id: string, el: HTMLElement | null) => void
}) {
  const results = useMemo(() => searchEmojis(query), [query])
  const [active, setActive] = useState(0)
  useEffect(() => setActive(0), [query])
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const move = (event: KeyboardEvent, delta: number) => {
    event.preventDefault()
    const next = Math.max(0, Math.min(results.length - 1, active + delta))
    setActive(next)
    buttons.current[next]?.focus()
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight') move(event, 1)
    if (event.key === 'ArrowLeft') move(event, -1)
    if (event.key === 'ArrowDown') move(event, columns)
    if (event.key === 'ArrowUp') move(event, -columns)
  }
  if (!results.length)
    return (
      <p className="px-3 py-8 text-center text-ink-soft" role="status">
        Nenhum emoji encontrado para “{query}”.
      </p>
    )
  const cell = (x: Emoji, i: number) => (
    <button
      key={x.e}
      ref={(el) => {
        buttons.current[i] = el
      }}
      type="button"
      aria-label={x.n}
      tabIndex={i === active ? 0 : -1}
      onFocus={() => {
        setActive(i)
        onHover?.(x)
      }}
      onMouseEnter={() => onHover?.(x)}
      onClick={() => onPick(x.e)}
      className={cn(
        'grid place-items-center rounded-(--radius-7) outline-none hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:ring-2 focus-visible:ring-primary',
        size === 'lg' ? 'size-10 text-[26px]' : 'size-9 text-[22px]',
        query && i === active && 'bg-accent-soft',
      )}
    >
      {x.e}
    </button>
  )
  const grid = (items: Emoji[], offset: number) => (
    <div
      className="grid gap-0.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((x, i) => cell(x, offset + i))}
    </div>
  )
  // Com busca: grade única. Sem busca: seções por categoria.
  if (query.trim() || !sections)
    return (
      <div role="grid" aria-label="Emojis" onKeyDown={onKeyDown} className="p-2">
        {grid(results, 0)}
      </div>
    )
  let offset = 0
  return (
    <div role="grid" aria-label="Emojis" onKeyDown={onKeyDown} className="flex flex-col gap-2 p-2">
      {categories.map((c) => {
        const start = offset
        offset += c.items.length
        return (
          <section key={c.id} ref={(el) => categoryRef?.(c.id, el)} aria-label={c.label}>
            <h3 className="caption px-1 pb-1 text-ink-faint">{c.label}</h3>
            {grid(c.items, start)}
          </section>
        )
      })}
    </div>
  )
}

function SearchField({
  value,
  onChange,
  onEnter,
  onArrowDown,
  autoFocus = true,
}: {
  value: string
  onChange: (v: string) => void
  onEnter: () => void
  onArrowDown?: () => void
  autoFocus?: boolean
}) {
  return (
    <div className="relative">
      <Search
        strokeWidth={1.7}
        className="pointer-events-none absolute top-1/2 left-2.5 size-[15px] -translate-y-1/2 text-ink-faint"
        aria-hidden
      />
      <Input
        autoFocus={autoFocus}
        aria-label="Buscar emoji"
        placeholder="Buscar emoji"
        className="pl-8"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onEnter()
          }
          if (event.key === 'ArrowDown' && onArrowDown) {
            event.preventDefault()
            onArrowDown()
          }
        }}
      />
    </div>
  )
}

function CategoryTabs({ onJump, current }: { onJump: (id: string) => void; current?: string }) {
  return (
    <div role="tablist" aria-label="Categorias" className="flex gap-0.5">
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={current === c.id}
          aria-label={c.label}
          title={c.label}
          onClick={() => onJump(c.id)}
          className={cn(
            'grid size-8 place-items-center rounded-(--radius-7) text-[18px] outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-primary',
            current === c.id && 'bg-accent-soft shadow-[inset_0_-2px_0_var(--color-primary)]',
          )}
        >
          {c.icon}
        </button>
      ))}
    </div>
  )
}

function useJump() {
  const sections = useRef(new Map<string, HTMLElement>())
  const [current, setCurrent] = useState('rostos')
  return {
    current,
    register: (id: string, el: HTMLElement | null) => {
      if (el) sections.current.set(id, el)
    },
    jump: (id: string) => {
      setCurrent(id)
      sections.current.get(id)?.scrollIntoView({ block: 'start' })
    },
  }
}

// ——— A: balão sobre o botão ———
export function PickerA({ onPick, open, onOpenChange, returnFocus }: PickerProps) {
  const [query, setQuery] = useState('')
  const [hover, setHover] = useState<Emoji | null>(null)
  const jump = useJump()
  const first = () => searchEmojis(query)[0]
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setQuery('')
      }}
    >
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Inserir emoji" aria-expanded={open} />
        }
      >
        <Smile strokeWidth={1.7} aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-[352px]"
        aria-label="Seletor de emojis"
        finalFocus={returnFocus}
      >
        <div className="flex flex-col gap-2 border-b border-line-soft p-2">
          <SearchField
            value={query}
            onChange={setQuery}
            onEnter={() => first() && onPick(first().e)}
          />
          {!query && <CategoryTabs onJump={jump.jump} current={jump.current} />}
        </div>
        <div className="h-[248px] overflow-y-auto">
          <EmojiGrid
            query={query}
            columns={8}
            size="md"
            onPick={onPick}
            onHover={setHover}
            categoryRef={jump.register}
          />
        </div>
        <div className="flex h-10 items-center gap-2 border-t border-line-soft px-3">
          {hover ? (
            <>
              <span className="text-[22px]">{hover.e}</span>
              <span className="truncate text-ink-soft">{hover.n}</span>
            </>
          ) : (
            <span className="caption text-ink-faint">Escolha um emoji · Esc fecha</span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

type PickerProps = {
  onPick: (e: string) => void
  open: boolean
  onOpenChange: (o: boolean) => void
  returnFocus?: RefObject<HTMLElement | null>
}
