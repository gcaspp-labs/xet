import { BookUser, Plus } from 'lucide-react'
import { type KeyboardEvent, type Ref, useDeferredValue, useState } from 'react'
import { ContactFilters } from '@/components/ContactFilters'
import { SearchBox } from '@/components/SearchBox'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import {
  type Contact,
  useContactFilter,
  useContactOptions,
  useContactPagination,
} from '@/lib/directory'
import { formatPhone, organizationLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

// Nome, telefone e órgão com o município, para não confundir homônimos.
export function ContactSummary({ contact }: { contact: Contact }) {
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

// O que muda de uma tela para outra: os filtros, o foco da busca, o contato sem telefone e o
// espaço entre o nome e o telefone na linha. O resto é igual nas três: as setas percorrem a lista,
// e ao focar o último contato que dá pra escolher vem a próxima página.
const variants = {
  // Novo chamado: os filtros por setor, módulo, município e órgão ficam na tela.
  'new-conversation': { filters: true, autoFocus: false, reachableOnly: false, summaryGap: false },
  // Registrar atendimento por telefone: sem filtros, a busca procura no cadastro inteiro.
  'phone-registration': {
    filters: false,
    autoFocus: false,
    reachableOnly: false,
    summaryGap: false,
  },
  // Enviar contato: filtros, foco na busca, só contato cadastrado com telefone (o único que o
  // cartão serve) e a linha com o espaço de 0.5 entre o nome e o telefone, como ela sempre foi.
  'send-contact': { filters: true, autoFocus: true, reachableOnly: true, summaryGap: true },
} as const

export type ContactSearchVariant = keyof typeof variants

// Busca no cadastro de Órgãos e contatos, compartilhada por Novo chamado, Registrar atendimento
// por telefone e Enviar contato. `variant` diz qual das três telas é.
export function ContactSearch({
  variant,
  onChoose,
  onRegister,
  checking = false,
  selectedId,
  selectedRow,
}: {
  variant: ContactSearchVariant
  onChoose: (contact: Contact) => void
  // Só as telas que cadastram o contato ali mesmo mostram o botão.
  onRegister?: () => void
  // Escolha em andamento: os contatos ficam desabilitados enquanto a tela confere.
  checking?: boolean
  // A linha escolhida: ao voltar da prévia, o foco de novo nela, no lugar da busca.
  selectedId?: number
  selectedRow?: Ref<HTMLButtonElement>
}) {
  const options = variants[variant]
  const [query, setQuery] = useState('')
  const contactFilter = useContactFilter()
  const search = useDeferredValue(query)
  // Sem os filtros na tela, a busca é a mesma de antes: sem recorte de setor, módulo etc.
  const filter = options.filters ? contactFilter.filter : {}
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useContactOptions(search, filter)
  const loaded = data?.pages.flatMap((page) => page.items) ?? []
  const contacts = options.reachableOnly
    ? loaded.filter((contact) => contact.registered && contact.phone)
    : loaded
  const end = useContactPagination({
    query: search,
    filter,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    itemCount: contacts.length,
  })

  // As setas movem o foco entre os contatos que dá pra escolher.
  const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) {
      return
    }
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    )
    const next = buttons[buttons.indexOf(document.activeElement as HTMLButtonElement) + step]
    if (next) {
      event.preventDefault()
      next.focus()
    }
  }

  // Ao focar o último contato que dá pra escolher, vem a próxima página.
  const loadMoreOnFocus = (index: number) => {
    if (
      hasNextPage &&
      !isFetchingNextPage &&
      contacts.slice(index + 1).every((contact) => !contact.phone)
    ) {
      void fetchNextPage()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchBox
        value={query}
        onChange={setQuery}
        label="Buscar contato"
        placeholder="Nome, município, telefone ou CNPJ"
        autoFocus={options.autoFocus}
      />
      {options.filters && <ContactFilters {...contactFilter} />}
      {onRegister && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={onRegister}
        >
          <Plus strokeWidth={1.7} aria-hidden />
          Novo contato
        </Button>
      )}
      {contacts.length > 0 ? (
        <ul
          aria-label="Contatos"
          className="flex flex-col divide-y divide-line-soft"
          onKeyDown={moveFocus}
        >
          {contacts.map((contact, index) => (
            <li key={contact.id}>
              <button
                ref={contact.id === selectedId ? selectedRow : undefined}
                type="button"
                // Sem telefone não há como escolher o contato: a linha fica desabilitada.
                disabled={checking || !contact.phone}
                onClick={() => onChoose(contact)}
                onFocus={() => loadMoreOnFocus(index)}
                className={cn(
                  'w-full min-w-0 rounded-(--radius-7) px-2 py-2 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
                  options.summaryGap && 'flex flex-col gap-0.5',
                )}
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
