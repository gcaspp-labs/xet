import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ClosingFields } from '@/components/ClosingFields'
import { FormDialog } from '@/components/FormDialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { checkPeriod, closingShape, localInput } from '@/lib/closing'
import { type TicketDetail, useClosingForm, useCorrectTicket } from '@/lib/conversation'

const schema = z
  .object({
    ...closingShape,
    spokeWith: z.string(),
    reason: z.string().trim().min(1, 'Informe o motivo da correção.'),
  })
  .superRefine(checkPeriod)

type FormValues = z.input<typeof schema>

// Janela de correção do atendimento encerrado (spec.md, Encerramento, retorno
// e correções): os dados do encerramento e o "falou com", com motivo
// obrigatório. Só é montado aberto, já com os módulos gravados; o backend
// confere quem pode corrigir e as regras de novo.
export function CorrectionSheet({
  ticket,
  recorded,
  onOpenChange,
}: {
  ticket: TicketDetail
  recorded: { id: number; name: string }[]
  onOpenChange: (open: boolean) => void
}) {
  const { data: form } = useClosingForm(ticket.id, true)
  const correct = useCorrectTicket(ticket.id)
  // Horários como estavam; sem alteração, vão com a precisão original.
  const [original] = useState(() => ({
    startedAt: localInput(new Date(ticket.startedAt)),
    endedAt: localInput(new Date(ticket.endedAt ?? ticket.closedAt ?? Date.now())),
  }))
  // Módulos gravados continuam selecionáveis mesmo se desativados depois.
  const modules = [
    ...recorded,
    ...(form?.modules ?? []).filter((module) => !recorded.some((r) => r.id === module.id)),
  ].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const methods = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: ticket.subject ?? '',
      resolution: ticket.resolution ?? '',
      moduleIds: recorded.map((module) => module.id),
      organization: ticket.organization ? { ...ticket.organization, cnpj: null } : null,
      ...original,
      spokeWith: ticket.spokeWith ?? '',
      reason: '',
    },
  })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = methods

  const onSubmit = handleSubmit((values) => {
    if (correct.isPending) {
      return
    }
    correct.mutate(
      {
        subject: values.subject,
        resolution: values.resolution,
        moduleIds: values.moduleIds,
        organizationId: values.organization!.id,
        startedAt:
          values.startedAt !== original.startedAt
            ? new Date(values.startedAt).toISOString()
            : ticket.startedAt,
        endedAt:
          values.endedAt !== original.endedAt
            ? new Date(values.endedAt).toISOString()
            : (ticket.endedAt ?? new Date(values.endedAt).toISOString()),
        spokeWith: values.spokeWith,
        reason: values.reason,
      },
      {
        onSuccess: () => {
          toast.success('Atendimento corrigido')
          onOpenChange(false)
        },
      },
    )
  })

  return (
    <FormDialog
      locked
      open
      onOpenChange={onOpenChange}
      title="Corrigir atendimento"
      description="A correção fica registrada no histórico de alterações, com o motivo."
      submitLabel="Salvar correção"
      pending={correct.isPending}
      error={correct.error?.message}
      onSubmit={onSubmit}
    >
      <FormProvider {...methods}>
        <ClosingFields idPrefix="correction" modules={modules} />
      </FormProvider>
      <Field>
        <FieldLabel htmlFor="correction-spoke-with">Falou com</FieldLabel>
        <Input
          id="correction-spoke-with"
          maxLength={200}
          placeholder="Quem atendeu neste telefone"
          {...register('spokeWith')}
        />
      </Field>
      <Field data-invalid={!!errors.reason}>
        <FieldLabel htmlFor="correction-reason">Motivo da correção</FieldLabel>
        <Textarea
          id="correction-reason"
          maxLength={2000}
          aria-invalid={!!errors.reason}
          {...register('reason')}
        />
        <FieldError errors={[errors.reason]} />
      </Field>
    </FormDialog>
  )
}
