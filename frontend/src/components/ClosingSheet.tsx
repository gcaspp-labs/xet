import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { ClosingFields } from '@/components/ClosingFields'
import { RegisterContactSheet } from '@/components/ContactSheet'
import { FormDialog } from '@/components/FormDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { FieldDescription } from '@/components/ui/field'
import { useClosingQuestions } from '@/hooks/use-closing-questions'
import { checkPeriod, closingShape, localInput } from '@/lib/closing'
import { type TicketDetail, ticketKey, useCloseTicket, useClosingForm } from '@/lib/conversation'
import { formatPhone } from '@/lib/format'
import { LastMessageWarning } from '@/prototype/LastMessageWarning'

const schema = z.object(closingShape).superRefine(checkPeriod)

type FormValues = z.input<typeof schema>
type Values = z.output<typeof schema>

// Janela de encerramento (spec.md, Formulário de encerramento): assunto,
// resolução e módulos obrigatórios; contato, atendente e setor automáticos;
// órgão, início e fim sugeridos e editáveis. O backend confere tudo de novo.
// A transferência para outro setor não passa por aqui: tem janela própria
// (SectorTransferSheet).
export function ClosingSheet({
  ticket,
  open,
  onOpenChange,
  successTo = '/chamados',
}: {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  successTo?: string
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: form, refetch: refetchForm } = useClosingForm(ticket.id, open)
  const close = useCloseTicket(ticket.id, ticket.sector.id)
  const [registering, setRegistering] = useState(false)
  // Horários sugeridos na abertura; só os alterados vão ao backend.
  const [suggested] = useState(() => ({
    startedAt: localInput(new Date(ticket.startedAt)),
    endedAt: localInput(new Date()),
  }))

  const methods = useForm<FormValues, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: '',
      resolution: '',
      moduleIds: [],
      organization: null,
      ...suggested,
    },
  })
  const { handleSubmit, getValues, setValue, setError } = methods

  // O órgão sugerido chega com o formulário ou depois do cadastro do contato.
  useEffect(() => {
    if (form?.organization && getValues('organization') === null) {
      setValue('organization', { ...form.organization, cnpj: null })
    }
  }, [form?.organization, getValues, setValue])

  // Os módulos do contato vêm marcados, com o formulário ou depois do cadastro,
  // sem desfazer o que a pessoa já marcou.
  const contactModules = useRef('')
  useEffect(() => {
    const ids = form?.contactModuleIds ?? []
    if (ids.join() !== contactModules.current) {
      contactModules.current = ids.join()
      if (getValues('moduleIds').length === 0) {
        setValue('moduleIds', ids)
      }
    }
  }, [form?.contactModuleIds, getValues, setValue])

  const saveForm = (
    values: Values,
    addSubject: boolean,
    addSolution: boolean,
    subjectModuleId?: number,
    solutionModuleId?: number,
  ) => {
    if (close.isPending) {
      return
    }
    const body = {
      subject: values.subject,
      resolution: values.resolution,
      moduleIds: values.moduleIds,
      organizationId: values.organization!.id,
      startedAt:
        values.startedAt !== suggested.startedAt
          ? new Date(values.startedAt).toISOString()
          : undefined,
      endedAt:
        values.endedAt !== suggested.endedAt ? new Date(values.endedAt).toISOString() : undefined,
      addSubject,
      addSolution,
      subjectModuleId,
      solutionModuleId,
    }
    const onSuccess = () => {
      toast.success('Chamado encerrado')
      onOpenChange(false)
      // A próxima ação depois de encerrar está no painel.
      void navigate(successTo)
    }
    // Se o servidor recusar, o aviso aparece no formulário.
    const onError = async (error: Error) => {
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
      setValue('moduleIds', activeIds)
      if (activeIds.length === 0) {
        questions.reset()
        setError('moduleIds', {
          message: 'Os módulos marcados foram desativados. Marque outro módulo ativo.',
        })
      } else if (addSubject) {
        questions.retry({ ...values, moduleIds: activeIds })
      } else {
        questions.reset()
      }
    }
    close.mutate(body, { onSuccess, onError })
  }

  // Assunto fora da lista do setor e resolução fora da lista do assunto:
  // pergunta antes de gravar.
  const questions = useClosingQuestions<Values>({
    subjects: form?.subjects ?? [],
    modules: form?.modules ?? [],
    save: saveForm,
  })

  const onSubmit = handleSubmit(
    (values) => {
      if (close.isPending) {
        return
      }
      questions.start(values)
    },
    () => undefined,
  )

  const row = (label: string, value: string) => (
    <div>
      <dt className="label text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  )

  return (
    <>
      <FormDialog
        locked
        open={open}
        onOpenChange={onOpenChange}
        title="Encerrar chamado"
        description="O chamado só é encerrado depois de salvar o registro do atendimento."
        submitLabel="Encerrar"
        pending={close.isPending}
        error={close.error?.message}
        onSubmit={onSubmit}
        question={questions.question}
      >
        <LastMessageWarning ticketId={ticket.id} />
        {!ticket.contact.registered && (
          <Alert variant="warning">
            <TriangleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription className="flex flex-col items-start gap-2">
              Contato não cadastrado. Cadastre o contato e vincule-o a um órgão antes de encerrar.
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRegistering(true)}
              >
                Cadastrar contato
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <dl className="grid grid-cols-2 gap-3">
          {row(
            'Contato',
            ticket.contact.phone
              ? `${ticket.contact.name} · ${formatPhone(ticket.contact.phone)}`
              : ticket.contact.name,
          )}
          {row('Setor', ticket.sector.name)}
          {row('Atendente', ticket.assignee?.name ?? '')}
        </dl>
        <FormProvider {...methods}>
          <ClosingFields
            idPrefix="closing"
            modules={form?.modules ?? []}
            subjects={form?.subjects ?? []}
            emptyModules={
              form
                ? 'O setor não tem módulos ativos. Peça a um supervisor para cadastrá-los.'
                : undefined
            }
          />
        </FormProvider>
        <FieldDescription>
          Alterações de horário ficam registradas no histórico de auditoria.
        </FieldDescription>
      </FormDialog>
      {registering && (
        <RegisterContactSheet
          contactId={ticket.contact.id}
          onOpenChange={setRegistering}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ticketKey(ticket.id) })}
        />
      )}
    </>
  )
}
