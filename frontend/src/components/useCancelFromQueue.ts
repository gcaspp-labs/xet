import { toast } from 'sonner'
import { useCancelTicket } from '@/lib/conversation'

// O X da fila cancela sem janela e sem motivo (#395), com o mesmo aviso da janela. A tela Chamados
// e o Dashboard usam este hook; o chamador fecha a confirmação no `onDone`.
export function useCancelFromQueue(onDone: () => void) {
  const cancel = useCancelTicket()
  const cancelFromQueue = (ticketId: number, sectorId: number) =>
    cancel.mutate(
      { ticketId, sectorId, reason: '' },
      {
        onSuccess: () => {
          onDone()
          toast.success('Chamado cancelado')
        },
        onError: (err) => toast.error(err.message),
      },
    )
  return { cancel, cancelFromQueue }
}
