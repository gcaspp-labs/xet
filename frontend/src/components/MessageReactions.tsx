import { useState } from 'react'
import { Plus, SmilePlus } from 'lucide-react'
import { EmojiPicker } from '@/components/EmojiPicker'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Message } from '@/lib/conversation'
import { cn } from '@/lib/utils'

// Os 6 emojis rápidos da barra; qualquer outro vem do seletor completo, pelo "+".
const quickEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function QuickBar({
  current,
  onReact,
}: {
  current: string | undefined
  onReact: (emoji: string) => void
}) {
  return (
    <div role="group" aria-label="Reagir à mensagem" className="flex items-center gap-0.5">
      {quickEmojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={current === emoji ? `Remover reação ${emoji}` : `Reagir com ${emoji}`}
          onClick={() => onReact(emoji)}
          className={cn(
            'grid size-8 cursor-pointer place-items-center rounded-full text-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
            current === emoji && 'bg-accent-soft ring-1 ring-primary',
          )}
        >
          <span aria-hidden>{emoji}</span>
        </button>
      ))}
      <EmojiPicker
        triggerLabel="Mais emojis"
        trigger={<Plus strokeWidth={1.7} aria-hidden />}
        onSelect={onReact}
      />
    </div>
  )
}

// Ícone ao lado do balão, que aparece ao passar o mouse ou focar; abre a barra de reações. Só o
// responsável vê, e só nas mensagens que aceitam reação.
export function ReactButton({
  current,
  onReact,
}: {
  current: string | undefined
  onReact: (emoji: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reagir"
            className={cn(
              'rounded-full opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100',
              open && 'opacity-100',
            )}
          />
        }
      >
        <SmilePlus strokeWidth={1.7} aria-hidden />
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-auto rounded-full p-1">
        <QuickBar
          current={current}
          onReact={(emoji) => {
            onReact(emoji)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// Reações em etiquetas embaixo do balão, com quem reagiu: "Cliente", o apelido de quem do setor
// reagiu por último, ou "Setor, pelo celular". Todos que veem a conversa as veem.
export function ReactionChips({
  reactions,
  outbound,
}: {
  reactions: Message['reactions']
  outbound: boolean
}) {
  const { customer, sector } = reactions
  if (!customer && !sector) return null
  const chip =
    'caption flex items-center gap-1.5 rounded-full border border-line-soft bg-card px-2 py-0.5 text-ink-soft'
  const sectorWho = sector?.by?.name ?? (sector?.viaPhone ? 'Setor, pelo celular' : 'Setor')
  return (
    <ul
      aria-label="Reações"
      className={cn('-mt-1 flex flex-wrap gap-1.5', outbound && 'justify-end')}
    >
      {customer && (
        <li className={chip} aria-label={`Cliente reagiu com ${customer.emoji}`}>
          <span className="text-sm" aria-hidden>
            {customer.emoji}
          </span>
          <span aria-hidden>Cliente</span>
        </li>
      )}
      {sector && (
        <li className={chip} aria-label={`Setor reagiu com ${sector.emoji}, ${sectorWho}`}>
          <span className="text-sm" aria-hidden>
            {sector.emoji}
          </span>
          <span aria-hidden>{sectorWho}</span>
        </li>
      )}
    </ul>
  )
}
