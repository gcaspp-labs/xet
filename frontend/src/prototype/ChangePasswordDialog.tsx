// PROTÓTIPO #259: descartável, não vai para a main.
// Plano: uma versão (ajuste em tela existente): item "Alterar senha" no menu Configurações,
// antes de "Sair", abrindo um FormDialog com três PasswordInput. Os estados das capturas
// abrem direto pela URL: ?estado=vazio | atual-incorreta | politica | comum | longa |
// confirmacao | igual | enviando | sucesso. Sem ?estado, o diálogo é interativo:
// a senha atual "certa" é Atual@2026; nada é gravado.
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormDialog } from '@/components/FormDialog'
import { PasswordInput } from '@/components/PasswordInput'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { passwordSchema } from '@/lib/auth'

const MSG_WRONG_CURRENT = 'Senha atual incorreta.'
const MSG_SAME = 'A nova senha precisa ser diferente da atual.'
const MSG_MISMATCH = 'A confirmação está diferente da nova senha.'
const MSG_COMMON = 'Senha muito comum. Escolha outra, mais difícil de adivinhar.'

const schema = z
  .object({
    current: z.string().min(1, 'Informe a senha atual.'),
    next: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: MSG_MISMATCH })
type Values = z.infer<typeof schema>

// Estados fixos para as capturas: valores preenchidos e o erro de cada campo.
const presets: Record<string, { values: Values; errors?: Partial<Record<keyof Values, string>> }> = {
  vazio: { values: { current: '', next: '', confirm: '' } },
  'atual-incorreta': {
    values: { current: 'Errada@2025', next: 'Nova#Senha26', confirm: 'Nova#Senha26' },
    errors: { current: MSG_WRONG_CURRENT },
  },
  politica: {
    values: { current: 'Atual@2026', next: 'senha123', confirm: 'senha123' },
    errors: {
      next: 'A senha precisa ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial.',
    },
  },
  comum: {
    values: { current: 'Atual@2026', next: 'Senha@123', confirm: 'Senha@123' },
    errors: { next: MSG_COMMON },
  },
  longa: {
    values: { current: 'Atual@2026', next: 'Aa1!'.repeat(19), confirm: 'Aa1!'.repeat(19) },
    errors: { next: 'A senha pode ter no máximo 72 caracteres.' },
  },
  confirmacao: {
    values: { current: 'Atual@2026', next: 'Nova#Senha26', confirm: 'Nova#Senha62' },
    errors: { confirm: MSG_MISMATCH },
  },
  igual: {
    values: { current: 'Atual@2026', next: 'Atual@2026', confirm: 'Atual@2026' },
    errors: { next: MSG_SAME },
  },
  enviando: { values: { current: 'Atual@2026', next: 'Nova#Senha26', confirm: 'Nova#Senha26' } },
}

export function protoState() {
  return new URLSearchParams(window.location.search).get('estado')
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const state = protoState()
  const preset = state ? presets[state] : undefined
  const [pending, setPending] = useState(state === 'enviando')
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: preset?.values ?? { current: '', next: '', confirm: '' },
  })

  useEffect(() => {
    if (!open) return
    for (const [name, message] of Object.entries(preset?.errors ?? {}))
      setError(name as keyof Values, { message })
  }, [open, preset, setError])

  // Envio falso: confere a senha atual e a igualdade como o servidor faria.
  const onSubmit = handleSubmit((values) => {
    setPending(true)
    setTimeout(() => {
      setPending(false)
      if (values.current !== 'Atual@2026') return setError('current', { message: MSG_WRONG_CURRENT })
      if (values.next === values.current) return setError('next', { message: MSG_SAME })
      onOpenChange(false)
      reset({ current: '', next: '', confirm: '' })
      toast.success('Senha alterada')
    }, 1200)
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset({ current: '', next: '', confirm: '' })
      }}
      title="Alterar senha"
      description="Ao alterar, as suas outras sessões abertas são encerradas. Esta continua conectada."
      submitLabel="Alterar senha"
      pending={pending}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.current}>
        <FieldLabel htmlFor="change-current">Senha atual</FieldLabel>
        <PasswordInput
          id="change-current"
          autoComplete="current-password"
          disabled={pending}
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
          disabled={pending}
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
          disabled={pending}
          aria-invalid={!!errors.confirm}
          {...register('confirm')}
        />
        <FieldError errors={[errors.confirm]} />
      </Field>
    </FormDialog>
  )
}
