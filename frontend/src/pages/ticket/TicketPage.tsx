import {
  Check,
  CircleAlert,
  CircleCheck,
  FileText,
  MessagesSquare,
  Mic,
  Paperclip,
  RotateCw,
  SendHorizontal,
  StickyNote,
  Trash2,
  UserCheck,
  UserRoundCog,
  X,
} from 'lucide-react'
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'
import { ClosingSheet } from '@/components/ClosingSheet'
import { ConversationList } from '@/components/ConversationList'
import { TicketHistoryList } from '@/components/TicketHistory'
import { Topbar } from '@/components/Topbar'
import { TransferSheet } from '@/components/TransferSheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { type User, useCurrentUser } from '@/lib/auth'
import {
  type AssignmentLog,
  type Message,
  type MessageStatus,
  type TicketDetail,
  maxFileSize,
  newRequestId,
  useAddNote,
  useAssignFromTicket,
  useAssignments,
  useContactHistory,
  useMessages,
  useNotes,
  useOrganizationHistory,
  useRetryMessage,
  useSaveSpokeWith,
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
  ticketStatusLabels,
} from '@/lib/format'
import { type Recording, useVoiceRecorder } from '@/lib/recorder'

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

const fileLabels: Record<string, string> = {
  image: 'Imagem',
  video: 'Vídeo',
  audio: 'Áudio',
  document: 'Documento',
}

