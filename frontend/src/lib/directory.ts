import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type Organization = {
  id: number
  name: string
  cnpj: string | null
}

export type Contact = {
  id: number
  name: string
  phone: string
  registered: boolean
  organization: Organization | null
}

export type OrganizationInput = { name: string; cnpj: string }

export type ContactInput = { name: string; phone: string; organizationId: number }

// O backend devolve no máximo este número de resultados por busca.
export const searchLimit = 50

const organizationsKey = ['organizations']
const contactsKey = ['contacts']

const searchPath = (path: string, query: string) =>
  query.trim() === '' ? path : `${path}?q=${encodeURIComponent(query.trim())}`

// Busca por nome ou CNPJ; sem termo, lista por nome.
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
    // A busca de contatos mostra o nome e o CNPJ do órgão.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: organizationsKey }),
        queryClient.invalidateQueries({ queryKey: contactsKey }),
      ]),
  })
}

// Busca por nome do contato ou do órgão, telefone ou CNPJ; sem termo, lista por nome.
export function useContacts(query: string) {
  return useQuery({
    queryKey: [...contactsKey, query.trim()],
    queryFn: () => api<Contact[]>(searchPath('/contacts', query)),
    placeholderData: keepPreviousData,
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
