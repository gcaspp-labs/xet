import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FormDialog } from '@/components/FormDialog'
import { type TicketDetail, useReturnTicket } from '@/lib/conversation'

// Janela de confirmação para devolver à fila o chamado em atendimento
// (spec.md, Devolver à fila). O backend confere de novo.
export function ReturnSheet({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const returnTicket = useReturnTicket(ticket.id, ticket.sector.id)

  const changeOpen = (next: boolean) => {
    if (!next) {
      returnTicket.reset()
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (returnTicket.isPending) {
      return
    }
    returnTicket.mutate(undefined, {
      onSuccess: () => {
        toast.success('Chamado devolvido à fila')
        changeOpen(false)
        // A próxima ação depois de devolver está no painel.
        void navigate('/')
      },
    })
  }

  return (
    <FormDialog
      locked
      open={open}
      onOpenChange={changeOpen}
      title="Devolver à fila"
      description="O chamado fica sem responsável e volta à fila do setor; mensagens, notas e histórico continuam no chamado."
      submitLabel="Devolver à fila"
      pending={returnTicket.isPending}
      error={returnTicket.error?.message}
      onSubmit={submit}
    >
      {null}
    </FormDialog>
  )
}
