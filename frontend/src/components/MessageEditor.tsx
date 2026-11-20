import { CircleAlert, SendHorizontal } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { EmojiPicker } from '@/components/EmojiPicker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import {
  editableText,
  insertEmojiAtCursor,
  type Message,
  newRequestId,
  useEditMessage,
} from '@/lib/conversation'

// O trecho da mensagem que identifica qual está sendo editada.
function preview(message: Message) {
  const text = editableText(message).trim()
  if (text) return text
  return message.media?.fileName ?? 'Arquivo sem legenda'
}

// A edição no lugar do compositor: faixa "Editando" com a mensagem e Cancelar, e o campo já com o
// texto (ou a legenda) atual, sem o apelido, que fica como foi enviado. O rascunho do compositor
// fica guardado pelo pai e volta ao cancelar ou salvar. Salvar só vale com a resposta do servidor:
// na falha, a faixa e o texto editado ficam para uma nova tentativa.
export function MessageEditor({
  message,
  ticketId,
  hasDraft,
  onDone,
}: {
  message: Message
  ticketId: number
  // Há um rascunho guardado no compositor, que volta ao terminar.
  hasDraft: boolean
  onDone: () => void
}) {
  const edit = useEditMessage(ticketId)
  const original = editableText(message)
  const [text, setText] = useState(original)
  // Uma nova tentativa do mesmo texto devolve o resultado da primeira; mudar o texto, ou receber a
  // resposta do servidor (recusa), pede um novo.
  const requestId = useRef<string | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const field = input.current
    if (!field) return
    field.focus()
    field.setSelectionRange(field.value.length, field.value.length)
  }, [])

  const changeText = (value: string) => {
    requestId.current = null
    setText(value)
  }

  const blank = !text.trim() && message.type === 'text'
  const unchanged = text.trim() === original.trim()
  const canSave = !edit.isPending && !blank && !unchanged

  const submit = () => {
    if (!canSave) return
    requestId.current ??= newRequestId()
    edit.mutate(
      { messageId: message.id, requestId: requestId.current, body: text },
      {
        onSuccess: onDone,
        onError: (error) => {
          if (error instanceof ApiError) requestId.current = null
        },
      },
    )
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    } else if (event.key === 'Escape' && !edit.isPending) {
      event.preventDefault()
      onDone()
    }
  }

  const insertEmoji = (emoji: string) => insertEmojiAtCursor(input.current, text, emoji, changeText)

  return (
    <>
      {edit.error && (
        <Alert variant="warning">
          <CircleAlert strokeWidth={1.7} aria-hidden />
          <AlertDescription>{edit.error.message}</AlertDescription>
        </Alert>
      )}
      <div
        role="group"
        aria-label="Editando mensagem"
        className="flex items-center gap-2 rounded-(--radius-7) border-l-4 border-primary bg-muted px-3 py-1.5"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="caption font-medium text-primary">Editando</span>
          <span className="truncate text-ink-soft">
            {message.author?.name ?? 'Setor'} · {preview(message)}
          </span>
          {hasDraft && (
            <span className="caption text-ink-soft">
              Seu rascunho será recuperado ao cancelar ou salvar.
            </span>
          )}
        </span>
        <Button variant="ghost" size="sm" disabled={edit.isPending} onClick={onDone}>
          Cancelar
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <EmojiPicker onSelect={insertEmoji} returnFocus={input} />
        <Textarea
          ref={input}
          aria-label="Editar mensagem"
          rows={1}
          className="max-h-40 min-h-9"
          value={text}
          readOnly={edit.isPending}
          onChange={(event) => changeText(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button size="icon" aria-label="Salvar edição" disabled={!canSave} onClick={submit}>
          <SendHorizontal strokeWidth={1.7} aria-hidden />
        </Button>
      </div>
    </>
  )
}
