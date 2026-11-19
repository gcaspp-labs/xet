import {
  ArrowRightLeft,
  Ban,
  Check,
  CircleAlert,
  CircleCheck,
  FileText,
  History,
  Lock,
  MessagesSquare,
  Mic,
  Paperclip,
  PencilLine,
  RotateCw,
  SendHorizontal,
  Trash2,
  Undo2,
  UserRoundCog,
  X,
} from 'lucide-react'
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type MutableRefObject,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { AudioPlayer } from '@/components/AudioPlayer'
import { EmojiPicker } from '@/components/EmojiPicker'
import { DraftQuote, QuoteBlock, ReplyButton } from '@/components/MessageQuote'
import { ReactButton, ReactionChips } from '@/components/MessageReactions'
import { CorrectionSheet } from '@/components/CorrectionSheet'
import { HistorySheet, TicketHistoryList, useHistoryTarget } from '@/components/TicketHistory'
import type { HistoryReturnState } from '@/lib/history-return'
import { Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { type User, useCurrentUser } from '@/lib/auth'
import {
  type AssignmentLog,
  type Correction,
  type CorrectionChange,
  type Message,
  type MessageStatus,
  type TicketDetail,
  canQuoteMessage,
  canReactTo,
  maxFileSize,
  newRequestId,
  useAssignments,
  useContactHistory,
  useCorrections,
  useMessages,
  useOrganizationHistory,
  useReactToMessage,
  useRetryMessage,
  useSendMessage,
  useTicket,
  useTicketModules,
} from '@/lib/conversation'
import {
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatMessageTime,
  formatPhone,
  organizationLabel,
  ticketStatusLabel,
} from '@/lib/format'
import { isNotFound } from '@/lib/api'
import { type Recording, useVoiceRecorder } from '@/lib/recorder'
import { parseTicketId } from '@/lib/tickets'
import { cn } from '@/lib/utils'
import NotFoundPage from '@/pages/NotFoundPage'
import { ImageViewer } from '@/pages/ticket/ImageViewer'
import { useTicketView } from '@/pages/ticket/useTicketView'

const messageStatusLabels: Record<
  MessageStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  pending: { label: 'Enviando', tone: 'neutral' },
  sent: { label: 'Enviada', tone: 'neutral' },
  delivered: { label: 'Entregue', tone: 'success' },
  read: { label: 'Lida', tone: 'success' },
  failed: { label: 'Falhou', tone: 'danger' },
}

const backToList = { to: '/atendimentos', label: 'Voltar à lista' }

const fileLabels: Record<string, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
}

// Imagens e vídeos com pré-visualização e áudios com player na própria
// conversa (a imagem abre ampliada por cima dela); os demais arquivos abrem ou
// são baixados pelo link.
function MessageMedia({ message }: { message: Message }) {
  if (!message.media) {
    return null
  }
  const src = `/api/media/${message.media.id}`
  switch (message.type) {
    case 'image':
      return <ImageViewer src={src} />
    case 'video':
      return (
        <video
          src={src}
          controls
          preload="metadata"
          aria-label="Vídeo"
          className="max-h-72 max-w-full rounded-(--radius-8) border border-line-soft bg-muted"
        />
      )
    case 'audio':
      return (
        <AudioPlayer
          src={src}
          label="Áudio"
          durationSeconds={message.media.durationSeconds}
          className="w-72 max-w-full"
        />
      )
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener"
      className="flex items-center gap-2 rounded-(--radius-7) border border-line-soft bg-card px-2.5 py-2 text-foreground hover:border-primary"
    >
      <FileText strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        {message.media.fileName ?? fileLabels[message.type] ?? 'Arquivo'}
      </span>
      <span className="mono-num caption text-ink-faint">
        {formatFileSize(message.media.sizeBytes)}
      </span>
    </a>
  )
}

// O aviso de cadastro vale para quem abre o chamado, mesmo na fila (spec.md, Órgãos e contatos).
function needsRegistration(ticket: TicketDetail) {
  return ticket.status !== 'closed' && !ticket.contact.registered
}

// Só o responsável conduz a conversa, com o chamado aberto; o backend confere de novo.
function conducts(ticket: TicketDetail, user: User) {
  return ticket.status !== 'closed' && ticket.assignee?.id === user.id
}

// O responsável transfere o próprio chamado em atendimento; supervisão e
// administração transferem o de qualquer atendente (spec.md, Transferências).
export function canTransfer(ticket: TicketDetail, user: User) {
  return ticket.status === 'in_progress' && (conducts(ticket, user) || user.role !== 'agent')
}

// Só o responsável encerra, como responde (spec.md, Formulário de encerramento).
export function canClose(ticket: TicketDetail, user: User) {
  return ticket.status === 'in_progress' && conducts(ticket, user)
}

// Quem é do setor do chamado age nele; o destino de uma transferência entre
// setores só lê os chamados anteriores (spec.md, Transferências).
function worksIn(ticket: TicketDetail, user: User) {
  return user.role === 'admin' || user.sectorId === ticket.sector.id
}

