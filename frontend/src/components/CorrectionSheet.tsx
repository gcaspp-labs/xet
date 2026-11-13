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
import { useClosingQuestions } from '@/hooks/use-closing-questions'
import { checkPeriod, closingShape, localInput, sameText } from '@/lib/closing'
import { type TicketDetail, useClosingForm, useCorrectTicket } from '@/lib/conversation'

const schema = z
  .object({
    ...closingShape,
    spokeWith: z.string(),
    reason: z.string().trim().min(1, 'Informe o motivo da correção.'),
  })
  .superRefine(checkPeriod)

type FormValues = z.input<typeof schema>
type Values = z.output<typeof schema>

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
  const { data: form, refetch: refetchForm } = useClosingForm(ticket.id, true)
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

  const methods = useForm<FormValues, unknown, Values>({
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
    setError,
    setValue,
    formState: { errors },
  } = methods

  const saveCorrection = (
    values: Values,
    addSubject: boolean,
    addSolution: boolean,
    subjectModuleId?: number,
    solutionModuleId?: number,
  ) => {
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
        addSubject,
        addSolution,
        subjectModuleId,
        solutionModuleId,
      },
      {
        onSuccess: () => {
          toast.success('Atendimento corrigido')
          onOpenChange(false)
        },
        // Se o servidor recusar, o aviso aparece no formulário.
        onError: async (error) => {
          if (error.message !== 'Escolha módulos ativos do setor do chamado.') {
            questions.reset()
            return
          }
          const { data: refreshed } = await refetchForm()
          if (!refreshed) {
            questions.reset()
            return
          }
          const activeIds = values.moduleIds.filter((id) =>
            refreshed.modules.some((module) => module.id === id),
          )
          const keptIds = values.moduleIds.filter(
            (id) => activeIds.includes(id) || recorded.some((module) => module.id === id),
          )
          setValue('moduleIds', keptIds)
          if (activeIds.length === 0) {
            questions.reset()
            setError('moduleIds', {
              message: 'Os módulos marcados foram desativados. Marque outro módulo ativo.',
            })
          } else if (addSubject) {
            questions.retry({ ...values, moduleIds: keptIds })
          } else {
            questions.reset()
          }
        },
      },
    )
  }

  // Só pergunta sobre o assunto e a resolução alterados nesta correção, para
  // não perguntar sobre textos que já estavam no chamado.
  const questions = useClosingQuestions<Values>({
    subjects: form?.subjects ?? [],
    modules: form?.modules ?? [],
    askSubject: (values) => !sameText(values.subject, ticket.subject ?? ''),
    askSolution: (values) => !sameText(values.resolution, ticket.resolution ?? ''),
    save: saveCorrection,
  })

  const onSubmit = handleSubmit((values) => {
    if (correct.isPending) {
      return
    }
    const newSubject =
      !sameText(values.subject, ticket.subject ?? '') &&
      !form?.subjects.some(
        (subject) =>
          values.moduleIds.includes(subject.moduleId) && sameText(subject.name, values.subject),
      )
    if (newSubject && !form?.modules.some((module) => values.moduleIds.includes(module.id))) {
      setError('moduleIds', { message: 'Marque ao menos um módulo ativo para salvar.' })
      return
    }
    questions.start(values)
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
      question={questions.question}
    >
      <FormProvider {...methods}>
        <ClosingFields idPrefix="correction" modules={modules} subjects={form?.subjects ?? []} />
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
