import { History } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { type HistoryEntry, useContactHistory, useOrganizationHistory } from '@/lib/conversation'
import { formatDateTime, organizationLabel, ticketStatusLabel } from '@/lib/format'

// Chamados do contato ou do órgão, do mais recente ao mais antigo, só dos
// setores do usuário (o backend filtra). Cada um abre a conversa completa.
export function TicketHistoryList({
  label,
  entries,
  currentTicketId,
  onOpen,
}: {
  label: string
  entries: HistoryEntry[] | undefined
  currentTicketId?: number
  onOpen?: () => void
}) {
  if (!entries) {
    return null
  }
  if (entries.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <History strokeWidth={1.7} aria-hidden />
        </EmptyMedia>
        <EmptyDescription>Nenhum chamado no histórico.</EmptyDescription>
      </Empty>
    )
  }
  return (
    <ul aria-label={label} className="flex flex-col divide-y divide-line-soft">
      {entries.map((entry) => {
        const status = ticketStatusLabel(entry.status, entry.closureType)
        return (
          <li key={entry.id} className="flex flex-col gap-1 py-2.5">
            <div className="flex items-center gap-2">
              <Link
                to={`/chamados/${entry.id}`}
                onClick={onOpen}
                className="mono-num body-strong text-accent-strong underline-offset-2 hover:underline"
              >
                {entry.protocol}
              </Link>
              {entry.id === currentTicketId && (
                <span className="caption text-ink-faint">Este chamado</span>
              )}
              <Badge tone={status.tone} className="ml-auto">
                {status.label}
              </Badge>
            </div>
            <p className="caption text-ink-faint">
              {entry.sectorName} · {entry.contactName}
              {entry.organizationName &&
                ` · ${organizationLabel(entry.organizationName, entry.municipalityName)}`}
            </p>
            <p className="caption text-ink-faint">
              <span className="mono-num">{formatDateTime(entry.arrivedAt)}</span>
              {entry.assigneeName && ` · ${entry.assigneeName}`}
            </p>
            {entry.subject && <p className="body-sm">{entry.subject}</p>}
          </li>
        )
      })}
    </ul>
  )
}

// Janela com o histórico de um contato ou de um órgão, aberto pelos cadastros.
export function HistorySheet({
  target,
  onClose,
}: {
  target: { kind: 'contact' | 'organization'; id: number; name: string } | null
  onClose: () => void
}) {
  const contact = useContactHistory(target?.kind === 'contact' ? target.id : undefined)
  const organization = useOrganizationHistory(
    target?.kind === 'organization' ? target.id : undefined,
  )
  const entries = target?.kind === 'contact' ? contact.data : organization.data

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader className="pr-12">
          <DialogTitle>Histórico</DialogTitle>
          <DialogDescription>{target?.name}</DialogDescription>
        </DialogHeader>
        <div data-slot="dialog-body" className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
          <TicketHistoryList
            label={`Chamados de ${target?.name ?? ''}`}
            entries={entries}
            onOpen={onClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
