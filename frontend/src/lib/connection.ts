import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Sector } from '@/lib/admin'
import { api } from '@/lib/api'

export type Connection = {
  status: Sector['connectionStatus']
  lastConnectedAt: string | null
  // Número lido do QR code.
  phone: string | null
  // Há conta a desvincular, mesmo durante uma queda temporária.
  linked: boolean
  // Motivo da recusa da última conexão.
  connectionError: string | null
  // Há um QR code aguardando leitura, servido por qrCodeUrl.
  pairing: boolean
  // Desvinculado no sistema, mas o aparelho não pôde ser avisado.
  warning?: string
}

export const connectionKey = (sectorId: number) => ['sectors', sectorId, 'connection']

// Atualizada pelos eventos do WebSocket; o botão da tela de conexão também
// recarrega, para mostrar um QR code novo.
export function useConnection(sectorId: number | undefined) {
  return useQuery({
    queryKey: connectionKey(sectorId ?? 0),
    queryFn: () => api<Connection>(`/sectors/${sectorId}/connection`),
    enabled: sectorId !== undefined,
  })
}

export function useConnect(sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<Connection>(`/sectors/${sectorId}/connection`, { method: 'POST' }),
    onSuccess: (connection) => {
      queryClient.setQueryData(connectionKey(sectorId), connection)
      return queryClient.invalidateQueries({ queryKey: ['sectors'], exact: true })
    },
  })
}

export function useDisconnect(sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<Connection>(`/sectors/${sectorId}/connection`, { method: 'DELETE' }),
    onSuccess: (connection) => {
      queryClient.setQueryData(connectionKey(sectorId), connection)
      return queryClient.invalidateQueries({ queryKey: ['sectors'], exact: true })
    },
  })
}

// O código muda a cada leitura do estado; o parâmetro evita a imagem antiga em cache.
export function qrCodeUrl(sectorId: number, version: number) {
  return `/api/sectors/${sectorId}/connection/qr.png?v=${version}`
}
