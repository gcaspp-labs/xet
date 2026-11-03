import { Bell, BellOff, CircleAlert, QrCode, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import type { User } from '@/lib/auth'
import { useAssignTicket } from '@/lib/conversation'
import { formatMessageTime } from '@/lib/format'
import { useNotifications } from '@/lib/notifications'
import { lastMessagePreview } from '@/lib/tickets'
import { cn } from '@/lib/utils'

// Sino do cabeçalho (spec.md › Notificações): números desconectados no topo, depois os
// chamados na fila. O contador soma os dois; fica em alerta enquanto houver número caído.
export function NotificationBell({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const { queue, down, count, showSector } = useNotifications(user)
  const assign = useAssignTicket()
  const { reset } = assign
  const label =
    count > 0 ? `Notificações, ${count} ${count === 1 ? 'pendente' : 'pendentes'}` : 'Notificações'

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // O erro é só da tentativa anterior.
        reset()
      }}
    >
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" aria-label={label} className="relative" />}
      >
        <Bell strokeWidth={1.7} aria-hidden />
        {count > 0 && (
          <span
            data-testid="notification-count"
            data-alert={down.length > 0}
            aria-hidden
            className={cn(
              'mono-num absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-medium',
              down.length > 0 ? 'bg-warning text-white' : 'bg-primary text-primary-foreground',
            )}
          >
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-1rem))]">
        <div className="border-b border-line px-4 py-2.5">
          <PopoverTitle>Notificações</PopoverTitle>
        </div>
        {assign.error && (
          <div className="px-4 pt-2.5">
            <Alert variant="warning">
              <CircleAlert strokeWidth={1.7} aria-hidden />
              <AlertDescription>{assign.error.message}</AlertDescription>
            </Alert>
          </div>
        )}
        {count === 0 ? (
          <Empty>
            <EmptyMedia>
              <BellOff strokeWidth={1.7} aria-hidden />
            </EmptyMedia>
            <EmptyDescription>Nenhuma notificação.</EmptyDescription>
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft overflow-y-auto">
            {down.map((sector) => (
              <li key={`down-${sector.id}`}>
                <Link
                  to={`/conexao?setor=${sector.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-2.5 bg-warning-soft px-4 py-2.5 text-warning-ink transition-colors hover:opacity-90"
                >
                  <QrCode strokeWidth={1.7} className="mt-0.5 size-[15px] shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="body-strong">Número do setor {sector.name} desconectado</span>
                    <span className="caption">
                      {sector.connectionStatus === 'connecting'
                        ? 'Conectando. Acompanhe pela tela de conexão.'
                        : 'Reconecte pelo QR code.'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {queue.map((ticket) => (
              <li key={ticket.id} className="flex flex-col gap-1 px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="body-strong min-w-0 flex-1 truncate">{ticket.contact.name}</span>
                  {ticket.lastMessage && (
                    <span className="mono-num caption text-ink-faint">
                      {formatMessageTime(ticket.lastMessage.sentAt)}
                    </span>
                  )}
                </span>
                {showSector && <span className="caption text-ink-faint">{ticket.sectorName}</span>}
                <span className="caption truncate text-ink-soft">{lastMessagePreview(ticket)}</span>
                <span className="mt-1 flex items-center justify-end gap-2">
                  <Link
                    to={`/chamados/${ticket.id}`}
                    onClick={() => setOpen(false)}
                    aria-label={`Abrir chamado de ${ticket.contact.name}`}
                    className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                  >
                    Abrir
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={assign.isPending}
                    aria-label={`Assumir chamado de ${ticket.contact.name}`}
                    onClick={() =>
                      assign.mutate(
                        { ticketId: ticket.id, sectorId: ticket.sectorId },
                        {
                          onSuccess: () =>
                            toast.success('Chamado assumido', {
                              action: (
                                <Link
                                  to={`/chamados/${ticket.id}`}
                                  className="body-strong ml-auto whitespace-nowrap text-accent-strong underline underline-offset-2"
                                >
                                  Abrir conversa
                                </Link>
                              ),
                            }),
                        },
                      )
                    }
                  >
                    <UserCheck strokeWidth={1.7} aria-hidden />
                    Assumir
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}
