import { zodResolver } from '@hookform/resolvers/zod'
import { BookUser, Plus, TriangleAlert } from 'lucide-react'
import { type KeyboardEvent, useDeferredValue, useEffect, useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ClosingFields } from '@/components/ClosingFields'
import { ContactSheet, RegisterContactSheet } from '@/components/ContactSheet'
import { FormDialog } from '@/components/FormDialog'
import { SearchBox } from '@/components/SearchBox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useClosingQuestions } from '@/hooks/use-closing-questions'
import { useSectors } from '@/lib/admin'
import { useCurrentUser } from '@/lib/auth'
import { checkPeriod, closingShape, localInput } from '@/lib/closing'
import { newRequestId } from '@/lib/conversation'
import { type Contact, useContactOptions } from '@/lib/directory'
import { formatPhone, organizationLabel } from '@/lib/format'
import { usePhoneForm, useRegisterPhone } from '@/lib/phone'

const schema = z.object(closingShape).superRefine(checkPeriod)

type FormValues = z.input<typeof schema>
type Values = z.output<typeof schema>

// O registro começa com o horário de agora no início e no fim; a pessoa corrige.
const defaults = (): FormValues => ({
  subject: '',
  resolution: '',
  moduleIds: [],
  organization: null,
  startedAt: localInput(new Date()),
  endedAt: localInput(new Date()),
})

function ContactSummary({ contact }: { contact: Contact }) {
  return (
    <>
      <span className="body-strong block truncate">{contact.name}</span>
      <span className="caption block truncate text-ink-faint">
        {contact.phone ? (
          <span className="mono-num">{formatPhone(contact.phone)}</span>
        ) : (
          'Sem telefone'
        )}
        {' · '}
        {contact.organization
          ? organizationLabel(contact.organization.name, contact.organization.municipality.name)
          : 'Não cadastrado'}
      </span>
    </>
  )
}