// Na fila, quem é do setor cancela; em atendimento, o responsável e a
// supervisão do setor (spec.md, Cancelamento).
export function canCancel(ticket: TicketDetail, user: User) {
  return (
    worksIn(ticket, user) &&
    (ticket.status === 'queued' ||
      (ticket.status === 'in_progress' && (conducts(ticket, user) || user.role !== 'agent')))
  )
}

// Devolvem à fila o chamado em atendimento o responsável e a supervisão do
// setor (spec.md, Devolver à fila).
export function canReturn(ticket: TicketDetail, user: User) {
  return (
    worksIn(ticket, user) &&
    ticket.status === 'in_progress' &&
    (conducts(ticket, user) || user.role !== 'agent')
  )
}

// Corrige o atendimento encerrado quem o encerrou e a supervisão do setor; o
// cancelado e o transferido para outro setor não são corrigidos (closing.md, regra 14).
export function canCorrect(ticket: TicketDetail, user: User) {
  return (
    ticket.status === 'closed' &&
    ticket.closureType !== 'cancelled' &&
    ticket.closureType !== 'transferred' &&
    worksIn(ticket, user) &&
    (ticket.closedBy?.id === user.id || user.role !== 'agent')
  )
}

function assignmentText(log: AssignmentLog) {
  if (log.action === 'ticket_started') {
    return `${log.toName} abriu e assumiu o chamado`
  }
  if (log.action === 'ticket_assigned') {
    return `${log.toName} assumiu o chamado`
  }
  if (log.action === 'ticket_returned') {
    return log.actor?.name === log.fromName
      ? `${log.fromName} devolveu o chamado à fila`
      : `${log.actor?.name ?? 'Sistema'} devolveu à fila o chamado de ${log.fromName}`
  }
  if (log.action === 'ticket_closed') {
    return `${log.actor?.name ?? 'Sistema'} encerrou o chamado`
  }
  if (log.action === 'ticket_transferred_sector') {
    const who = log.actor?.name ?? 'Sistema'
    return log.fromSectorName
      ? `${who} transferiu o chamado do setor ${log.fromSectorName} para o setor ${log.toSectorName}`
      : `${who} transferiu o chamado para o setor ${log.toSectorName}`
  }
  if (log.action === 'ticket_cancelled') {
    return `${log.actor?.name ?? 'Sistema'} cancelou o chamado`
  }
  if (log.action === 'ticket_corrected') {
    return `${log.actor?.name ?? 'Sistema'} corrigiu o atendimento`
  }
  if (log.actor?.name === log.fromName) {
    return `${log.fromName} transferiu o chamado para ${log.toName}`
  }
  return `${log.actor?.name ?? 'Sistema'} transferiu o chamado de ${log.fromName} para ${log.toName}`
}

// Registro de responsável ou de encerramento entre as mensagens, na ordem do tempo.
function AssignmentEntry({ log, modern = false }: { log: AssignmentLog; modern?: boolean }) {
  return (
    <li
      aria-label="Registro do chamado"
      className={cn(
        'caption flex items-start gap-1.5 self-center rounded-(--radius-7) border px-2.5 py-1 text-ink-soft',
        modern ? 'border-dashed border-line bg-transparent' : 'border-line-soft bg-muted',
      )}
    >
      {log.action === 'ticket_cancelled' ? (
        <Ban strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      ) : log.action === 'ticket_closed' ? (
        <CircleCheck strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      ) : log.action === 'ticket_transferred_sector' ? (
        <ArrowRightLeft strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      ) : log.action === 'ticket_corrected' ? (
        <PencilLine strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      ) : log.action === 'ticket_returned' ? (
        <Undo2 strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      ) : (
        <UserRoundCog strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      )}
      <span className="min-w-0">
        {assignmentText(log)} · <span className="mono-num">{formatMessageTime(log.createdAt)}</span>
        {(log.action === 'ticket_cancelled' ||
          (log.action === 'ticket_transferred_sector' && log.reason)) && (
          <span className="block whitespace-pre-wrap break-words">Motivo: {log.reason}</span>
        )}
      </span>
    </li>
  )
}

type TimelineItem =
  | { kind: 'message'; at: number; message: Message }
  | { kind: 'assignment'; at: number; log: AssignmentLog }

// Mensagens e registros de responsável numa única sequência pelo horário.
function timeline(messages: Message[], logs: AssignmentLog[]): TimelineItem[] {
  const items: TimelineItem[] = [
    ...messages.map((message) => ({
      kind: 'message' as const,
      at: Date.parse(message.sentAt),
      message,
    })),
    ...logs.map((log) => ({ kind: 'assignment' as const, at: Date.parse(log.createdAt), log })),
  ]
  // No mesmo instante (conversa iniciada), o registro vem antes da primeira mensagem.
  return items.sort(
    (a, b) =>
      a.at - b.at || (a.kind === 'assignment' ? -1 : 0) - (b.kind === 'assignment' ? -1 : 0),
  )
}

// A mensagem do XET que esta cita, quando a citação está ligada a uma do mesmo chamado.
function quotedOf(message: Message, byId: Map<number, Message>) {
  return message.quote?.messageId != null ? byId.get(message.quote.messageId) : undefined
}

