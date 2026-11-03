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

// Sugestão da consulta de CNPJ; sem município, ele fica para escolher à mão.
export type CnpjSuggestion = { name: string; municipality: MunicipalityRef | null }

export type OrganizationInput = { name: string; cnpj: string; municipalityId: number }

export type ContactInput = {
  name: string
  phone: string
  organizationId: number
  sectorIds: number[]
  moduleIds: number[]
}

// Sem setor, módulo, município ou órgão, a busca vale para todos.
export type ContactFilter = {
  sectorId?: number
  moduleId?: number
  municipalityId?: number
  organizationId?: number
}

// O backend devolve no máximo este número de resultados por busca.
export const searchLimit = 50

const organizationsKey = ['organizations']
export const contactsKey = ['contacts']

function searchPath(path: string, query: string, filters: Record<string, number | undefined>) {
  const params = new URLSearchParams()
  if (query.trim() !== '') {
    params.set('q', query.trim())
  }
  for (const [name, value] of Object.entries(filters)) {
    if (value !== undefined) {
      params.set(name, String(value))
    }
  }
  const search = params.toString()
  return search === '' ? path : `${path}?${search}`
}

// Os municípios não têm cadastro: a lista não muda enquanto a tela está aberta.
export function useMunicipalities(enabled: boolean) {
  return useQuery({
    queryKey: ['municipalities'],
    queryFn: () => api<Municipality[]>('/municipalities'),
    enabled,
    staleTime: Infinity,
  })
}

// Municípios que têm órgão, para o filtro de contatos; salvar um órgão atualiza a lista.
export function useOrganizationMunicipalities() {
  return useQuery({
    queryKey: [...organizationsKey, 'municipalities'],
    queryFn: () => api<MunicipalityRef[]>('/organizations/municipalities'),
  })
}

// Busca por nome, município ou CNPJ, só nos órgãos do município, se informado;
// sem termo, lista por nome.
export function useOrganizations(query: string, municipalityId?: number) {
  return useQuery({
    queryKey: [...organizationsKey, query.trim(), municipalityId],
    queryFn: () => api<Organization[]>(searchPath('/organizations', query, { municipalityId })),
    placeholderData: keepPreviousData,
  })
}

// Parte de um clique e não salva nada: é uma mutação só para não repetir a chamada à API externa.
export function useLookupCnpj() {
  return useMutation({
    mutationFn: (cnpj: string) => api<CnpjSuggestion>(`/cnpj/${cnpj}`),
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

// Busca por nome do contato, do órgão ou do município, telefone ou CNPJ, dentro do
// filtro; sem termo, lista por nome.
export function useContacts(query: string, filter: ContactFilter = {}) {
  return useQuery({
    queryKey: [
      ...contactsKey,
      query.trim(),
      filter.sectorId,
      filter.moduleId,
      filter.municipalityId,
      filter.organizationId,
    ],
    queryFn: () => api<Contact[]>(searchPath('/contacts', query, filter)),
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
  const [municipality, setChosenMunicipality] = useState<MunicipalityRef | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const sector = chosenSector ?? (ownSector !== undefined ? String(ownSector) : allContacts)
  const filter: ContactFilter = {
    sectorId: sector === allContacts ? undefined : Number(sector),
    moduleId: chosenModule === allContacts ? undefined : Number(chosenModule),
    municipalityId: municipality?.id,
    organizationId: organization?.id,
  }
  return {
    ownSector,
    sector,
    module: chosenModule,
    municipality,
    organization,
    filter,
    setSector: (value: string) => {
      setChosenSector(value)
      setChosenModule(allContacts)
    },
    setModule: setChosenModule,
    // O órgão acompanha o município: o de outra cidade sai do filtro.
    setMunicipality: (value: MunicipalityRef | null) => {
      setChosenMunicipality(value)
      if (value && organization?.municipality.id !== value.id) {
        setOrganization(null)
      }
    },
    setOrganization,
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

// Salva só o nome de um contato não cadastrado, que continua não cadastrado.
export function useSaveContactName() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api<Contact>(`/contacts/${id}/name`, { method: 'PUT', body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contactsKey }),
  })
}
