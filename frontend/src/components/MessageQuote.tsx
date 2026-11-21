import { CornerUpLeft, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/format'
import { isHiddenByXet, type Message, type MessageQuote as Quote } from '@/lib/conversation'
import type { MessageType } from '@/lib/tickets'
import { cn } from '@/lib/utils'

// O apelido que o setor põe no início do texto enviado ("*Ana:*") não entra no trecho mostrado.
const senderPrefix = /^\*([^*\n]+:)\*(?:\n|$)/

// Tipo e nome ou legenda, como na citação do WhatsApp; áudio e arquivo não tocam nem abrem aqui.
function describe(type: MessageType | null, text: string | null, seconds?: number | null) {
  switch (type) {
    case 'audio':
      return `🎤 Áudio${seconds ? ` (${formatDuration(seconds)})` : ''}`
    case 'document':
      return `📎 ${text ?? 'Arquivo'}`
    case 'image':
      return text ? `🖼️ Imagem · ${text}` : '🖼️ Imagem'
    case 'video':
      return text ? `🎬 Vídeo · ${text}` : '🎬 Vídeo'
    case 'media_unavailable':
      return `📎 ${text ?? 'Arquivo não pôde ser baixado'}`
    case 'contact':
      // A citação de um cartão mostra o nome do primeiro cartão ("👤 Nome"), como a prévia das listas.
      return text ? `👤 ${text}` : '👤 Contato'
    case 'unsupported':
      return 'Tipo de mensagem não suportado'
    default:
      return text ?? ''
  }
}

// O conteúdo de uma mensagem do XET como a citação o mostra.
function quotedPreview(message: Message) {
  // O cartão de contato não tem texto: o trecho é o nome do primeiro cartão.
  if (message.type === 'contact') {
    return describe('contact', message.contactCards?.[0]?.name ?? null)
  }
  const body =
    message.direction === 'outbound' && message.origin === 'agent'
      ? (message.body?.replace(senderPrefix, '') ?? null)
      : message.body
  const text = message.type === 'document' ? (message.media?.fileName ?? body) : body
  return describe(message.type, text || null, message.media?.durationSeconds)
}

// Quem escreveu a mensagem: o cliente, ou o atendente do setor (o celular do setor não tem nome).
function quotedAuthor(message: Message) {
  return message.direction === 'inbound' ? 'Cliente' : (message.author?.name ?? 'Setor')
}

// Rola até a mensagem original e a pisca, a não ser que a pessoa peça menos movimento.
function showOriginal(messageId: number) {
  const element = document.getElementById(`message-${messageId}`)
  if (!element) return
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' })
  if (!calm) element.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 700 })
}

// A citação dentro do balão, com a faixa à esquerda: autor e trecho da mensagem do XET, ou o trecho
// que veio do WhatsApp, ou "Mensagem indisponível" quando não há nenhum dos dois. Clicar numa
// citação de mensagem do XET leva à original. `quoted` é a mensagem ligada, quando está na conversa.
export function QuoteBlock({
  quote,
  quoted,
  onPrimary,
  hideDeleted = false,
}: {
  quote: Quote
  quoted: Message | undefined
  // Balão do setor com fundo de destaque: a faixa troca para o tom do texto sobre ele.
  onPrimary: boolean
  // Em Chamados, a mensagem citada que o XET excluiu mostra um aviso, não o conteúdo.
  hideDeleted?: boolean
}) {
  const style = cn(
    'caption flex flex-col gap-0.5 rounded-(--radius-6) border-l-4 px-2 py-1.5 text-left',
    onPrimary
      ? 'border-primary-foreground bg-primary-foreground/10 text-primary-foreground'
      : 'border-primary bg-muted text-ink-soft',
  )

  if (quoted) {
    const author = quotedAuthor(quoted)
    const preview =
      hideDeleted && isHiddenByXet(quoted) ? 'Mensagem excluída no XET' : quotedPreview(quoted)
    return (
      <button
        type="button"
        aria-label={`Citação de ${author}: ${preview}`}
        onClick={() => showOriginal(quoted.id)}
        className={cn(style, 'cursor-pointer focus-visible:outline-2 focus-visible:outline-ring')}
      >
        <span className="font-medium">{author}</span>
        <span className="line-clamp-2 break-words">{preview}</span>
      </button>
    )
  }

  if (quote.type !== null || quote.text !== null) {
    const preview = describe(quote.type, quote.text)
    return (
      <div role="group" aria-label={`Citação do WhatsApp: ${preview}`} className={style}>
        <span className="line-clamp-2 break-words">{preview}</span>
        <span>Trecho do WhatsApp</span>
      </div>
    )
  }

  return (
    <div role="group" aria-label="Citação: mensagem indisponível" className={style}>
      <span className="italic">Mensagem indisponível</span>
    </div>
  )
}

// Botão ao lado do balão que prepara a citação; aparece ao passar o mouse ou ao focar, como o de reagir.
export function ReplyButton({ onReply }: { onReply: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Responder"
      className="rounded-full opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100"
      onClick={onReply}
    >
      <CornerUpLeft strokeWidth={1.7} aria-hidden />
    </Button>
  )
}

// A citação em preparo, na faixa acima do campo de mensagem, com o botão para cancelá-la.
export function DraftQuote({ message, onCancel }: { message: Message; onCancel: () => void }) {
  const author = quotedAuthor(message)
  return (
    <div
      role="group"
      aria-label={`Respondendo a ${author}`}
      className="flex items-center gap-2 rounded-(--radius-7) border-l-4 border-primary bg-muted px-3 py-1.5"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="caption font-medium text-primary">Respondendo a {author}</span>
        <span className="truncate text-ink-soft">{quotedPreview(message)}</span>
      </span>
      <Button variant="ghost" size="icon" aria-label="Cancelar citação" onClick={onCancel}>
        <X strokeWidth={1.7} aria-hidden />
      </Button>
    </div>
  )
}
