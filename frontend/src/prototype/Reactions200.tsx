// PROTÓTIPO #200 (descartável, não vai para a main).
// Três versões das reações na conversa, trocadas por ?variant=A|B|C, na tela /chamados/:id.
// A: botão ao lado do balão + selo sobre a borda (como no WhatsApp), quem reagiu ao abrir o selo.
// B: botão "Reagir" no rodapé do balão + reações em etiquetas embaixo, com quem reagiu escrito.
// C: barra aparece sozinha ao passar o mouse (ou focar) + linha de reações dentro do balão.
// Estado só em memória; ?falha=1 simula falha no envio (desfaz e avisa).
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Plus, SmilePlus } from 'lucide-react'
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

export const variant = () => new URLSearchParams(window.location.search).get('variant') ?? 'A'

// Pode reagir: responsável, chamado aberto, mensagem com identificador no WhatsApp.
export const reactable = (m: Message, canAct: boolean) =>
  canAct && (m.direction === 'inbound' || ['sent', 'delivered', 'read'].includes(m.status ?? ''))

const sectorWho = (s: NonNullable<Pair['sector']>) => (s.by ? s.by : 'pelo celular')
const label = (p: Pair) =>
  [
    p.customer && `Cliente reagiu ${p.customer}`,
    p.sector && `Setor reagiu ${p.sector.emoji}, ${sectorWho(p.sector)}`,
  ]
    .filter(Boolean)
    .join('; ')

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

// ---------- Versão A: botão ao lado + selo sobre a borda ----------
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

