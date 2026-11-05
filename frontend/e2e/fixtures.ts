import { type APIRequestContext, expect, type Locator, request, type Page } from '@playwright/test'

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

// Troca de usuário: sai da página antes de limpar os cookies. Uma requisição ainda em andamento
// renovaria o cookie ao responder, e a tela de login redirecionaria o usuário anterior ao painel.
export async function clearSession(page: Page) {
  await page.goto('about:blank')
  await page.context().clearCookies()
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

// O banco é compartilhado entre os testes, que rodam em paralelo e deixam números desconectados.
// Limita a lista de setores da página aos do teste, para a contagem do sino do administrador ser
// exata. O restante, inclusive a fila e o tempo real, continua vindo do backend.
export async function onlySectors(page: Page, ...ids: number[]) {
  await page.route('**/api/sectors', async (route) => {
    const response = await route.fetch()
    const sectors = (await response.json()) as SectorData[]
    await route.fulfill({ response, json: sectors.filter((s) => ids.includes(s.id)) })
  })
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

// Define a resposta da API de CNPJ falsa para um CNPJ; sem resposta definida, ela devolve 404.
export async function fakeCnpjResponse(cnpj: string, status: number, body: unknown = {}) {
  const response = await fetch(`http://localhost:18081/responses/${cnpj}`, {
    method: 'PUT',
    body: JSON.stringify({ status, body }),
  })
  expect(response.ok).toBeTruthy()
}

type OrganizationData = {
  id: number
  name: string
  cnpj: string | null
  municipality: { id: number; name: string }
}

// Município usado pelos testes que não tratam da cidade do órgão.
export const defaultMunicipality = 'Itu'

// Id de um município carregado pela migração; o contexto precisa estar logado.
export async function municipalityId(api: APIRequestContext, name = defaultMunicipality) {
  const response = await api.get('/api/municipalities')
  expect(response.ok()).toBeTruthy()
  const municipalities = (await response.json()) as { id: number; name: string }[]
  return municipalities.find((municipality) => municipality.name === name)!.id
}

// Cadastra órgãos e contatos pela API como administrador.
export async function seedDirectory(
  baseURL: string,
  organizations: { name: string; cnpj?: string; municipality?: string }[],
  contacts: { name: string; phone: string; organization: number; sector: number }[],
) {
  const api = await request.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect(login.ok()).toBeTruthy()
  const created: OrganizationData[] = []
  for (const { municipality, ...org } of organizations) {
    const response = await api.post('/api/organizations', {
      data: { ...org, municipalityId: await municipalityId(api, municipality) },
    })
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

// Janela com bloqueio (spec.md, Janelas de formulário): sem X, Esc e clique fora não fecham, o
// texto digitado continua, e o botão do rodapé fecha. Sem `field`, a janela não tem texto a digitar.
export async function expectLockedDialog(
  page: Page,
  dialog: Locator,
  { field, cancel = 'Cancelar' }: { field?: string; cancel?: string } = {},
) {
  const text = 'Texto digitado antes de tentar fechar'
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toHaveCount(0)
  if (field) {
    await dialog.getByLabel(field).fill(text)
  }
  await page.keyboard.press('Escape')
  await page.mouse.click(10, 300)
  await expect(dialog).toBeVisible()
  if (field) {
    await expect(dialog.getByLabel(field)).toHaveValue(text)
  }
  await dialog.getByRole('button', { name: cancel, exact: true }).click()
  await expect(dialog).toBeHidden()
}

// Janela com fechamento normal: X, Esc e clique fora fecham.
export async function expectClosableDialog(page: Page, dialog: Locator, open: () => Promise<void>) {
  await open()
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(dialog).toBeHidden()
  await open()
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await open()
  await expect(dialog).toBeVisible()
  await page.mouse.click(10, 300)
  await expect(dialog).toBeHidden()
}