// Busca do contato de quem ligou: escolher um contato resumido no topo da janela.
function ContactSearch({
  onChoose,
  onRegister,
}: {
  onChoose: (contact: Contact) => void
  onRegister: () => void
}) {
  const [query, setQuery] = useState('')
  const search = useDeferredValue(query)
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useContactOptions(search)
  const contacts = data?.pages.flatMap((page) => page.items) ?? []
  const end = useRef<HTMLDivElement>(null)

  // Nova busca: a lista recomeça na página 1, e a rolagem volta ao topo.
  useEffect(() => {
    end.current?.closest('[data-slot="dialog-body"]')?.scrollTo({ top: 0 })
  }, [search])

  // A próxima página vem quando o fim da lista aparece na rolagem, também quando a lista
  // cabe na janela e não há o que rolar.
  useEffect(() => {
    const target = end.current
    if (!target || !hasNextPage || isFetchingNextPage) {
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void fetchNextPage()
      }
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, contacts.length])

  // As setas movem o foco entre os contatos; ao focar o último contato que dá pra escolher, vem a próxima página.
  const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) {
      return
    }
    const options = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    )
    const next = options[options.indexOf(document.activeElement as HTMLButtonElement) + step]
    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchBox
        value={query}
        onChange={setQuery}
        label="Buscar contato"
        placeholder="Nome, município, telefone ou CNPJ"
      />
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onRegister}>
        <Plus strokeWidth={1.7} aria-hidden />
        Novo contato
      </Button>
      {contacts.length > 0 ? (
        <ul
          aria-label="Contatos"
          className="flex flex-col divide-y divide-line-soft"
          onKeyDown={moveFocus}
        >
          {contacts.map((contact, index) => (
            <li key={contact.id}>
              <button
                type="button"
                disabled={!contact.phone}
                onClick={() => onChoose(contact)}
                onFocus={() => {
                  if (
                    hasNextPage &&
                    !isFetchingNextPage &&
                    contacts.slice(index + 1).every((c) => !c.phone)
                  ) {
                    void fetchNextPage()
                  }
                }}
                className="w-full min-w-0 rounded-(--radius-7) px-2 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ContactSummary contact={contact} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          <EmptyMedia>
            <BookUser strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>Nenhum contato encontrado.</EmptyDescription>
        </Empty>
      )}
      <div ref={end} aria-hidden />
    </div>
  )
}

// Divisão visual entre quem ligou e o atendimento (design.md).
function Divider({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="overline text-ink-faint">{children}</span>
      <span className="h-px flex-1 bg-line-soft" />
    </div>
  )
}

// Janela "Registrar atendimento por telefone" (spec #311, versão A de #322): o
// registro entra em Atendimentos já encerrado, com o protocolo para passar ao
// cliente, sem conversa e sem enviar nada ao número do setor.
export function PhoneRegistrationSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: user } = useCurrentUser()
  const { data: sectors = [] } = useSectors()
  const isAdmin = user?.role === 'admin'
  // O administrador escolhe o setor, que define os módulos; os demais registram no próprio.
  const activeSectors = sectors.filter((sector) => sector.active)
  const [chosenSector, setChosenSector] = useState<number>()
  const sectorId = isAdmin ? (chosenSector ?? activeSectors[0]?.id) : (user?.sectorId ?? undefined)
  const sector = sectors.find((item) => item.id === sectorId)

  const [contact, setContact] = useState<Contact | null>(null)
  const [choosing, setChoosing] = useState(true)
  const [contactError, setContactError] = useState(false)
  const [registering, setRegistering] = useState(false)
  // Cada abertura é um registro novo: a página remonta a janela, e o
  // identificador da requisição nasce com ela.
  const requestId = useRef(newRequestId())

  const formQuery = usePhoneForm(sectorId, contact?.id)
  const form = formQuery.data
  const registerPhone = useRegisterPhone(sectorId)

  const methods = useForm<FormValues, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  })
  const { handleSubmit, setValue, formState } = methods

  // O órgão e os módulos do contato chegam com o formulário; trocar de contato
  // ou de setor recomeça com os dados do contato, sem desfazer o resto.
  const applied = useRef('')
  useEffect(() => {
    if (!form || !contact || sectorId === undefined) {
      return
    }
    const key = `${sectorId}-${contact.id}`
    if (applied.current === key) {
      return
    }
    applied.current = key
    setValue('organization', form.organization ? { ...form.organization, cnpj: null } : null)
    setValue('moduleIds', form.contactModuleIds)
  }, [form, contact, sectorId, setValue])

  const saveForm = (
    values: Values,
    addSubject: boolean,
    addSolution: boolean,
    subjectModuleId?: number,
    solutionModuleId?: number,
  ) => {
    if (registerPhone.isPending || !contact) {
      return
    }
    registerPhone.mutate(
      {
        contactId: contact.id,
        organizationId: values.organization!.id,
        moduleIds: values.moduleIds,
        subject: values.subject,
        resolution: values.resolution,
        startedAt: new Date(values.startedAt).toISOString(),
        endedAt: new Date(values.endedAt).toISOString(),
        clientRequestId: requestId.current,
        addSubject,
        addSolution,
        subjectModuleId,
        solutionModuleId,
      },
      {
        onSuccess: ({ protocol }) => {
          toast.success(`Atendimento registrado · protocolo ${protocol}`)
          onOpenChange(false)
        },
        // Se o servidor recusar, o aviso aparece no formulário com o que foi preenchido.
        onError: () => questions.reset(),
      },
    )
  }

  // Assunto fora da lista do setor e resolução fora da lista do assunto:
  // pergunta antes de gravar, como no encerramento.
  const questions = useClosingQuestions<Values>({
    subjects: form?.subjects ?? [],
    modules: form?.modules ?? [],
    save: saveForm,
  })

  const choose = (chosen: Contact) => {
    setContactError(false)
    setContact(chosen)
    setChoosing(false)
    // O atendimento anterior não vale para o contato novo.
    setValue('subject', '')
    setValue('resolution', '')
  }

  const onSubmit = handleSubmit(
    (values) => {
      if (!contact) {
        setContactError(true)
        return
      }
      questions.start(values)
    },
    () => setContactError(!contact),
  )

  const summary =
    formState.isSubmitted && (Object.keys(formState.errors).length > 0 || contactError)

  return (
    <>
      <FormDialog
        locked
        open={open}
        onOpenChange={onOpenChange}
        title="Registrar atendimento por telefone"
        description="O registro entra em Atendimentos já encerrado, com o protocolo para passar ao cliente."
        submitLabel="Registrar atendimento"
        pending={registerPhone.isPending}
        error={
          registerPhone.error?.message ?? (summary ? 'Confira os campos marcados.' : undefined)
        }
        onSubmit={onSubmit}
        question={questions.question}
      >
        <Field>
          <FieldLabel htmlFor={isAdmin ? 'phone-sector' : undefined}>Setor</FieldLabel>
          {isAdmin ? (
            <Select
              items={activeSectors.map((item) => ({
                value: item.id.toString(),
                label: item.name,
              }))}
              value={sectorId?.toString() ?? null}
              onValueChange={(value) => value && setChosenSector(Number(value))}
            >
              <SelectTrigger id="phone-sector" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activeSectors.map((item) => (
                  <SelectItem key={item.id} value={item.id.toString()}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="body-strong">{sector?.name ?? '—'}</p>
          )}
          <FieldDescription>
            Atendente e supervisor registram no próprio setor; só o administrador troca.
          </FieldDescription>
        </Field>
        <Field data-invalid={contactError}>
          <FieldLabel>Contato</FieldLabel>
          {contact && !choosing ? (
            <div className="flex items-start justify-between gap-2 rounded-(--radius-7) border border-line bg-card px-3 py-2">
              <div className="min-w-0 flex-1">
                <ContactSummary contact={contact} />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setContactError(false)
                  setChoosing(true)
                }}
              >
                Trocar
              </Button>
            </div>
          ) : (
            <div className="rounded-(--radius-7) border border-line bg-surface-2 p-3">
              <ContactSearch onChoose={choose} onRegister={() => setRegistering(true)} />
            </div>
          )}
          {contact && !contact.registered && (
            <Alert variant="warning">
              <TriangleAlert strokeWidth={1.7} aria-hidden />
              <AlertDescription className="flex flex-col items-start gap-2">
                Contato não cadastrado. Cadastre o contato e vincule-o a um órgão antes de
                registrar.
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
          <FieldError
            errors={contactError ? [{ message: 'Escolha o contato de quem ligou.' }] : []}
          />
        </Field>
        <Divider>Atendimento</Divider>
        <FormProvider {...methods}>
          <ClosingFields
            idPrefix="phone"
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
      {registering && contact && (
        <RegisterContactSheet
          contactId={contact.id}
          onOpenChange={setRegistering}
          onSaved={(saved) => {
            applied.current = ''
            setContact(saved)
            setChoosing(false)
          }}
        />
      )}
      {registering && !contact && (
        <ContactSheet
          locked
          contact={null}
          open={registering}
          onOpenChange={setRegistering}
          onSaved={choose}
        />
      )}
    </>
  )
}
