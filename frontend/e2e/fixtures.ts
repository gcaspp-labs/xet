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

type SectorData = { id: number; name: string; phone: string }

// Prepara dados pela API como administrador, para testes que não são da tela de cadastro.
export async function seedSector(baseURL: string) {
  const api = await request.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect(login.ok()).toBeTruthy()
  const { id, phone } = unique()
  const sector = await api.post('/api/sectors', { data: { name: `Setor ${id}`, phone } })
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
