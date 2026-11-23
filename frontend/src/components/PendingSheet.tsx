import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FormDialog } from '@/components/FormDialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { type TicketDetail, useMarkPending } from '@/lib/conversation'

// Janela "Colocar como pendente": o responsável escreve o motivo obrigatório e o chamado vai para a
// aba Pendentes do setor (spec #332). O backend confere de novo.
export function PendingSheet({
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
  const pending = useMarkPending(ticket.id, ticket.sector.id)
  const [reason, setReason] = useState('')
  const [missing, setMissing] = useState(false)

  const changeOpen = (next: boolean) => {
    if (!next) {
      setReason('')
      setMissing(false)
      pending.reset()
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending.isPending) {
      return
    }
    if (!reason.trim()) {
      setMissing(true)
      return
    }
    setMissing(false)
    pending.mutate(reason.trim(), {
      onSuccess: () => {
        toast.success('Chamado marcado como pendente')
        changeOpen(false)
        // A próxima ação depois de marcar está no painel.
        void navigate(successTo)
      },
    })
  }

  return (
    <FormDialog
      locked
      open={open}
      onOpenChange={changeOpen}
      title="Colocar como pendente"
      description="O chamado sai de Meus chamados e vai para Pendentes do setor. O contato fica livre para um chamado novo, e este não recebe mensagens até alguém retomar."
      submitLabel="Colocar como pendente"
      pending={pending.isPending}
      error={pending.error?.message}
      onSubmit={submit}
    >
      <Field data-invalid={missing}>
        <FieldLabel htmlFor="pending-reason">Motivo</FieldLabel>
        <Textarea
          id="pending-reason"
          maxLength={2000}
          aria-invalid={missing}
          placeholder="Por que o chamado vai ficar pendente"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        {missing ? (
          <FieldError>Informe o motivo do pendente.</FieldError>
        ) : (
          <FieldDescription>O setor vê o motivo na aba Pendentes e na conversa.</FieldDescription>
        )}
      </Field>
    </FormDialog>
  )
}
