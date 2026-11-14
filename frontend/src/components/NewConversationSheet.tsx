import { BookUser, Plus } from 'lucide-react'
import { type FormEvent, useDeferredValue, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ContactFilters } from '@/components/ContactFilters'
import { ContactSheet } from '@/components/ContactSheet'
import { FormDialog } from '@/components/FormDialog'
import { SearchBox } from '@/components/SearchBox'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { newRequestId } from '@/lib/conversation'
import { type Contact, useContactFilter, useContacts } from '@/lib/directory'
import { formatPhone, organizationLabel } from '@/lib/format'
import { openTicketOf, useStartConversation } from '@/lib/tickets'

const existingNotice = 'O contato já tem um chamado aberto no setor.'

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

// Busca do contato: escolher um contato com chamado aberto no setor leva ao chamado.
function ContactSearch({
  checking,
  onChoose,
  onRegister,
}: {
  checking: boolean
  onChoose: (contact: Contact) => void
  onRegister: () => void
}) {
  const [query, setQuery] = useState('')
  const contactFilter = useContactFilter()
  const { data } = useContacts(useDeferredValue(query), contactFilter.filter)
  const contacts = data?.items ?? []

  return (
    <div className="flex flex-col gap-3">
      <SearchBox
        value={query}
        onChange={setQuery}
        label="Buscar contato"
        placeholder="Nome, município, telefone ou CNPJ"
      />
      <ContactFilters {...contactFilter} />
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onRegister}>
        <Plus strokeWidth={1.7} aria-hidden />
        Novo contato
      </Button>
      {contacts.length > 0 ? (
        <ul aria-label="Contatos" className="flex flex-col divide-y divide-line-soft">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                disabled={checking || !contact.phone}
                onClick={() => onChoose(contact)}
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
    </div>
  )
}

// Janela de nova conversa: escolhe o contato e escreve a primeira mensagem,
// enviada pelo número do setor.
export function NewConversationSheet({
  sectorId,
  open,
  onOpenChange,
}: {
  sectorId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const start = useStartConversation(sectorId)
  const [contact, setContact] = useState<Contact | null>(null)
  const [body, setBody] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string>()
  const [registering, setRegistering] = useState(false)
  // O mesmo identificador numa nova tentativa evita chamado e mensagem duplicados.
  const requestId = useRef<string | null>(null)

  const goTo = (ticketId: number) => {
    onOpenChange(false)
    void navigate(`/chamados/${ticketId}`)
  }

  const choose = async (chosen: Contact) => {
    setChecking(true)
    setError(undefined)
    try {
      const { ticketId } = await openTicketOf(sectorId, chosen.id)
      if (ticketId !== null) {
        toast(existingNotice)
        goTo(ticketId)
        return
      }
      requestId.current = null
      setContact(chosen)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setChecking(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = body.trim()
    if (!contact || start.isPending) {
      return
    }
    if (!text) {
      setError('Escreva a mensagem.')
      return
    }
    setError(undefined)
    requestId.current ??= newRequestId()
    start.mutate(
      { contactId: contact.id, requestId: requestId.current, body: text },
      {
        onSuccess: (started) => {
          if (started.existing) {
            toast(`${existingNotice} A mensagem não foi enviada.`)
          } else {
            toast.success('Chamado iniciado')
          }
          goTo(started.ticketId)
        },
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <>
      <FormDialog
        locked
        open={open}
        onOpenChange={onOpenChange}
        title="Novo chamado"
        description="A mensagem sai pelo número do setor e o chamado fica com você."
        submitLabel="Enviar"
        pending={!contact || start.isPending}
        error={error}
        onSubmit={submit}
      >
        {contact ? (
          <>
            <Field>
              <FieldLabel>Contato</FieldLabel>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ContactSummary contact={contact} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setContact(null)
                    setError(undefined)
                  }}
                >
                  Trocar
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="new-conversation-body">Mensagem</FieldLabel>
              <Textarea
                id="new-conversation-body"
                value={body}
                autoFocus
                onChange={(event) => {
                  requestId.current = null
                  setBody(event.target.value)
                }}
              />
            </Field>
          </>
        ) : (
          <ContactSearch
            checking={checking}
            onChoose={(chosen) => void choose(chosen)}
            onRegister={() => setRegistering(true)}
          />
        )}
      </FormDialog>
      {registering && (
        <ContactSheet
          locked
          contact={null}
          open={registering}
          onOpenChange={setRegistering}
          onSaved={(saved) => void choose(saved)}
        />
      )}
    </>
  )
}
