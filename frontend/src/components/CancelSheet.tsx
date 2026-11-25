import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FormDialog } from '@/components/FormDialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { type TicketDetail, useCancelTicket } from '@/lib/conversation'

// Janela de cancelamento: finaliza o chamado sem lançar o atendimento, com motivo opcional
// (spec.md, Cancelamento; #395). Sem motivo, a conversa mostra só quem cancelou e quando. O backend
// confere as permissões de novo.
export function CancelSheet({
  ticket,
  open,
  onOpenChange,
  successTo = '/chamados',
}: {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  successTo?: string
}) {
  const navigate = useNavigate()
  const cancel = useCancelTicket()
  const [reason, setReason] = useState('')

  const changeOpen = (next: boolean) => {
    if (!next) {
      setReason('')
      cancel.reset()
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (cancel.isPending) {
      return
    }
    cancel.mutate(
      { ticketId: ticket.id, sectorId: ticket.sector.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success('Chamado cancelado')
          changeOpen(false)
          // A próxima ação depois de cancelar está no painel.
          void navigate(successTo)
        },
      },
    )
  }

  return (
    <FormDialog
      locked
      open={open}
      onOpenChange={changeOpen}
      title="Cancelar chamado"
      description="Para spam, golpes e engano. O chamado fica no histórico sem lançar o atendimento e não é corrigido nem reaberto."
      submitLabel="Cancelar chamado"
      cancelLabel="Voltar"
      pending={cancel.isPending}
      error={cancel.error?.message}
      onSubmit={submit}
    >
      <Field>
        <FieldLabel htmlFor="cancel-reason">Motivo (opcional)</FieldLabel>
        <Textarea
          id="cancel-reason"
          maxLength={2000}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <FieldDescription>
          Sem o motivo, a conversa mostra só quem cancelou e quando.
        </FieldDescription>
      </Field>
    </FormDialog>
  )
}
