// PROTÓTIPO #200 (descartável, não vai para a main).
// Versão aprovada por Laboratório em 15/11/2026, na tela /chamados/:id:
// botão de reagir ao lado do balão (da antiga A) + reações em etiquetas com quem reagiu escrito (da antiga B).
// As versões não escolhidas (selo da A, botão no rodapé da B, versão C) ficam no commit 02467ba.
// Estado só em memória; ?falha=1 simula falha no envio (desfaz e avisa).
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Plus, SmilePlus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { EmojiPicker } from '@/components/EmojiPicker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Message } from '@/lib/conversation'
import { seedReactions } from './fakeApi'

export const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const ME = 'Paula Souza'

type Pair = { customer?: string; sector?: { emoji: string; by: string | null } }
const store = new Map<number, Pair>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const get = (id: number): Pair | undefined => store.get(id) ?? seedReactions[id]
const set = (id: number, value: Pair) => {
  store.set(id, value)
  emit()
}
function useReaction(id: number) {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => get(id),
  )
}

// Reagir: troca, ou remove ao tocar no mesmo emoji. Falha desfaz e avisa.
function react(id: number, emoji: string) {
  const before = get(id) ?? {}
  const removing = before.sector?.emoji === emoji
  set(id, { ...before, sector: removing ? undefined : { emoji, by: ME } })
  if (new URLSearchParams(window.location.search).get('falha') === '1') {
    setTimeout(() => {
      set(id, before)
      toast.error('Não foi possível enviar a reação. Tente de novo.')
    }, 500)
  }
}

// Versão única aprovada; ?variant= não troca mais nada.
export const variant = () => 'A'

// Pode reagir: responsável, chamado aberto, mensagem com identificador no WhatsApp.
export const reactable = (m: Message, canAct: boolean) =>
  canAct && (m.direction === 'inbound' || ['sent', 'delivered', 'read'].includes(m.status ?? ''))

const sectorWho = (s: NonNullable<Pair['sector']>) => (s.by ? s.by : 'pelo celular')
function QuickBar({ id, onDone }: { id: number; onDone?: () => void }) {
  const current = useReaction(id)?.sector?.emoji
  return (
    <div role="group" aria-label="Reagir à mensagem" className="flex items-center gap-0.5">
      {QUICK.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={current === e ? `Remover reação ${e}` : `Reagir com ${e}`}
          aria-pressed={current === e}
          onClick={() => {
            react(id, e)
            onDone?.()
          }}
          className={cn(
            'grid size-8 place-items-center rounded-full text-lg hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
            current === e && 'bg-accent-soft ring-1 ring-primary',
          )}
        >
          {e}
        </button>
      ))}
      <EmojiPicker
        triggerLabel="Mais emojis"
        trigger={<Plus strokeWidth={1.7} aria-hidden />}
        onSelect={(e) => {
          react(id, e)
          onDone?.()
        }}
      />
    </div>
  )
}

// ---------- Botão ao lado do balão (da antiga A) ----------
function SideButtonA({ id }: { id: number }) {
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
        <QuickBar id={id} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

// ---------- Etiquetas com quem reagiu (da antiga B) ----------
function ChipsB({ id, outbound }: { id: number; outbound: boolean }) {
  const p = useReaction(id)
  if (!p || (!p.customer && !p.sector)) return null
  const chip =
    'flex items-center gap-1.5 rounded-full border border-line-soft bg-card px-2 py-0.5 caption text-ink-soft'
  return (
    <ul
      aria-label="Reações"
      className={cn('-mt-1 flex flex-wrap gap-1.5', outbound ? 'self-end' : 'self-start')}
    >
      {p.customer && (
        <li className={chip} aria-label={`Cliente reagiu ${p.customer}`}>
          <span className="text-sm" aria-hidden>
            {p.customer}
          </span>
          Cliente
        </li>
      )}
      {p.sector && (
        <li className={chip} aria-label={`Setor reagiu ${p.sector.emoji}, ${sectorWho(p.sector)}`}>
          <span className="text-sm" aria-hidden>
            {p.sector.emoji}
          </span>
          {p.sector.by ?? 'Setor, pelo celular'}
        </li>
      )}
    </ul>
  )
}

// Envolve o balão de hoje: botão ao lado e etiquetas embaixo.
export function ReactionShell({
  message,
  canAct,
  outbound,
  bubble,
}: {
  message: Message
  canAct: boolean
  outbound: boolean
  modern: boolean
  bubble: (slots: { footer?: ReactNode; inside?: ReactNode; overlay?: ReactNode }) => ReactNode
}) {
  const can = reactable(message, canAct)
  return (
    <div
      className={cn(
        'group/msg flex max-w-[78%] flex-col gap-1',
        outbound ? 'items-end self-end' : 'items-start self-start',
      )}
    >
      <div className={cn('flex items-center gap-1', outbound && 'flex-row-reverse')}>
        {bubble({})}
        {can && <SideButtonA id={message.id} />}
      </div>
      <ChipsB id={message.id} outbound={outbound} />
    </div>
  )
}

// Barra flutuante do protótipo: só marca a versão aprovada (não há mais o que trocar).
export function PrototypeSwitcher() {
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('captura') === '1')
    return null
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#7c2d92] px-3 py-1.5 text-sm font-medium text-white shadow-lg">
      <span className="mr-1 text-xs uppercase opacity-80">Protótipo #200</span>
      <span>Aprovada: botão ao lado + etiquetas</span>
    </div>
  )
}
