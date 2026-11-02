import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useState } from 'react'
import type { Module } from '@/lib/admin'
import { api } from '@/lib/api'
import { useCurrentUser } from '@/lib/auth'

export type MunicipalityRef = { id: number; name: string }

export type Municipality = MunicipalityRef & { audespCode: string }

export type Organization = {
  id: number
  name: string
  cnpj: string | null
  municipality: MunicipalityRef
}

export type Contact = {
  id: number
  name: string
  // Vazio só em contato criado por mensagem sem telefone conhecido.
  phone: string | null
  registered: boolean
  organization: Organization | null
  sectors: { id: number; name: string }[]
  modules: ContactModule[]
}

export type ContactModule = { id: number; sectorId: number; name: string }

export type OrganizationInput = { name: string; cnpj: string; municipalityId: number }

export type ContactInput = {
  name: string
  phone: string
  organizationId: number
  sectorIds: number[]
  moduleIds: number[]
}

// Sem setor ou módulo, a busca vale para todos.
export type ContactFilter = { sectorId?: number; moduleId?: number }

// O backend devolve no máximo este número de resultados por busca.
export const searchLimit = 50

const organizationsKey = ['organizations']
const contactsKey = ['contacts']

const searchPath = (path: string, query: string) =>
  query.trim() === '' ? path : `${path}?q=${encodeURIComponent(query.trim())}`

// Os municípios não têm cadastro: a lista não muda enquanto a tela está aberta.
export function useMunicipalities(enabled: boolean) {
  return useQuery({
    queryKey: ['municipalities'],
    queryFn: () => api<Municipality[]>('/municipalities'),
    enabled,
    staleTime: Infinity,
  })
}

// Busca por nome, município ou CNPJ; sem termo, lista por nome.
export function useOrganizations(query: string) {
  return useQuery({
    queryKey: [...organizationsKey, query.trim()],
    queryFn: () => api<Organization[]>(searchPath('/organizations', query)),
    placeholderData: keepPreviousData,
  })
}

export function useSaveOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: OrganizationInput & { id?: number }) =>
      id === undefined
        ? api<Organization>('/organizations', { method: 'POST', body })
        : api<Organization>(`/organizations/${id}`, { method: 'PUT', body }),
    // A busca de contatos mostra o nome, o município e o CNPJ do órgão.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationsKey }),
        queryClient.invalidateQueries({ queryKey: contactsKey }),
      ]),
  })
}

function contactsPath(query: string, filter: ContactFilter) {
  const params = new URLSearchParams()
  if (query.trim() !== '') {
    params.set('q', query.trim())
  }
  if (filter.sectorId !== undefined) {
    params.set('sectorId', String(filter.sectorId))
  }
  if (filter.moduleId !== undefined) {
    params.set('moduleId', String(filter.moduleId))
  }
  const search = params.toString()
  return search === '' ? '/contacts' : `/contacts?${search}`
}

// Busca por nome do contato ou do órgão, telefone ou CNPJ, no setor e no módulo
// do filtro; sem termo, lista por nome.
export function useContacts(query: string, filter: ContactFilter = {}) {
  return useQuery({
    queryKey: [...contactsKey, query.trim(), filter.sectorId, filter.moduleId],
    queryFn: () => api<Contact[]>(contactsPath(query, filter)),
    placeholderData: keepPreviousData,
  })
}

export function useContact(id: number, enabled: boolean) {
  return useQuery({
    queryKey: [...contactsKey, 'detail', id],
    queryFn: () => api<Contact>(`/contacts/${id}`),
    enabled,
  })
}

// Valor do filtro que mostra todos os setores ou módulos.
export const allContacts = 'all'

// Filtro da busca de contatos (spec.md, Setores e módulos do contato): abre em
// "Meu setor", com opção de ver todos; o administrador abre em todos e escolhe
// entre os setores.
export function useContactFilter() {
  const { data: user } = useCurrentUser()
  const ownSector = user?.role === 'admin' ? undefined : (user?.sectorId ?? undefined)
  const [chosenSector, setChosenSector] = useState<string | null>(null)
  const [chosenModule, setChosenModule] = useState(allContacts)
  const sector = chosenSector ?? (ownSector !== undefined ? String(ownSector) : allContacts)
  const filter: ContactFilter = {
    sectorId: sector === allContacts ? undefined : Number(sector),
    moduleId: chosenModule === allContacts ? undefined : Number(chosenModule),
  }
  return {
    ownSector,
    sector,
    module: chosenModule,
    filter,
    setSector: (value: string) => {
      setChosenSector(value)
      setChosenModule(allContacts)
    },
    setModule: setChosenModule,
  }
}

const activeModulesQuery = (sectorId: number) => ({
  queryKey: ['sectors', sectorId, 'active-modules'],
  queryFn: () => api<Module[]>(`/sectors/${sectorId}/active-modules`),
})

// Módulos ativos de um setor, para o filtro da busca.
export function useActiveModules(sectorId: number | undefined) {
  return useQuery({ ...activeModulesQuery(sectorId ?? 0), enabled: sectorId !== undefined })
}

// Módulos ativos de vários setores, para o cadastro do contato.
export function useActiveModulesOf(sectorIds: number[]) {
  return useQueries({
    queries: sectorIds.map(activeModulesQuery),
    combine: (results) => results.flatMap((result) => result.data ?? []),
  })
}

export type SavedContact = { name: string; phone: string; exists: boolean }

export type ImportResult = { created: number; existing: number; unavailable: number }

// Agenda do número do setor. Sem nova tentativa: número desconectado é um aviso, não uma falha passageira.
export function useSavedContacts(sectorId: number | undefined) {
  return useQuery({
    queryKey: ['sectors', sectorId, 'saved-contacts'],
    queryFn: () => api<SavedContact[]>(`/sectors/${sectorId}/saved-contacts`),
    enabled: sectorId !== undefined,
    retry: false,
  })
}

// Envia só os telefones escolhidos; o servidor lê os nomes de novo.
export function useImportContacts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      sectorId,
      ...body
    }: {
      sectorId: number
      phones: string[]
      organizationId: number
    }) => api<ImportResult>(`/sectors/${sectorId}/saved-contacts/import`, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contactsKey }),
  })
}

export function useSaveContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ContactInput & { id?: number }) =>
      id === undefined
        ? api<Contact>('/contacts', { method: 'POST', body })
        : api<Contact>(`/contacts/${id}`, { method: 'PUT', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contactsKey }),
  })
}
