import {
  ArrowDown,
  ArrowRightLeft,
  Ban,
  Check,
  CircleAlert,
  CircleCheck,
  CirclePause,
  CirclePlay,
  Contact,
  FileText,
  History,
  Lock,
  Merge,
  MessagesSquare,
  Mic,
  Paperclip,
  PencilLine,
  Phone,
  RotateCw,
  SendHorizontal,
  Trash2,
  Undo2,
  UserRoundCog,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type MutableRefObject,
  type KeyboardEvent,
  type ReactNode,
  type TouchEvent,
  type WheelEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { AudioPlayer } from '@/components/AudioPlayer'
import { ContactCards } from '@/components/ContactCards'
import { EmojiPicker } from '@/components/EmojiPicker'
import { DeleteMessageDialog, MessageMenu } from '@/components/MessageActions'
import { MessageChangesDialog } from '@/components/MessageChanges'
import { MessageEditor } from '@/components/MessageEditor'
import { MergedIntoLink } from '@/components/MergedIntoLink'
import { DraftQuote, QuoteBlock, ReplyButton } from '@/components/MessageQuote'
import { ReactButton, ReactionChips } from '@/components/MessageReactions'
import { CorrectionSheet } from '@/components/CorrectionSheet'
import { SendContactDialog } from '@/components/SendContactDialog'
import { HistorySheet, TicketHistoryList, useHistoryTarget } from '@/components/TicketHistory'
import { PhoneTag } from '@/components/TicketChannel'
import type { HistoryReturnState } from '@/lib/history-return'
import { PhoneCopy } from '@/components/PhoneCopy'
import { Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  changesLabel,
  insertEmojiAtCursor,
  isHiddenByXet,
  messageChanges,
  messageChangesId,
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
  formatAverageTime,
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatMessageTime,
  formatTime,
  organizationLabel,
  ticketStatusLabel,
} from '@/lib/format'
import { isNotFound } from '@/lib/api'
import { clearDraft, readDraft, saveDraft } from '@/lib/message-draft'
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

// Distância em pixels do fim que ainda conta como "estar no fim" da conversa: arredondamento e
// zoom não podem fazer o botão de ir à última mensagem piscar.
const NEAR_END_PX = 48

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
// O pendente é só leitura: o cadastro fica para quem o retomar.
function needsRegistration(ticket: TicketDetail) {
  return ticket.status !== 'closed' && ticket.status !== 'pending' && !ticket.contact.registered
}

// Só o responsável conduz a conversa, com o chamado em atendimento; o backend confere de novo.
function conducts(ticket: TicketDetail, user: User) {
  return ticket.status === 'in_progress' && ticket.assignee?.id === user.id
}

// Só o responsável pelo chamado em atendimento o coloca como pendente (spec #332).
export function canMarkPending(ticket: TicketDetail, user: User) {
  return conducts(ticket, user)
}

// O responsável pelo chamado em atendimento retoma um pendente do contato, pela janela. Na fila
// só o aviso aparece: a ação exige assumir antes, e o backend recusa (spec #332).
export function canResumePending(ticket: TicketDetail, user: User) {
  return conducts(ticket, user) && (ticket.pendingTickets?.length ?? 0) > 0
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

// Retoma o pendente quem é do setor dele (o administrador também). O backend confere de novo, e a
// tela não pode oferecer o Retomar a quem ele recusaria (spec #332).
export function canResume(ticket: TicketDetail, user: User) {
  return ticket.status === 'pending' && worksIn(ticket, user)
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
// cancelado, o transferido para outro setor e o mesclado num pendente não são
// corrigidos (closing.md, regra 14; spec #332, Mesclar em pendente).
export function canCorrect(ticket: TicketDetail, user: User) {
  return (
    ticket.status === 'closed' &&
    ticket.closureType !== 'cancelled' &&
    ticket.closureType !== 'transferred' &&
    ticket.closureType !== 'merged' &&
    worksIn(ticket, user) &&
    (ticket.closedBy?.id === user.id || user.role !== 'agent')
  )
}

// O que cada registro do chamado mostra na conversa: o ícone e o texto da ação. Fica num mapa só
// para uma ação nova mexer num lugar só, sem um segundo switch para o ícone.
const assignmentActions: Record<
  AssignmentLog['action'],
  { icon: LucideIcon; text: (log: AssignmentLog) => string }
> = {
  ticket_started: {
    icon: UserRoundCog,
    text: (log) => `${log.toName} abriu e assumiu o chamado`,
  },
  ticket_assigned: {
    icon: UserRoundCog,
    text: (log) => `${log.toName} assumiu o chamado`,
  },
  ticket_returned: {
    icon: Undo2,
    text: (log) =>
      log.actor?.name === log.fromName
        ? `${log.fromName} devolveu o chamado à fila`
        : `${log.actor?.name ?? 'Sistema'} devolveu à fila o chamado de ${log.fromName}`,
  },
  ticket_pending: {
    icon: CirclePause,
    text: (log) => `${log.actor?.name ?? 'Sistema'} colocou o chamado como pendente`,
  },
  ticket_resumed: {
    icon: CirclePlay,
    text: (log) => `${log.actor?.name ?? 'Sistema'} retomou o chamado`,
  },
  // A retomada a partir de um chamado novo nomeia o chamado mesclado, que a tela não abre (spec #332).
  ticket_resumed_by_merge: {
    icon: CirclePlay,
    text: (log) =>
      `${log.actor?.name ?? 'Sistema'} retomou este chamado a partir do ${log.mergedProtocol ?? 'chamado mesclado'}`,
  },
  // No chamado que foi mesclado, o destino aparece na própria ficha (spec #332, #339).
  ticket_merged: {
    icon: Merge,
    text: (log) => `${log.actor?.name ?? 'Sistema'} mesclou este chamado num pendente`,
  },
  ticket_closed: {
    icon: CircleCheck,
    text: (log) => `${log.actor?.name ?? 'Sistema'} encerrou o chamado`,
  },
  ticket_transferred_sector: {
    icon: ArrowRightLeft,
    text: (log) => {
      const who = log.actor?.name ?? 'Sistema'
      return log.fromSectorName
        ? `${who} transferiu o chamado do setor ${log.fromSectorName} para o setor ${log.toSectorName}`
        : `${who} transferiu o chamado para o setor ${log.toSectorName}`
    },
  },
  ticket_cancelled: {
    icon: Ban,
    text: (log) => `${log.actor?.name ?? 'Sistema'} cancelou o chamado`,
  },
  ticket_corrected: {
    icon: PencilLine,
    text: (log) => `${log.actor?.name ?? 'Sistema'} corrigiu o atendimento`,
  },
  ticket_transferred_user: {
    icon: UserRoundCog,
    text: (log) =>
      log.actor?.name === log.fromName
        ? `${log.fromName} transferiu o chamado para ${log.toName}`
        : `${log.actor?.name ?? 'Sistema'} transferiu o chamado de ${log.fromName} para ${log.toName}`,
  },
}

// Registro de responsável ou de encerramento entre as mensagens, na ordem do tempo.
function AssignmentEntry({ log, modern = false }: { log: AssignmentLog; modern?: boolean }) {
  const { icon: Icon, text } = assignmentActions[log.action]
  return (
    <li
      aria-label="Registro do chamado"
      className={cn(
        'caption flex items-start gap-1.5 self-center rounded-(--radius-7) border px-2.5 py-1 text-ink-soft',
        modern ? 'border-dashed border-line bg-transparent' : 'border-line-soft bg-muted',
      )}
    >
      <Icon strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      <span className="min-w-0">
        {text(log)} · <span className="mono-num">{formatMessageTime(log.createdAt)}</span>
        {(log.action === 'ticket_cancelled' ||
          log.action === 'ticket_pending' ||
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
  onEdit,
  onDelete,
  onShowChanges,
  hideDeleted = false,
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
  // Só o responsável edita e exclui, e só a mensagem enviada pelo XET; sem isto, não há menu.
  onEdit?: () => void
  onDelete?: () => void
  // Em Atendimentos, abre só para leitura as versões conhecidas e a exclusão da mensagem.
  onShowChanges?: () => void
  // Em Chamados, o conteúdo excluído pelo XET (para todos ou para mim) vira um aviso.
  hideDeleted?: boolean
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
  const hidden = hideDeleted && isHiddenByXet(message)
  // A mensagem enviada pelo XET tem o menu (⋯), com Responder dentro; as demais, o botão de responder.
  const hasMenu =
    !!onEdit && !!onDelete && !hidden && !message.deletion && message.origin === 'agent'
  const mutedTone = modern && outbound ? 'text-primary-foreground' : 'text-ink-soft'

  return (
    <li
      id={`message-${message.id}`}
      aria-label={outbound ? 'Mensagem enviada' : 'Mensagem recebida'}
      className={cn(
        // A largura máxima da mensagem (78% da conversa) fica só em --msg-max: a linha do balão,
        // abaixo, desfaz a mesma fração para chegar à largura da lista.
        'group/msg flex max-w-[calc(var(--msg-max)*100%)] flex-col gap-1 [--msg-max:0.78]',
        outbound ? 'items-end self-end' : 'items-start self-start',
      )}
    >
      {/* O balão com as ações pode passar da largura máxima da mensagem (o cartão de contato tem
          largura fixa), mas não da largura da conversa: 100%/--msg-max do item é a largura da
          lista. Numa janela estreita o balão encolhe, sem cobrir a coluna ao lado. */}
      <div
        className={cn(
          'flex max-w-[calc(100%/var(--msg-max))] items-center gap-1',
          outbound && 'flex-row-reverse',
        )}
      >
        <div
          data-slot="message-bubble"
          className={cn(
            'flex min-w-0 flex-col gap-1 rounded-(--radius-12) border',
            message.type === 'contact' && !hidden ? 'p-2' : 'px-3 py-2',
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
          {hidden && <p className={cn('italic', mutedTone)}>Mensagem excluída no XET</p>}
          {!hidden && message.quote && (
            <QuoteBlock
              quote={message.quote}
              quoted={quoted}
              onPrimary={modern && outbound}
              hideDeleted={hideDeleted}
            />
          )}
          {!hidden && <MessageMedia message={message} />}
          {!hidden && message.type === 'media_unavailable' && (
            <p className="italic text-ink-soft">Arquivo não pôde ser baixado</p>
          )}
          {hidden ? null : message.type === 'unsupported' ? (
            <p className="italic text-ink-soft">Tipo de mensagem não suportado</p>
          ) : message.type === 'contact' ? (
            // Cartão de contato: um balão por mensagem, com um cartão para cada contato recebido
            // de uma vez. Sem cartões, a mensagem cai no aviso de sempre.
            message.contactCards && message.contactCards.length > 0 ? (
              <ContactCards cards={message.contactCards} outbound={outbound} />
            ) : (
              <p className="italic text-ink-soft">Tipo de mensagem não suportado</p>
            )
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
            {onShowChanges && (
              <Button
                id={messageChangesId(message.id)}
                variant="ghost"
                size="sm"
                className="h-auto px-1 py-0 caption"
                onClick={onShowChanges}
              >
                <History strokeWidth={1.7} aria-hidden />
                {changesLabel(message)}
              </Button>
            )}
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
            {message.editedAt && !hidden && (
              <span className={cn('caption font-medium', mutedTone)}>· Editada</span>
            )}
            {message.deletion && !hidden && (
              <span className={cn('caption font-medium', mutedTone)}>· Excluída</span>
            )}
            {status &&
              (modern && outbound ? (
                <span className="caption font-medium text-primary-foreground">
                  · {status.label}
                </span>
              ) : (
                <Badge tone={status.tone}>{status.label}</Badge>
              ))}
          </div>
          {message.status === 'failed' && !message.deletion && (
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
        {onReact && !hidden && canReactTo(message) && (
          <ReactButton current={message.reactions.sector?.emoji} onReact={onReact} />
        )}
        {hasMenu ? (
          <MessageMenu
            message={message}
            onReply={onReply && canQuoteMessage(message) ? onReply : undefined}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ) : (
          onReply && !hidden && canQuoteMessage(message) && <ReplyButton onReply={onReply} />
        )}
      </div>
      {!hidden && <ReactionChips reactions={message.reactions} outbound={outbound} />}
    </li>
  )
}

function Composer({
  ticketId,
  userId,
  quoted,
  onCancelQuote,
  attachRef,
  editing,
  beginEditRef,
  onStartEditing,
  onStopEditing,
  onSent,
}: {
  ticketId: number
  userId: number
  // Avisa a área da conversa que a mensagem saiu daqui: ela sempre desce ao fim.
  onSent: () => void
  // A mensagem que o responsável está editando: o campo de edição toma o lugar do compositor, que
  // guarda o rascunho (texto, arquivo, áudio e citação) até a edição terminar.
  editing: Message | null
  // O menu da mensagem pede a edição por aqui, para o compositor guardar o rascunho antes.
  beginEditRef: MutableRefObject<((messageId: number) => void) | null>
  onStartEditing: (messageId: number) => void
  onStopEditing: () => void
  // A área da conversa entrega o arquivo solto; fica null quando o campo não aceita (áudio).
  attachRef: MutableRefObject<((file: File) => void) | null>
  // A mensagem que a próxima resposta cita, escolhida no botão de responder.
  quoted: Message | null
  onCancelQuote: () => void
}) {
  const send = useSendMessage()
  const recorder = useVoiceRecorder()
  // Limpar o erro do gravador na troca de chamado, com uma referência estável para as dependências.
  const clearRecorderError = recorder.setError
  // O texto digitado fica guardado no navegador, por usuário e por chamado, até o envio: fechar a
  // guia, recarregar ou trocar de chamado não perde o que estava escrito.
  const [text, setText] = useState(() => readDraft(userId, ticketId))
  const [textTicketId, setTextTicketId] = useState(ticketId)
  const [file, setFile] = useState<File | null>(null)
  const [voice, setVoice] = useState<Recording | null>(null)
  // O áudio anexado agora, para a troca de chamado liberar a URL fora do render.
  const voiceRef = useRef<Recording | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  // A janela "Enviar contato" aberta no menu do anexo.
  const [contactOpen, setContactOpen] = useState(false)
  // O mesmo identificador numa nova tentativa evita mensagem duplicada; muda
  // quando o conteúdo muda.
  const requestId = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const messageInput = useRef<HTMLTextAreaElement>(null)
  // O chamado aberto agora: a confirmação do envio pode chegar depois de a pessoa trocar de chamado.
  const shownTicketId = useRef(ticketId)
  useLayoutEffect(() => {
    shownTicketId.current = ticketId
  }, [ticketId])

  // Arquivo, áudio e erros do campo de mensagem são do chamado em que apareceram: ao trocar de
  // chamado saem da tela, senão o arquivo do chamado anterior iria para o cliente do chamado novo e
  // o aviso de erro de um apareceria no outro. O áudio tem a URL liberada aqui, fora do render. A
  // gravação em andamento é descartada junto, sem anexar ao chamado novo.
  const attachedTicketId = useRef(ticketId)
  useLayoutEffect(() => {
    if (attachedTicketId.current === ticketId) return
    attachedTicketId.current = ticketId
    setFile(null)
    setFileError(null)
    clearRecorderError(null)
    if (voiceRef.current) {
      URL.revokeObjectURL(voiceRef.current.url)
      voiceRef.current = null
    }
    setVoice(null)
    if (recorder.recording) recorder.cancel()
  }, [ticketId, recorder.recording, recorder.cancel, clearRecorderError])

  // Trocar de chamado sem sair da tela troca o texto pelo rascunho do chamado novo, e não mistura
  // o que foi escrito em cada um.
  if (textTicketId !== ticketId) {
    setTextTicketId(ticketId)
    setText(readDraft(userId, ticketId))
    requestId.current = null
  }

  // O rascunho volta com o cursor no fim do texto, pronto para continuar a frase.
  useEffect(() => {
    const input = messageInput.current
    if (input && input.value) {
      input.setSelectionRange(input.value.length, input.value.length)
    }
  }, [ticketId])

  // Citar outra mensagem, ou cancelar a citação, muda a mensagem a enviar: um novo identificador de
  // envio. Ao citar, o foco vai para o campo, para escrever a resposta.
  const quotedId = quoted?.id
  useEffect(() => {
    requestId.current = null
    if (quotedId !== undefined) messageInput.current?.focus()
  }, [quotedId])

  const insertEmoji = (emoji: string) =>
    insertEmojiAtCursor(messageInput.current, text, emoji, changeText)

  const changeText = (value: string) => {
    requestId.current = null
    setText(value)
    saveDraft(userId, ticketId, value)
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
  const accepts = !editing && !recorder.recording && !voice
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
    if (voiceRef.current) {
      URL.revokeObjectURL(voiceRef.current.url)
    }
    voiceRef.current = recording
    setVoice(recording)
  }

  const finishRecording = async () => {
    const at = ticketId
    const recording = await recorder.stop()
    // A gravação é do chamado em que começou. Na troca de chamado é o `cancel` do efeito acima que
    // solta o microfone e descarta o áudio; esta checagem cobre o áudio que fecha no mesmo instante
    // da troca, antes de o efeito rodar, para ele não ser anexado no chamado novo.
    if (shownTicketId.current !== at) {
      if (recording) URL.revokeObjectURL(recording.url)
      return
    }
    if (recording && recording.blob.size > maxFileSize) {
      URL.revokeObjectURL(recording.url)
      recorder.setError('O áudio passa de 16 MB. Grave um áudio mais curto.')
      return
    }
    changeVoice(recording)
  }

  // O foco volta ao campo de mensagem quando a edição termina.
  const editingId = editing?.id
  const wasEditing = useRef(false)
  useEffect(() => {
    if (editingId !== undefined) {
      wasEditing.current = true
    } else if (wasEditing.current) {
      wasEditing.current = false
      messageInput.current?.focus()
    }
  }, [editingId])

  // Ao fechar a janela "Enviar contato", o foco volta ao campo de mensagem, como ao terminar a
  // edição. A espera é pelo fechamento da janela, que devolve o foco ao fim dele.
  const wasContactOpen = useRef(false)
  useEffect(() => {
    if (contactOpen) {
      wasContactOpen.current = true
      return
    }
    if (!wasContactOpen.current) {
      return
    }
    wasContactOpen.current = false
    const frame = requestAnimationFrame(() => messageInput.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [contactOpen])

  // Entrar em edição com uma gravação em andamento a conclui, para o áudio ficar guardado como
  // rascunho em vez de se perder.
  useEffect(() => {
    beginEditRef.current = (messageId) => {
      if (recorder.recording) void finishRecording()
      onStartEditing(messageId)
    }
  })

  const submit = () => {
    const body = text.trim()
    if ((!body && !file && !voice) || send.isPending) {
      return
    }
    requestId.current ??= newRequestId()
    const quotedMessageId = quoted?.id
    // O rascunho do chamado sai já no envio, e não só na confirmação: sair do chamado e voltar
    // enquanto o servidor responde não pode trazer de volta o texto (nem a legenda) que já foi
    // enviado. Se o envio falhar, o texto volta a ser rascunho (regra no `useSendMessage`).
    clearDraft(userId, ticketId)
    // Mensagem enviada por aqui sempre desce ao fim, esteja a conversa onde estiver.
    onSent()
    send.mutate(
      voice
        ? {
            ticketId,
            userId,
            requestId: requestId.current,
            body: '',
            file: null,
            voice: voice.blob,
            quotedMessageId,
          }
        : { ticketId, userId, requestId: requestId.current, body, file, quotedMessageId },
      {
        onSuccess: () => {
          requestId.current = null
          // A pessoa trocou de chamado antes de o servidor confirmar: o campo agora é do chamado
          // novo, com o rascunho dele, e não pode ser limpo. O rascunho do enviado saiu no envio,
          // e o arquivo e o áudio dele saíram na troca.
          if (shownTicketId.current !== ticketId) return
          onCancelQuote()
          if (voice) {
            changeVoice(null)
          } else {
            // Enviar a mensagem limpa o campo daquele chamado.
            changeText('')
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

  // O erro de um envio fica ligado ao chamado em que ele foi feito: falhou o envio do chamado A
  // depois de a pessoa abrir o B, o aviso é do A e não aparece no B.
  const sendError = send.error && send.variables?.ticketId === ticketId ? send.error.message : null
  const error = fileError ?? recorder.error ?? sendError

  return (
    <div className="flex flex-col gap-2 border-t border-line-soft p-3">
      {error && !editing && (
        <Alert variant="warning">
          <CircleAlert strokeWidth={1.7} aria-hidden />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {editing ? (
        <MessageEditor
          key={editing.id}
          message={editing}
          ticketId={ticketId}
          hasDraft={!!(text.trim() || file || voice || recorder.recording || quoted)}
          onDone={onStopEditing}
        />
      ) : null}
      {!editing && quoted && <DraftQuote message={quoted} onCancel={onCancelQuote} />}
      {!editing && file && !voice && (
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
      {editing ? null : recorder.recording ? (
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
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="Anexar arquivo" />}
            >
              <Paperclip strokeWidth={1.7} aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" className="min-w-40">
              <DropdownMenuItem onClick={() => fileInput.current?.click()}>
                <Paperclip strokeWidth={1.7} aria-hidden />
                Arquivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setContactOpen(true)}>
                <Contact strokeWidth={1.7} aria-hidden />
                Contato
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      {contactOpen && (
        <SendContactDialog
          ticketId={ticketId}
          quotedMessageId={quoted?.id}
          onSent={() => {
            onCancelQuote()
            onSent()
          }}
          onClose={() => setContactOpen(false)}
        />
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
  onResumePending,
  modern = false,
  className,
}: {
  ticket: TicketDetail
  user: User
  onRegister: () => void
  // Abre a janela Retomar chamado, que escolhe um dos pendentes do contato (spec #332).
  onResumePending: () => void
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
  // O aviso de pendentes no contato vale para o chamado em atendimento e para o da fila, que só
  // avisa: retomar exige assumir antes (spec #332).
  const pendings = ticket.pendingTickets ?? []
  const showPendingNotice =
    (ticket.status === 'in_progress' || ticket.status === 'queued') && pendings.length > 0
  const canResumePendingNow = canResumePending(ticket, user)
  // Chamado que não está mais com o usuário (encerrado, transferido, cancelado, devolvido) não
  // mostra rascunho: o que estava guardado é descartado, para não voltar num chamado futuro.
  useEffect(() => {
    if (!canReply) {
      clearDraft(user.id, ticket.id)
    }
  }, [canReply, user.id, ticket.id])
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
  // A mensagem citada que o XET passou a ocultar (excluída para todos ou para mim, aqui ou em outra
  // sessão) sai da citação em preparo, para o conteúdo não ficar no compositor; o texto digitado fica.
  if (quotedDraft && isHiddenByXet(quotedDraft)) setQuoting(null)
  // A edição e a janela de exclusão são deste chamado, e só do responsável. Trocar de chamado, perder
  // o direito de responder ou a mensagem sair do alcance (excluída por outra via) as encerra; o que
  // vale é a confirmação do servidor.
  const [editingId, setEditingId] = useState<number | null>(null)
  const beginEdit = useRef<((messageId: number) => void) | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [changingTicketId, setChangingTicketId] = useState(ticket.id)
  if (changingTicketId !== ticket.id) {
    setChangingTicketId(ticket.id)
    setEditingId(null)
    setDeletingId(null)
  }
  const changeable = (id: number | null) => {
    const message = id === null || !canReply ? undefined : byId.get(id)
    return message && messageChanges(message) ? message : null
  }
  const editing = changeable(editingId)
  const deleting = changeable(deletingId)
  if (editingId !== null && !editing && messages.length > 0) setEditingId(null)
  if (deletingId !== null && !deleting && messages.length > 0) setDeletingId(null)

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

  // A conversa segue a mensagem mais recente enquanto a pessoa está no fim; rolada para cima, ela
  // fica onde está, e as mensagens que chegam contam no botão de ir ao fim (regra 44 de
  // conversation.md). "No fim" tem uma tolerância em pixels, para arredondamento e zoom não
  // fazerem o botão piscar. O contador é só da tela: não vai à API nem ao banco.
  const [following, setFollowing] = useState(true)
  const [missed, setMissed] = useState(0)
  // A intenção em ref: o observador de altura e o efeito das mensagens leem o valor atual sem
  // esperar o próximo render.
  const followingRef = useRef(true)
  const follow = (value: boolean) => {
    followingRef.current = value
    setFollowing(value)
  }
  // O maior id de mensagem já visto neste chamado: null até a primeira carga, que abre no fim.
  const seen = useRef<{ ticket: number; newest: number | null }>({
    ticket: ticket.id,
    newest: null,
  })
  // A rolagem do botão é suave: ele some já no clique, e os eventos de rolagem do meio do caminho
  // não são a pessoa saindo do fim, então não podem trazê-lo de volta nem contar a mensagem que
  // chegue enquanto a tela desce. Se a pessoa puxar a tela para cima no meio da descida, a
  // descida automática para: ela fica onde está, e a próxima mensagem conta no botão. O
  // temporizador é a rede de segurança, se a rolagem não chegar ao fim.
  const settling = useRef(false)
  const settleTimer = useRef<number | null>(null)
  // Último scrollTop visto: diz se o passo de rolagem foi para cima (a mão da pessoa) ou para
  // baixo (a descida automática).
  const lastTop = useRef(0)
  // Altura do conteúdo na última rolagem: com a altura parada, uma mudança de posição é a mão da
  // pessoa; com a altura mudando, é o layout que está assentando e não tira a conversa do fim.
  const scrollHeight = useRef(0)
  // A pessoa pediu para subir pela roda, pelo teclado ou pelo dedo: só isso tira a conversa do fim.
  const manualUp = useRef(false)
  // A primeira comparação parte do que a lista já mostra, e não de zero (posição e altura): sem
  // isso, o primeiro evento de rolagem veria a altura mudar e a posição subir sem ninguém ter
  // tocado na tela. Trocar de chamado semeia de novo.
  const seededTicket = useRef<number | null>(null)
  useLayoutEffect(() => {
    const element = list.current
    if (!element || seededTicket.current === ticket.id) return
    seededTicket.current = ticket.id
    lastTop.current = element.scrollTop
    scrollHeight.current = element.scrollHeight
  }, [ticket.id])
  const stopSettling = () => {
    settling.current = false
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = null
    }
  }
  const distanceToEnd = (element: HTMLElement) =>
    element.scrollHeight - element.scrollTop - element.clientHeight
  useEffect(() => stopSettling, [])
  const scrollToEnd = (smooth: boolean) => {
    const element = list.current
    if (!element) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    stopSettling()
    settling.current = smooth && !reducedMotion
    if (settling.current) {
      settleTimer.current = window.setTimeout(() => {
        stopSettling()
        const current = list.current
        if (current && distanceToEnd(current) > NEAR_END_PX) {
          follow(false)
        }
      }, 1000)
    }
    element.scrollTo({
      top: element.scrollHeight,
      behavior: settling.current ? 'smooth' : 'auto',
    })
  }
  // A roda, o teclado e o dedo são a mão da pessoa: para cima tiram a conversa do fim; para baixo
  // devolvem a decisão ao próprio fim.
  const onWheel = (event: WheelEvent) => {
    if (event.deltaY < 0) manualUp.current = true
    else if (event.deltaY > 0) manualUp.current = false
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Home') {
      manualUp.current = true
    } else if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === 'End') {
      manualUp.current = false
    }
  }
  const touchY = useRef<number | null>(null)
  const onTouchStart = (event: TouchEvent) => {
    touchY.current = event.touches[0]?.clientY ?? null
  }
  const onTouchMove = (event: TouchEvent) => {
    const y = event.touches[0]?.clientY
    if (y == null || touchY.current == null) return
    if (y > touchY.current + 2) manualUp.current = true
    else if (y < touchY.current - 2) manualUp.current = false
    touchY.current = y
  }
  // O botão aparece fora do fim, e o contador zera ao chegar nele por qualquer caminho.
  const onScroll = () => {
    const element = list.current
    if (!element) return
    const top = element.scrollTop
    const height = element.scrollHeight
    const distance = distanceToEnd(element)
    const movingUp = top < lastTop.current - 1
    const heightChanged = height !== scrollHeight.current
    lastTop.current = top
    scrollHeight.current = height
    const end = distance <= NEAR_END_PX
    if (settling.current && movingUp) {
      // Rolagem manual para cima no meio da descida: cancela a descida automática. A conversa
      // fica onde a pessoa a deixou e a mensagem que chegar agora conta no botão.
      stopSettling()
      follow(false)
      return
    }
    if (end) stopSettling()
    if (end || settling.current) {
      follow(true)
      setMissed(0)
    } else if (manualUp.current || !heightChanged) {
      // Fora do fim, pela mão da pessoa: a conversa fica onde está e o que chegar conta no botão.
      // Quando só o layout se ajusta (a altura muda junto), ela continua seguindo o fim.
      follow(false)
    }
  }
  // Uma mensagem nova: no fim, desce junto; fora do fim, fica onde está e conta. Edição, exclusão,
  // reação e mudança de situação de entrega não mudam o id da mensagem e não contam.
  useEffect(() => {
    const element = list.current
    const newest = messages.reduce((max, message) => Math.max(max, message.id), 0)
    if (seen.current.ticket !== ticket.id) {
      // Trocar de chamado abre no fim, sem botão e sem contador herdado.
      seen.current = { ticket: ticket.id, newest: null }
      follow(true)
      setMissed(0)
    }
    const before = seen.current.newest
    if (before === null) {
      // Primeira carga deste chamado: abre no fim, sem contar o que já estava lá.
      seen.current.newest = newest || null
      if (newest > 0) element?.scrollTo({ top: element.scrollHeight })
      return
    }
    seen.current.newest = newest
    if (newest <= before) return
    if (following) {
      element?.scrollTo({ top: element.scrollHeight })
    } else {
      setMissed((count) => count + messages.filter((message) => message.id > before).length)
    }
  }, [messages, ticket.id, following])
  // Avisos do sistema não contam, mas também não puxam a conversa para baixo; no fim, continuam
  // descendo junto com o resto.
  useEffect(() => {
    // Durante a descida suave do botão, o salto daqui cancelaria a animação e o temporizador de
    // segurança: a rolagem já está a caminho.
    if (following && !settling.current) list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [logs.length, following])
  // A altura do conteúdo muda sozinha depois de rolar (a largura e as fontes assentam, um aviso
  // entra): quem estava no fim continua no fim, e quem estava lendo mais acima fica onde está. Sem
  // isso, abrir o chamado podia deixar a última mensagem por baixo do fim.
  useEffect(() => {
    const element = list.current
    const content = element?.firstElementChild
    if (!element || !content) return
    const observer = new ResizeObserver(() => {
      // Quem está seguindo o fim continua no fim quando a altura assenta; quem saiu, pela mão da
      // pessoa, fica onde está e não é arrastado de volta.
      if (followingRef.current) {
        element.scrollTop = element.scrollHeight
        setMissed(0)
      }
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [ticket.id, messages.length, logs.length])

  let notice: string | null = null
  if (ticket.status === 'pending') {
    // O pendente é só leitura; a explicação fica no rodapé, com o Retomar no topo da tela.
    notice = null
  } else if (ticket.status === 'closed') {
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
      {showPendingNotice && (
        <div className="border-b border-line-soft p-3">
          <Alert variant="warning">
            <CirclePause strokeWidth={1.7} aria-hidden />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Este contato tem {pendings.length}{' '}
                {pendings.length === 1 ? 'chamado pendente' : 'chamados pendentes'}.
                {ticket.status === 'queued' && ' Assuma o chamado para retomar o pendente.'}
                {ticket.status === 'in_progress' &&
                  !canResumePendingNow &&
                  ' Só quem atende este chamado pode retomar o pendente.'}
              </span>
              {canResumePendingNow && (
                <Button variant="outline" size="sm" onClick={onResumePending}>
                  <CirclePlay strokeWidth={1.7} aria-hidden />
                  Retomar chamado
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
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
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={list}
          onScroll={onScroll}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
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
                        ? (emoji) =>
                            react.mutate({ messageId: item.message.id, emoji, actor: user })
                        : undefined
                    }
                    onReply={canReply ? () => setQuoting(item.message.id) : undefined}
                    onEdit={
                      canReply
                        ? () => (beginEdit.current ?? setEditingId)(item.message.id)
                        : undefined
                    }
                    onDelete={canReply ? () => setDeletingId(item.message.id) : undefined}
                    hideDeleted
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
        {!following && (
          // Por cima do último balão, sem cobrir o campo de mensagem (que fica fora desta área).
          <div className="pointer-events-none absolute right-4 bottom-4 z-10">
            <Button
              variant="outline"
              size="icon"
              aria-label={
                missed > 0
                  ? `Ir para a última mensagem, ${missed} ${missed === 1 ? 'nova' : 'novas'}`
                  : 'Ir para a última mensagem'
              }
              title="Ir para a última mensagem"
              onClick={() => {
                manualUp.current = false
                scrollToEnd(true)
                follow(true)
                setMissed(0)
              }}
              className="pointer-events-auto size-9 rounded-full border-line bg-card shadow-(--shadow) hover:border-ink-faint"
            >
              <ArrowDown strokeWidth={1.7} className="size-[17px]" aria-hidden />
              {missed > 0 && (
                <span
                  aria-hidden
                  className="mono-num absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card bg-primary px-1 text-[calc(10px*var(--text-scale))] leading-none font-medium text-primary-foreground"
                >
                  {missed > 99 ? '99+' : missed}
                </span>
              )}
            </Button>
          </div>
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
      {deleting && (
        <DeleteMessageDialog
          key={deleting.id}
          message={deleting}
          ticketId={ticket.id}
          onClose={() => setDeletingId(null)}
        />
      )}
      {canReply ? (
        <Composer
          ticketId={ticket.id}
          userId={user.id}
          attachRef={attach}
          quoted={quotedDraft && !isHiddenByXet(quotedDraft) ? quotedDraft : null}
          onCancelQuote={() => setQuoting(null)}
          editing={editing}
          beginEditRef={beginEdit}
          onStartEditing={setEditingId}
          onStopEditing={() => setEditingId(null)}
          onSent={() => {
            manualUp.current = false
            follow(true)
            setMissed(0)
            scrollToEnd(false)
          }}
        />
      ) : ticket.status === 'pending' ? (
        <div
          role="status"
          aria-label="Somente leitura"
          className="caption flex shrink-0 items-center gap-2 border-t border-line-soft px-4 py-3 text-ink-soft"
        >
          <Lock strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
          <span>Somente leitura. Retome o chamado para responder ao contato.</span>
        </div>
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
  // O cancelado e o mesclado não lançam o atendimento: não têm formulário de encerramento nem
  // correções, e o mesclado perde assunto, resolução e módulos para o chamado original (spec #332).
  const merged = ticket.closureType === 'merged'
  const closed = ticket.status === 'closed' && !cancelled && !merged
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
      {row('Canal', ticket.channel === 'phone' ? <PhoneTag /> : 'WhatsApp')}
      {row('Setor', ticket.sector.name)}
      {row(
        'Contato',
        <>
          {ticket.contact.name}
          <PhoneCopy phone={ticket.contact.phone} />
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
          cancelled ? 'Cancelado em' : merged ? 'Mesclado em' : 'Encerrado em',
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
  // A mensagem cujas versões e exclusão estão à vista: a janela fica montada só aberta.
  const [changesId, setChangesId] = useState<number | null>(null)
  const changed = changesId === null ? undefined : byId.get(changesId)

  // Abre no fim: o desfecho e as correções ficam à vista.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length, logs.length])

  return (
    <>
      <Card role="region" aria-label="Conversa" className="min-h-0" {...ignoreFileDrop}>
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
                    onShowChanges={
                      item.message.editedAt || item.message.deletion
                        ? () => setChangesId(item.message.id)
                        : undefined
                    }
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
      {changed && (
        <MessageChangesDialog
          key={changed.id}
          message={changed}
          ticketId={ticket.id}
          onClose={() => setChangesId(null)}
        />
      )}
    </>
  )
}

// O registro por telefone não tem conversa: no lugar dela, o aviso e a ligação, com
// quem registrou e quando no pé. Corrigir continua no topo, como nos outros encerrados.
function PhoneConversation({ ticket }: { ticket: TicketDetail }) {
  const callTime = ticket.startedAt ? formatTime(ticket.startedAt) : null
  const endTime = ticket.endedAt ? formatTime(ticket.endedAt) : null
  const seconds =
    ticket.startedAt && ticket.endedAt
      ? (new Date(ticket.endedAt).getTime() - new Date(ticket.startedAt).getTime()) / 1000
      : null
  const registeredBy = ticket.closedBy?.name ?? ticket.assignee?.name
  return (
    <Card role="region" aria-label="Atendimento por telefone" className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
        <Empty>
          <EmptyMedia>
            <Phone strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>
            <span className="body-strong block text-ink">
              Atendimento por telefone, sem conversa
            </span>
            {callTime && endTime
              ? `Ligação das ${callTime} às ${endTime}${
                  seconds !== null ? ` · ${formatAverageTime(seconds)}` : ''
                }.`
              : 'O registro fica nos Detalhes, ao lado.'}
          </EmptyDescription>
        </Empty>
      </div>
      {ticket.closedAt && (
        <div className="border-t border-line-soft px-4 py-3">
          <p className="caption text-ink-faint">
            Registrado{registeredBy ? ` por ${registeredBy}` : ''} em{' '}
            <span className="mono-num">{formatDateTime(ticket.closedAt)}</span>.
          </p>
        </div>
      )}
    </Card>
  )
}

// O mesclado num pendente não tem conversa própria: as mensagens foram para o chamado original,
// e a ficha só avisa disso e leva a ele (spec #332). O registro por telefone não tem mensagens:
// os dados do atendimento foram para o original, e o aviso aparece do mesmo jeito.
function MergedConversation({ ticket }: { ticket: TicketDetail }) {
  const mergedInto = ticket.mergedInto
  const byPhone = ticket.channel === 'phone'
  return (
    <Card role="region" aria-label="Conversa" className="flex min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
        <Empty>
          <EmptyMedia>
            <Merge strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>
            <span className="body-strong block text-ink">
              {byPhone ? 'Atendimento por telefone mesclado' : 'Chamado mesclado'}
            </span>
            {byPhone
              ? 'Os dados deste atendimento foram para o chamado original.'
              : 'As mensagens deste chamado foram para o chamado original.'}
            {mergedInto && <MergedIntoLink mergedInto={mergedInto} className="mt-1 block" />}
          </EmptyDescription>
        </Empty>
      </div>
      {ticket.closedAt && (
        <div
          role="status"
          aria-label="Só leitura"
          className="caption flex items-center gap-2 border-t border-line-soft bg-muted px-4 py-3 text-ink-soft"
        >
          <Lock strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
          <span>
            <span className="font-medium text-foreground">Só leitura.</span> Mesclado
            {ticket.closedBy ? ` por ${ticket.closedBy.name}` : ''} em{' '}
            <span className="mono-num">{formatDateTime(ticket.closedAt)}</span>:{' '}
            {byPhone
              ? 'os dados do atendimento foram para o chamado original.'
              : 'as mensagens foram para o chamado original.'}
          </span>
        </div>
      )}
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
    // A página tem a altura da janela e não rola: a conversa e a ficha rolam cada uma no seu painel.
    <div className="flex h-[calc(100dvh-var(--header-height)-var(--realtime-note-height,0px))] flex-col overflow-clip [&>header]:shrink-0">
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
      <div className="grid min-h-0 w-full flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,3fr)_minmax(0,2fr)] gap-4 px-4 py-4 md:px-[30px] md:py-[30px] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)]">
        {ticket.mergedInto ? (
          <MergedConversation ticket={ticket} />
        ) : ticket.channel === 'phone' ? (
          <PhoneConversation ticket={ticket} />
        ) : (
          <ReadOnlyConversation ticket={ticket} />
        )}
        <Card role="region" aria-labelledby="ticket-info-title" className="min-h-0">
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
            <TabsContent value="details" className="min-h-0 overflow-y-auto">
              <DetailsTab ticket={ticket} />
            </TabsContent>
            <TabsContent value="history" className="min-h-0 overflow-y-auto">
              <HistoryTab ticket={ticket} />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
