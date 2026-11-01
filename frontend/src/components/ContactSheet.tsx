import { zodResolver } from '@hookform/resolvers/zod'
import { useDeferredValue, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormSheet } from '@/components/FormSheet'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { type Contact, type Organization, useOrganizations, useSaveContact } from '@/lib/directory'
import { formatCnpj, normalizePhone } from '@/lib/format'

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
export function OrganizationPicker({
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

export function ContactSheet({
  contact,
  open,
  onOpenChange,
  onSaved,
}: {
  contact: Pick<Contact, 'id' | 'name' | 'phone' | 'organization'> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
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
          onSaved?.()
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
