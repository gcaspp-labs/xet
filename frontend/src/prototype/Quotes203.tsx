// PROTÓTIPO #203 (descartável, não vai para a main).
// Três versões da citação na conversa, trocadas por ?variant=A|B|C, na tela /chamados/:id.
// A: botão "Responder" ao lado do balão; citação dentro do balão com filete à esquerda (como no WhatsApp).
// B: "Responder" escrito no rodapé do balão; citação fora, numa linha acima do balão.
// C: barra ao passar o mouse (ou focar) sobre o balão; citação em cartão dentro do balão, com ícone do tipo.
// Estado só em memória; recarregar zera.
import { useSyncExternalStore, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, CornerUpLeft, FileText, Mic, Quote as QuoteIcon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Message } from '@/lib/conversation'
import { proto, type Quote } from './fakeApi'

export const variant = () => new URLSearchParams(window.location.search).get('variant') ?? 'A'

// ---------- citação em preparo (uma por chamado) ----------
let draft: { ticketId: number; quote: Quote & { source: 'xet' } } | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export function useDraft(ticketId: number) {
  const d = useSyncExternalStore(subscribe, () => draft)
  return d && d.ticketId === ticketId ? d.quote : null
}
export const clearDraft = () => {
  draft = null
  proto.quote = null
  emit()
}

const seconds = (s: number | null) => (s == null ? '' : ` (${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')})`)
export function previewOf(m: Message) {
  switch (m.type) {
    case 'audio':
      return `🎤 Áudio${seconds(m.media?.durationSeconds ?? null)}`
    case 'document':
      return `📎 ${m.media?.fileName ?? 'Arquivo'}${m.body ? ` · ${m.body}` : ''}`
    case 'image':
      return `🖼️ Imagem${m.body ? ` · ${m.body}` : ''}`
    case 'video':
      return `🎬 Vídeo${m.body ? ` · ${m.body}` : ''}`
    case 'media_unavailable':
      return '📎 Arquivo não pôde ser baixado'
    default:
      return m.body ?? ''
  }
}
const authorOf = (m: Message) => (m.direction === 'inbound' ? 'Cliente' : (m.author?.name ?? 'Setor'))

export function startQuote(m: Message) {
  const quote = { source: 'xet' as const, messageId: m.id, author: authorOf(m), preview: previewOf(m) }
  draft = { ticketId: m.ticketId, quote }
  proto.quote = quote
  emit()
  requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('textarea[aria-label]')?.focus())
}

// Pode citar: responsável, chamado aberto, mensagem com identificador, tipo que não seja "não suportado".
export const quotable = (m: Message, canAct: boolean) =>
  canAct && m.type !== 'unsupported' && !['pending', 'failed'].includes(m.status ?? '')

type MsgQuote = Quote | null | undefined
const quoteOf = (m: Message) => (m as Message & { quote?: MsgQuote }).quote

const goTo = (id: number) => {
  const el = document.getElementById(`msg-${id}`)
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el?.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 700 })
}

const typeIcon = (preview: string) =>
  preview.startsWith('🎤') ? Mic : preview.startsWith('📎') ? FileText : QuoteIcon

function QuoteBody({ q, onPrimary }: { q: Quote; onPrimary: boolean }) {
  if (q.source === 'unavailable')
    return <span className={cn('italic', onPrimary ? 'text-primary-foreground' : 'text-ink-soft')}>Mensagem indisponível</span>
  return (
    <>
      <span className="font-medium">{q.author}</span>
      <span className="line-clamp-2 break-words">{q.preview}</span>
      {q.source === 'whatsapp' && <span className="caption opacity-80">Trecho do WhatsApp</span>}
    </>
  )
}
const quoteLabel = (q: Quote) =>
  q.source === 'unavailable' ? 'Citação: mensagem indisponível' : `Citação de ${q.author}: ${q.preview}`

// A: dentro do balão, filete à esquerda.
function InsideA({ q, onPrimary }: { q: Quote; onPrimary: boolean }) {
  const Tag = q.source === 'xet' ? 'button' : 'div'
  return (
    <Tag
      type={q.source === 'xet' ? 'button' : undefined}
      aria-label={quoteLabel(q)}
      onClick={q.source === 'xet' ? () => goTo(q.messageId) : undefined}
      className={cn(
        'caption flex flex-col gap-0.5 rounded-(--radius-6) border-l-4 px-2 py-1.5 text-left',
        onPrimary ? 'border-primary-foreground bg-primary-foreground/15 text-primary-foreground' : 'border-primary bg-muted text-ink-soft',
      )}
    >
      <QuoteBody q={q} onPrimary={onPrimary} />
    </Tag>
  )
}

// B: fora do balão, uma linha acima.
function AboveB({ q, outbound }: { q: Quote; outbound: boolean }) {
  return (
    <p
      aria-label={quoteLabel(q)}
      className={cn('caption flex max-w-[70%] items-center gap-1.5 text-ink-soft', outbound ? 'self-end' : 'self-start')}
    >
      <CornerUpLeft className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden />
      {q.source === 'unavailable' ? (
        <span className="italic">Respondendo a uma mensagem indisponível</span>
      ) : (
        <>
          <span className="shrink-0">Respondendo a {q.author}:</span>
          {q.source === 'xet' ? (
            <button type="button" className="truncate underline-offset-2 hover:underline" onClick={() => goTo(q.messageId)}>
              {q.preview}
            </button>
          ) : (
            <span className="truncate">
              {q.preview} <span className="opacity-80">(do WhatsApp)</span>
            </span>
          )}
        </>
      )}
    </p>
  )
}

