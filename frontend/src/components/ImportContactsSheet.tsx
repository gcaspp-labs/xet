import { type FormEventHandler, useState } from 'react'
import { OrganizationPicker } from '@/components/ContactSheet'
import { FormDialog } from '@/components/FormDialog'
import { SearchBox } from '@/components/SearchBox'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { FieldDescription, Field, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
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
  type ImportResult,
  type Organization,
  type SavedContact,
  useImportContacts,
  useSavedContacts,
} from '@/lib/directory'
import { formatPhone } from '@/lib/format'

// Compara sem diferenciar maiúsculas nem acentos ("joao" encontra "João").
function folded(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function matches(contact: SavedContact, query: string) {
  const digits = query.replace(/\D/g, '')
  return (
    folded(contact.name).includes(folded(query.trim())) ||
    (digits !== '' && contact.phone.includes(digits))
  )
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

// Importação pela agenda do número do setor (spec.md, Importar contatos do
// WhatsApp): atendente e supervisor usam o próprio setor; o administrador escolhe.
export function ImportContactsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: user } = useCurrentUser()
  const isAdmin = user?.role === 'admin'
  const { data: sectors = [] } = useSectors()
  const [chosenSector, setChosenSector] = useState<number>()
  const sectorId = isAdmin ? chosenSector : (user?.sectorId ?? undefined)
  const book = useSavedContacts(open ? sectorId : undefined)
  const saved = book.data ?? []
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [missing, setMissing] = useState(false)
  const [result, setResult] = useState<ImportResult>()
  const save = useImportContacts()

  const sectorItems = sectors
    .filter((sector) => sector.active)
    .map((sector) => ({ value: String(sector.id), label: sector.name }))
  const chosen = selected.filter((phone) => saved.some((contact) => contact.phone === phone))
  // "Selecionar todos" vale para os mostrados; os demais continuam como estão.
  const visible = saved.filter((contact) => matches(contact, query))
  const visibleChosen = visible.filter((contact) => selected.includes(contact.phone))
  const allChosen = visible.length > 0 && visibleChosen.length === visible.length
  const toggleVisible = (checked: boolean) => {
    const phones = visible.map((contact) => contact.phone)
    setMissing(false)
    setSelected(
      checked
        ? [...new Set([...selected, ...phones])]
        : selected.filter((phone) => !phones.includes(phone)),
    )
  }

  const toggle = (phone: string, checked: boolean) => {
    setMissing(false)
    setSelected(checked ? [...selected, phone] : selected.filter((item) => item !== phone))
  }

  if (result) {
    return (
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Importar contatos"
        cancelLabel="Fechar"
        pending={false}
        onSubmit={(event) => event.preventDefault()}
      >
        <ul className="flex flex-col gap-2">
          <li>{plural(result.created, 'contato criado', 'contatos criados')}.</li>
          <li>
            {plural(result.existing, 'contato já existia', 'contatos já existiam')}: dados mantidos,
            com vínculo ao setor.
          </li>
          {result.unavailable > 0 && (
            <li>
              {plural(result.unavailable, 'contato saiu', 'contatos saíram')} da agenda e não{' '}
              {result.unavailable === 1 ? 'foi importado' : 'foram importados'}.
            </li>
          )}
        </ul>
      </FormDialog>
    )
  }

  const onSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    if (sectorId === undefined || chosen.length === 0) {
      setMissing(true)
      return
    }
    save.mutate(
      { sectorId, phones: chosen, organizationId: organization?.id ?? 0 },
      { onSuccess: setResult },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Importar contatos"
      description="Contatos com nome salvo na agenda do número do setor."
      submitLabel={saved.length > 0 ? 'Importar contatos' : undefined}
      pending={save.isPending}
      error={
        book.error?.message ??
        save.error?.message ??
        (missing ? 'Selecione ao menos um contato.' : undefined)
      }
      onSubmit={onSubmit}
    >
      {isAdmin && (
        <Field>
          <FieldLabel htmlFor="import-sector">Setor</FieldLabel>
          <Select
            items={sectorItems}
            value={chosenSector === undefined ? null : String(chosenSector)}
            onValueChange={(value) => {
              if (value) {
                setChosenSector(Number(value))
                setSelected([])
                setMissing(false)
              }
            }}
          >
            <SelectTrigger id="import-sector">
              <SelectValue placeholder="Selecione o setor" />
            </SelectTrigger>
            <SelectContent>
              {sectorItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {book.isSuccess && saved.length === 0 && (
        <p className="text-ink-faint">Nenhum contato com nome salvo na agenda do número.</p>
      )}
      {saved.length > 0 && (
        <>
          <Field>
            <FieldLabel htmlFor="import-organization">Órgão</FieldLabel>
            <OrganizationPicker
              id="import-organization"
              value={organization}
              onChange={setOrganization}
              invalid={false}
            />
            <FieldDescription>
              Opcional. Vale para todos os novos. Sem órgão, o contato fica não cadastrado e é
              completado antes do encerramento.
            </FieldDescription>
          </Field>
          <FieldSet>
            <FieldLegend variant="label">Contatos da agenda</FieldLegend>
            {/* Enter na busca não envia a importação. */}
            <div onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}>
              <SearchBox
                value={query}
                onChange={setQuery}
                label="Buscar na agenda"
                placeholder="Nome ou telefone"
              />
            </div>
            <p className="caption text-ink-faint">
              {plural(chosen.length, 'contato selecionado', 'contatos selecionados')}
            </p>
            {visible.length > 0 ? (
              <>
                <label className="flex items-center gap-2 body-strong">
                  <Checkbox
                    checked={allChosen}
                    indeterminate={visibleChosen.length > 0 && !allChosen}
                    onCheckedChange={toggleVisible}
                  />
                  Selecionar todos ({visible.length})
                </label>
                <ul className="flex flex-col gap-2">
                  {visible.map((contact) => (
                    <li key={contact.phone}>
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={selected.includes(contact.phone)}
                          onCheckedChange={(checked) => toggle(contact.phone, checked)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{contact.name}</span>
                          <span className="mono-num caption block text-ink-faint">
                            {formatPhone(contact.phone)}
                          </span>
                        </span>
                        {contact.exists && <Badge tone="neutral">Já existe</Badge>}
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-ink-faint">Nenhum contato encontrado.</p>
            )}
          </FieldSet>
        </>
      )}
    </FormDialog>
  )
}
