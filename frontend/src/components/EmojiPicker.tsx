import { useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import emojiData from 'emojibase-data/pt/compact.json'
import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const categories = [
  { group: 0, label: 'Rostos e emoções', icon: '😀' },
  { group: 1, label: 'Pessoas e corpo', icon: '👋' },
  { group: 3, label: 'Animais e natureza', icon: '🐻' },
  { group: 4, label: 'Comida e bebida', icon: '🍎' },
  { group: 5, label: 'Viagens e lugares', icon: '🚗' },
  { group: 6, label: 'Atividades', icon: '⚽' },
  { group: 7, label: 'Objetos', icon: '💡' },
  { group: 8, label: 'Símbolos', icon: '❤️' },
  { group: 9, label: 'Bandeiras', icon: '🏳️' },
]

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')

const emojis = emojiData.filter((emoji) =>
  categories.some((category) => category.group === emoji.group),
)

export function EmojiPicker({
  onSelect,
  returnFocus,
}: {
  onSelect: (emoji: string) => void
  returnFocus?: RefObject<HTMLElement | null>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState(0)
  const [active, setActive] = useState(0)
  const search = useRef<HTMLInputElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const matches = emojis.filter((emoji) =>
    query.trim()
      ? normalize([emoji.label, ...(emoji.tags ?? [])].join(' ')).includes(normalize(query.trim()))
      : emoji.group === group,
  )
  const choose = (index: number) => {
    const emoji = matches[index]
    if (!emoji) return
    onSelect(emoji.unicode)
    setOpen(false)
  }
  const navigate = (event: KeyboardEvent) => {
    const offsets: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 8,
      ArrowUp: -8,
    }
    if (event.key === 'Enter' && event.target === search.current) {
      event.preventDefault()
      choose(active)
    } else if (event.key in offsets && matches.length) {
      event.preventDefault()
      const next =
        event.target === search.current
          ? 0
          : Math.max(0, Math.min(matches.length - 1, active + offsets[event.key]))
      setActive(next)
      grid.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus()
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setQuery('')
          setActive(0)
        }
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Inserir emoji" />}>
        <Smile strokeWidth={1.7} aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-3"
        initialFocus={search}
        finalFocus={returnFocus}
        onKeyDown={navigate}
      >
        <Input
          ref={search}
          type="search"
          aria-label="Buscar emoji"
          placeholder="Buscar emoji"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
        />
        <div
          role="tablist"
          aria-label="Categorias de emojis"
          className="flex justify-between gap-1 py-2"
        >
          {categories.map((category) => (
            <button
              key={category.group}
              type="button"
              role="tab"
              aria-label={category.label}
              aria-selected={group === category.group && !query}
              className="rounded-(--radius-7) p-1 hover:bg-muted aria-selected:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => {
                setGroup(category.group)
                setQuery('')
                setActive(0)
              }}
            >
              <span aria-hidden>{category.icon}</span>
            </button>
          ))}
        </div>
        {matches.length ? (
          <div ref={grid} aria-label="Emojis" className="grid max-h-56 grid-cols-8 overflow-y-auto">
            {matches.map((emoji, index) => (
              <button
                key={emoji.hexcode}
                type="button"
                aria-label={emoji.label}
                tabIndex={index === active ? 0 : -1}
                className="aspect-square rounded-(--radius-7) text-xl hover:bg-muted focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                onFocus={() => setActive(index)}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
              >
                {emoji.unicode}
              </button>
            ))}
          </div>
        ) : (
          <p className="caption py-4 text-ink-soft">Nenhum emoji encontrado.</p>
        )}
        <p className="caption min-h-6 border-t border-line-soft pt-2 text-ink-soft">
          {matches[active]?.label ?? ''}
        </p>
      </PopoverContent>
    </Popover>
  )
}
