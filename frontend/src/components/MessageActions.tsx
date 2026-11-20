import { useRef, useState } from 'react'
import { CircleAlert, CornerUpLeft, EllipsisVertical, PencilLine, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ApiError } from '@/lib/api'
import {
  type Message,
  messageChanges,
  messageMenuId,
  newRequestId,
  useDeleteMessage,
} from '@/lib/conversation'
import { cn } from '@/lib/utils'

// Os itens do menu, calculados quando ele abre: o prazo é conferido com o relógio de agora.
function MenuItems({
  message,
  onReply,
  onEdit,
  onDelete,
}: {
  message: Message
  onReply?: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const changes = messageChanges(message)
  const actions = changes && (changes.edit || changes.deleteForEveryone || changes.deleteForMe)
  return (
    <>
      {onReply && (
        <DropdownMenuItem onClick={onReply}>
          <CornerUpLeft strokeWidth={1.7} aria-hidden />
          Responder
        </DropdownMenuItem>
      )}
      {changes?.edit && (
        <DropdownMenuItem onClick={onEdit}>
          <PencilLine strokeWidth={1.7} aria-hidden />
          Editar
        </DropdownMenuItem>
      )}
      {changes && (changes.deleteForEveryone || changes.deleteForMe) && (
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 strokeWidth={1.7} aria-hidden />
          Excluir
        </DropdownMenuItem>
      )}
      {changes?.note && (
        <>
          {(actions || onReply) && <DropdownMenuSeparator />}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="max-w-64 whitespace-normal normal-case">
              {changes.note}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        </>
      )}
    </>
  )
}

// Menu (⋯) ao lado do balão da mensagem enviada pelo XET, com Responder (quando a mensagem pode ser
// citada), Editar e Excluir quando o prazo e o estado deixam, ou o motivo de não deixar. Só o
// responsável vê, e só nas mensagens do XET.
export function MessageMenu({
  message,
  onReply,
  onEdit,
  onDelete,
}: {
  message: Message
  onReply?: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            id={messageMenuId(message.id)}
            variant="ghost"
            size="icon"
            aria-label="Ações da mensagem"
            className={cn(
              'rounded-full opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100',
              open && 'opacity-100',
            )}
          />
        }
      >
        <EllipsisVertical strokeWidth={1.7} aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <MenuItems message={message} onReply={onReply} onEdit={onEdit} onDelete={onDelete} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// A janela de exclusão: "Excluir para todos" (no WhatsApp também) só quando o prazo deixa, "Excluir
// para mim" (oculta para o setor, só no XET) e Cancelar, que fecha sem chamar a API. Enquanto uma
// confirmação está em andamento, nada se repete nem fecha; a falha mantém a janela, com o motivo.
export function DeleteMessageDialog({
  message,
  ticketId,
  onClose,
}: {
  message: Message
  ticketId: number
  onClose: () => void
}) {
  const remove = useDeleteMessage(ticketId)
  // O mesmo identificador numa repetição devolve o resultado da primeira; depois de uma resposta do
  // servidor (recusa), o responsável tenta de novo com um novo.
  const requestIds = useRef<Record<string, string>>({})
  const changes = messageChanges(message)

  const confirm = (scope: 'everyone' | 'local') => {
    if (remove.isPending) return
    requestIds.current[scope] ??= newRequestId()
    remove.mutate(
      { messageId: message.id, requestId: requestIds.current[scope], scope },
      {
        onSuccess: onClose,
        onError: (error) => {
          if (error instanceof ApiError) delete requestIds.current[scope]
        },
      },
    )
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !remove.isPending) onClose()
      }}
    >
      <DialogContent
        finalFocus={() => document.getElementById(messageMenuId(message.id))}
        showCloseButton={!remove.isPending}
      >
        <DialogHeader>
          <DialogTitle>Excluir mensagem</DialogTitle>
          <DialogDescription>Escolha como deseja excluir esta mensagem.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto p-5 text-sm">
          {remove.error && (
            <Alert variant="warning">
              <CircleAlert strokeWidth={1.7} aria-hidden />
              <AlertDescription>{remove.error.message}</AlertDescription>
            </Alert>
          )}
          {changes?.deleteForEveryone ? (
            <p>
              <strong>Para todos:</strong> solicita a exclusão da mensagem no WhatsApp.
            </p>
          ) : (
            <p className="text-ink-soft">
              {changes?.note ?? 'O prazo para excluir para todos terminou.'}
            </p>
          )}
          <p>
            <strong>Para mim:</strong> oculta a mensagem para todo o setor no XET. O registro
            permanece em Atendimentos e pode continuar nos celulares e outros dispositivos.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={remove.isPending} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            disabled={remove.isPending || !changes?.deleteForMe}
            onClick={() => confirm('local')}
          >
            {remove.isPending && remove.variables?.scope === 'local'
              ? 'Excluindo…'
              : 'Excluir para mim'}
          </Button>
          {changes?.deleteForEveryone && (
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => confirm('everyone')}
            >
              {remove.isPending && remove.variables?.scope === 'everyone'
                ? 'Excluindo…'
                : 'Excluir para todos'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
