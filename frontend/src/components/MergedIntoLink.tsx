import { Link } from 'react-router'
import { type MergedInto, ticketPath } from '@/lib/tickets'
import { cn } from '@/lib/utils'

// O chamado original de um mesclado, na lista de Atendimentos e na ficha do atendimento:
// mesmo texto e mesmo destino nos dois lugares (spec #374). Aberto em Chamados quando ainda
// está ativo, e em Atendimentos quando já foi encerrado.
export function MergedIntoLink({
  mergedInto,
  className,
}: {
  mergedInto: MergedInto
  className?: string
}) {
  return (
    <Link
      to={ticketPath(mergedInto)}
      className={cn('caption text-accent-strong underline-offset-2 hover:underline', className)}
    >
      Ver chamado {mergedInto.protocol}
    </Link>
  )
}
