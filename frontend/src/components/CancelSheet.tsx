import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FormDialog } from '@/components/FormDialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { type TicketDetail, useCancelTicket } from '@/lib/conversation'

// Janela de cancelamento: finaliza o chamado sem lançar o atendimento, com
// motivo obrigatório (spec.md, Cancelamento). O backend confere de novo.
export function CancelSheet({
  ticket,
  open,
  onOpenChange,
  successTo = '/conversas',
}: {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  successTo?: string
}) {
  const navigate = useNavigate()
  const cancel = useCancelTicket(ticket.id, ticket.sector.id)
  const [reason, setReason] = useState('')
  const [missing, setMissing] = useState(false)

  const changeOpen = (next: boolean) => {
    if (!next) {
      setReason('')
      setMissing(false)
      cancel.reset()
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (cancel.isPending) {
      return
    }
    if (!reason.trim()) {
      setMissing(true)
      return
    }
    setMissing(false)
    cancel.mutate(reason.trim(), {
      onSuccess: () => {
        toast.success('Chamado cancelado')
        changeOpen(false)
        // A próxima ação depois de cancelar está no painel.
        void navigate(successTo)
      },
    })
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
      <Field data-invalid={missing}>
        <FieldLabel htmlFor="cancel-reason">Motivo</FieldLabel>
        <Textarea
          id="cancel-reason"
          maxLength={2000}
          aria-invalid={missing}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {missing && <FieldError>Informe o motivo do cancelamento.</FieldError>}
      </Field>
    </FormDialog>
  )
}
