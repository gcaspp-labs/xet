import { Ban, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// O X do chamado na fila (#395): fica sempre visível no fim da linha de ações, à direita do item e
// longe do Assumir, que é o que evita o clique errado. Na lista do Dashboard, o `z-10` põe o clique
// acima da área da linha que abre o chamado, como no Assumir.
export function CancelQueueButton({
  contactName,
  onClick,
}: {
  contactName: string
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Cancelar chamado de ${contactName}`}
      title="Cancelar chamado"
      className="relative z-10 text-ink-soft hover:bg-danger-soft hover:text-destructive"
      onClick={onClick}
    >
      <X strokeWidth={1.7} aria-hidden />
    </Button>
  )
}

// A confirmação no próprio item da fila (#395): o X não cancela no primeiro clique, e o item troca
// as ações por esta faixa. O Voltar recebe o foco ao abrir, e o Esc também volta sem cancelar.
export function CancelQueueConfirm({
  contactName,
  pending,
  onBack,
  onCancel,
}: {
  contactName: string
  pending: boolean
  onBack: () => void
  onCancel: () => void
}) {
  return (
    <div
      data-slot="cancel-queue-confirm"
      className="flex flex-col gap-2 rounded-(--radius-7) bg-danger-soft px-3 py-2 whitespace-normal"
      onKeyDown={(event) => {
        // O Esc fecha só a confirmação: a tela não usa o Esc para outra coisa enquanto ela está
        // aberta (o handler da tela Chamados respeita o evento já tratado).
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault()
          onBack()
        }
      }}
    >
      <p className="caption flex items-start gap-1.5 text-ink">
        <Ban strokeWidth={1.7} aria-hidden className="mt-px size-[15px] shrink-0 text-danger" />
        <span>
          Cancelar o chamado de <strong className="font-semibold">{contactName}</strong>? Ele não é
          reaberto.
        </span>
      </p>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" autoFocus onClick={onBack}>
          Voltar
        </Button>
        <Button variant="destructive" size="sm" disabled={pending} onClick={onCancel}>
          Cancelar chamado
        </Button>
      </div>
    </div>
  )
}
