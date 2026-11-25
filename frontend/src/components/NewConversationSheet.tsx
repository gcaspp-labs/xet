import { type FormEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ContactSearch, ContactSummary } from '@/components/ContactSearch'
import { ContactSheet } from '@/components/ContactSheet'
import { FormDialog } from '@/components/FormDialog'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { newRequestId } from '@/lib/conversation'
import { type Contact } from '@/lib/directory'
import { openTicketOf, useStartConversation } from '@/lib/tickets'

const existingNotice = 'O contato já tem um chamado aberto no setor.'

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
          // Busca do contato: escolher um contato com chamado aberto no setor leva ao chamado.
          <ContactSearch
            checking={checking}
            withFilters
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