function MessageBubble({
  message,
  canRetry,
  onRetry,
  retrying,
  onReact,
  onReply,
  quoted,
  modern = false,
}: {
  message: Message
  canRetry: boolean
  onRetry: () => void
  retrying: boolean
  // Só o responsável reage; sem isto, a mensagem mostra as reações mas não oferece reagir.
  onReact?: (emoji: string) => void
  // Só o responsável responde citando; sem isto, a mensagem mostra a citação mas não oferece responder.
  onReply?: () => void
  // A mensagem do XET que esta cita, quando está na conversa.
  quoted?: Message
  modern?: boolean
}) {
  const outbound = message.direction === 'outbound'
  const status = message.status && outbound ? messageStatusLabels[message.status] : null
  const author =
    message.origin === 'phone' ? 'Enviada fora do sistema' : outbound ? message.author?.name : null
  const prefix =
    outbound && message.origin === 'agent' ? message.body?.match(/^\*([^*\n]+:)\*(?:\n|$)/) : null

  return (
    <li
      id={`message-${message.id}`}
      aria-label={outbound ? 'Mensagem enviada' : 'Mensagem recebida'}
      className={cn(
        'group/msg flex max-w-[78%] flex-col gap-1',
        outbound ? 'items-end self-end' : 'items-start self-start',
      )}
    >
      <div className={cn('flex items-center gap-1', outbound && 'flex-row-reverse')}>
        <div
          data-slot="message-bubble"
          className={cn(
            'flex min-w-0 flex-col gap-1 rounded-(--radius-12) border px-3 py-2',
            modern
              ? outbound
                ? 'rounded-br-(--radius-6) border-primary bg-primary text-primary-foreground'
                : 'rounded-bl-(--radius-6) border-line bg-card'
              : outbound
                ? 'border-accent-soft bg-accent-soft'
                : 'border-line-soft bg-card',
          )}
        >
          {author && (
            <p
              className={cn(
                'caption font-medium',
                modern && outbound ? 'text-primary-foreground' : 'text-ink-soft',
              )}
            >
              {author}
            </p>
          )}
          {message.quote && (
            <QuoteBlock quote={message.quote} quoted={quoted} onPrimary={modern && outbound} />
          )}
          <MessageMedia message={message} />
          {message.type === 'media_unavailable' && (
            <p className="italic text-ink-soft">Arquivo não pôde ser baixado</p>
          )}
          {message.type === 'unsupported' ? (
            <p className="italic text-ink-soft">Tipo de mensagem não suportado</p>
          ) : (
            message.body && (
              <p className="whitespace-pre-wrap break-words">
                {prefix ? (
                  <>
                    <strong>{prefix[1]}</strong>
                    {message.body.slice(prefix[0].length) &&
                      `\n${message.body.slice(prefix[0].length)}`}
                  </>
                ) : (
                  message.body
                )}
              </p>
            )
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={cn(
                'mono-num caption',
                modern && outbound
                  ? 'text-primary-foreground'
                  : modern
                    ? 'text-ink-soft'
                    : 'text-ink-faint',
              )}
            >
              {formatMessageTime(message.sentAt)}
            </span>
            {status &&
              (modern && outbound ? (
                <span className="caption font-medium text-primary-foreground">
                  · {status.label}
                </span>
              ) : (
                <Badge tone={status.tone}>{status.label}</Badge>
              ))}
          </div>
          {message.status === 'failed' && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {message.failureReason && (
                <span
                  className={cn(
                    'caption',
                    modern && outbound ? 'text-primary-foreground' : 'text-danger',
                  )}
                >
                  {message.failureReason}
                </span>
              )}
              {canRetry && message.origin === 'agent' && (
                <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
                  <RotateCw strokeWidth={1.7} aria-hidden />
                  Reenviar
                </Button>
              )}
            </div>
          )}
        </div>
        {onReact && canReactTo(message) && (
          <ReactButton current={message.reactions.sector?.emoji} onReact={onReact} />
        )}
        {onReply && canQuoteMessage(message) && <ReplyButton onReply={onReply} />}
      </div>
      <ReactionChips reactions={message.reactions} outbound={outbound} />
    </li>
  )
}

function Composer({
  ticketId,
  quoted,
  onCancelQuote,
  attachRef,
}: {
  ticketId: number
  // A área da conversa entrega o arquivo solto; fica null quando o campo não aceita (áudio).
  attachRef: MutableRefObject<((file: File) => void) | null>
  // A mensagem que a próxima resposta cita, escolhida no botão de responder.
  quoted: Message | null
  onCancelQuote: () => void
}) {
  const send = useSendMessage(ticketId)
  const recorder = useVoiceRecorder()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [voice, setVoice] = useState<Recording | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  // O mesmo identificador numa nova tentativa evita mensagem duplicada; muda
  // quando o conteúdo muda.
  const requestId = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const messageInput = useRef<HTMLTextAreaElement>(null)

  // Citar outra mensagem, ou cancelar a citação, muda a mensagem a enviar: um novo identificador de
  // envio. Ao citar, o foco vai para o campo, para escrever a resposta.
  const quotedId = quoted?.id
  useEffect(() => {
    requestId.current = null
    if (quotedId !== undefined) messageInput.current?.focus()
  }, [quotedId])

  const insertEmoji = (emoji: string) => {
    const input = messageInput.current
    if (!input) return
    const start = input.selectionStart
    const end = input.selectionEnd
    changeText(text.slice(0, start) + emoji + text.slice(end))
    requestAnimationFrame(() => {
      input.focus()
      input.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

  const changeText = (value: string) => {
    requestId.current = null
    setText(value)
  }

  // A mesma regra para o botão de anexo, a colagem e o soltar.
  const attachFile = (chosen: File) => {
    requestId.current = null
    if (chosen.size > maxFileSize) {
      setFileError('O arquivo passa de 16 MB. Escolha um arquivo menor.')
      return
    }
    setFileError(null)
    setFile(chosen)
  }

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null
    event.target.value = ''
    if (chosen) attachFile(chosen)
  }

  // Com gravação em andamento ou pronta, colar e soltar não fazem nada.
  const accepts = !recorder.recording && !voice
  useEffect(() => {
    attachRef.current = accepts ? attachFile : null
  })

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.files[0]
    if (!pasted) return // só texto: cola normalmente
    event.preventDefault()
    attachFile(pasted)
  }

  const changeVoice = (recording: Recording | null) => {
    requestId.current = null
    if (voice) {
      URL.revokeObjectURL(voice.url)
    }
    setVoice(recording)
  }

  const finishRecording = async () => {
    const recording = await recorder.stop()
    if (recording && recording.blob.size > maxFileSize) {
      URL.revokeObjectURL(recording.url)
      recorder.setError('O áudio passa de 16 MB. Grave um áudio mais curto.')
      return
    }
    changeVoice(recording)
  }

  const submit = () => {
    const body = text.trim()
    if ((!body && !file && !voice) || send.isPending) {
      return
    }
    requestId.current ??= newRequestId()
    const quotedMessageId = quoted?.id
    send.mutate(
      voice
        ? { requestId: requestId.current, body: '', file: null, voice: voice.blob, quotedMessageId }
        : { requestId: requestId.current, body, file, quotedMessageId },
      {
        onSuccess: () => {
          requestId.current = null
          onCancelQuote()
          if (voice) {
            changeVoice(null)
          } else {
            setText('')
            setFile(null)
          }
        },
      },
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const error = fileError ?? recorder.error ?? send.error?.message

  return (
    <div className="flex flex-col gap-2 border-t border-line-soft p-3">
      {error && (
        <Alert variant="warning">
          <CircleAlert strokeWidth={1.7} aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {quoted && <DraftQuote message={quoted} onCancel={onCancelQuote} />}
      {file && !voice && (
        <div className="flex items-center gap-2 self-start rounded-(--radius-7) border border-line-soft bg-card px-2.5 py-1.5">
          <Paperclip strokeWidth={1.7} className="size-[15px]" aria-hidden />
          <span className="max-w-[240px] truncate">{file.name}</span>
          <span className="mono-num caption text-ink-faint">{formatFileSize(file.size)}</span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remover arquivo"
            onClick={() => {
              requestId.current = null
              setFile(null)
            }}
          >
            <X strokeWidth={1.7} aria-hidden />
          </Button>
        </div>
      )}
      {recorder.recording ? (
        <div role="status" aria-label="Gravação de áudio" className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-danger" aria-hidden />
          <span className="flex-1">
            Gravando{' '}
            <span className="mono-num text-ink-soft">{formatDuration(recorder.elapsed)}</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancelar gravação"
            onClick={recorder.cancel}
          >
            <Trash2 strokeWidth={1.7} aria-hidden />
          </Button>
          <Button size="icon" aria-label="Concluir gravação" onClick={finishRecording}>
            <Check strokeWidth={1.7} aria-hidden />
          </Button>
        </div>
      ) : voice ? (
        <div className="flex items-center gap-2">
          <AudioPlayer
            src={voice.url}
            label="Áudio gravado"
            durationSeconds={voice.seconds}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Descartar áudio"
            disabled={send.isPending}
            onClick={() => changeVoice(null)}
          >
            <Trash2 strokeWidth={1.7} aria-hidden />
          </Button>
          <Button size="icon" aria-label="Enviar áudio" disabled={send.isPending} onClick={submit}>
            <SendHorizontal strokeWidth={1.7} aria-hidden />
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            aria-label="Arquivo para enviar"
            onChange={chooseFile}
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Anexar arquivo"
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip strokeWidth={1.7} aria-hidden />
          </Button>
          <EmojiPicker onSelect={insertEmoji} returnFocus={messageInput} />
          <Textarea
            ref={messageInput}
            aria-label={file ? 'Legenda do arquivo' : 'Mensagem'}
            placeholder={file ? 'Legenda (opcional)' : 'Escreva a mensagem'}
            rows={1}
            className="max-h-40 min-h-9"
            value={text}
            onChange={(event) => changeText(event.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          {!text.trim() && !file ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Gravar áudio"
              onClick={() => {
                setFileError(null)
                send.reset()
                void recorder.start()
              }}
            >
              <Mic strokeWidth={1.7} aria-hidden />
            </Button>
          ) : (
            <Button
              size="icon"
              aria-label="Enviar mensagem"
              disabled={send.isPending}
              onClick={submit}
            >
              <SendHorizontal strokeWidth={1.7} aria-hidden />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Destaque da área enquanto um arquivo é arrastado sobre ela.
function DropOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-50 rounded-[inherit] bg-accent-soft p-2"
    >
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-(--radius-8) border-2 border-dashed border-primary text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Paperclip strokeWidth={1.7} className="size-6" aria-hidden />
        </span>
        <p className="title-drawer text-accent-strong">Solte para anexar</p>
        <p className="caption text-ink-soft">Um arquivo por vez, até 16 MB.</p>
      </div>
    </div>
  )
}

export function ConversationCard({
  ticket,
  user,
  onRegister,
  modern = false,
  className,
}: {
  ticket: TicketDetail
  user: User
  onRegister: () => void
  modern?: boolean
  // A tela Chamados define a altura do cartão; a ficha do chamado segue com a própria.
  className?: string
}) {
  const { data: messages = [] } = useMessages(ticket.id)
  const { data: logs = [] } = useAssignments(ticket.id)
  const retry = useRetryMessage(ticket.id)
  const react = useReactToMessage(ticket.id)
  const list = useRef<HTMLDivElement>(null)
  const canReply = conducts(ticket, user)
  // A citação em preparo é deste chamado: trocar de chamado a descarta, e perder o direito de
  // responder (transferência, encerramento) também.
  const [quoting, setQuoting] = useState<number | null>(null)
  const [quotingTicketId, setQuotingTicketId] = useState(ticket.id)
  if (quotingTicketId !== ticket.id) {
    setQuotingTicketId(ticket.id)
    setQuoting(null)
  }
  // Sem direito de responder, a citação em preparo é descartada de vez: ao reassumir, o campo volta limpo.
  if (!canReply && quoting !== null) setQuoting(null)
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])
  const quotedDraft = canReply && quoting !== null ? (byId.get(quoting) ?? null) : null

  // Arrastar e soltar na área inteira da conversa.
  const attach = useRef<((file: File) => void) | null>(null)
  const depth = useRef(0)
  const [dragging, setDragging] = useState(false)
  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files')
  // O cartão sempre cancela o soltar, para o navegador não abrir o arquivo na aba. Destaque e
  // anexo só valem com `canReply` e o campo aceitando (sem gravação nem áudio pronto).
  const accepting = () => canReply && attach.current !== null
  const dropProps = {
    onDragEnter: (event: DragEvent) => {
      if (!hasFiles(event) || !accepting()) return
      event.preventDefault()
      depth.current += 1
      setDragging(true)
    },
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault() // o navegador não abre o arquivo na aba
      event.dataTransfer.dropEffect = accepting() ? 'copy' : 'none'
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    },
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth.current = 0
      setDragging(false)
      const dropped = event.dataTransfer.files[0] // vários: só o primeiro
      if (dropped && accepting()) attach.current?.(dropped)
    },
  }

  // Mostra sempre a mensagem mais recente.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length, logs.length])

  let notice: string | null = null
  if (ticket.status === 'closed') {
    notice = ticket.closureType === 'cancelled' ? 'Chamado cancelado.' : 'Chamado encerrado.'
  } else if (!ticket.assignee) {
    notice = ticket.previous
      ? `Transferido de ${ticket.previous.sectorName}. Assuma o chamado e envie a primeira mensagem ao cliente.`
      : 'Chamado na fila. Assuma o chamado para responder.'
  } else if (!canReply) {
    notice = `Chamado com ${ticket.assignee.name}. Peça a transferência para responder.`
  }

  return (
    <Card
      role="region"
      aria-label="Conversa"
      className={cn('relative h-[70dvh] lg:h-[calc(100dvh-150px-var(--header-height))]', className)}
      {...dropProps}
    >
      {canReply && dragging && <DropOverlay />}
      {needsRegistration(ticket) && (
        <div className="border-b border-line-soft p-3">
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription className="flex flex-col items-start gap-2">
              Contato não cadastrado. Cadastre o contato e vincule-o a um órgão antes de encerrar.
              <Button variant="outline" size="sm" onClick={onRegister}>
                Cadastrar contato
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
      <div
        ref={list}
        className={cn(
          'flex-1 overflow-y-auto px-4 py-4',
          modern && 'border-y border-line-soft bg-background [[data-contrast=high]_&]:bg-muted',
        )}
      >
        {messages.length > 0 || logs.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {timeline(messages, logs).map((item) =>
              item.kind === 'message' ? (
                <MessageBubble
                  key={`message-${item.message.id}`}
                  message={item.message}
                  quoted={quotedOf(item.message, byId)}
                  modern={modern}
                  canRetry={canReply}
                  retrying={retry.isPending}
                  onRetry={() => retry.mutate(item.message.id)}
                  onReact={
                    canReply
                      ? (emoji) => react.mutate({ messageId: item.message.id, emoji, actor: user })
                      : undefined
                  }
                  onReply={canReply ? () => setQuoting(item.message.id) : undefined}
                />
              ) : (
                <AssignmentEntry key={`log-${item.log.id}`} log={item.log} modern={modern} />
              ),
            )}
          </ol>
        ) : (
          <Empty>
            <EmptyMedia>
              <MessagesSquare strokeWidth={1.7} aria-hidden />
            </EmptyMedia>
            <EmptyDescription>Nenhuma mensagem.</EmptyDescription>
          </Empty>
        )}
      </div>
      {retry.error && (
        <div className="px-3 pb-2">
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{retry.error.message}</AlertDescription>
          </Alert>
        </div>
      )}
      {canReply ? (
        <Composer
          ticketId={ticket.id}
          attachRef={attach}
          quoted={quotedDraft}
          onCancelQuote={() => setQuoting(null)}
        />
      ) : (
        notice && (
          <div className="border-t border-line-soft p-3">
            <Alert variant="warning">
              <CircleAlert strokeWidth={1.7} aria-hidden />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          </div>
        )
      )}
    </Card>
  )
}

type ShownField = Exclude<CorrectionChange['field'], 'spoke_with'>

const correctionFields: Record<ShownField, string> = {
  subject: 'Assunto',
  resolution: 'Resolução',
  organization: 'Órgão',
  modules: 'Módulos',
  started_at: 'Início',
  ended_at: 'Fim',
}

type ShownChange = CorrectionChange & { field: ShownField }

function isShown(change: CorrectionChange): change is ShownChange {
  return change.field !== 'spoke_with'
}

function correctionValue(field: ShownField, value: CorrectionChange['from']) {
  if (value === null || value.length === 0) {
    return 'Não informado'
  }
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return field === 'started_at' || field === 'ended_at' ? formatDateTime(value) : value
}

// Histórico de alterações do atendimento encerrado: autor, data, motivo e
// valores anteriores e novos de cada campo corrigido.
// As mudanças de "Falou com" de correções antigas não aparecem, e a correção que
// só mudou isso sai da lista (a API as devolve até a migração que apaga esses dados).
function CorrectionHistory({ corrections: all }: { corrections: Correction[] }) {
  const corrections = all
    .map((c) => ({ ...c, changes: c.changes.filter(isShown) }))
    .filter((c) => c.changes.length > 0)
  return (
    <section>
      <h3 className="overline text-ink-soft">Histórico de alterações</h3>
      {corrections.length === 0 ? (
        <p className="caption text-ink-faint">Nenhuma correção.</p>
      ) : (
        <ol aria-label="Histórico de alterações" className="mt-1 flex flex-col gap-2">
          {corrections.map((correction) => (
            <li
              key={correction.id}
              className="rounded-(--radius-7) border border-line-soft bg-card px-3 py-2"
            >
              <p className="caption text-ink-faint">
                {correction.actor?.name ?? 'Sistema'} ·{' '}
                <span className="mono-num">{formatDateTime(correction.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap break-words">Motivo: {correction.reason}</p>
              <dl className="mt-1 flex flex-col gap-1">
                {correction.changes.map((change) => (
                  <div key={change.field}>
                    <dt className="label text-ink-soft">{correctionFields[change.field]}</dt>
                    <dd className="caption break-words">
                      <span className="text-ink-faint line-through">
                        {correctionValue(change.field, change.from)}
                      </span>{' '}
                      → {correctionValue(change.field, change.to)}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function DetailsTab({ ticket }: { ticket: TicketDetail }) {
  const status = ticketStatusLabel(ticket.status, ticket.closureType)
  const cancelled = ticket.closureType === 'cancelled'
  // O cancelado não lança o atendimento: não tem formulário de encerramento nem correções.
  const closed = ticket.status === 'closed' && !cancelled
  const { data: modules = [] } = useTicketModules(ticket.id, closed)
  const { data: corrections } = useCorrections(ticket.id, closed)
  const row = (label: string, value: ReactNode) => (
    <div>
      <dt className="label text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
  return (
    <dl className="flex flex-col gap-3">
      {(ticket.previous || ticket.next) && <TransferChain ticket={ticket} />}
      {row('Protocolo', <span className="mono-num">{ticket.protocol}</span>)}
      {row('Situação', <Badge tone={status.tone}>{status.label}</Badge>)}
      {row('Setor', ticket.sector.name)}
      {row(
        'Contato',
        <>
          {ticket.contact.name}
          <span className="mono-num block caption text-ink-faint">
            {ticket.contact.phone ? formatPhone(ticket.contact.phone) : 'Sem telefone'}
          </span>
        </>,
      )}
      {row(
        'Órgão',
        ticket.organization
          ? organizationLabel(ticket.organization.name, ticket.organization.municipality.name)
          : 'Não cadastrado',
      )}
      {row('Responsável', ticket.assignee?.name ?? 'Sem responsável')}
      {row('Chegada', <span className="mono-num">{formatDateTime(ticket.arrivedAt)}</span>)}
      {ticket.assignedAt &&
        row('Assumido em', <span className="mono-num">{formatDateTime(ticket.assignedAt)}</span>)}
      {ticket.closedAt &&
        row(
          cancelled ? 'Cancelado em' : 'Encerrado em',
          <span className="mono-num">{formatDateTime(ticket.closedAt)}</span>,
        )}
      {closed && (
        <>
          {row('Assunto', ticket.subject)}
          {row(
            'Resolução',
            <span className="whitespace-pre-wrap break-words">{ticket.resolution}</span>,
          )}
          {row(
            'Módulos',
            <span className="flex flex-wrap gap-1">
              {modules.map((module) => (
                <Badge key={module.id} variant="tag">
                  {module.name}
                </Badge>
              ))}
            </span>,
          )}
          {row('Início', <span className="mono-num">{formatDateTime(ticket.startedAt)}</span>)}
          {ticket.endedAt &&
            row('Fim', <span className="mono-num">{formatDateTime(ticket.endedAt)}</span>)}
        </>
      )}
      {corrections && <CorrectionHistory corrections={corrections} />}
    </dl>
  )
}

function HistoryTab({ ticket }: { ticket: TicketDetail }) {
  const contact = useContactHistory(ticket.contact.id)
  const organization = useOrganizationHistory(ticket.organization?.id)
  const history = useHistoryTarget()
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="overline text-ink-soft">Do contato</h3>
        <TicketHistoryList
          label="Chamados do contato"
          entries={contact.data?.items.slice(0, 5)}
          currentTicketId={ticket.id}
        />
        {contact.data && contact.data.total > 5 && (
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={() =>
              history.open({ kind: 'contact', id: ticket.contact.id, name: ticket.contact.name })
            }
          >
            <History strokeWidth={1.7} aria-hidden />
            Ver os {contact.data.total} chamados
          </Button>
        )}
      </section>
      {ticket.organization && (
        <section>
          <h3 className="overline text-ink-soft">Do órgão</h3>
          <TicketHistoryList
            label="Chamados do órgão"
            entries={organization.data?.items.slice(0, 5)}
            currentTicketId={ticket.id}
          />
          {organization.data && organization.data.total > 5 && (
            <Button
              variant="outline"
              className="mt-2 w-full"
              onClick={() =>
                history.open({
                  kind: 'organization',
                  id: ticket.organization!.id,
                  name: organizationLabel(
                    ticket.organization!.name,
                    ticket.organization!.municipality.name,
                  ),
                })
              }
            >
              <History strokeWidth={1.7} aria-hidden />
              Ver os {organization.data.total} chamados
            </Button>
          )}
        </section>
      )}
      <HistorySheet target={history.target} onClose={history.close} currentTicketId={ticket.id} />
    </div>
  )
}

// Cadeia de transferências entre setores, no topo de Detalhes: a origem abre em /atendimentos/:id
// (só leitura), este atendimento e o destino, que só mostra setor e protocolo.
function TransferChain({ ticket }: { ticket: TicketDetail }) {
  const { previous, next } = ticket
  const step = (children: ReactNode, current = false) => (
    <li className="relative pb-3 last:pb-0">
      <span
        aria-hidden
        className={cn(
          'absolute top-1.5 -left-4.5 size-2.5 rounded-full border-2',
          current ? 'border-primary bg-primary' : 'border-line bg-card',
        )}
      />
      {children}
    </li>
  )
  return (
    <section aria-label="Cadeia de transferências">
      <h3 className="overline text-ink-soft">Transferências</h3>
      <ol className="mt-2 flex flex-col border-l border-line-soft pl-3">
        {previous &&
          step(
            <section aria-label="Chamado anterior" className="flex flex-col gap-0.5">
              <p>
                {previous.sectorName} · <span className="mono-num">{previous.protocol}</span>
              </p>
              <p className="caption text-ink-faint">
                Origem
                {previous.closedByName && ` · transferido por ${previous.closedByName}`}
              </p>
              {previous.reason && (
                <p className="caption whitespace-pre-wrap break-words">
                  <span className="text-ink-soft">Motivo: </span>
                  {previous.reason}
                </p>
              )}
              {previous.subject && (
                <p className="caption">
                  <span className="text-ink-soft">Assunto: </span>
                  {previous.subject}
                </p>
              )}
              {previous.resolution && (
                <p className="caption whitespace-pre-wrap break-words">
                  <span className="text-ink-soft">Resolução: </span>
                  {previous.resolution}
                </p>
              )}
              <Link
                to={`/atendimentos/${previous.id}`}
                className="caption text-primary hover:underline"
              >
                Ver chamado anterior
              </Link>
            </section>,
          )}
        {step(
          <p>
            {ticket.sector.name} · <span className="mono-num">{ticket.protocol}</span>
            <span className="caption block text-ink-faint">Este atendimento</span>
          </p>,
          true,
        )}
        {next &&
          step(
            <p>
              {next.sectorName} · <span className="mono-num">{next.protocol}</span>
              <span className="caption block text-ink-faint">
                Destino · chamado novo neste setor
              </span>
            </p>,
          )}
      </ol>
    </section>
  )
}

// Como o atendimento terminou, para o rodapé da conversa só leitura.
function readOnlyNote(ticket: TicketDetail) {
  const at = ticket.closedAt ? formatDateTime(ticket.closedAt) : ''
  const by = ticket.closedBy ? ` por ${ticket.closedBy.name}` : ''
  if (ticket.closureType === 'cancelled') {
    return `Cancelado em ${at}${by}.`
  }
  if (ticket.closureType === 'transferred') {
    return `Transferido para ${ticket.next?.sectorName ?? 'outro setor'} em ${at}${by}.`
  }
  return `Encerrado em ${at}${by}.`
}

// Na conversa só de leitura, soltar um arquivo não faz nada, mas o navegador não pode abri-lo na aba.
const ignoreFileDrop = {
  onDragOver: (event: DragEvent) => {
    if (!event.dataTransfer.types.includes('Files')) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'none'
  },
  onDrop: (event: DragEvent) => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault()
  },
}

// A conversa completa, só para leitura: sem campo de mensagem, áudio, anexo nem Reenviar, com os
// avisos de sistema e de correção na ordem do tempo. A tela Chamados segue com a ConversationCard.
function ReadOnlyConversation({ ticket }: { ticket: TicketDetail }) {
  const { data: messages = [] } = useMessages(ticket.id)
  const { data: logs = [] } = useAssignments(ticket.id)
  const list = useRef<HTMLDivElement>(null)
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  // Abre no fim: o desfecho e as correções ficam à vista.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length, logs.length])

  return (
    <Card
      role="region"
      aria-label="Conversa"
      className="h-[70dvh] lg:h-[calc(100dvh-150px-var(--header-height))]"
      {...ignoreFileDrop}
    >
      <div ref={list} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length > 0 || logs.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {timeline(messages, logs).map((item) =>
              item.kind === 'message' ? (
                <MessageBubble
                  key={`message-${item.message.id}`}
                  message={item.message}
                  quoted={quotedOf(item.message, byId)}
                  canRetry={false}
                  retrying={false}
                  onRetry={() => {}}
                />
              ) : (
                <AssignmentEntry key={`log-${item.log.id}`} log={item.log} />
              ),
            )}
          </ol>
        ) : (
          <Empty>
            <EmptyMedia>
              <MessagesSquare strokeWidth={1.7} aria-hidden />
            </EmptyMedia>
            <EmptyDescription>Nenhuma mensagem.</EmptyDescription>
          </Empty>
        )}
      </div>
      <div
        role="status"
        aria-label="Só leitura"
        className="caption flex items-center gap-2 border-t border-line-soft bg-muted px-4 py-3 text-ink-soft"
      >
        <Lock strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
        <span>
          <span className="font-medium text-foreground">Só leitura.</span> {readOnlyNote(ticket)}
        </span>
      </div>
    </Card>
  )
}

export default function TicketPage() {
  const location = useLocation()
  const origin = location.state as Partial<HistoryReturnState> | null
  const back = origin?.historyReturn
    ? { to: origin.historyReturn, label: 'Voltar ao histórico', state: origin.historyBefore }
    : backToList
  const param = useParams().ticketId
  const validId = parseTicketId(param) !== null
  const ticketId = Number(param)
  const { data: user } = useCurrentUser()
  const { data: ticket, error } = useTicket(ticketId, validId)
  const [correcting, setCorrecting] = useState(false)
  const { data: recordedModules } = useTicketModules(ticketId, ticket?.status === 'closed')
  const [view, setView] = useTicketView(ticketId)

  // Esta tela é só de chamado encerrado: id inválido, inexistente (404) ou ainda ativo é Não
  // encontrado. O 403 e os erros de rede ou do servidor seguem com o erro de hoje. A decisão fica
  // aqui dentro, sem trocar de componente, para a tela não desmontar enquanto a consulta recarrega.
  if (!validId || isNotFound(error) || (ticket && ticket.status !== 'closed')) {
    return <NotFoundPage />
  }
  if (error) {
    return (
      <>
        <Topbar back={back} breadcrumb="Atendimentos" title="Chamado" />
        <div className="px-4 py-4 md:px-[30px] md:py-[30px]">
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      </>
    )
  }
  if (!ticket || !user) {
    return null
  }

  // Na ficha só existem Detalhes e Histórico (a aba Assuntos não existe aqui).
  const tab =
    new URLSearchParams(location.search).has('historico') || view.tab === 'history'
      ? 'history'
      : 'details'

  return (
    <>
      <Topbar
        back={back}
        breadcrumb={`${ticket.sector.name} · ${ticket.protocol}`}
        title={ticket.contact.name}
        action={
          // Única ação da ficha, visível e sem menu ⋯; nunca em chamado cancelado ou transferido.
          canCorrect(ticket, user) && (
            <Button onClick={() => setCorrecting(true)}>
              <PencilLine strokeWidth={1.7} aria-hidden />
              Corrigir
            </Button>
          )
        }
      />
      {/* Montado só aberto: começa com os dados atuais do atendimento. */}
      {correcting && recordedModules && (
        <CorrectionSheet ticket={ticket} recorded={recordedModules} onOpenChange={setCorrecting} />
      )}
      {/* A tela de conversas usa a largura toda (design.md). */}
      <div className="grid w-full items-start gap-4 px-4 py-4 md:px-[30px] md:py-[30px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <ReadOnlyConversation ticket={ticket} />
        <Card role="region" aria-labelledby="ticket-info-title">
          <CardHeader>
            <CardTitle id="ticket-info-title">Atendimento</CardTitle>
          </CardHeader>
          <Tabs
            value={tab}
            onValueChange={(next) => setView({ tab: String(next) })}
            className="min-h-0 flex-1 px-5 pb-5"
          >
            <TabsList>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <DetailsTab ticket={ticket} />
            </TabsContent>
            <TabsContent value="history">
              <HistoryTab ticket={ticket} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </>
  )
}
