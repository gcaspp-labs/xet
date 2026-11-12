import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api, ApiError } from '@/lib/api'
import { clearTicketViews } from '@/pages/ticket/useTicketView'

export type Role = 'agent' | 'supervisor' | 'admin'

export type User = {
  id: number
  name: string
  email: string
  role: Role
  sectorId: number | null
}

const meKey = ['auth', 'me']

// Usuário da sessão atual; null quando não há sessão válida.
export function useCurrentUser() {
  return useQuery({
    queryKey: meKey,
    queryFn: async () => {
      try {
        return await api<User>('/auth/me')
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return null
        }
        throw error
      }
    },
    staleTime: Infinity,
    retry: false,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api<User>('/auth/login', { method: 'POST', body: credentials }),
    onSuccess: (user) => queryClient.setQueryData(meKey, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      clearTicketViews()
      queryClient.clear()
      queryClient.setQueryData(meKey, null)
    },
  })
}

// Mesma regra de senha do backend (spec.md): mínimo de 8 caracteres, com
// maiúscula, minúscula, número e caractere especial; até 72 bytes (bcrypt).
export const passwordSchema = z
  .string()
  .refine(
    (value) =>
      [...value].length >= 8 &&
      /\p{Lu}/u.test(value) &&
      /\p{Ll}/u.test(value) &&
      /\p{N}/u.test(value) &&
      /[^\p{L}\p{N}]/u.test(value),
    'A senha precisa ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial.',
  )
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    'A senha pode ter no máximo 72 caracteres.',
  )
