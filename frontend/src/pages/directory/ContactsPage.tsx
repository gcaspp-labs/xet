import { zodResolver } from '@hookform/resolvers/zod'
import { BookUser, Plus } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormSheet } from '@/components/FormSheet'
import { SearchBox } from '@/components/SearchBox'
import { PageContent, Topbar } from '@/components/Topbar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
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
import {
  type Contact,
  type Organization,
  searchLimit,
  useContacts,
  useOrganizations,
  useSaveContact,
} from '@/lib/directory'
import { formatCnpj, formatPhone, normalizePhone } from '@/lib/format'

const organizationSchema = z.object({
  id: z.number(),
  name: z.string(),
  cnpj: z.string().nullable(),
})

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do contato.'),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((value) => /^\d{10,15}$/.test(value), 'Informe o telefone com DDI e DDD.'),
  organization: organizationSchema
    .nullable()
    .refine((value) => value !== null, 'Selecione o órgão do contato.'),
})

type FormValues = z.input<typeof schema>

// Busca os órgãos pré-cadastrados no servidor conforme o atendente digita.
function OrganizationPicker({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: Organization | null
  onChange: (value: Organization | null) => void
  invalid: boolean
}) {
  const [input, setInput] = useState(value?.name ?? '')
  const deferredInput = useDeferredValue(input)
  // Com um órgão escolhido, o campo mostra o nome dele; a lista volta a ter todos.
  const { data: organizations = [] } = useOrganizations(
    value && deferredInput === value.name ? '' : deferredInput,
  )

  return (
    <Combobox
      items={organizations}
      value={value}
      onValueChange={onChange}
      inputValue={input}
      onInputValueChange={setInput}
      itemToStringLabel={(organization: Organization) => organization.name}
      isItemEqualToValue={(a: Organization, b: Organization) => a.id === b.id}
      filter={null}
    >
      <ComboboxInput id={id} placeholder="Busque por nome ou CNPJ" aria-invalid={invalid} />
      <ComboboxContent>
        <ComboboxEmpty>Nenhum órgão encontrado.</ComboboxEmpty>
        <ComboboxList>
          {(organization: Organization) => (
            <ComboboxItem key={organization.id} value={organization}>
              <span className="min-w-0 flex-1 truncate">{organization.name}</span>
              {organization.cnpj && (
                <span className="mono-num caption text-ink-faint">
                  {formatCnpj(organization.cnpj)}
                </span>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function ContactSheet({
  contact,
  open,
  onOpenChange,
}: {
  contact: Contact | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveContact()
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: contact?.name ?? '',
      phone: contact?.phone ?? '',
      organization: contact?.organization ?? null,
    },
  })

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      {
        id: contact?.id,
        name: values.name,
        phone: values.phone,
        organizationId: values.organization!.id,
      },
      {
        onSuccess: () => {
          toast.success('Contato salvo')
          onOpenChange(false)
        },
      },
    ),
  )

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={contact ? 'Editar contato' : 'Novo contato'}
      submitLabel={contact ? 'Salvar' : 'Cadastrar contato'}
      pending={save.isPending}
      error={save.error?.message}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="contact-name">Nome</FieldLabel>
        <Input id="contact-name" aria-invalid={!!errors.name} {...register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.phone}>
        <FieldLabel htmlFor="contact-phone">Telefone (WhatsApp)</FieldLabel>
        <Input
          id="contact-phone"
          inputMode="tel"
          className="mono-num"
          aria-invalid={!!errors.phone}
          {...register('phone')}
        />
        <FieldDescription>Com DDI e DDD, por exemplo 55 11 99999-0000.</FieldDescription>
        <FieldError errors={[errors.phone]} />
      </Field>
      <Field data-invalid={!!errors.organization}>
        <FieldLabel htmlFor="contact-organization">Órgão</FieldLabel>
        <Controller
          control={control}
          name="organization"
          render={({ field }) => (
            <OrganizationPicker
              id="contact-organization"
              value={field.value}
              onChange={field.onChange}
              invalid={!!errors.organization}
            />
          )}
        />
        <FieldDescription>
          Somente órgãos pré-cadastrados. Órgãos novos são cadastrados por um supervisor.
        </FieldDescription>
        <FieldError errors={[errors.organization]} />
      </Field>
    </FormSheet>
  )
}

export default function ContactsPage() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const { data: contacts, isPending } = useContacts(deferredQuery)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [open, setOpen] = useState(false)
  // Nova chave a cada abertura: o formulário começa sempre limpo.
  const [sheetKey, setSheetKey] = useState(0)

  const openSheet = (contact: Contact | null) => {
    setEditing(contact)
    setSheetKey((key) => key + 1)
    setOpen(true)
  }

  return (
    <>
      <Topbar
        breadcrumb="Cadastro"
        title="Contatos"
        action={
          <Button onClick={() => openSheet(null)}>
            <Plus strokeWidth={1.7} aria-hidden />
            Novo contato
          </Button>
        }
      />
      <PageContent>
        <SearchBox
          value={query}
          onChange={setQuery}
          label="Buscar contatos"
          placeholder="Nome, telefone ou CNPJ"
        />
        <Card>
          {contacts && contacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <p className="body-strong">{contact.name}</p>
                      <p className="mono-num caption text-ink-faint">
                        {contact.phone ? formatPhone(contact.phone) : 'Sem telefone'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {contact.organization ? (
                        <>
                          <p>{contact.organization.name}</p>
                          {contact.organization.cnpj && (
                            <p className="mono-num caption text-ink-faint">
                              {formatCnpj(contact.organization.cnpj)}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-faint">Sem órgão</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${contact.name}`}
                        onClick={() => openSheet(contact)}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            !isPending && (
              <Empty>
                <EmptyMedia>
                  <BookUser strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>
                  {deferredQuery.trim()
                    ? 'Nenhum contato encontrado.'
                    : 'Nenhum contato cadastrado.'}
                </EmptyDescription>
              </Empty>
            )
          )}
        </Card>
        {contacts?.length === searchLimit && (
          <p className="caption text-ink-faint">
            Mostrando os {searchLimit} primeiros resultados. Refine a busca para encontrar outros.
          </p>
        )}
      </PageContent>
      <ContactSheet key={sheetKey} contact={editing} open={open} onOpenChange={setOpen} />
    </>
  )
}
