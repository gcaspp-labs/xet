import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { FormDialog } from '@/components/FormDialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { type TicketDetail, useSectorTransfer, useTransferSectors } from '@/lib/conversation'

// Janela "Outro setor": o responsável escolhe o setor de destino e, se quiser,
// escreve o motivo; sem formulário de encerramento e sem exigir o cadastro do
// contato (docs/features/transfers.md). O backend confere tudo de novo.
export function SectorTransferSheet({
  ticket,
  open,
  onOpenChange,
  onSuccess,
}: {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}) {
  const { data: sectors } = useTransferSectors(ticket.id, open)
  const transfer = useSectorTransfer(ticket.id, ticket.sector.id)
  const [target, setTarget] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()

  const items = (sectors ?? []).map((sector) => ({ value: String(sector.id), label: sector.name }))
  const empty = sectors !== undefined && sectors.length === 0

  const changeOpen = (next: boolean) => {
    if (!next) {
      setTarget(null)
      setReason('')
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
      setError('Escolha o setor de destino.')
      return
    }
    setError(undefined)
    transfer.mutate(
      { sectorId: Number(target), reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Chamado transferido para outro setor')
          changeOpen(false)
          onSuccess?.()
        },
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <FormDialog
      locked
      open={open}
      onOpenChange={changeOpen}
      title="Transferir para outro setor"
      description="A etapa deste setor é encerrada como Transferido, e um novo chamado, com o mesmo contato, entra na fila do destino."
      submitLabel={empty ? undefined : 'Transferir'}
      cancelLabel={empty ? 'Fechar' : 'Cancelar'}
      pending={transfer.isPending}
      error={error}
      onSubmit={submit}
    >
      <Field>
        <FieldLabel htmlFor="sector-transfer-target">Setor de destino</FieldLabel>
        <Select
          items={items}
          value={target}
          disabled={transfer.isPending || empty}
          onValueChange={(value) => setTarget(value)}
        >
          <SelectTrigger id="sector-transfer-target">
            <SelectValue placeholder="Escolha o setor" />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {empty && (
          <FieldDescription>Não há outro setor ativo para receber o chamado.</FieldDescription>
        )}
      </Field>
      {!empty && (
        <Field>
          <FieldLabel htmlFor="sector-transfer-reason">
            Motivo da transferência (opcional)
          </FieldLabel>
          <Textarea
            id="sector-transfer-reason"
            maxLength={2000}
            disabled={transfer.isPending}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldDescription>
            O setor de destino vê o motivo no chamado, e ele aparece na conversa dos dois chamados.
          </FieldDescription>
        </Field>
      )}
    </FormDialog>
  )
}
