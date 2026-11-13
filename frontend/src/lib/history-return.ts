// Estado da navegação ao abrir um chamado pelo histórico: o endereço de volta e o
// estado de quem o abriu, para o retorno encadeado (histórico → chamado → outro
// histórico → chamado) chegar de volta à origem.
export type HistoryReturnState = { historyReturn: string; historyBefore?: HistoryReturnState }

export function historyReturnState(location: {
  pathname: string
  search: string
  state: unknown
}): HistoryReturnState {
  const before = location.state as Partial<HistoryReturnState> | null
  return {
    historyReturn: location.pathname + location.search,
    historyBefore: before?.historyReturn ? (before as HistoryReturnState) : undefined,
  }
}
