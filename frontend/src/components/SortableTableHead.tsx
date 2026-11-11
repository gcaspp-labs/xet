import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { TableHead } from '@/components/ui/table'
import type { PagedList } from '@/lib/paging'
import { cn } from '@/lib/utils'

// Título de coluna que ordena a lista: uma coluna ativa por vez, com a setinha da
// direção; clicar de novo inverte.
export function SortableTableHead({
  label,
  column,
  list,
  className,
}: {
  label: string
  column: string
  list: Pick<PagedList, 'column' | 'direction' | 'toggleSort'>
  className?: string
}) {
  const active = list.column === column
  const Icon = !active ? ArrowUpDown : list.direction === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={className}
      aria-sort={active ? (list.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => list.toggleSort(column)}
        className={cn(
          'table-head -ml-2 inline-flex items-center gap-1 rounded-(--radius-7) px-2 py-1 hover:bg-muted',
          active ? 'text-ink' : 'text-ink-soft',
        )}
      >
        {label}
        <Icon
          strokeWidth={1.7}
          aria-hidden
          className={cn('size-[13px]', active ? 'text-accent-strong' : 'text-ink-faint')}
        />
      </button>
    </TableHead>
  )
}
