import { TriangleAlert } from 'lucide-react'
import type { FormEventHandler, ReactNode } from 'react'
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
  submitLabel: string
  pending: boolean
  error?: string
  onSubmit: FormEventHandler<HTMLFormElement>
  children: ReactNode
  extra?: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <form id="form-sheet" onSubmit={onSubmit} noValidate className="px-5 py-[18px]">
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
          <SheetClose render={<Button variant="ghost" />}>Cancelar</SheetClose>
          <Button type="submit" form="form-sheet" disabled={pending}>
            {submitLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
