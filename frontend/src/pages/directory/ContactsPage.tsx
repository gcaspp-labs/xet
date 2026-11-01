import { BookUser, Plus } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { ContactSheet } from '@/components/ContactSheet'
import { SearchBox } from '@/components/SearchBox'
import { HistorySheet } from '@/components/TicketHistory'
import { PageContent, Topbar } from '@/components/Topbar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type Contact, searchLimit, useContacts } from '@/lib/directory'
import { formatCnpj, formatPhone } from '@/lib/format'

export default function ContactsPage() {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const { data: contacts, isPending } = useContacts(deferredQuery)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [open, setOpen] = useState(false)
  // Nova chave a cada abertura: o formulário começa sempre limpo.
  const [sheetKey, setSheetKey] = useState(0)
  const [history, setHistory] = useState<Contact | null>(null)

  const openSheet = (contact: Contact | null) => {
    setEditing(contact)
    setSheetKey((key) => key + 1)
    setOpen(true)
  }

  return (
    <>
      <Topbar
        breadcrumb="Cadastro"
        title="Contatos"
        action={
          <Button onClick={() => openSheet(null)}>
            <Plus strokeWidth={1.7} aria-hidden />
            Novo contato
          </Button>
        }
      />
      <PageContent>
        <SearchBox
          value={query}
          onChange={setQuery}
          label="Buscar contatos"
          placeholder="Nome, telefone ou CNPJ"
        />
        <Card>
          {contacts && contacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Órgão</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      <p className="body-strong">{contact.name}</p>
                      <p className="mono-num caption text-ink-faint">
                        {contact.phone ? formatPhone(contact.phone) : 'Sem telefone'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {contact.organization ? (
                        <>
                          <p>{contact.organization.name}</p>
                          {contact.organization.cnpj && (
                            <p className="mono-num caption text-ink-faint">
                              {formatCnpj(contact.organization.cnpj)}
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-ink-faint">Sem órgão</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Histórico de ${contact.name}`}
                        onClick={() => setHistory(contact)}
                      >
                        Histórico
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${contact.name}`}
                        onClick={() => openSheet(contact)}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            !isPending && (
              <Empty>
                <EmptyMedia>
                  <BookUser strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>
                  {deferredQuery.trim()
                    ? 'Nenhum contato encontrado.'
                    : 'Nenhum contato cadastrado.'}
                </EmptyDescription>
              </Empty>
            )
          )}
        </Card>
        {contacts?.length === searchLimit && (
          <p className="caption text-ink-faint">
            Mostrando os {searchLimit} primeiros resultados. Refine a busca para encontrar outros.
          </p>
        )}
      </PageContent>
      <ContactSheet key={sheetKey} contact={editing} open={open} onOpenChange={setOpen} />
      <HistorySheet
        target={history && { kind: 'contact', id: history.id, name: history.name }}
        onClose={() => setHistory(null)}
      />
    </>
  )
}
