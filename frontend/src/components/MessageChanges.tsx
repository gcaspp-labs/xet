import { CircleAlert } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import {
  type Message,
  type MessageChange,
  messageChangesId,
  useMessageChanges,
} from '@/lib/conversation'

// Quem fez a alteração: o cliente, o celular do setor ou o XET (com o nome, quando se sabe).
function by(change: MessageChange) {
  if (change.origin === 'customer') return 'pelo cliente'
  if (change.origin === 'phone') return 'pelo celular do setor'
  return change.author ? `pelo XET, por ${change.author.name}` : 'pelo XET'
}

// O apelido gravado no envio vem em negrito, como no balão da conversa.
function MessageVersionContent({ body }: { body: string }) {
  const prefix = body.match(/^\*([^*\n]+:)\*(?:\n|$)/)
  return (
    <p className="whitespace-pre-wrap break-words">
      {prefix ? (
        <>
          <strong>{prefix[1]}</strong>
          {body.slice(prefix[0].length) && `\n${body.slice(prefix[0].length)}`}
        </>
      ) : (
        body
      )}
    </p>
  )
}

// Só leitura: as versões conhecidas da mensagem, da original à atual, e a exclusão, quando houve,
// com o horário, quem fez e o alcance. Nenhuma ação de alterar, restaurar ou reenviar.
export function MessageChangesDialog({
  message,
  ticketId,
  onClose,
}: {
  message: Message
  ticketId: number
  onClose: () => void
}) {
  const { data: changes, error, isPending } = useMessageChanges(ticketId, message.id)
  const versions = changes?.filter((change) => change.kind !== 'deletion') ?? []
  // A atual é a última versão gravada, e só ela leva a etiqueta.
  const current = versions.length > 1 ? versions[versions.length - 1].id : null
  const deletion = changes?.find((change) => change.kind === 'deletion')
  const deletionScope = message.deletion?.scope ?? deletion?.scope

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent finalFocus={() => document.getElementById(messageChangesId(message.id))}>
        <DialogHeader>
          <DialogTitle>
            {message.editedAt && message.deletion
              ? 'Versões e exclusão da mensagem'
              : message.editedAt
                ? 'Versões da mensagem'
                : 'Mensagem excluída'}
          </DialogTitle>
          <DialogDescription>
            Somente leitura. Mostra o que o XET recebeu do WhatsApp sobre esta mensagem.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5 text-sm">
          {error && (
            <Alert variant="warning">
              <CircleAlert strokeWidth={1.7} aria-hidden />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          {isPending && !error && <Skeleton className="h-16 w-full" />}
          {changes && (
            <ol aria-label="Versões e exclusão" className="flex flex-col gap-3">
              {changes.map((change) =>
                change.kind === 'deletion' ? (
                  <li
                    key={change.id}
                    data-testid="message-deletion"
                    className="flex flex-col gap-1 rounded-(--radius-12) border border-line bg-muted px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="danger">Excluída</Badge>
                      <span className="font-medium">
                        {change.scope === 'local'
                          ? 'Para mim (oculta no XET)'
                          : 'Para todos (também no WhatsApp)'}
                      </span>
                    </div>
                    <p className="caption text-ink-soft">
                      {formatDateTime(change.at)} · {by(change)}
                    </p>
                  </li>
                ) : (
                  <li
                    key={change.id}
                    data-testid="message-version"
                    className="flex flex-col gap-1 rounded-(--radius-12) border border-line-soft bg-card px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {change.kind === 'original' ? 'Original' : 'Editada'}
                      </span>
                      {change.id === current && <Badge variant="tag">Atual</Badge>}
                    </div>
                    <p className="caption text-ink-soft">
                      {formatDateTime(change.at)} ·{' '}
                      {change.kind === 'original'
                        ? `Enviada ${by(change)}`
                        : `Editada ${by(change)}`}
                    </p>
                    {change.body ? (
                      <MessageVersionContent body={change.body} />
                    ) : (
                      <p className="italic text-ink-soft">Sem texto</p>
                    )}
                  </li>
                ),
              )}
              {changes.length === 0 && (
                <li className="text-ink-soft">
                  Nenhuma versão conhecida além do conteúdo da conversa.
                </li>
              )}
            </ol>
          )}
          {message.deletion && deletionScope && (
            <p data-testid="deleted-content" className="caption text-ink-soft">
              {deletionScope === 'local'
                ? 'Excluída só no XET: o conteúdo e o arquivo continuam preservados na conversa.'
                : 'Excluída para todos: o conteúdo e o arquivo continuam preservados na conversa.'}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
