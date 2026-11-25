import { type FormEvent, useEffect, useRef, useState } from 'react'
import { ContactCardItem } from '@/components/ContactCards'
import { ContactSearch } from '@/components/ContactSearch'
import { FormDialog } from '@/components/FormDialog'
import { type Contact } from '@/lib/directory'
import { type ContactCard, newRequestId, useSendContact } from '@/lib/conversation'
import { organizationLabel } from '@/lib/format'

// O cartão como o cliente recebe, montado do cadastro do contato escolhido.
function cardOf(contact: Contact): ContactCard {
  return {
    name: contact.name,
    organization: contact.organization
      ? organizationLabel(contact.organization.name, contact.organization.municipality.name)
      : null,
    phones: [{ phone: contact.phone ?? '', whatsAppId: null }],
  }
}

// A prévia mostra o cartão no formato do enviado, como o cliente o recebe.
function ContactPreview({ contact }: { contact: Contact }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="label text-ink-soft">Como o cliente recebe</p>
        <ContactCardItem card={cardOf(contact)} outbound />
      </div>
      <p className="caption text-ink-soft">
        Sem legenda, como o áudio. O cliente toca para conversar ou salvar.
      </p>
    </div>
  )
}

// Janela "Enviar contato": a busca ocupa a janela, e escolher um contato troca a lista pela prévia,
// com Voltar, Cancelar e Enviar. A ação é a de envio de contato do backend, que monta o cartão do
// cadastro; a mensagem segue o caminho das outras, com a situação de entrega na conversa. Com
// `quotedMessageId`, o cartão vai como resposta citada, e `onSent` limpa a citação em preparo.
export function SendContactDialog({
  ticketId,
  quotedMessageId,
  onSent,
  onClose,
}: {
  ticketId: number
  quotedMessageId?: number
  onSent?: () => void
  onClose: () => void
}) {
  const send = useSendContact(ticketId)
  const [step, setStep] = useState<'search' | 'preview'>('search')
  const [contact, setContact] = useState<Contact | null>(null)
  // O mesmo identificador numa nova tentativa evita mensagem duplicada; muda quando o contato muda.
  const requestId = useRef<string | null>(null)
  // A lista continua montada por baixo da prévia: ao Voltar, a busca, os filtros (inclusive "Todos
  // os setores"), as páginas já carregadas e a rolagem ficam como estavam, com o foco na linha
  // escolhida. A prévia recebe o foco ao aparecer, como a pergunta da FormDialog.
  const chosenRow = useRef<HTMLButtonElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  // O corpo rolável da própria janela, que a lista e a prévia dividem.
  const root = useRef<HTMLDivElement>(null)
  const bodyScroll = useRef(0)
  const returning = useRef(false)

  const dialogBody = () => root.current?.closest<HTMLDivElement>('[data-slot="dialog-body"]')

  useEffect(() => {
    if (step === 'preview') {
      preview.current?.focus()
    }
  }, [step])

  useEffect(() => {
    if (step !== 'search' || !returning.current) {
      return
    }
    returning.current = false
    const body = dialogBody()
    if (body) {
      body.scrollTop = bodyScroll.current
    }
    chosenRow.current?.focus({ preventScroll: true })
  }, [step])

  const choose = (chosen: Contact) => {
    requestId.current = null
    // A rolagem da lista fica guardada antes de a prévia tomar o lugar dela.
    bodyScroll.current = dialogBody()?.scrollTop ?? 0
    setContact(chosen)
    setStep('preview')
  }

  const back = () => {
    returning.current = true
    setStep('search')
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step !== 'preview' || !contact || send.isPending) {
      return
    }
    requestId.current ??= newRequestId()
    send.mutate(
      { requestId: requestId.current, contactId: contact.id, quotedMessageId },
      {
        onSuccess: () => {
          requestId.current = null
          onSent?.()
          onClose()
        },
      },
    )
  }

  return (
    <FormDialog
      open
      onOpenChange={(next) => {
        if (!next && !send.isPending) onClose()
      }}
      title="Enviar contato"
      description={
        step === 'search'
          ? 'Busque no cadastro de Órgãos e contatos. O cartão sai pelo número do setor.'
          : 'Confira o cartão antes de enviar.'
      }
      submitLabel={step === 'preview' ? 'Enviar' : undefined}
      pending={send.isPending}
      error={send.error?.message}
      onSubmit={submit}
      back={step === 'preview' ? { label: 'Voltar', onClick: back } : undefined}
    >
      {/* A lista fica montada por baixo da prévia: a busca e os filtros continuam como estavam. */}
      <div ref={root} hidden={step === 'preview'}>
        <ContactSearch
          variant="send-contact"
          onChoose={choose}
          selectedId={contact?.id}
          selectedRow={chosenRow}
        />
      </div>
      {step === 'preview' && contact && (
        <div
          ref={preview}
          tabIndex={-1}
          data-slot="contact-preview"
          className="flex flex-col gap-3"
        >
          <ContactPreview contact={contact} />
        </div>
      )}
    </FormDialog>
  )
}
