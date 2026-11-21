import { BookUser } from 'lucide-react'
import { type FormEvent, type Ref, useDeferredValue, useEffect, useRef, useState } from 'react'
import { ContactCardItem } from '@/components/ContactCards'
import { ContactFilters } from '@/components/ContactFilters'
import { FormDialog } from '@/components/FormDialog'
import { SearchBox } from '@/components/SearchBox'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { type Contact, useContactFilter, useContactOptions } from '@/lib/directory'
import { type ContactCard, newRequestId, useSendContact } from '@/lib/conversation'
import { formatPhone, organizationLabel } from '@/lib/format'

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

// Uma linha do resultado: nome, telefone e órgão com o município, para não confundir homônimos.
function ContactOption({
  contact,
  onChoose,
  buttonRef,
}: {
  contact: Contact
  onChoose: () => void
  buttonRef?: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onChoose}
      className="flex w-full min-w-0 flex-col gap-0.5 rounded-(--radius-7) px-2 py-2 text-left transition-colors hover:bg-muted"
    >
      <span className="body-strong block truncate">{contact.name}</span>
      <span className="caption block truncate text-ink-faint">
        <span className="mono-num">{formatPhone(contact.phone ?? '')}</span>
        {' · '}
        {contact.organization
          ? organizationLabel(contact.organization.name, contact.organization.municipality.name)
          : 'Não cadastrado'}
      </span>
    </button>
  )
}

// Busca no cadastro de Órgãos e contatos, como a do Novo chamado: abre em "Meu setor", com a
// opção de ver todos, e só mostra contato cadastrado com telefone, o único que o cartão serve.
function ContactSearch({
  onChoose,
  selectedId,
  selectedRow,
}: {
  onChoose: (contact: Contact) => void
  // A linha escolhida: ao voltar da prévia, o foco de novo nela, no lugar da busca.
  selectedId?: number
  selectedRow?: Ref<HTMLButtonElement>
}) {
  const [query, setQuery] = useState('')
  const contactFilter = useContactFilter()
  const search = useDeferredValue(query)
  const { filter } = contactFilter
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useContactOptions(search, filter)
  const contacts = (data?.pages.flatMap((page) => page.items) ?? []).filter(
    (contact) => contact.registered && contact.phone,
  )
  const end = useRef<HTMLDivElement>(null)

  // Nova busca ou outro filtro: a lista recomeça na página 1, e a rolagem volta ao topo.
  useEffect(() => {
    end.current?.closest('[data-slot="dialog-body"]')?.scrollTo({ top: 0 })
  }, [search, filter.sectorId, filter.moduleId, filter.municipalityId, filter.organizationId])

  // A próxima página vem quando o fim da lista aparece na rolagem, também quando a lista cabe na
  // janela e não há o que rolar.
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

  return (
    <div className="flex flex-col gap-3">
      <SearchBox
        value={query}
        onChange={setQuery}
        label="Buscar contato"
        placeholder="Nome, município, telefone ou CNPJ"
        autoFocus
      />
      <ContactFilters {...contactFilter} />
      {contacts.length > 0 ? (
        <ul aria-label="Contatos" className="flex flex-col divide-y divide-line-soft">
          {contacts.map((contact) => (
            <li key={contact.id}>
              <ContactOption
                contact={contact}
                onChoose={() => onChoose(contact)}
                buttonRef={contact.id === selectedId ? selectedRow : undefined}
              />
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
// cadastro; a mensagem segue o caminho das outras, com a situação de entrega na conversa.
export function SendContactDialog({
  ticketId,
  onClose,
}: {
  ticketId: number
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
  const bodyScroll = useRef(0)
  const returning = useRef(false)

  // O corpo rolável da janela, que a lista e a prévia dividem.
  const dialogBody = () => document.querySelector<HTMLDivElement>('[data-slot="dialog-body"]')

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
      { requestId: requestId.current, contactId: contact.id },
      {
        onSuccess: () => {
          requestId.current = null
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
      <div hidden={step === 'preview'}>
        <ContactSearch onChoose={choose} selectedId={contact?.id} selectedRow={chosenRow} />
      </div>
      {step === 'preview' && contact && (
        <div ref={preview} tabIndex={-1} className="flex flex-col gap-3 outline-none">
          <ContactPreview contact={contact} />
        </div>
      )}
    </FormDialog>
  )
}
