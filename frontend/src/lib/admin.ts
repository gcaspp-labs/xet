import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Role, User } from '@/lib/auth'
import { normalizeSearch } from '@/lib/format'

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
  // PROTÓTIPO #150: módulo do assunto; vazio nos assuntos antigos.
  module: { id: number; name: string; active: boolean } | null
  // Soluções do assunto, apagadas junto com ele.
  solutions: { id: number; subjectId: number; body: string }[]
}

const subjectsKey = (sectorId: number) => ['sectors', sectorId, 'subjects']

// PROTÓTIPO #150: filtro por módulo ('none' = sem módulo).
export function useSubjects(sectorId: number | undefined, module: string | null = null) {
  return useQuery({
    queryKey: [...subjectsKey(sectorId ?? 0), module],
    queryFn: () =>
      api<Subject[]>(`/sectors/${sectorId}/subjects${module ? `?module=${module}` : ''}`),
    enabled: sectorId !== undefined,
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

// Busca da tela Assuntos (spec.md, Assuntos e soluções), sem diferenciar acentos
// nem maiúsculas: o assunto encontrado pelo nome vem com todas as soluções; o
// encontrado por uma solução vem só com as soluções que batem.
export function filterSubjects(subjects: Subject[], query: string) {
  const typed = normalizeSearch(query.trim())
  if (!typed) {
    return subjects
  }
  return subjects.flatMap((subject) => {
    if (normalizeSearch(subject.name).includes(typed)) {
      return [subject]
    }
    const solutions = subject.solutions.filter((solution) =>
      normalizeSearch(solution.body).includes(typed),
    )
    return solutions.length > 0 ? [{ ...subject, solutions }] : []
  })
}
