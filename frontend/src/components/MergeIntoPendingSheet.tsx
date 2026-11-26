import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { FormDialog } from '@/components/FormDialog'
import { FieldDescription, FieldError } from '@/components/ui/field'
import { type TicketDetail, useMergeIntoPending } from '@/lib/conversation'
import { formatElapsed } from '@/lib/format'

// Janela "Mesclar em pendente": lista os pendentes do mesmo contato e setor, e este atendimento
// encerrado ou cancelado passa para o escolhido, que fica com a situação e os dados do
// encerramento e continua como atendimento; este fica Mesclado (spec #332, #343). O backend
// confere de novo quem pode mesclar e se o pendente continua pendente.
export function MergeIntoPendingSheet({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const merge = useMergeIntoPending(ticket.id, ticket.sector.id)
  const pendings = ticket.pendingTickets ?? []
  const [chosen, setChosen] = useState<number | null>(null)
  const [missing, setMissing] = useState(false)
  // A lista recarrega depois de um erro (alguém retomou o pendente antes, por exemplo): a escolha
  // que sumiu dá lugar à primeira que ainda existe.
  const selected = pendings.find((item) => item.id === chosen)?.id ?? pendings[0]?.id ?? null

  const changeOpen = (next: boolean) => {
    if (!next) {
      setChosen(null)
      setMissing(false)
      merge.reset()
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (merge.isPending) {
      return
    }
    if (selected === null) {
      setMissing(true)
      return
    }
    setMissing(false)
    merge.mutate(selected, {
      onSuccess: (merged) => {
        toast.success('Atendimento mesclado')
        changeOpen(false)
        // O atendimento que herdou o encerramento abre com as mensagens dos dois e o aviso da mesclagem.
        void navigate(`/atendimentos/${merged.id}`)
      },
    })
  }

  return (
    <FormDialog
      locked
      open={open}
      onOpenChange={changeOpen}
      title="Mesclar em pendente"
      description="As mensagens deste atendimento passam para o pendente escolhido, que fica com a situação e os dados deste encerramento. Este atendimento fica registrado como Mesclado."
      submitLabel="Mesclar em pendente"
      pending={merge.isPending}
      submitDisabled={pendings.length === 0}
      error={merge.error?.message}
      onSubmit={submit}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1 text-ink-soft">Chamado pendente deste contato</legend>
        {pendings.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-(--radius-9) border border-line px-3 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-accent-soft"
          >
            <input
              type="radio"
              name="pending-ticket"
              className="mt-1 size-4 shrink-0 accent-(--accent)"
              checked={selected === item.id}
              onChange={() => {
                setChosen(item.id)
                if (missing) setMissing(false)
              }}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <span className="body-strong">{ticket.contact.name}</span>
                <span className="mono-num caption text-ink-faint">{item.protocol}</span>
              </span>
              <span className="caption text-ink">{item.reason}</span>
              <span className="caption text-ink-faint">
                por {item.by.name} · {formatElapsed(item.at)}
              </span>
            </span>
          </label>
        ))}
        {pendings.length === 0 ? (
          <FieldDescription>Este contato não tem mais chamado pendente.</FieldDescription>
        ) : (
          missing && <FieldError>Escolha o chamado pendente.</FieldError>
        )}
      </fieldset>
    </FormDialog>
  )
}
