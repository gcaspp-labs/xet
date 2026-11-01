import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { OrganizationPicker } from '@/components/ContactSheet'
import { FormSheet } from '@/components/FormSheet'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type TicketDetail, useClosingForm, useCorrectTicket } from '@/lib/conversation'
import type { Organization } from '@/lib/directory'

// Valor de <input type="datetime-local"> no horário do navegador: 2026-03-02T14:05.
const localInput = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm")

const schema = z
  .object({
    subject: z.string().trim().min(1, 'Informe o assunto.'),
    resolution: z.string().trim().min(1, 'Informe a resolução.'),
    moduleIds: z.array(z.number()).min(1, 'Selecione ao menos um módulo.'),
    organization: z
      .object({ id: z.number(), name: z.string(), cnpj: z.string().nullable() })
      .nullable()
      .refine((value) => value !== null, 'Selecione o órgão do atendimento.'),
    startedAt: z.string().min(1, 'Informe o início.'),
    endedAt: z.string().min(1, 'Informe o fim.'),
    spokeWith: z.string(),
    reason: z.string().trim().min(1, 'Informe o motivo da correção.'),
  })
  .refine((values) => new Date(values.endedAt) <= new Date(), {
    path: ['endedAt'],
    message: 'O fim não pode estar no futuro.',
  })
  .refine((values) => values.endedAt >= values.startedAt, {
    path: ['endedAt'],
    message: 'O fim precisa ser depois do início.',
  })

type FormValues = z.input<typeof schema>

// Drawer de correção do atendimento encerrado (spec.md, Encerramento, retorno
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

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues, unknown, z.output<typeof schema>>({
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
    <FormSheet
      open
      onOpenChange={onOpenChange}
      title="Corrigir atendimento"
      description="A correção fica registrada no histórico de alterações, com o motivo."
      submitLabel="Salvar correção"
      pending={correct.isPending}
      error={correct.error?.message}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.subject}>
        <FieldLabel htmlFor="correction-subject">Assunto</FieldLabel>
        <Input
          id="correction-subject"
          maxLength={500}
          aria-invalid={!!errors.subject}
          {...register('subject')}
        />
        <FieldError errors={[errors.subject]} />
      </Field>
      <Field data-invalid={!!errors.resolution}>
        <FieldLabel htmlFor="correction-resolution">Resolução</FieldLabel>
        <Textarea
          id="correction-resolution"
          maxLength={10000}
          aria-invalid={!!errors.resolution}
          {...register('resolution')}
        />
        <FieldError errors={[errors.resolution]} />
      </Field>
      <Controller
        control={control}
        name="moduleIds"
        render={({ field }) => (
          <FieldSet data-invalid={!!errors.moduleIds}>
            <FieldLegend variant="label">Módulos</FieldLegend>
            <div className="flex flex-col gap-2">
              {modules.map((module) => (
                <label key={module.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={field.value.includes(module.id)}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked
                          ? [...field.value, module.id]
                          : field.value.filter((id) => id !== module.id),
                      )
                    }
                  />
                  {module.name}
                </label>
              ))}
            </div>
            <FieldError errors={[errors.moduleIds]} />
          </FieldSet>
        )}
      />
      <Field data-invalid={!!errors.organization}>
        <FieldLabel htmlFor="correction-organization">Órgão</FieldLabel>
        <Controller
          control={control}
          name="organization"
          render={({ field }) => (
            <OrganizationPicker
              key={field.value?.id ?? 'none'}
              id="correction-organization"
              value={field.value as Organization | null}
              onChange={field.onChange}
              invalid={!!errors.organization}
            />
          )}
        />
        <FieldDescription>Trocar o órgão vale só para este chamado.</FieldDescription>
        <FieldError errors={[errors.organization]} />
      </Field>
      <div className="grid gap-[15px] sm:grid-cols-2">
        <Field data-invalid={!!errors.startedAt}>
          <FieldLabel htmlFor="correction-started-at">Início</FieldLabel>
          <Input
            id="correction-started-at"
            type="datetime-local"
            className="mono-num"
            aria-invalid={!!errors.startedAt}
            {...register('startedAt')}
          />
          <FieldError errors={[errors.startedAt]} />
        </Field>
        <Field data-invalid={!!errors.endedAt}>
          <FieldLabel htmlFor="correction-ended-at">Fim</FieldLabel>
          <Input
            id="correction-ended-at"
            type="datetime-local"
            className="mono-num"
            aria-invalid={!!errors.endedAt}
            {...register('endedAt')}
          />
          <FieldError errors={[errors.endedAt]} />
        </Field>
      </div>
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
    </FormSheet>
  )
}
