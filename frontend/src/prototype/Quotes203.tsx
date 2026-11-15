// PROTÓTIPO #203 (descartável, não vai para a main).
// Versão aprovada por Laboratório em 15/11/2026 (a antiga A), na tela /chamados/:id:
// botão "Responder" ao lado do balão; citação enviada dentro do mesmo balão, com faixa à esquerda;
// citação em preparo na faixa acima do campo, com × para cancelar.
// As versões não escolhidas (B e C) ficam no commit a6afe6c.
// Estado só em memória; recarregar zera.
import { useSyncExternalStore, type ReactNode } from 'react'
import { CornerUpLeft, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Message } from '@/lib/conversation'
import { proto, type Quote } from './fakeApi'

// Versão única aprovada; ?variant= não troca mais nada.
export const variant = () => 'A'

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

const seconds = (s: number | null) =>
  s == null ? '' : ` (${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')})`
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
const authorOf = (m: Message) =>
  m.direction === 'inbound' ? 'Cliente' : (m.author?.name ?? 'Setor')

export function startQuote(m: Message) {
  const quote = {
    source: 'xet' as const,
    messageId: m.id,
    author: authorOf(m),
    preview: previewOf(m),
  }
  draft = { ticketId: m.ticketId, quote }
  proto.quote = quote
  emit()
  requestAnimationFrame(() =>
    document.querySelector<HTMLTextAreaElement>('textarea[aria-label]')?.focus(),
  )
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

function QuoteBody({ q, onPrimary }: { q: Quote; onPrimary: boolean }) {
  if (q.source === 'unavailable')
    return (
      <span className={cn('italic', onPrimary ? 'text-primary-foreground' : 'text-ink-soft')}>
        Mensagem indisponível
      </span>
    )
  return (
    <>
      <span className="font-medium">{q.author}</span>
      <span className="line-clamp-2 break-words">{q.preview}</span>
      {q.source === 'whatsapp' && <span className="caption opacity-80">Trecho do WhatsApp</span>}
    </>
  )
}
const quoteLabel = (q: Quote) =>
  q.source === 'unavailable'
    ? 'Citação: mensagem indisponível'
    : `Citação de ${q.author}: ${q.preview}`

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
        onPrimary
          ? 'border-primary-foreground bg-primary-foreground/15 text-primary-foreground'
          : 'border-primary bg-muted text-ink-soft',
      )}
    >
      <QuoteBody q={q} onPrimary={onPrimary} />
    </Tag>
  )
}

function ReplyButton({
  message,
  className,
  children,
}: {
  message: Message
  className?: string
  children?: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Responder"
      className={className}
      onClick={() => startQuote(message)}
    >
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
  const q = quoteOf(message)
  const can = quotable(message, canAct)
  const onPrimary = modern && outbound
  return (
    <div
      className={cn(
        'group/msg flex max-w-[78%] items-center gap-1',
        outbound ? 'flex-row-reverse self-end' : 'self-start',
      )}
    >
      {bubble({ top: q ? <InsideA q={q} onPrimary={onPrimary} /> : null })}
      {can && (
        <ReplyButton
          message={message}
          className="rounded-full opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100"
        />
      )}
    </div>
  )
}

// Citação em preparo, acima do campo de mensagem.
export function DraftQuote({ ticketId }: { ticketId: number }) {
  const q = useDraft(ticketId)
  if (!q) return null
  const cancel = (
    <Button variant="ghost" size="icon" aria-label="Cancelar citação" onClick={clearDraft}>
      <X strokeWidth={1.7} aria-hidden />
    </Button>
  )
  return (
    <div
      role="group"
      aria-label={`Respondendo a ${q.author}`}
      className="flex items-center gap-2 rounded-(--radius-7) border-l-4 border-primary bg-muted px-3 py-1.5"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="caption font-medium text-primary">Respondendo a {q.author}</span>
        <span className="truncate text-ink-soft">{q.preview}</span>
      </span>
      {cancel}
    </div>
  )
}

// Barra flutuante do protótipo: só marca a versão aprovada (não há mais o que trocar).
export function PrototypeSwitcher() {
  if (!import.meta.env.DEV || new URLSearchParams(window.location.search).get('captura') === '1')
    return null
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#7c2d92] px-3 py-1.5 text-sm font-medium text-white shadow-lg">
      <span className="mr-1 text-xs uppercase opacity-80">Protótipo #203</span>
      <span>Aprovada: botão ao lado + faixa no balão</span>
    </div>
  )
}
