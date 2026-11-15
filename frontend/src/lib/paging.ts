import { useLocation, useSearchParams } from 'react-router'

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

// Atualiza a query string da tela; nulo tira o parâmetro. O estado da navegação
// (por exemplo, de onde o histórico foi aberto) segue junto com o endereço.
export function useQueryState() {
  const [params, setParams] = useSearchParams()
  const { state } = useLocation()
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
      { replace, state },
    )
  }
  return { params, update }
}

// Página e ordem da lista guardadas no endereço (?pagina=, ?ordem=, ?direcao=), com o
// nome da coluna na tela ligado ao nome na API. Sem parâmetro, a ordem é a da coluna
// padrão, na direção padrão (crescente, a não ser que a lista diga outra), e a página 1.
// Ao clicar em outra coluna, ela começa crescente; a coluna padrão só começa na direção
// padrão na abertura da lista. O endereço só guarda a direção quando ela difere da
// inicial da coluna. Valor desconhecido cai na ordem padrão inteira, como na API.
export function usePagedList<Sort extends string>(
  columns: Record<string, Sort>,
  defaultColumn: string,
  defaultDirection: SortDirection = 'asc',
) {
  const { params, update } = useQueryState()
  const chosen = params.get('ordem') ?? defaultColumn
  const known = Object.hasOwn(columns, chosen)
  const column = known ? chosen : defaultColumn
  const firstDirection = (of: string): SortDirection =>
    of === defaultColumn ? defaultDirection : 'asc'
  const asked = params.get('direcao')
  const direction: SortDirection = !known
    ? defaultDirection
    : asked === 'asc' || asked === 'desc'
      ? asked
      : firstDirection(column)
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
    // Clicar na coluna ativa inverte a direção; outra coluna começa crescente, a padrão
    // também (a direção padrão só vale na abertura da lista).
    toggleSort: (next: string) => {
      const nextDirection: SortDirection =
        column === next ? (direction === 'asc' ? 'desc' : 'asc') : 'asc'
      update({
        ordem: next === defaultColumn ? null : next,
        direcao: nextDirection === firstDirection(next) ? null : nextDirection,
        pagina: null,
      })
    },
  }
}

export type PagedList = ReturnType<typeof usePagedList>
