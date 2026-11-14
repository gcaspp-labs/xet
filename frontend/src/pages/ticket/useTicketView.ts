import { useSyncExternalStore } from 'react'

type View = { tab: string; query: string }
const views = new Map<number, View>()
const listeners = new Set<() => void>()
const defaultView: View = { tab: 'details', query: '' }

const searches = new Map<number, string>()

export function clearTicketViews() {
  views.clear()
  searches.clear()
  listeners.forEach((listener) => listener())
}

// As escolhas vivem somente na memória da página, separadas por chamado.
export function useTicketView(ticketId: number) {
  const view = useSyncExternalStore(
    (callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    () => views.get(ticketId) ?? defaultView,
  )
  const setView = (patch: Partial<View>) => {
    views.set(ticketId, { ...(views.get(ticketId) ?? defaultView), ...patch })
    listeners.forEach((listener) => listener())
  }
  return [view, setView] as const
}

// Na tela Chamados só a busca de Assuntos é lembrada, por chamado e apenas na memória da página.
// A aba volta a ser a Fila a cada troca de conversa.
export function useConversasSearch(ticketId: number) {
  const query = useSyncExternalStore(
    (callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    () => searches.get(ticketId) ?? '',
  )
  const setQuery = (value: string) => {
    searches.set(ticketId, value)
    listeners.forEach((listener) => listener())
  }
  return [query, setQuery] as const
}
