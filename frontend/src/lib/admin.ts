import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Role, User } from '@/lib/auth'

export type Sector = {
  id: number
  name: string
  // Lido do QR code; vazio enquanto nenhum número está vinculado.
  phone: string | null
  provider: string
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'logged_out'
  lastConnectedAt: string | null
  active: boolean
}

export type Module = {
  id: number
  sectorId: number
  name: string
  active: boolean
}

export type AdminUser = User & { active: boolean }

export type SectorInput = { name: string }

export type UserInput = {
  name: string
  email: string
  role: Role
  sectorId: number | null
}

const sectorsKey = ['sectors']
const usersKey = ['users']
const modulesKey = (sectorId: number) => ['sectors', sectorId, 'modules']

// Setores visíveis ao usuário: todos para o administrador, o próprio para os demais.
export function useSectors() {
  return useQuery({ queryKey: sectorsKey, queryFn: () => api<Sector[]>('/sectors') })
}

export function useSaveSector() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: SectorInput & { id?: number }) =>
      id === undefined
        ? api<Sector>('/sectors', { method: 'POST', body })
        : api<Sector>(`/sectors/${id}`, { method: 'PUT', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sectorsKey }),
  })
}

export function useUsers() {
  return useQuery({ queryKey: usersKey, queryFn: () => api<AdminUser[]>('/users') })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: UserInput & { password: string }) =>
      api<AdminUser>('/users', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UserInput & { id: number; active: boolean }) =>
      api<AdminUser>(`/users/${id}`, { method: 'PUT', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      api<void>(`/users/${id}/password`, { method: 'PUT', body: { password } }),
  })
}

export function useModules(sectorId: number | undefined) {
  return useQuery({
    queryKey: modulesKey(sectorId ?? 0),
    queryFn: () => api<Module[]>(`/sectors/${sectorId}/modules`),
    enabled: sectorId !== undefined,
  })
}

export function useSaveModule(sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: number; name: string; active: boolean }) =>
      id === undefined
        ? api<Module>(`/sectors/${sectorId}/modules`, { method: 'POST', body: { name: body.name } })
        : api<Module>(`/sectors/${sectorId}/modules/${id}`, { method: 'PUT', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modulesKey(sectorId) }),
  })
}
