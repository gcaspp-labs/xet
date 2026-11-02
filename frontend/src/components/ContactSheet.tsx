import { zodResolver } from '@hookform/resolvers/zod'
import { useDeferredValue, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSectors } from '@/lib/admin'
import { useCurrentUser } from '@/lib/auth'
import {
  type Contact,
  type Organization,
  useActiveModulesOf,
  useContact,
  useOrganizations,
  useSaveContact,
  useSaveContactName,
} from '@/lib/directory'
import { formatCnpj, normalizePhone, organizationLabel } from '@/lib/format'

const organizationSchema = z.object({
  id: z.number(),
  name: z.string(),
  cnpj: z.string().nullable(),
  municipality: z.object({ id: z.number(), name: z.string() }),
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
  sectorIds: z.array(z.number()).min(1, 'Selecione ao menos um setor.'),
  modules: z.array(z.object({ id: z.number(), sectorId: z.number() })),
})

// Cadastro durante o atendimento, sem órgão: vale só o nome.
const nameOnlySchema = schema.extend({
  phone: z.string().transform(normalizePhone),
  organization: organizationSchema.nullable(),
  sectorIds: z.array(z.number()),
})

const fullResolver = zodResolver(schema)
const nameOnlyResolver = zodResolver(nameOnlySchema)

type FormValues = z.input<typeof schema>

