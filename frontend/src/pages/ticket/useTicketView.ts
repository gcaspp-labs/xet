import { useSyncExternalStore } from 'react'

type View = { tab: string; query: string }
const views = new Map<number, View>()
const listeners = new Set<() => void>()
const defaultView: View = { tab: 'details', query: '' }

export function clearTicketViews() {
  views.clear()
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
