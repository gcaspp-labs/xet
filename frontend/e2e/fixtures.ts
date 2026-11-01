import { expect, request, type Page } from '@playwright/test'

// Administrador de teste criado no banco próprio dos testes ponta a ponta.
export const admin = {
  name: 'Administrador E2E',
  email: 'admin@e2e.test',
  password: 'Senha@E2E1',
}

// Senha usada pelos usuários criados nos testes.
export const userPassword = 'Senha@Teste1'

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

// Entra e espera sair da tela de login, antes de navegar para outra página.
export async function signIn(page: Page, email: string, password: string) {
  await login(page, email, password)
  await expect(page).not.toHaveURL(/\/login$/)
}

// Os testes rodam em paralelo no mesmo banco: nomes, e-mails e números são únicos por teste.
export function unique() {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-9)
  return { id, phone: `5511${id}` }
}

type SectorData = { id: number; name: string; phone: string | null }

// Prepara dados pela API como administrador, para testes que não são da tela de cadastro.
export async function seedSector(baseURL: string) {
  const api = await request.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect(login.ok()).toBeTruthy()
  const { id } = unique()
  const sector = await api.post('/api/sectors', { data: { name: `Setor ${id}` } })
  expect(sector.ok()).toBeTruthy()
  const data = (await sector.json()) as SectorData

  const createUser = async (role: 'agent' | 'supervisor') => {
    const email = `${role}.${id}@e2e.test`
    const response = await api.post('/api/users', {
      data: { name: `${role} ${id}`, email, role, sectorId: data.id, password: userPassword },
    })
    expect(response.ok()).toBeTruthy()
    return email
  }

  const result = {
    sector: data,
    supervisor: await createUser('supervisor'),
    agent: await createUser('agent'),
  }
  await api.dispose()
  return result
}

// Dígito verificador do CNPJ (módulo 11, cada caractere vale o código ASCII menos 48).
function cnpjCheckDigit(prefix: string) {
  let sum = 0
  let weight = 2
  for (let i = prefix.length - 1; i >= 0; i--) {
    sum += (prefix.charCodeAt(i) - 48) * weight
    weight = weight === 9 ? 2 : weight + 1
  }
  const rest = sum % 11
  return rest < 2 ? '0' : String(11 - rest)
}

// CNPJ válido e único por teste; com letras, gera um CNPJ alfanumérico.
export function uniqueCnpj(alphanumeric = false) {
  const digits = unique().id.slice(-8)
  const base = alphanumeric
    ? `${digits.slice(0, 2)}AB${digits.slice(2, 6)}C${digits.slice(6)}1`
    : `${digits}0001`
  const first = cnpjCheckDigit(base)
  return base + first + cnpjCheckDigit(base + first)
}

export function formatCnpj(cnpj: string) {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`
}

type OrganizationData = { id: number; name: string; cnpj: string | null }

// Cadastra órgãos e contatos pela API como administrador.
export async function seedDirectory(
  baseURL: string,
  organizations: { name: string; cnpj?: string }[],
  contacts: { name: string; phone: string; organization: number; sector: number }[],
) {
  const api = await request.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect(login.ok()).toBeTruthy()
  const created: OrganizationData[] = []
  for (const org of organizations) {
    const response = await api.post('/api/organizations', { data: org })
    expect(response.ok()).toBeTruthy()
    created.push((await response.json()) as OrganizationData)
  }
  for (const contact of contacts) {
    const response = await api.post('/api/contacts', {
      data: {
        name: contact.name,
        phone: contact.phone,
        organizationId: created[contact.organization].id,
        sectorIds: [contact.sector],
      },
    })
    expect(response.ok()).toBeTruthy()
  }
  await api.dispose()
  return created
}
