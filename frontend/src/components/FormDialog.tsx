import { TriangleAlert } from 'lucide-react'
import { type FormEventHandler, type ReactNode, useEffect, useId, useRef } from 'react'
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
//
// Com `question`, a janela mostra uma pergunta antes de gravar, como uma etapa
// no lugar do formulário, sem abrir outra janela por cima: Voltar volta ao
// formulário, sem salvar nada (design.md, Assunto do formulário). O formulário
// continua montado, escondido, para não perder o que foi preenchido.
export type FormQuestion = {
  // Identifica a pergunta: ao passar de uma para outra, o foco vai para a nova.
  id?: string
  body: ReactNode
  onBack: () => void
  onSkip: () => void
  onConfirm: () => void
}

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
  question,
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
  question?: FormQuestion | null
}) {
  // Id próprio: duas janelas abertas (uma sobre a outra) não enviam o formulário errado.
  const formId = useId()
  // A pergunta recebe o foco, para o leitor de tela anunciá-la.
  const questionRef = useRef<HTMLDivElement>(null)
  const asking = !!question
  const questionId = question ? (question.id ?? 'question') : null
  useEffect(() => {
    if (questionId) {
      questionRef.current?.focus()
    }
  }, [questionId])
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
          {question && (
            <div
              ref={questionRef}
              tabIndex={-1}
              data-slot="form-question"
              className="flex flex-col gap-3 px-5 py-[18px] outline-none"
            >
              {question.body}
            </div>
          )}
          <form
            id={formId}
            onSubmit={onSubmit}
            noValidate
            hidden={asking}
            className="px-5 py-[18px]"
          >
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
          {!asking && extra}
        </div>
        {question ? (
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={question.onBack}>
              Voltar
            </Button>
            <Button variant="outline" disabled={pending} onClick={question.onSkip}>
              Não adicionar
            </Button>
            <Button disabled={pending} onClick={question.onConfirm}>
              Adicionar
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>{cancelLabel}</DialogClose>
            {submitLabel && (
              <Button type="submit" form={formId} disabled={pending}>
                {submitLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