// Imagens e vídeos com pré-visualização e áudios com player na própria
// conversa; os demais arquivos abrem ou são baixados pelo link.
function MessageMedia({ message }: { message: Message }) {
  if (!message.media) {
    return null
  }
  const src = `/api/media/${message.media.id}`
  switch (message.type) {
    case 'image':
      return (
        <a href={src} target="_blank" rel="noopener" aria-label="Abrir imagem em tamanho real">
          <img
            src={src}
            alt="Imagem"
            loading="lazy"
            className="max-h-72 max-w-full rounded-(--radius-8) border border-line-soft bg-muted object-contain"
          />
        </a>
      )
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
        <div className="flex items-center gap-2">
          <audio
            src={src}
            controls
            preload="metadata"
            aria-label="Áudio"
            className="w-72 max-w-full"
          />
          {message.media.durationSeconds !== null && (
            <span className="mono-num caption text-ink-faint" aria-label="Duração do áudio">
              {formatDuration(message.media.durationSeconds)}
            </span>
          )}
        </div>
      )
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener"
      className="flex items-center gap-2 rounded-(--radius-7) border border-line-soft bg-card px-2.5 py-2 hover:border-primary"
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

// Só o responsável conduz a conversa, com o chamado aberto; o backend confere de novo.
function conducts(ticket: TicketDetail, user: User) {
  return ticket.status !== 'closed' && ticket.assignee?.id === user.id
}

// O responsável transfere o próprio chamado em atendimento; supervisão e
// administração transferem o de qualquer atendente (spec.md, Transferências).
function canTransfer(ticket: TicketDetail, user: User) {
  return ticket.status === 'in_progress' && (conducts(ticket, user) || user.role !== 'agent')
}

// Só o responsável encerra, como responde (spec.md, Formulário de encerramento).
function canClose(ticket: TicketDetail, user: User) {
  return ticket.status === 'in_progress' && conducts(ticket, user)
}

function assignmentText(log: AssignmentLog) {
  if (log.action === 'ticket_started') {
    return `${log.toName} iniciou a conversa e assumiu o chamado`
  }
  if (log.action === 'ticket_assigned') {
    return `${log.toName} assumiu o chamado`
  }
  if (log.action === 'ticket_closed') {
    return `${log.actor?.name ?? 'Sistema'} encerrou o chamado`
  }
  if (log.actor?.name === log.fromName) {
    return `${log.fromName} transferiu o chamado para ${log.toName}`
  }
  return `${log.actor?.name ?? 'Sistema'} transferiu o chamado de ${log.fromName} para ${log.toName}`
}

// Registro de responsável ou de encerramento entre as mensagens, na ordem do tempo.
function AssignmentEntry({ log }: { log: AssignmentLog }) {
  return (
    <li
      aria-label="Registro do chamado"
      className="caption flex items-center gap-1.5 self-center rounded-(--radius-7) border border-line-soft bg-muted px-2.5 py-1 text-ink-soft"
    >
      {log.action === 'ticket_closed' ? (
        <CircleCheck strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      ) : (
        <UserRoundCog strokeWidth={1.7} className="size-[15px] shrink-0" aria-hidden />
      )}
      <span>
        {assignmentText(log)} · <span className="mono-num">{formatMessageTime(log.createdAt)}</span>
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

function MessageBubble({
  message,
  canRetry,
  onRetry,
  retrying,
}: {
  message: Message
  canRetry: boolean
  onRetry: () => void
  retrying: boolean
}) {
  const outbound = message.direction === 'outbound'
  const status = message.status && outbound ? messageStatusLabels[message.status] : null
  const author =
    message.origin === 'phone' ? 'Enviada fora do sistema' : outbound ? message.author?.name : null

  return (
    <li
      aria-label={outbound ? 'Mensagem enviada' : 'Mensagem recebida'}
      className={`flex max-w-[78%] flex-col gap-1 rounded-(--radius-12) border px-3 py-2 ${
        outbound
          ? 'self-end border-accent-soft bg-accent-soft'
          : 'self-start border-line-soft bg-card'
      }`}
    >
      {author && <p className="caption font-medium text-ink-soft">{author}</p>}
      <MessageMedia message={message} />
      {message.type === 'unsupported' ? (
        <p className="italic text-ink-soft">Tipo de mensagem não suportado</p>
      ) : (
        message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mono-num caption text-ink-faint">{formatMessageTime(message.sentAt)}</span>
        {status && <Badge tone={status.tone}>{status.label}</Badge>}
      </div>
      {message.status === 'failed' && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {message.failureReason && (
            <span className="caption text-danger">{message.failureReason}</span>
          )}
          {canRetry && message.origin === 'agent' && (
            <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
              <RotateCw strokeWidth={1.7} aria-hidden />
              Reenviar
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

function Composer({ ticketId }: { ticketId: number }) {
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

  const changeText = (value: string) => {
    requestId.current = null
    setText(value)
  }

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!chosen) {
      return
    }
    requestId.current = null
    if (chosen.size > maxFileSize) {
      setFileError('O arquivo passa de 16 MB. Escolha um arquivo menor.')
      return
    }
    setFileError(null)
    setFile(chosen)
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
    send.mutate(
      voice
        ? { requestId: requestId.current, body: '', file: null, voice: voice.blob }
        : { requestId: requestId.current, body, file },
      {
        onSuccess: () => {
          requestId.current = null
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
          <audio
            src={voice.url}
            controls
            aria-label="Áudio gravado"
            className="h-9 min-w-0 flex-1"
          />
          <span className="mono-num caption text-ink-faint">{formatDuration(voice.seconds)}</span>
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
          <Textarea
            aria-label={file ? 'Legenda do arquivo' : 'Mensagem'}
            placeholder={file ? 'Legenda (opcional)' : 'Escreva a mensagem'}
            rows={1}
            className="max-h-40 min-h-9"
            value={text}
            onChange={(event) => changeText(event.target.value)}
            onKeyDown={onKeyDown}
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

function ConversationCard({ ticket, user }: { ticket: TicketDetail; user: User }) {
  const { data: messages = [] } = useMessages(ticket.id)
  const { data: logs = [] } = useAssignments(ticket.id)
  const retry = useRetryMessage(ticket.id)
  const list = useRef<HTMLDivElement>(null)
  const canReply = conducts(ticket, user)

  // Mostra sempre a mensagem mais recente.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages.length, logs.length])

  let notice: string | null = null
  if (ticket.status === 'closed') {
    notice = 'Chamado encerrado.'
  } else if (!ticket.assignee) {
    notice = 'Chamado na fila. Assuma o chamado para responder.'
  } else if (!canReply) {
    notice = `Chamado com ${ticket.assignee.name}. Peça a transferência para responder.`
  }

  return (
    <Card role="region" aria-label="Conversa" className="h-[70dvh] lg:h-[calc(100dvh-150px)]">
      <div ref={list} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length > 0 || logs.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {timeline(messages, logs).map((item) =>
              item.kind === 'message' ? (
                <MessageBubble
                  key={`message-${item.message.id}`}
                  message={item.message}
                  canRetry={canReply}
                  retrying={retry.isPending}
                  onRetry={() => retry.mutate(item.message.id)}
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
      {retry.error && (
        <div className="px-3 pb-2">
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{retry.error.message}</AlertDescription>
          </Alert>
        </div>
      )}
      {canReply ? (
        <Composer ticketId={ticket.id} />
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

function SpokeWithField({ ticket, editable }: { ticket: TicketDetail; editable: boolean }) {
  const save = useSaveSpokeWith(ticket.id)
  const [value, setValue] = useState(ticket.spokeWith ?? '')

  if (!editable) {
    return (
      <div>
        <dt className="label text-ink-soft">Falou com</dt>
        <dd>{ticket.spokeWith ?? 'Não informado'}</dd>
      </div>
    )
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save.mutate(value, { onSuccess: () => toast.success('Falou com salvo') })
      }}
    >
      <Field>
        <FieldLabel htmlFor="spoke-with">Falou com</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="spoke-with"
            maxLength={200}
            placeholder="Quem atendeu neste telefone"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={save.isPending}>
            Salvar
          </Button>
        </div>
      </Field>
      {save.error && <p className="caption mt-1 text-danger">{save.error.message}</p>}
    </form>
  )
}

function DetailsTab({ ticket, user }: { ticket: TicketDetail; user: User }) {
  const status = ticketStatusLabels[ticket.status]
  const closed = ticket.status === 'closed'
  const { data: modules = [] } = useTicketModules(ticket.id, closed)
  const row = (label: string, value: ReactNode) => (
    <div>
      <dt className="label text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
  return (
    <dl className="flex flex-col gap-3">
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
      {row('Órgão', ticket.organization?.name ?? 'Não cadastrado')}
      {row('Responsável', ticket.assignee?.name ?? 'Sem responsável')}
      {row('Chegada', <span className="mono-num">{formatDateTime(ticket.arrivedAt)}</span>)}
      {ticket.assignedAt &&
        row('Assumido em', <span className="mono-num">{formatDateTime(ticket.assignedAt)}</span>)}
      {ticket.closedAt &&
        row('Encerrado em', <span className="mono-num">{formatDateTime(ticket.closedAt)}</span>)}
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
      <SpokeWithField
        key={ticket.spokeWith ?? ''}
        ticket={ticket}
        editable={conducts(ticket, user)}
      />
    </dl>
  )
}

function NotesTab({ ticketId }: { ticketId: number }) {
  const { data: notes = [] } = useNotes(ticketId)
  const add = useAddNote(ticketId)
  const [body, setBody] = useState('')

  return (
    <div className="flex flex-col gap-3">
      <p className="caption text-ink-faint">Visíveis só para a equipe; não vão para o cliente.</p>
      {notes.length > 0 ? (
        <ol aria-label="Notas internas" className="flex flex-col gap-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-(--radius-7) border border-line-soft bg-card px-3 py-2"
            >
              <p className="caption text-ink-faint">
                {note.author.name} ·{' '}
                <span className="mono-num">{formatDateTime(note.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap break-words">{note.body}</p>
            </li>
          ))}
        </ol>
      ) : (
        <Empty>
          <EmptyMedia>
            <StickyNote strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>Nenhuma nota.</EmptyDescription>
        </Empty>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!body.trim()) {
            return
          }
          add.mutate(body.trim(), {
            onSuccess: () => {
              setBody('')
              toast.success('Nota adicionada')
            },
          })
        }}
      >
        <Field>
          <FieldLabel htmlFor="note-body">Nova nota</FieldLabel>
          <Textarea id="note-body" value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        {add.error && <p className="caption text-danger">{add.error.message}</p>}
        <Button
          type="submit"
          variant="outline"
          className="self-end"
          disabled={add.isPending || !body.trim()}
        >
          Adicionar nota
        </Button>
      </form>
    </div>
  )
}

function HistoryTab({ ticket }: { ticket: TicketDetail }) {
  const contact = useContactHistory(ticket.contact.id)
  const organization = useOrganizationHistory(ticket.organization?.id)
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="overline text-ink-soft">Do contato</h3>
        <TicketHistoryList
          label="Chamados do contato"
          entries={contact.data}
          currentTicketId={ticket.id}
        />
      </section>
      {ticket.organization && (
        <section>
          <h3 className="overline text-ink-soft">Do órgão</h3>
          <TicketHistoryList
            label="Chamados do órgão"
            entries={organization.data}
            currentTicketId={ticket.id}
          />
        </section>
      )}
    </div>
  )
}

export default function TicketPage() {
  const ticketId = Number(useParams().ticketId)
  const { data: user } = useCurrentUser()
  const { data: ticket, error } = useTicket(ticketId)
  const assign = useAssignFromTicket(ticketId, ticket?.sector.id)
  const [transferring, setTransferring] = useState(false)
  const [closing, setClosing] = useState(false)
  // Nova chave a cada abertura: o formulário começa limpo, com o fim sugerido no momento.
  const [closingKey, setClosingKey] = useState(0)

  if (error) {
    return (
      <>
        <Topbar breadcrumb="Atendimento" title="Chamado" />
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

  return (
    <>
      <Topbar
        breadcrumb={`${ticket.sector.name} · ${ticket.protocol}`}
        title={ticket.contact.name}
        action={
          ticket.status === 'queued' ? (
            <Button
              disabled={assign.isPending}
              onClick={() =>
                assign.mutate(undefined, { onSuccess: () => toast.success('Chamado assumido') })
              }
            >
              <UserCheck strokeWidth={1.7} aria-hidden />
              Assumir
            </Button>
          ) : (
            <div className="flex gap-2">
              {canTransfer(ticket, user) && (
                <Button
                  variant={canClose(ticket, user) ? 'outline' : 'default'}
                  onClick={() => setTransferring(true)}
                >
                  <UserRoundCog strokeWidth={1.7} aria-hidden />
                  Transferir
                </Button>
              )}
              {canClose(ticket, user) && (
                <Button
                  onClick={() => {
                    setClosingKey((key) => key + 1)
                    setClosing(true)
                  }}
                >
                  <CircleCheck strokeWidth={1.7} aria-hidden />
                  Encerrar
                </Button>
              )}
            </div>
          )
        }
      />
      {/* Sempre montado: o botão some quando o chamado é encerrado. */}
      <ClosingSheet key={closingKey} ticket={ticket} open={closing} onOpenChange={setClosing} />
      {/* Sempre montado: quem transfere o próprio chamado perde o botão ao concluir. */}
      <TransferSheet ticket={ticket} open={transferring} onOpenChange={setTransferring} />
      {/* A tela de conversas usa a largura toda (design.md). */}
      <div className="grid w-full items-start gap-4 px-4 py-4 md:px-[30px] md:py-[30px] lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        {assign.error && (
          <Alert variant="warning" className="lg:col-span-2 xl:col-span-3">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{assign.error.message}</AlertDescription>
          </Alert>
        )}
        {/* Abaixo de 1280px a lista some; o painel continua sendo o caminho entre conversas. */}
        <div className="hidden xl:block">
          <ConversationList sectorId={ticket.sector.id} user={user} />
        </div>
        <ConversationCard ticket={ticket} user={user} />
        <Card role="region" aria-labelledby="ticket-info-title">
          <CardHeader>
            <CardTitle id="ticket-info-title">Chamado</CardTitle>
          </CardHeader>
          <Tabs defaultValue="details" className="px-5 pb-5">
            <TabsList>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="notes">Notas</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              <DetailsTab ticket={ticket} user={user} />
            </TabsContent>
            <TabsContent value="notes">
              <NotesTab ticketId={ticket.id} />
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
