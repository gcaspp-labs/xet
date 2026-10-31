import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { connectionKey } from '@/lib/connection'
import { ticketsKey, workloadKey } from '@/lib/tickets'

// Avisos do backend (arquitetura.md, Tempo real): dizem o que mudou, e os dados
// são recarregados pela API.
type RealtimeEvent =
  { type: 'ticket'; sectorId: number; ticketId: number } | { type: 'connection'; sectorId: number }

// Código de fechamento do backend quando a sessão termina.
const sessionEnded = 1008

const minDelay = 1000
const maxDelay = 30000

function handle(queryClient: QueryClient, event: RealtimeEvent) {
  switch (event.type) {
    case 'ticket':
      void queryClient.invalidateQueries({ queryKey: ticketsKey(event.sectorId) })
      void queryClient.invalidateQueries({ queryKey: workloadKey(event.sectorId) })
      break
    case 'connection':
      void queryClient.invalidateQueries({ queryKey: ['sectors'], exact: true })
      void queryClient.invalidateQueries({ queryKey: connectionKey(event.sectorId) })
      break
  }
}

// Mantém a conexão com os eventos em tempo real enquanto há sessão. Reconecta
// sozinha com espera crescente e recarrega tudo ao reconectar, para não perder
// o que mudou no intervalo.
export function useRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    let socket: WebSocket | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let delay = minDelay
    let reconnecting = false
    let stopped = false

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      socket = new WebSocket(`${protocol}//${window.location.host}/api/ws`)
      socket.onopen = () => {
        delay = minDelay
        if (reconnecting) {
          void queryClient.invalidateQueries()
        }
      }
      socket.onmessage = (message) => {
        handle(queryClient, JSON.parse(String(message.data)) as RealtimeEvent)
      }
      socket.onclose = (event) => {
        if (stopped) {
          return
        }
        if (event.code === sessionEnded) {
          // Sessão encerrada: a consulta do usuário leva de volta ao login.
          void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
          return
        }
        reconnecting = true
        timer = setTimeout(connect, delay)
        delay = Math.min(delay * 2, maxDelay)
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      socket?.close()
    }
  }, [queryClient])
}
