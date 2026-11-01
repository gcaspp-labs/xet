import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { ClosingFields } from '@/components/ClosingFields'
import { ContactSheet } from '@/components/ContactSheet'
import { FormSheet } from '@/components/FormSheet'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { checkPeriod, closingShape, localInput } from '@/lib/closing'
import {
  type TicketDetail,
  ticketKey,
  useCloseTicket,
  useClosingForm,
  useTransferSector,
  useTransferSectors,
} from '@/lib/conversation'
import { formatPhone } from '@/lib/format'

const schema = z.object(closingShape).superRefine(checkPeriod)

type FormValues = z.input<typeof schema>

// Drawer de encerramento (spec.md, Formulário de encerramento): assunto,
// resolução e módulos obrigatórios; contato, atendente e setor automáticos;
// órgão, início e fim sugeridos e editáveis. Com `transfer`, o mesmo
// formulário encerra a etapa e transfere o chamado para outro setor
// (spec.md, Transferências entre setores). O backend confere tudo de novo.
export function ClosingSheet({
  ticket,
  open,
  onOpenChange,
  transfer = false,
}: {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  transfer?: boolean
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: form } = useClosingForm(ticket.id, open)
  const close = useCloseTicket(ticket.id, ticket.sector.id)
  const transferSector = useTransferSector(ticket.id, ticket.sector.id)
  const save = transfer ? transferSector : close
  const { data: sectors } = useTransferSectors(ticket.id, open && transfer)
  const [sectorId, setSectorId] = useState<string | null>(null)
  const [sectorError, setSectorError] = useState<string>()
  const [registering, setRegistering] = useState(false)
  // Horários sugeridos na abertura; só os alterados vão ao backend.
  const [suggested] = useState(() => ({
    startedAt: localInput(new Date(ticket.startedAt)),
    endedAt: localInput(new Date()),
  }))

  const methods = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject: '',
      resolution: '',
      moduleIds: [],
      organization: null,
      ...suggested,
    },
  })
  const { handleSubmit, getValues, setValue } = methods

  // O órgão sugerido chega com o formulário ou depois do cadastro do contato.
  useEffect(() => {
    if (form?.organization && getValues('organization') === null) {
      setValue('organization', { ...form.organization, cnpj: null })
    }
  }, [form?.organization, getValues, setValue])

  const onSubmit = handleSubmit(
    (values) => {
      if (save.isPending || (transfer && !sectorId)) {
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
      }
      const onSuccess = () => {
        toast.success(transfer ? 'Chamado transferido para outro setor' : 'Chamado encerrado')
        onOpenChange(false)
        // A próxima ação depois de encerrar ou transferir está no painel.
        void navigate('/')
      }
      if (transfer) {
        transferSector.mutate({ ...body, sectorId: Number(sectorId) }, { onSuccess })
      } else {
        close.mutate(body, { onSuccess })
      }
    },
    () => undefined,
  )

  // O destino é conferido junto com os campos do formulário.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    setSectorError(transfer && !sectorId ? 'Escolha o setor de destino.' : undefined)
    void onSubmit(event)
  }

  const sectorItems = (sectors ?? []).map((sector) => ({
    value: String(sector.id),
    label: sector.name,
  }))

  const row = (label: string, value: string) => (
    <div>
      <dt className="label text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  )

  return (
    <>
      <FormSheet
        open={open}
        onOpenChange={onOpenChange}
        title={transfer ? 'Transferir para outro setor' : 'Encerrar chamado'}
        description={
          transfer
            ? 'A etapa deste setor é encerrada com o registro do atendimento, e um novo chamado entra na fila do destino.'
            : 'O chamado só é encerrado depois de salvar o registro do atendimento.'
        }
        submitLabel={transfer ? 'Transferir' : 'Encerrar'}
        pending={save.isPending}
        error={save.error?.message}
        onSubmit={submit}
      >
        {!ticket.contact.registered && (
          <Alert variant="warning">
            <TriangleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription className="flex flex-col items-start gap-2">
              Contato não cadastrado. Cadastre o contato e vincule-o a um órgão antes de{' '}
              {transfer ? 'transferir' : 'encerrar'}.
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
        {transfer && (
          <Field data-invalid={!!sectorError}>
            <FieldLabel htmlFor="transfer-sector">Setor de destino</FieldLabel>
            <Select
              items={sectorItems}
              value={sectorId}
              onValueChange={(value) => setSectorId(value)}
            >
              <SelectTrigger id="transfer-sector" aria-invalid={!!sectorError}>
                <SelectValue placeholder="Escolha o setor" />
              </SelectTrigger>
              <SelectContent>
                {sectorItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sectors && sectors.length === 0 && (
              <FieldDescription>Não há outro setor ativo.</FieldDescription>
            )}
            <FieldError errors={sectorError ? [{ message: sectorError }] : []} />
          </Field>
        )}
        <FormProvider {...methods}>
          <ClosingFields
            idPrefix="closing"
            modules={form?.modules ?? []}
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
      </FormSheet>
      <ContactSheet
        key={registering ? 'open' : 'closed'}
        contact={{
          id: ticket.contact.id,
          name: ticket.contact.name,
          phone: ticket.contact.phone,
          organization: null,
        }}
        open={registering}
        onOpenChange={setRegistering}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ticketKey(ticket.id) })}
      />
    </>
  )
}
