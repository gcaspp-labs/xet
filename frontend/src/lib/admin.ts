import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Role, User } from '@/lib/auth'
import { type Page, type PageRequest, pageParams } from '@/lib/paging'

export type Sector = {
  id: number
  name: string
  email: string | null
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

export type AdminUser = User & { nickname: string; active: boolean }

export type SectorInput = { name: string; email: string }

export type UserInput = {
  name: string
  nickname: string
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

// Assuntos da lista do setor (spec.md, Assuntos e soluções): supervisor do
// setor e administrador. O atendente lê a lista pelo formulário de encerramento.
export type Subject = {
  id: number
  sectorId: number
  name: string
  moduleId: number | null
  // Soluções mostradas, que na busca por uma solução são só as que batem, e
  // solutionCount, a lista inteira do assunto (a contagem e a exclusão usam ela).
  solutions: { id: number; subjectId: number; body: string }[]
  solutionCount: number
}

const subjectsKey = (sectorId: number) => ['sectors', sectorId, 'subjects']

// Colunas que ordenam a lista na tela, ligadas às colunas que a API aceita.
export type SubjectSort = 'name' | 'module'

export const subjectColumns: Record<string, SubjectSort> = { assunto: 'name', modulo: 'module' }
export const defaultSubjectColumn = 'assunto'

// Página de 20 assuntos do setor, com a busca e o filtro de módulo no servidor;
// cada assunto vem com as soluções que a busca mostra.
export function useSubjects(
  sectorId: number | undefined,
  filter: { query: string; module: string },
  request: PageRequest<SubjectSort>,
) {
  return useQuery({
    queryKey: [
      ...subjectsKey(sectorId ?? 0),
      'page',
      filter.query.trim(),
      filter.module,
      request.page,
      request.sort,
      request.direction,
    ],
    queryFn: () => {
      const search = new URLSearchParams(pageParams(request))
      if (filter.query.trim()) {
        search.set('q', filter.query.trim())
      }
      if (filter.module !== 'all') {
        search.set('moduleId', filter.module)
      }
      return api<Page<Subject>>(`/sectors/${sectorId}/subjects?${search}`)
    },
    enabled: sectorId !== undefined,
    placeholderData: keepPreviousData,
  })
}

export function useSaveSubject(sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name, moduleId }: { id?: number; name: string; moduleId: number }) =>
      id === undefined
        ? api<Subject>(`/sectors/${sectorId}/subjects`, {
            method: 'POST',
            body: { name, moduleId },
          })
        : api<Subject>(`/sectors/${sectorId}/subjects/${id}`, {
            method: 'PUT',
            body: { name, moduleId },
          }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subjectsKey(sectorId) }),
  })
}

export function useDeleteSubject(sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      api<void>(`/sectors/${sectorId}/subjects/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subjectsKey(sectorId) }),
  })
}

export type Solution = Subject['solutions'][number]

export function useSaveSolution(sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ subjectId, id, body }: { subjectId: number; id?: number; body: string }) =>
      id === undefined
        ? api<Solution>(`/sectors/${sectorId}/subjects/${subjectId}/solutions`, {
            method: 'POST',
            body: { body },
          })
        : api<Solution>(`/sectors/${sectorId}/subjects/${subjectId}/solutions/${id}`, {
            method: 'PUT',
            body: { body },
          }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subjectsKey(sectorId) }),
  })
}

export function useDeleteSolution(sectorId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ subjectId, id }: { subjectId: number; id: number }) =>
      api<void>(`/sectors/${sectorId}/subjects/${subjectId}/solutions/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subjectsKey(sectorId) }),
  })
}
