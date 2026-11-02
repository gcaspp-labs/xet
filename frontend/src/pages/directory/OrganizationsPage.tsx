import { zodResolver } from '@hookform/resolvers/zod'
import { Landmark, Plus } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormSheet } from '@/components/FormSheet'
import { MunicipalityPicker } from '@/components/MunicipalityPicker'
import { SearchBox } from '@/components/SearchBox'
import { HistorySheet } from '@/components/TicketHistory'
import { PageContent, Topbar } from '@/components/Topbar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCurrentUser } from '@/lib/auth'
import {
  type Organization,
  searchLimit,
  useMunicipalities,
  useOrganizations,
  useSaveOrganization,
} from '@/lib/directory'
import { formatCnpj, isValidCnpj, normalizeCnpj, organizationLabel } from '@/lib/format'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do órgão.'),
  municipality: z
    .object({ id: z.number(), name: z.string() })
    .nullable()
    .refine((value) => value !== null, 'Selecione o município do órgão.'),
  cnpj: z
    .string()
    .transform(normalizeCnpj)
    .refine(
      (value) => value === '' || isValidCnpj(value),
      'CNPJ inválido. Confira os 14 caracteres.',
    ),
})

type FormValues = z.input<typeof schema>

function OrganizationSheet({
  organization,
  open,
  onOpenChange,
}: {
  organization: Organization | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveOrganization()
  const { data: municipalities = [] } = useMunicipalities(open)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: organization?.name ?? '',
      municipality: organization?.municipality ?? null,
      cnpj: organization?.cnpj ? formatCnpj(organization.cnpj) : '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      {
        id: organization?.id,
        name: values.name,
        cnpj: values.cnpj,
        municipalityId: values.municipality!.id,
      },
      {
        onSuccess: () => {
          toast.success('Órgão salvo')
          onOpenChange(false)
        },
      },
    ),
  )

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={organization ? 'Editar órgão' : 'Novo órgão'}
      submitLabel={organization ? 'Salvar' : 'Cadastrar órgão'}
      pending={save.isPending}
      error={save.error?.message}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="organization-name">Nome</FieldLabel>
        <Input id="organization-name" aria-invalid={!!errors.name} {...register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.municipality}>
        <FieldLabel htmlFor="organization-municipality">Município</FieldLabel>
        <Controller
          control={control}
          name="municipality"
          render={({ field }) => (
            <MunicipalityPicker
              id="organization-municipality"
              municipalities={municipalities}
              value={field.value}
              onChange={field.onChange}
              invalid={!!errors.municipality}
            />
          )}
        />
        <FieldError errors={[errors.municipality]} />
      </Field>
      <Field data-invalid={!!errors.cnpj}>
        <FieldLabel htmlFor="organization-cnpj">CNPJ</FieldLabel>
        <Input
          id="organization-cnpj"
          className="mono-num uppercase"
          aria-invalid={!!errors.cnpj}
          {...register('cnpj')}
        />
        <FieldDescription>Opcional. Aceita o CNPJ numérico e o alfanumérico.</FieldDescription>
        <FieldError errors={[errors.cnpj]} />
      </Field>
    </FormSheet>
  )
}

export default function OrganizationsPage() {
  const { data: user } = useCurrentUser()
  // Órgãos são cadastrados por supervisores e administradores; o backend também recusa.
  const canEdit = user?.role === 'supervisor' || user?.role === 'admin'
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const { data: organizations, isPending } = useOrganizations(deferredQuery)
  const [editing, setEditing] = useState<Organization | null>(null)
  const [open, setOpen] = useState(false)
  // Nova chave a cada abertura: o formulário começa sempre limpo.
  const [sheetKey, setSheetKey] = useState(0)
  const [history, setHistory] = useState<Organization | null>(null)

  const openSheet = (organization: Organization | null) => {
    setEditing(organization)
    setSheetKey((key) => key + 1)
    setOpen(true)
  }

  return (
    <>
      <Topbar
        breadcrumb="Cadastro"
        title="Órgãos"
        action={
          canEdit && (
            <Button onClick={() => openSheet(null)}>
              <Plus strokeWidth={1.7} aria-hidden />
              Novo órgão
            </Button>
          )
        }
      />
      <PageContent>
        <SearchBox
          value={query}
          onChange={setQuery}
          label="Buscar órgãos"
          placeholder="Nome, município ou CNPJ"
        />
        <Card>
          {organizations && organizations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Órgão</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((organization) => (
                  <TableRow key={organization.id}>
                    <TableCell className="body-strong">{organization.name}</TableCell>
                    <TableCell>{organization.municipality.name}</TableCell>
                    <TableCell className="mono-num">
                      {organization.cnpj ? formatCnpj(organization.cnpj) : '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Histórico de ${organization.name}`}
                        onClick={() => setHistory(organization)}
                      >
                        Histórico
                      </Button>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Editar ${organization.name}`}
                          onClick={() => openSheet(organization)}
                        >
                          Editar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            !isPending && (
              <Empty>
                <EmptyMedia>
                  <Landmark strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>
                  {deferredQuery.trim() ? 'Nenhum órgão encontrado.' : 'Nenhum órgão cadastrado.'}
                </EmptyDescription>
              </Empty>
            )
          )}
        </Card>
        {organizations?.length === searchLimit && (
          <p className="caption text-ink-faint">
            Mostrando os {searchLimit} primeiros resultados. Refine a busca para encontrar outros.
          </p>
        )}
      </PageContent>
      <OrganizationSheet key={sheetKey} organization={editing} open={open} onOpenChange={setOpen} />
      <HistorySheet
        target={
          history && {
            kind: 'organization',
            id: history.id,
            name: organizationLabel(history.name, history.municipality.name),
          }
        }
        onClose={() => setHistory(null)}
      />
    </>
  )
}