function BadgeA({ id, outbound }: { id: number; outbound: boolean }) {
  const p = useReaction(id)
  if (!p || (!p.customer && !p.sector)) return null
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Reações: ${label(p)}`}
            className={cn(
              'relative z-[1] -mt-3 mb-1 flex items-center gap-0.5 rounded-full border border-line-soft bg-card px-1.5 py-0.5 text-sm shadow-(--shadow) hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
              outbound ? 'mr-3 self-end' : 'ml-3 self-start',
            )}
          />
        }
      >
        {p.customer && <span aria-hidden>{p.customer}</span>}
        {p.sector && <span aria-hidden>{p.sector.emoji}</span>}
      </PopoverTrigger>
      <PopoverContent side="bottom" align={outbound ? 'end' : 'start'} className="w-64 p-3">
        <p className="caption mb-2 font-medium text-ink-soft">Reações</p>
        <ul className="flex flex-col gap-2">
          {p.customer && (
            <li className="flex items-center gap-2">
              <span className="text-lg">{p.customer}</span>Cliente
            </li>
          )}
          {p.sector && (
            <li className="flex items-center gap-2">
              <span className="text-lg">{p.sector.emoji}</span>
              <span>
                Setor <span className="text-ink-soft">· {sectorWho(p.sector)}</span>
              </span>
            </li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// ---------- Versão B: botão no rodapé + etiquetas com quem reagiu ----------
export function FooterButtonB({ id, onPrimary, outbound }: { id: number; onPrimary: boolean; outbound: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Reagir"
            className={cn(
              'caption flex items-center gap-1 rounded-(--radius-6) px-1 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring',
              onPrimary ? 'text-primary-foreground' : 'text-ink-soft',
            )}
          />
        }
      >
        <SmilePlus className="size-3.5" strokeWidth={1.7} aria-hidden />
        Reagir
      </PopoverTrigger>
      <PopoverContent side="top" align={outbound ? 'end' : 'start'} className="w-auto rounded-full p-1">
        <QuickBar id={id} onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}

function ChipsB({ id, outbound }: { id: number; outbound: boolean }) {
  const p = useReaction(id)
  if (!p || (!p.customer && !p.sector)) return null
  const chip = 'flex items-center gap-1.5 rounded-full border border-line-soft bg-card px-2 py-0.5 caption text-ink-soft'
  return (
    <ul aria-label="Reações" className={cn('-mt-1 flex flex-wrap gap-1.5', outbound ? 'self-end' : 'self-start')}>
      {p.customer && (
        <li className={chip} aria-label={`Cliente reagiu ${p.customer}`}>
          <span className="text-sm" aria-hidden>{p.customer}</span>Cliente
        </li>
      )}
      {p.sector && (
        <li className={chip} aria-label={`Setor reagiu ${p.sector.emoji}, ${sectorWho(p.sector)}`}>
          <span className="text-sm" aria-hidden>{p.sector.emoji}</span>
          {p.sector.by ?? 'Setor, pelo celular'}
        </li>
      )}
    </ul>
  )
}

// ---------- Versão C: barra que aparece ao passar o mouse + linha no balão ----------
function HoverBarC({ id, outbound }: { id: number; outbound: boolean }) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute -top-9 z-10 rounded-full border border-line-soft bg-popover p-0.5 opacity-0 shadow-(--shadow)',
        'group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100',
        outbound ? 'right-0' : 'left-0',
      )}
    >
      <QuickBar id={id} />
    </div>
  )
}

function LineC({ id, onPrimary }: { id: number; onPrimary: boolean }) {
  const p = useReaction(id)
  if (!p || (!p.customer && !p.sector)) return null
  return (
    <p
      aria-label={`Reações: ${label(p)}`}
      className={cn(
        'caption flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-1.5',
        onPrimary ? 'border-primary-foreground/30 text-primary-foreground' : 'border-line-soft text-ink-soft',
      )}
    >
      {p.customer && (
        <span aria-hidden>
          <span className="text-sm">{p.customer}</span> cliente
        </span>
      )}
      {p.sector && (
        <span aria-hidden>
          <span className="text-sm">{p.sector.emoji}</span> setor ({sectorWho(p.sector)})
        </span>
      )}
    </p>
  )
}

// Envolve o balão de hoje e põe as reações conforme a versão.
export function ReactionShell({
  message,
  canAct,
  outbound,
  modern,
  bubble,
}: {
  message: Message
  canAct: boolean
  outbound: boolean
  modern: boolean
  bubble: (slots: { footer?: ReactNode; inside?: ReactNode; overlay?: ReactNode }) => ReactNode
}) {
  const v = variant()
  const can = reactable(message, canAct)
  const onPrimary = modern && outbound
  if (v === 'B')
    return (
      <>
        {bubble({ footer: can ? <FooterButtonB id={message.id} onPrimary={onPrimary} outbound={outbound} /> : null })}
        <ChipsB id={message.id} outbound={outbound} />
      </>
    )
  if (v === 'C')
    return bubble({
      overlay: can ? <HoverBarC id={message.id} outbound={outbound} /> : null,
      inside: <LineC id={message.id} onPrimary={onPrimary} />,
    })
  return (
    <div className={cn('group/msg flex max-w-[78%] flex-col', outbound ? 'self-end' : 'self-start')}>
      <div className={cn('flex items-center gap-1', outbound && 'flex-row-reverse')}>
        {bubble({})}
        {can && <SideButtonA id={message.id} />}
      </div>
      <BadgeA id={message.id} outbound={outbound} />
    </div>
  )
}

// Barra flutuante do protótipo: ← → trocam a versão (fora de campos de texto).
const names: Record<string, string> = {
  A: 'A (botão ao lado + selo)',
  B: 'B (rodapé + etiquetas)',
  C: 'C (barra ao passar o mouse)',
}
export function PrototypeSwitcher() {
  const order = ['A', 'B', 'C']
  const current = variant()
  const go = (step: number) => {
    const next = order[(order.indexOf(current) + step + order.length) % order.length]
    const params = new URLSearchParams(window.location.search)
    params.set('variant', next)
    window.location.search = params.toString()
  }
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('captura') === '1') return null
  return (
    <div
      onKeyDownCapture={() => {}}
      className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#7c2d92] px-3 py-1.5 text-sm font-medium text-white shadow-lg"
    >
      <span className="mr-1 text-xs uppercase opacity-80">Protótipo #200</span>
      <button type="button" aria-label="Versão anterior" onClick={() => go(-1)}>
        <ChevronLeft className="size-4" />
      </button>
      <span>{names[current]}</span>
      <button type="button" aria-label="Próxima versão" onClick={() => go(1)}>
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    const a = document.activeElement
    if (a && a !== document.body) return
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    if (!document.querySelector('[aria-label="Próxima versão"]')) return
    const order = ['A', 'B', 'C']
    const params = new URLSearchParams(window.location.search)
    const cur = params.get('variant') ?? 'A'
    params.set('variant', order[(order.indexOf(cur) + (e.key === 'ArrowRight' ? 1 : 2)) % 3])
    window.location.search = params.toString()
  })
}
