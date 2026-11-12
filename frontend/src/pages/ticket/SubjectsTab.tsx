import { BookOpen, Copy, SearchX } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { SearchBox } from '@/components/SearchBox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { useClosingForm } from '@/lib/conversation'
import { normalizeSearch } from '@/lib/format'
import { cn } from '@/lib/utils'

export function SubjectsTab({
  ticketId,
  query,
  onQueryChange,
}: {
  ticketId: number
  query: string
  onQueryChange: (query: string) => void
}) {
  const { data, error } = useClosingForm(ticketId, true)
  const [expanded, setExpanded] = useState<number[]>([])
  const term = normalizeSearch(query.trim())
  const subjects = data?.subjects ?? []
  const shown = subjects.flatMap((subject) => {
    if (!term || normalizeSearch(subject.name).includes(term)) return [subject]
    const solutions = subject.solutions.filter((solution) =>
      normalizeSearch(solution.body).includes(term),
    )
    return solutions.length ? [{ ...subject, solutions }] : []
  })

  async function copy(body: string) {
    try {
      await navigator.clipboard.writeText(body)
      toast.success('Solução copiada')
    } catch {
      toast.error('Não foi possível copiar a solução.')
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <p className="caption text-ink-soft">
        Soluções do setor para consulta. Copie e adapte no chat.
      </p>
      <SearchBox
        value={query}
        onChange={onQueryChange}
        label="Buscar assuntos e soluções"
        placeholder="Buscar assunto ou solução"
      />
      {error && (
        <Alert variant="warning">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {!data && !error && <p className="caption text-ink-soft">Carregando assuntos...</p>}
      {data && !subjects.length && (
        <Empty>
          <EmptyMedia>
            <BookOpen strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>Este setor ainda não tem assuntos cadastrados.</EmptyDescription>
        </Empty>
      )}
      {data && subjects.length > 0 && !shown.length && (
        <Empty>
          <EmptyMedia>
            <SearchX strokeWidth={1.7} aria-hidden />
          </EmptyMedia>
          <EmptyDescription>Nenhum assunto ou solução encontrado.</EmptyDescription>
        </Empty>
      )}
      <ul className="flex flex-col gap-2">
        {shown.flatMap((subject) =>
          subject.solutions.length
            ? subject.solutions.map((solution) => {
                const long = solution.body.length > 220
                const full = expanded.includes(solution.id)
                return (
                  <li key={solution.id} className="rounded-(--radius-8) border border-line p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <Badge variant="tag" className="min-w-0 break-words">
                        {subject.name}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => void copy(solution.body)}>
                        <Copy strokeWidth={1.7} aria-hidden />
                        Copiar
                      </Button>
                    </div>
                    <p
                      className={cn(
                        'body whitespace-pre-wrap [overflow-wrap:anywhere]',
                        long && !full && 'line-clamp-4',
                      )}
                    >
                      {solution.body}
                    </p>
                    {long && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-1 h-auto p-0"
                        onClick={() =>
                          setExpanded(
                            full
                              ? expanded.filter((id) => id !== solution.id)
                              : [...expanded, solution.id],
                          )
                        }
                      >
                        {full ? 'Mostrar menos' : 'Ver texto inteiro'}
                      </Button>
                    )}
                  </li>
                )
              })
            : [
                <li
                  key={`subject-${subject.id}`}
                  className="rounded-(--radius-8) border border-line p-3"
                >
                  <Badge variant="tag">{subject.name}</Badge>
                  <p className="caption text-ink-soft">Nenhuma solução cadastrada.</p>
                </li>,
              ],
        )}
      </ul>
    </div>
  )
}
