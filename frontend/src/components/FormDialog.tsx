import { TriangleAlert } from 'lucide-react'
import { type FormEventHandler, type ReactNode, useId } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'

// Janela de cadastro e edição (design.md): rodapé com Cancelar e a ação primária.
// Erros do servidor aparecem como Note, no topo do formulário. Com `locked`, a saída é
// concluir ou usar o botão do rodapé: sem X, e Esc e clique fora não fecham
// (spec.md, Janelas de formulário).
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel = 'Cancelar',
  pending,
  error,
  onSubmit,
  children,
  extra,
  locked = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  // Sem rótulo, não há ação primária: a janela só informa.
  submitLabel?: string
  cancelLabel?: string
  pending: boolean
  error?: string
  onSubmit: FormEventHandler<HTMLFormElement>
  children: ReactNode
  extra?: ReactNode
  locked?: boolean
}) {
  // Id próprio: duas janelas abertas (uma sobre a outra) não enviam o formulário errado.
  const formId = useId()
  return (
    <Dialog
      open={open}
      disablePointerDismissal={locked}
      onOpenChange={(next, details) => {
        if (locked && details.reason === 'escape-key') {
          details.cancel()
          return
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton={!locked}
        // O navegador limpa o campo de busca com Esc, e o texto digitado precisa continuar.
        onKeyDown={(event) => locked && event.key === 'Escape' && event.preventDefault()}
      >
        <DialogHeader className={locked ? undefined : 'pr-12'}>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div data-slot="dialog-body" className="min-h-0 flex-1 overflow-y-auto">
          <form id={formId} onSubmit={onSubmit} noValidate className="px-5 py-[18px]">
            <FieldGroup className="gap-[15px]">
              {error && (
                <Alert variant="warning">
                  <TriangleAlert strokeWidth={1.7} aria-hidden />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {children}
            </FieldGroup>
          </form>
          {extra}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>{cancelLabel}</DialogClose>
          {submitLabel && (
            <Button type="submit" form={formId} disabled={pending}>
              {submitLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
