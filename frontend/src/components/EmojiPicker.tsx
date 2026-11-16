import { useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import emojiData from 'emojibase-data/pt/compact.json'
import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

// O mesmo seletor serve ao campo de mensagem e ao "+" da barra de reações: só o gatilho muda.
export function EmojiPicker({
  onSelect,
  returnFocus,
  triggerLabel = 'Inserir emoji',
  trigger,
}: {
  onSelect: (emoji: string) => void
  returnFocus?: RefObject<HTMLElement | null>
  triggerLabel?: string
  trigger?: ReactNode
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
  const focusEmoji = (index: number) => {
    setActive(index)
    grid.current?.querySelectorAll<HTMLButtonElement>('button')[index]?.focus()
  }
  const searchKeys = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      choose(active)
    } else if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault()
      focusEmoji(0)
    }
  }
  const tabKeys = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' && matches.length) {
      event.preventDefault()
      focusEmoji(0)
    }
  }
  const gridKeys = (event: KeyboardEvent) => {
    const offsets: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: 8,
      ArrowUp: -8,
    }
    if (!(event.key in offsets)) return
    event.preventDefault()
    const next = active + offsets[event.key]
    if (next < 0) search.current?.focus()
    else focusEmoji(Math.min(matches.length - 1, next))
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
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={triggerLabel} />}>
        {trigger ?? <Smile strokeWidth={1.7} aria-hidden />}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-3"
        initialFocus={search}
        finalFocus={returnFocus}
      >
        <Input
          ref={search}
          type="search"
          aria-label="Buscar emoji"
          placeholder="Buscar emoji"
          value={query}
          onKeyDown={searchKeys}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
        />
        <Tabs
          value={query ? null : group}
          onValueChange={(value) => {
            setGroup(value as number)
            setQuery('')
            setActive(0)
          }}
        >
          <TabsList
            aria-label="Categorias de emojis"
            className="justify-between gap-1 border-b-0 py-1"
            onKeyDown={tabKeys}
          >
            {categories.map((category) => (
              <TabsTrigger
                key={category.group}
                value={category.group}
                aria-label={category.label}
                className="rounded-(--radius-7) border-b-0 p-1 hover:bg-muted data-active:bg-muted"
              >
                <span aria-hidden>{category.icon}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {matches.length ? (
          <div
            ref={grid}
            aria-label="Emojis"
            onKeyDown={gridKeys}
            className="grid max-h-56 grid-cols-8 overflow-y-auto"
          >
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
