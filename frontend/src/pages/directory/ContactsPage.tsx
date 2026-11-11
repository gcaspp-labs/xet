import { BookUser, Download, Plus } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { ContactFilters } from '@/components/ContactFilters'
import { ContactSheet } from '@/components/ContactSheet'
import { ImportContactsSheet } from '@/components/ImportContactsSheet'
import { Pagination } from '@/components/Pagination'
import { SearchBox } from '@/components/SearchBox'
import { SortableTableHead } from '@/components/SortableTableHead'
import { HistorySheet } from '@/components/TicketHistory'
import { PageContent, Topbar } from '@/components/Topbar'
import { Badge } from '@/components/ui/badge'
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
import {
  type Contact,
  contactColumns,
  defaultContactColumn,
  useContactFilterInAddress,
  useContacts,
} from '@/lib/directory'
import { formatCnpj, formatPhone, organizationLabel } from '@/lib/format'
import { usePagedList } from '@/lib/paging'

export default function ContactsPage() {
  // Busca, filtros, página e ordem ficam no endereço: voltar de um chamado ou reabrir
  // o link devolve a mesma lista.
  const { query, setQuery, ...contactFilter } = useContactFilterInAddress()
  const deferredQuery = useDeferredValue(query)
  const list = usePagedList(contactColumns, defaultContactColumn)
  const { data, isPending, isPlaceholderData } = useContacts(
    deferredQuery,
    contactFilter.filter,
    list.request,
  )
  const contacts = data?.items
  const served = data && !isPlaceholderData ? data.page : undefined
  const { correctPage } = list
  // Página além da última: o servidor devolve a última, e o endereço acompanha.
  useEffect(() => {
    if (served !== undefined) {
      correctPage(served)
    }
  }, [served, correctPage])
  // Filtrando por órgão, todos os contatos encontrados são dele: o nome do campo vem deles
  // quando o endereço traz só o id.
  const organization =
    contactFilter.organization ??
    (contactFilter.filter.organizationId !== undefined
      ? (contacts?.find((c) => c.organization?.id === contactFilter.filter.organizationId)
          ?.organization ?? null)
      : null)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [open, setOpen] = useState(false)
  // Nova chave a cada abertura: o formulário começa sempre limpo.
  const [sheetKey, setSheetKey] = useState(0)
  const [history, setHistory] = useState<Contact | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importKey, setImportKey] = useState(0)

  const openSheet = (contact: Contact | null) => {
    setEditing(contact)
    setSheetKey((key) => key + 1)
    setOpen(true)
  }

  return (
    <>
      <Topbar
        breadcrumb="Helpdesk"
        title="Contatos"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setImportKey((key) => key + 1)
                setImportOpen(true)
              }}
            >
              <Download strokeWidth={1.7} aria-hidden />
              Importar contatos
            </Button>
            <Button onClick={() => openSheet(null)}>
              <Plus strokeWidth={1.7} aria-hidden />
              Novo contato
            </Button>
          </div>
        }
      />
      <PageContent>
        <SearchBox
          value={query}
          onChange={setQuery}
          label="Buscar contatos"
          placeholder="Nome, município, telefone ou CNPJ"
        />
        <ContactFilters {...contactFilter} organization={organization} />
        <Card className="gap-0 py-0">
          {contacts && contacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Contato" column="nome" list={list} />
                  <SortableTableHead label="Órgão" column="orgao" list={list} />
                  <TableHead>Setores e módulos</TableHead>
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
                          <p>
                            {organizationLabel(
                              contact.organization.name,
                              contact.organization.municipality.name,
                            )}
                          </p>
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
                    <TableCell>
                      {contact.sectors.length > 0 ? (
                        <ul className="flex flex-col gap-1">
                          {contact.sectors.map((sector) => {
                            const module = contact.modules.find((m) => m.sectorId === sector.id)
                            return (
                              <li key={sector.id} className="flex flex-wrap items-center gap-2">
                                {sector.name}
                                {module && <Badge variant="tag">{module.name}</Badge>}
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <span className="text-ink-faint">Sem setor</span>
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
                  {deferredQuery.trim() || Object.values(contactFilter.filter).some(Boolean)
                    ? 'Nenhum contato encontrado.'
                    : 'Nenhum contato cadastrado.'}
                </EmptyDescription>
              </Empty>
            )
          )}
          {data && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              noun={['contato', 'contatos']}
              onPage={list.setPage}
            />
          )}
        </Card>
      </PageContent>
      <ContactSheet key={sheetKey} contact={editing} open={open} onOpenChange={setOpen} />
      <ImportContactsSheet
        key={`import-${importKey}`}
        open={importOpen}
        onOpenChange={setImportOpen}
      />
      <HistorySheet
        target={history && { kind: 'contact', id: history.id, name: history.name }}
        onClose={() => setHistory(null)}
      />
    </>
  )
}
