import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { FormSheet } from '@/components/FormSheet'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type TicketDetail, useTransferTicket } from '@/lib/conversation'
import { roleLabels } from '@/lib/format'
import { useWorkload } from '@/lib/tickets'

// Drawer de transferência entre atendentes: o destino é uma pessoa ativa do
// setor do chamado (spec.md, Transferências). O backend confere de novo.
export function TransferSheet({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: workload = [] } = useWorkload(ticket.sector.id)
  const transfer = useTransferTicket(ticket.id, ticket.sector.id)
  const [target, setTarget] = useState<string | null>(null)
  const [error, setError] = useState<string>()

  const items = workload
    .filter((u) => u.active && u.role !== 'admin' && u.id !== ticket.assignee?.id)
    .map((u) => ({
      value: String(u.id),
      label: `${u.name} · ${roleLabels[u.role]} · ${u.activeTickets} em atendimento`,
    }))

  const changeOpen = (next: boolean) => {
    if (!next) {
      setTarget(null)
      setError(undefined)
      transfer.reset()
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (transfer.isPending) {
      return
    }
    if (!target) {
      setError('Escolha para quem transferir.')
      return
    }
    setError(undefined)
    transfer.mutate(Number(target), {
      onSuccess: () => {
        toast.success('Chamado transferido')
        changeOpen(false)
      },
      onError: (err) => setError(err.message),
    })
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={changeOpen}
      title="Transferir chamado"
      description="O novo responsável passa a responder; mensagens, notas e histórico continuam no chamado."
      submitLabel="Transferir"
      pending={transfer.isPending}
      error={error}
      onSubmit={submit}
    >
      <Field>
        <FieldLabel htmlFor="transfer-target">Transferir para</FieldLabel>
        <Select items={items} value={target} onValueChange={(value) => setTarget(value)}>
          <SelectTrigger id="transfer-target">
            <SelectValue placeholder="Escolha o atendente" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {items.length === 0 && (
          <FieldDescription>Não há outra pessoa ativa no setor.</FieldDescription>
        )}
      </Field>
    </FormSheet>
  )
}
