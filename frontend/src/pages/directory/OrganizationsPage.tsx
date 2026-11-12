import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, Landmark, Plus } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormDialog } from '@/components/FormDialog'
import { MunicipalityPicker } from '@/components/MunicipalityPicker'
import { Pagination } from '@/components/Pagination'
import { SearchBox } from '@/components/SearchBox'
import { SortableTableHead } from '@/components/SortableTableHead'
import { HistorySheet } from '@/components/TicketHistory'
import { PageContent, Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  defaultOrganizationColumn,
  type Organization,
  organizationColumns,
  useLookupCnpj,
  useMunicipalities,
  useOrganizations,
  useSaveOrganization,
} from '@/lib/directory'
import { formatCnpj, isValidCnpj, normalizeCnpj, organizationLabel } from '@/lib/format'
import { usePagedList, useQueryState } from '@/lib/paging'

const invalidCnpjMessage = 'CNPJ inválido. Confira os 14 caracteres.'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do órgão.'),
  municipality: z
    .object({ id: z.number(), name: z.string() })
    .nullable()
    .refine((value) => value !== null, 'Selecione o município do órgão.'),
  cnpj: z
    .string()
    .transform(normalizeCnpj)
    .refine((value) => value === '' || isValidCnpj(value), invalidCnpjMessage),
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
  const lookup = useLookupCnpj()
  const { data: municipalities = [] } = useMunicipalities(open)
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    setError,
    clearErrors,
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

  // A consulta só preenche o formulário: nada é salvo sem a confirmação de quem cadastra.
  const onLookup = () => {
    const cnpj = normalizeCnpj(getValues('cnpj'))
    if (!isValidCnpj(cnpj)) {
      lookup.reset()
      setError('cnpj', { message: invalidCnpjMessage })
      return
    }
    clearErrors('cnpj')
    lookup.mutate(cnpj, {
      onSuccess: ({ name, municipality }) => {
        setValue('name', name)
        setValue('municipality', municipality)
        clearErrors('name')
        if (municipality) {
          clearErrors('municipality')
        }
      },
    })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={organization ? 'Editar órgão' : 'Novo órgão'}
      submitLabel={organization ? 'Salvar' : 'Cadastrar órgão'}
      pending={save.isPending}
      error={save.error?.message}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.cnpj}>
        <FieldLabel htmlFor="organization-cnpj">CNPJ</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="organization-cnpj"
            className="mono-num uppercase"
            aria-invalid={!!errors.cnpj}
            {...register('cnpj', { onChange: () => lookup.reset() })}
          />
          <Button type="button" variant="outline" disabled={lookup.isPending} onClick={onLookup}>
            {lookup.isPending ? 'Consultando...' : 'Consultar'}
          </Button>
        </div>
        <FieldDescription>Opcional. Aceita o CNPJ numérico e o alfanumérico.</FieldDescription>
        <FieldError errors={[errors.cnpj]} />
      </Field>
      {lookup.isSuccess && lookup.data.municipality && (
        <p role="status" className="caption text-ink-soft">
          Nome e município sugeridos pela consulta. Confira os dados antes de salvar.
        </p>
      )}
      {(lookup.isError || (lookup.isSuccess && !lookup.data.municipality)) && (
        <Alert variant="warning">
          <CircleAlert strokeWidth={1.7} aria-hidden />
          <AlertDescription>
            {lookup.error?.message ??
              'Município não encontrado na lista. Selecione o município e confira o nome antes de salvar.'}
          </AlertDescription>
        </Alert>
      )}
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
    </FormDialog>
  )
}

export default function OrganizationsPage() {
  const { data: user } = useCurrentUser()
  // Órgãos são cadastrados por supervisores e administradores; o backend também recusa.
  const canEdit = user?.role === 'supervisor' || user?.role === 'admin'
  // Busca, página e ordem ficam no endereço (?busca=, ?pagina=, ?ordem=, ?direcao=):
  // reabrir o link devolve a mesma lista; mudar a busca volta à página 1.
  const { params, update } = useQueryState()
  const query = params.get('busca') ?? ''
  const setQuery = (value: string) =>
    update({ busca: value === '' ? null : value, pagina: null }, true)
  const deferredQuery = useDeferredValue(query)
  const list = usePagedList(organizationColumns, defaultOrganizationColumn)
  const { data, isPending, isPlaceholderData } = useOrganizations(
    deferredQuery,
    undefined,
    list.request,
  )
  const organizations = data?.items
  const served = data && !isPlaceholderData ? data.page : undefined
  const { correctPage } = list
  // Página além da última: o servidor devolve a última, e o endereço acompanha.
  useEffect(() => {
    if (served !== undefined) {
      correctPage(served)
    }
  }, [served, correctPage])
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
        <Card className="gap-0 py-0">
          {organizations && organizations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Órgão" column="nome" list={list} />
                  <SortableTableHead label="Município" column="municipio" list={list} />
                  <SortableTableHead label="CNPJ" column="cnpj" list={list} />
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
          {data && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              noun={['órgão', 'órgãos']}
              onPage={list.setPage}
            />
          )}
        </Card>
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
