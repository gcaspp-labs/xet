import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormDialog } from '@/components/FormDialog'
import { PasswordInput } from '@/components/PasswordInput'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { ApiError } from '@/lib/api'
import { passwordSchema, useChangeOwnPassword } from '@/lib/auth'

const MSG_WRONG_CURRENT = 'Senha atual incorreta.'

const schema = z
  .object({
    current: z.string().min(1, 'Informe a senha atual.'),
    next: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, {
    path: ['confirm'],
    message: 'A confirmação está diferente da nova senha.',
  })
type Values = z.infer<typeof schema>

const empty: Values = { current: '', next: '', confirm: '' }

// Troca da própria senha, aberta pelo menu Configurações (access.md, regra 2).
// Os erros ficam embaixo de cada campo: a senha atual errada em "Senha atual",
// os da regra da senha e "igual à atual" em "Nova senha". Só um erro inesperado
// (rede, servidor) vai para o aviso do topo.
export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const change = useChangeOwnPassword()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: empty })

  const close = () => {
    onOpenChange(false)
    reset(empty)
    change.reset()
  }

  const onSubmit = handleSubmit((values) => {
    change.reset()
    change.mutate(
      { current_password: values.current, new_password: values.next },
      {
        onSuccess: () => {
          close()
          toast.success('Senha alterada')
        },
        onError: (error) => {
          if (!(error instanceof ApiError) || error.status !== 422) return
          setError(error.message === MSG_WRONG_CURRENT ? 'current' : 'next', {
            message: error.message,
          })
        },
      },
    )
  })

  const unexpected =
    change.error && !(change.error instanceof ApiError && change.error.status === 422)
      ? change.error.message
      : undefined

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title="Alterar senha"
      description="Ao alterar, as suas outras sessões abertas são encerradas. Esta continua conectada."
      submitLabel="Alterar senha"
      pending={change.isPending}
      error={unexpected}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.current}>
        <FieldLabel htmlFor="change-current">Senha atual</FieldLabel>
        <PasswordInput
          id="change-current"
          autoComplete="current-password"
          disabled={change.isPending}
          aria-invalid={!!errors.current}
          {...register('current')}
        />
        <FieldError errors={[errors.current]} />
      </Field>
      <Field data-invalid={!!errors.next}>
        <FieldLabel htmlFor="change-next">Nova senha</FieldLabel>
        <PasswordInput
          id="change-next"
          autoComplete="new-password"
          disabled={change.isPending}
          aria-invalid={!!errors.next}
          {...register('next')}
        />
        {errors.next ? (
          <FieldError errors={[errors.next]} />
        ) : (
          <FieldDescription>
            No mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e caractere
            especial.
          </FieldDescription>
        )}
      </Field>
      <Field data-invalid={!!errors.confirm}>
        <FieldLabel htmlFor="change-confirm">Confirmar nova senha</FieldLabel>
        <PasswordInput
          id="change-confirm"
          autoComplete="new-password"
          disabled={change.isPending}
          aria-invalid={!!errors.confirm}
          {...register('confirm')}
        />
        <FieldError errors={[errors.confirm]} />
      </Field>
    </FormDialog>
  )
}