// Busca os órgãos pré-cadastrados no servidor conforme o atendente digita.
export function OrganizationPicker({
  id,
  label: ariaLabel,
  placeholder = 'Busque por nome, município ou CNPJ',
  clearLabel,
  municipalityId,
  value,
  onChange,
  invalid = false,
}: {
  id?: string
  label?: string
  placeholder?: string
  clearLabel?: string
  // Com município, a lista traz só os órgãos dele.
  municipalityId?: number
  value: Organization | null
  onChange: (value: Organization | null) => void
  invalid?: boolean
}) {
  const label = (organization: Organization) =>
    organizationLabel(organization.name, organization.municipality.name)
  const [input, setInput] = useState(value ? label(value) : '')
  const deferredInput = useDeferredValue(input)
  // Com um órgão escolhido, o campo mostra o nome dele; a lista volta a ter todos.
  const { data: organizations = [] } = useOrganizations(
    value && deferredInput === label(value) ? '' : deferredInput,
    municipalityId,
  )

  return (
    <Combobox
      items={organizations}
      value={value}
      onValueChange={onChange}
      inputValue={input}
      onInputValueChange={setInput}
      itemToStringLabel={label}
      isItemEqualToValue={(a: Organization, b: Organization) => a.id === b.id}
      filter={null}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        aria-invalid={invalid}
        clearLabel={clearLabel}
      />
      <ComboboxContent>
        <ComboboxEmpty>Nenhum órgão encontrado.</ComboboxEmpty>
        <ComboboxList>
          {(organization: Organization) => (
            <ComboboxItem key={organization.id} value={organization}>
              <span className="min-w-0 flex-1 truncate">{label(organization)}</span>
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

const noModule = 'none'

export function ContactSheet({
  contact,
  open,
  onOpenChange,
  onSaved,
  organizationOptional = false,
}: {
  contact: Contact | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (saved: Contact) => void
  // Na conversa, o órgão é opcional: sem ele, grava-se só o nome (spec.md, Órgãos e contatos).
  organizationOptional?: boolean
}) {
  const save = useSaveContact()
  const saveName = useSaveContactName()
  const { data: user } = useCurrentUser()
  // Para atendente e supervisor, a lista traz só o próprio setor: os demais do
  // contato aparecem para leitura, e o backend os preserva.
  const { data: sectors = [] } = useSectors()
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormValues, unknown, z.output<typeof nameOnlySchema>>({
    resolver: (values, context, options) =>
      organizationOptional && values.organization === null
        ? nameOnlyResolver(values, context, options)
        : fullResolver(values, context, options),
    defaultValues: {
      name: contact?.name ?? '',
      phone: contact?.phone ?? '',
      organization: contact?.organization ?? null,
      sectorIds: contact?.sectors.length
        ? contact.sectors.map((sector) => sector.id)
        : user?.sectorId
          ? [user.sectorId]
          : [],
      modules: contact?.modules ?? [],
    },
  })
  const sectorIds = useWatch({ control, name: 'sectorIds' })
  const chosenModules = useWatch({ control, name: 'modules' })
  const organization = useWatch({ control, name: 'organization' })
  const nameOnly = organizationOptional && organization === null
  const editable = sectors.filter(
    (sector) => sector.active || contact?.sectors.some((linked) => linked.id === sector.id),
  )
  const isEditable = (sectorId: number) => sectors.some((sector) => sector.id === sectorId)
  const activeModules = useActiveModulesOf(sectorIds.filter(isEditable))
  const otherSectors = contact?.sectors.filter((sector) => !isEditable(sector.id)) ?? []
  const otherModules = contact?.modules.filter((module) => !isEditable(module.sectorId)) ?? []

  // Um módulo por setor: escolher outro substitui o do setor.
  const chooseModule = (sectorId: number, moduleId: string) => {
    const others = chosenModules.filter((module) => module.sectorId !== sectorId)
    setValue(
      'modules',
      moduleId === noModule ? others : [...others, { id: Number(moduleId), sectorId }],
    )
  }

  // Tirar um setor tira também o módulo dele.
  const toggleSector = (sectorId: number, checked: boolean) => {
    setValue(
      'sectorIds',
      checked ? [...sectorIds, sectorId] : sectorIds.filter((id) => id !== sectorId),
      { shouldValidate: errors.sectorIds !== undefined },
    )
    if (!checked) {
      setValue(
        'modules',
        getValues('modules').filter((module) => module.sectorId !== sectorId),
      )
    }
  }

  const onSubmit = handleSubmit((values) => {
    const finish = (saved: Contact, message: string) => {
      toast.success(message)
      onSaved?.(saved)
      onOpenChange(false)
    }
    if (contact && organizationOptional && values.organization === null) {
      saveName.mutate(
        { id: contact.id, name: values.name },
        { onSuccess: (saved) => finish(saved, 'Nome salvo') },
      )
      return
    }
    save.mutate(
      {
        id: contact?.id,
        name: values.name,
        phone: values.phone,
        organizationId: values.organization!.id,
        sectorIds: values.sectorIds,
        moduleIds: values.modules.map((module) => module.id),
      },
      { onSuccess: (saved) => finish(saved, 'Contato salvo') },
    )
  })

  let title = contact ? 'Editar contato' : 'Novo contato'
  let submitLabel = contact ? 'Salvar' : 'Cadastrar contato'
  if (organizationOptional) {
    title = 'Cadastrar contato'
    submitLabel = nameOnly ? 'Salvar nome' : 'Cadastrar contato'
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        organizationOptional
          ? 'Com órgão, o cadastro fica completo. Sem órgão, somente o nome é salvo: os demais dados são descartados e o contato continua não cadastrado.'
          : undefined
      }
      submitLabel={submitLabel}
      pending={save.isPending || saveName.isPending}
      error={(nameOnly ? saveName : save).error?.message}
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
          {organizationOptional && 'Opcional. '}Somente órgãos pré-cadastrados. Órgãos novos são
          cadastrados por um supervisor.
        </FieldDescription>
        <FieldError errors={[errors.organization]} />
      </Field>
      <FieldSet data-invalid={!!errors.sectorIds}>
        <FieldLegend variant="label">Setores</FieldLegend>
        <div className="flex flex-col gap-2">
          {editable.map((sector) => (
            <label key={sector.id} className="flex items-center gap-2">
              <Checkbox
                checked={sectorIds.includes(sector.id)}
                onCheckedChange={(checked) => toggleSector(sector.id, checked)}
              />
              {sector.name}
            </label>
          ))}
        </div>
        {otherSectors.length > 0 && (
          <FieldDescription>
            Também em: {otherSectors.map((sector) => sector.name).join(', ')}.
          </FieldDescription>
        )}
        <FieldError errors={[errors.sectorIds]} />
      </FieldSet>
      {editable
        .filter((sector) => sectorIds.includes(sector.id))
        .map((sector) => {
          // O módulo já vinculado continua na lista depois de desativado.
          const linked = contact?.modules.find((module) => module.sectorId === sector.id)
          const options = activeModules.filter((module) => module.sectorId === sector.id)
          const items = [
            { value: noModule, label: 'Sem módulo' },
            ...(linked && !options.some((module) => module.id === linked.id) ? [linked] : [])
              .concat(options)
              .map((module) => ({ value: String(module.id), label: module.name })),
          ]
          const chosen = chosenModules.find((module) => module.sectorId === sector.id)
          return (
            items.length > 1 && (
              <Field key={sector.id}>
                <FieldLabel htmlFor={`contact-module-${sector.id}`}>
                  Módulo em {sector.name}
                </FieldLabel>
                <Select
                  items={items}
                  value={chosen ? String(chosen.id) : noModule}
                  onValueChange={(value) => value && chooseModule(sector.id, value)}
                >
                  <SelectTrigger id={`contact-module-${sector.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Opcional. Vem marcado no encerramento.</FieldDescription>
              </Field>
            )
          )
        })}
      {otherModules.length > 0 && (
        <FieldDescription>
          Módulos de outros setores: {otherModules.map((module) => module.name).join(', ')}.
        </FieldDescription>
      )}
    </FormSheet>
  )
}

// Cadastro de um contato já existente, montado só aberto: o formulário espera os
// dados atuais, porque o nome pode ter mudado em outra tela depois da última consulta.
export function RegisterContactSheet({
  contactId,
  onOpenChange,
  onSaved,
  organizationOptional,
}: {
  contactId: number
  onOpenChange: (open: boolean) => void
  onSaved?: (saved: Contact) => void
  organizationOptional?: boolean
}) {
  const { data: contact, isFetchedAfterMount } = useContact(contactId, true)
  if (!contact || !isFetchedAfterMount) {
    return null
  }
  return (
    <ContactSheet
      contact={contact}
      open
      onOpenChange={onOpenChange}
      onSaved={onSaved}
      organizationOptional={organizationOptional}
    />
  )
}
