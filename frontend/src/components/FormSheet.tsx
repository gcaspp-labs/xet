import { TriangleAlert } from 'lucide-react'
import { type FormEventHandler, type ReactNode, useId } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

// Drawer de cadastro e edição (design.md): rodapé com Cancelar e a ação primária.
// Erros do servidor aparecem como Note, no topo do formulário.
export function FormSheet({
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  // Sem rótulo, não há ação primária: o drawer só informa.
  submitLabel?: string
  cancelLabel?: string
  pending: boolean
  error?: string
  onSubmit: FormEventHandler<HTMLFormElement>
  children: ReactNode
  extra?: ReactNode
}) {
  // Id próprio: dois drawers abertos (um sobre o outro) não enviam o formulário errado.
  const formId = useId()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
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
        <SheetFooter>
          <SheetClose render={<Button variant="ghost" />}>{cancelLabel}</SheetClose>
          {submitLabel && (
            <Button type="submit" form={formId} disabled={pending}>
              {submitLabel}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
