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

// Busca no cadastro de Órgãos e contatos, compartilhada por Novo chamado, Registrar
// atendimento por telefone e Enviar contato. Cada tela escolhe as diferenças de hoje:
// os filtros, o botão de cadastrar, o foco da busca, a navegação pelas setas, a
// paginação ao focar o último contato e o que fazer com contato sem telefone.
export function ContactSearch({
  onChoose,
  onRegister,
  checking = false,
  withFilters = false,
  autoFocus = false,
  onlyReachable = false,
  disableUnreachable = true,
  keyboardNavigation = true,
  loadOnLastFocus = true,
  selectedId,
  selectedRow,
}: {
  onChoose: (contact: Contact) => void
  // Só as telas que cadastram o contato ali mesmo mostram o botão.
  onRegister?: () => void
  // Escolha em andamento: os contatos ficam desabilitados enquanto a tela confere.
  checking?: boolean
  // "Enviar contato" e "Novo chamado" filtram por setor, módulo, município e órgão.
  withFilters?: boolean
  // A busca recebe o foco ao abrir a janela, como no "Enviar contato".
  autoFocus?: boolean
  // "Enviar contato" só mostra contato cadastrado com telefone, o único que o cartão serve.
  onlyReachable?: boolean
  // Fora do "Enviar contato" (que já esconde o contato sem telefone), a linha fica desabilitada.
  disableUnreachable?: boolean
  // As setas movem o foco entre os contatos (Novo chamado e Registrar por telefone).
  keyboardNavigation?: boolean
  // Ao focar o último contato que dá pra escolher, vem a próxima página.
  loadOnLastFocus?: boolean
  // A linha escolhida: ao voltar da prévia, o foco de novo nela, no lugar da busca.
  selectedId?: number
  selectedRow?: Ref<HTMLButtonElement>
}) {
  const [query, setQuery] = useState('')
  const contactFilter = useContactFilter()
  const search = useDeferredValue(query)
  // Sem os filtros na tela, a busca é a mesma de antes: sem recorte de setor, módulo etc.
  const filter = withFilters ? contactFilter.filter : {}
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useContactOptions(search, filter)
  const loaded = data?.pages.flatMap((page) => page.items) ?? []
  const contacts = onlyReachable
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

  // As setas movem o foco entre os contatos; ao focar o último contato que dá pra escolher, vem a próxima página.
  const moveFocus = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!keyboardNavigation) {
      return
    }
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

  const loadMoreOnFocus = (index: number) => {
    if (
      loadOnLastFocus &&
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
        autoFocus={autoFocus}
      />
      {withFilters && <ContactFilters {...contactFilter} />}
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
                disabled={disableUnreachable && (checking || !contact.phone)}
                onClick={() => onChoose(contact)}
                onFocus={() => loadMoreOnFocus(index)}
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