// C: cartão dentro do balão com ícone do tipo.
function CardC({ q, onPrimary }: { q: Quote; onPrimary: boolean }) {
  const Icon = q.source === 'unavailable' ? QuoteIcon : typeIcon(q.preview)
  return (
    <div
      aria-label={quoteLabel(q)}
      className={cn(
        'caption flex items-start gap-2 rounded-(--radius-8) border px-2.5 py-2',
        onPrimary ? 'border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground' : 'border-line-soft bg-card text-ink-soft',
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.7} aria-hidden />
      <span className="flex min-w-0 flex-col gap-0.5">
        <QuoteBody q={q} onPrimary={onPrimary} />
      </span>
    </div>
  )
}

function ReplyButton({ message, className, children }: { message: Message; className?: string; children?: ReactNode }) {
  return (
    <Button variant="ghost" size="icon" aria-label="Responder" className={className} onClick={() => startQuote(message)}>
      {children ?? <CornerUpLeft strokeWidth={1.7} aria-hidden />}
    </Button>
  )
}

export function QuoteShell({
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
  bubble: (slots: { top?: ReactNode; footer?: ReactNode; overlay?: ReactNode }) => ReactNode
}) {
  const v = variant()
  const q = quoteOf(message)
  const can = quotable(message, canAct)
  const onPrimary = modern && outbound
  if (v === 'B')
    return (
      <>
        {q && <AboveB q={q} outbound={outbound} />}
        {bubble({
          footer: can ? (
            <button
              type="button"
              onClick={() => startQuote(message)}
              className={cn(
                'caption flex items-center gap-1 rounded-(--radius-6) px-1 font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring',
                onPrimary ? 'text-primary-foreground' : 'text-ink-soft',
              )}
            >
              <CornerUpLeft className="size-3.5" strokeWidth={1.7} aria-hidden />
              Responder
            </button>
          ) : null,
        })}
      </>
    )
  if (v === 'C')
    return bubble({
      top: q ? <CardC q={q} onPrimary={onPrimary} /> : null,
      overlay: can ? (
        <div
          className={cn(
            'pointer-events-none absolute -top-9 z-10 flex rounded-full border border-line-soft bg-popover p-0.5 opacity-0 shadow-(--shadow)',
            'group-hover/msg:pointer-events-auto group-hover/msg:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100',
            outbound ? 'right-0' : 'left-0',
          )}
        >
          <Button variant="ghost" size="sm" className="rounded-full" onClick={() => startQuote(message)}>
            <CornerUpLeft strokeWidth={1.7} aria-hidden />
            Responder
          </Button>
        </div>
      ) : null,
    })
  return (
    <div className={cn('group/msg flex max-w-[78%] items-center gap-1', outbound ? 'flex-row-reverse self-end' : 'self-start')}>
      {bubble({ top: q ? <InsideA q={q} onPrimary={onPrimary} /> : null })}
      {can && (
        <ReplyButton message={message} className="rounded-full opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100" />
      )}
    </div>
  )
}

// Citação em preparo, acima do campo de mensagem.
export function DraftQuote({ ticketId }: { ticketId: number }) {
  const q = useDraft(ticketId)
  if (!q) return null
  const v = variant()
  const cancel = (
    <Button variant="ghost" size="icon" aria-label="Cancelar citação" onClick={clearDraft}>
      <X strokeWidth={1.7} aria-hidden />
    </Button>
  )
  if (v === 'B')
    return (
      <div role="group" aria-label={`Respondendo a ${q.author}`} className="caption flex items-center gap-1.5 text-ink-soft">
        <CornerUpLeft className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden />
        <span className="shrink-0">Respondendo a {q.author}:</span>
        <span className="truncate">{q.preview}</span>
        {cancel}
      </div>
    )
  if (v === 'C') {
    const Icon = typeIcon(q.preview)
    return (
      <div role="group" aria-label={`Citando mensagem de ${q.author}`} className="flex items-start gap-2 rounded-(--radius-8) border border-line-soft bg-card px-3 py-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-ink-soft" strokeWidth={1.7} aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="caption font-medium text-ink-soft">Citando mensagem de {q.author}</span>
          <span className="truncate">{q.preview}</span>
        </span>
        <Button variant="outline" size="sm" onClick={clearDraft}>
          Cancelar citação
        </Button>
      </div>
    )
  }
  return (
    <div role="group" aria-label={`Respondendo a ${q.author}`} className="flex items-center gap-2 rounded-(--radius-7) border-l-4 border-primary bg-muted px-3 py-1.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="caption font-medium text-primary">Respondendo a {q.author}</span>
        <span className="truncate text-ink-soft">{q.preview}</span>
      </span>
      {cancel}
    </div>
  )
}

// Barra flutuante do protótipo: ← → trocam a versão (fora de campos de texto).
const names: Record<string, string> = {
  A: 'A (botão ao lado + filete no balão)',
  B: 'B (rodapé + linha acima do balão)',
  C: 'C (barra ao passar o mouse + cartão)',
}
const order = ['A', 'B', 'C']
const go = (step: number) => {
  const params = new URLSearchParams(window.location.search)
  params.set('variant', order[(order.indexOf(variant()) + step + 3) % 3])
  window.location.search = params.toString()
}
export function PrototypeSwitcher() {
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('captura') === '1') return null
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#7c2d92] px-3 py-1.5 text-sm font-medium text-white shadow-lg">
      <span className="mr-1 text-xs uppercase opacity-80">Protótipo #203</span>
      <button type="button" aria-label="Versão anterior" onClick={() => go(-1)}>
        <ChevronLeft className="size-4" />
      </button>
      <span>{names[variant()]}</span>
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
    if (!document.querySelector('[aria-label="Próxima versão"]')) return
    if (e.key === 'ArrowLeft') go(-1)
    if (e.key === 'ArrowRight') go(1)
  })
}
