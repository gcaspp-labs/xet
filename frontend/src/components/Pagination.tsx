import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Números das páginas; acima de 7, a primeira, a última e as vizinhas da atual,
// com reticências no meio.
function pageNumbers(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages: (number | 'gap')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) {
    pages.push('gap')
  }
  for (let p = start; p <= end; p++) {
    pages.push(p)
  }
  if (end < total - 1) {
    pages.push('gap')
  }
  pages.push(total)
  return pages
}

// Faixa de paginação no rodapé do painel: "Página X de Y · N itens" e os botões.
// Some quando tudo cabe numa página.
export function Pagination({
  page,
  pageSize,
  total,
  noun,
  onPage,
}: {
  page: number
  pageSize: number
  total: number
  // Singular e plural do que a lista conta, ex.: ['contato', 'contatos'].
  noun: [string, string]
  onPage: (page: number) => void
}) {
  if (total <= pageSize) {
    return null
  }
  const totalPages = Math.ceil(total / pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="caption text-ink-soft">
        Página <span className="mono-num">{page}</span> de{' '}
        <span className="mono-num">{totalPages}</span> · <span className="mono-num">{total}</span>{' '}
        {total === 1 ? noun[0] : noun[1]}
      </p>
      <nav aria-label="Paginação" className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft strokeWidth={1.7} aria-hidden />
          Anterior
        </Button>
        {pageNumbers(page, totalPages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-ink-faint" aria-hidden>
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="sm"
              aria-label={`Página ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className="mono-num min-w-8"
              onClick={() => onPage(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Próxima
          <ChevronRight strokeWidth={1.7} aria-hidden />
        </Button>
      </nav>
    </div>
  )
}
