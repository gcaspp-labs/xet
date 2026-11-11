import { useSearchParams } from 'react-router'

// Resposta comum das listas paginadas no servidor: os itens da página, o total que o
// filtro encontra, a página de fato devolvida (a última, se a pedida passou dela) e
// o tamanho da página.
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number }

export type SortDirection = 'asc' | 'desc'

// Página e ordem que a lista pede à API (?page=, ?sort=, ?direction=).
export type PageRequest<Sort extends string> = {
  page: number
  sort: Sort
  direction: SortDirection
}

export function pageParams<Sort extends string>(request: PageRequest<Sort>) {
  return {
    page: String(request.page),
    sort: request.sort,
    direction: request.direction,
  }
}

// Atualiza a query string da tela; nulo tira o parâmetro.
export function useQueryState() {
  const [params, setParams] = useSearchParams()
  const update = (next: Record<string, string | null>, replace = false) => {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        for (const [key, value] of Object.entries(next)) {
          if (value === null) {
            copy.delete(key)
          } else {
            copy.set(key, value)
          }
        }
        return copy
      },
      { replace },
    )
  }
  return { params, update }
}

// Página e ordem da lista guardadas no endereço (?pagina=, ?ordem=, ?direcao=), com o
// nome da coluna na tela ligado ao nome na API. Sem parâmetro, a ordem padrão
// crescente e a página 1; valor desconhecido também cai nelas, e coluna desconhecida
// volta à ordem padrão inteira, crescente, como na API.
export function usePagedList<Sort extends string>(
  columns: Record<string, Sort>,
  defaultColumn: string,
) {
  const { params, update } = useQueryState()
  const chosen = params.get('ordem') ?? defaultColumn
  const known = Object.hasOwn(columns, chosen)
  const column = known ? chosen : defaultColumn
  const direction: SortDirection = known && params.get('direcao') === 'desc' ? 'desc' : 'asc'
  const page = Math.max(1, Math.trunc(Number(params.get('pagina'))) || 1)
  return {
    column,
    direction,
    page,
    request: { page, sort: columns[column], direction } as PageRequest<Sort>,
    setPage: (next: number) => update({ pagina: next === 1 ? null : String(next) }),
    // A página que o servidor devolveu corrige o endereço, sem nova entrada no histórico.
    correctPage: (served: number) => {
      if (served !== page) {
        update({ pagina: served === 1 ? null : String(served) }, true)
      }
    },
    // Clicar na coluna ativa inverte a direção; outra coluna começa crescente.
    toggleSort: (next: string) => {
      const nextDirection = column === next && direction === 'asc' ? 'desc' : 'asc'
      update({
        ordem: next === defaultColumn ? null : next,
        direcao: nextDirection === 'asc' ? null : 'desc',
        pagina: null,
      })
    },
  }
}

export type PagedList = ReturnType<typeof usePagedList>
