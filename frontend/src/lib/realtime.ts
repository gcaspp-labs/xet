import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { connectionKey } from '@/lib/connection'
import { historyKey, ticketKey } from '@/lib/conversation'
import { dashboardAssigneesKey, dashboardKey } from '@/lib/dashboard'
import { contactsKey } from '@/lib/directory'
import { resetQueueBaseline } from '@/lib/notifications'
import { closedTodayKey, ticketsKey, workloadKey } from '@/lib/tickets'

// Avisos do backend (docs/architecture.md, Tempo real): dizem o que mudou, e os dados
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
      void queryClient.invalidateQueries({ queryKey: closedTodayKey(event.sectorId) })
      void queryClient.invalidateQueries({ queryKey: dashboardKey })
      void queryClient.invalidateQueries({ queryKey: dashboardAssigneesKey(event.sectorId) })
      // Conversa e histórico abertos do chamado.
      void queryClient.invalidateQueries({ queryKey: ticketKey(event.ticketId) })
      void queryClient.invalidateQueries({ queryKey: historyKey })
      // O aviso também vem quando o nome ou o cadastro do contato muda.
      void queryClient.invalidateQueries({ queryKey: contactsKey })
      break
    case 'connection':
      void queryClient.invalidateQueries({ queryKey: ['sectors'], exact: true })
      void queryClient.invalidateQueries({ queryKey: connectionKey(event.sectorId) })
      break
  }
}

// Mantém a conexão com os eventos em tempo real enquanto há sessão. Reconecta
// sozinha com espera crescente e recarrega tudo ao reconectar, para não perder
// o que mudou no intervalo. Devolve false enquanto a conexão está caída, para
// a tela avisar que os dados podem estar desatualizados.
export function useRealtime() {
  const queryClient = useQueryClient()
  const [online, setOnline] = useState(true)

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
        setOnline(true)
        if (reconnecting) {
          // O que entrou na fila durante a queda não é novidade para o sino: não avisa.
          resetQueueBaseline()
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
        setOnline(false)
        // A fila pode mudar sem o sino ver: a próxima carga vira a referência, não novidade.
        resetQueueBaseline()
        timer = setTimeout(connect, delay)
        delay = Math.min(delay * 2, maxDelay)
      }
    }

    // A rede pode cair antes de o WebSocket perceber, e o TanStack Query recarrega a fila
    // assim que ela volta, antes de o WebSocket reabrir. A referência vale desde a queda.
    window.addEventListener('offline', resetQueueBaseline)

    connect()
    return () => {
      stopped = true
      window.removeEventListener('offline', resetQueueBaseline)
      clearTimeout(timer)
      socket?.close()
    }
  }, [queryClient])

  return online
}
