import { expect, request as apiRequest, test, type Page } from '@playwright/test'
import { admin, login, seedSector, signIn, unique, userPassword } from './fixtures'

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test('administrador cadastra a Contabilidade e seus usuários', async ({ page, browser }) => {
  const { id } = unique()
  const sectorName = `Contabilidade ${id}`

  await signIn(page, admin.email, admin.password)
  await page.getByRole('link', { name: 'Setores' }).click()
  await expect(page.getByRole('heading', { name: 'Setores' })).toBeVisible()

  await page.getByRole('button', { name: 'Novo setor' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo setor' })
  await drawer.getByLabel('Nome').fill(sectorName)
  await expect(drawer.getByLabel('Número do WhatsApp')).toBeHidden()
  await drawer.getByRole('button', { name: 'Cadastrar setor' }).click()
  await expect(page.getByText('Setor salvo')).toBeVisible()
  await expect(drawer).toBeHidden()
  const row = page.getByRole('row', { name: new RegExp(sectorName) })
  await expect(row).toContainText('Não conectado')
  await expect(row).toContainText('Desconectado')

  await page.getByRole('link', { name: 'Usuários' }).click()
  const people = [
    { name: `Supervisora ${id}`, email: `sup.${id}@e2e.test`, role: 'Supervisor' },
    { name: `Atendente ${id}`, email: `agente.${id}@e2e.test`, role: 'Atendente' },
  ]
  for (const person of people) {
    await page.getByRole('button', { name: 'Novo usuário' }).click()
    const userDrawer = page.getByRole('dialog', { name: 'Novo usuário' })
    await userDrawer.getByLabel('Nome').fill(person.name)
    await userDrawer.getByLabel('E-mail').fill(person.email)
    await chooseOption(page, 'Papel', person.role)
    await chooseOption(page, 'Setor', sectorName)
    await userDrawer.getByLabel('Senha inicial').fill(userPassword)
    await userDrawer.getByRole('button', { name: 'Cadastrar usuário' }).click()
    await expect(userDrawer).toBeHidden()
    const userRow = page.getByRole('row', { name: new RegExp(person.email) })
    await expect(userRow).toContainText(person.role)
    await expect(userRow).toContainText(sectorName)
    await expect(userRow).toContainText('Ativo')
  }

  // Os usuários cadastrados entram com a senha inicial.
  for (const person of people) {
    const context = await browser.newContext()
    const userPage = await context.newPage()
    await login(userPage, person.email, userPassword)
    await expect(userPage.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
    await context.close()
  }
})

test('cadastro de setor exige o nome e recusa nome repetido', async ({ page, baseURL }) => {
  const { sector } = await seedSector(baseURL!)
  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/setores')

  await page.getByRole('button', { name: 'Novo setor' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo setor' })
  await drawer.getByRole('button', { name: 'Cadastrar setor' }).click()
  await expect(drawer.getByText('Informe o nome do setor.')).toBeVisible()

  await drawer.getByLabel('Nome').fill(sector.name)
  await drawer.getByRole('button', { name: 'Cadastrar setor' }).click()
  await expect(drawer.getByRole('alert')).toHaveText('Já existe um setor com este nome.')
})

test('administrador edita setor e desativa usuário', async ({ page, browser, baseURL }) => {
  const { sector, agent } = await seedSector(baseURL!)
  await signIn(page, admin.email, admin.password)

  await page.goto('/admin/setores')
  await page.getByRole('button', { name: `Editar ${sector.name}` }).click()
  const drawer = page.getByRole('dialog', { name: 'Editar setor' })
  await expect(drawer.getByLabel('Nome')).toHaveValue(sector.name)
  await drawer.getByLabel('Nome').fill(`${sector.name} editado`)
  await drawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByRole('row', { name: new RegExp(`${sector.name} editado`) })).toBeVisible()

  await page.goto('/admin/usuarios')
  const row = page.getByRole('row', { name: new RegExp(agent) })
  await row.getByRole('button', { name: /^Editar/ }).click()
  const userDrawer = page.getByRole('dialog', { name: 'Editar usuário' })
  await userDrawer.getByRole('switch', { name: 'Ativo' }).click()
  await userDrawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(userDrawer).toBeHidden()
  await expect(row).toContainText('Inativo')

  const context = await browser.newContext()
  const agentPage = await context.newPage()
  await login(agentPage, agent, userPassword)
  await expect(agentPage.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await context.close()
})

test('usuário com chamado em atendimento só é desativado ou trocado de setor depois de transferir', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const other = await seedSector(baseURL!)

  const adminApi = await apiRequest.newContext({ baseURL })
  await adminApi.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect((await adminApi.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  expect((await adminApi.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  await adminApi.dispose()
  const received = await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
    data: {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName: 'Joana Cliente',
      body: 'Preciso da segunda via da guia',
    },
  })
  expect(received.ok()).toBeTruthy()

  // O atendente assume pela API; o teste é da tela de usuários.
  const agentApi = await apiRequest.newContext({ baseURL })
  await agentApi.post('/api/auth/login', { data: { email: agent, password: userPassword } })
  const tickets = (await (await agentApi.get(`/api/sectors/${sector.id}/tickets`)).json()) as {
    id: number
  }[]
  expect((await agentApi.post(`/api/tickets/${tickets[0].id}/assign`)).ok()).toBeTruthy()

  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/usuarios')
  const row = page.getByRole('row', { name: new RegExp(agent) })
  await row.getByRole('button', { name: /^Editar/ }).click()
  const drawer = page.getByRole('dialog', { name: 'Editar usuário' })
  const refusal =
    'O usuário tem 1 chamado em atendimento. Transfira antes de desativar ou trocar de setor.'

  // Desativar é recusado, e o aviso aparece no formulário, que continua aberto.
  await drawer.getByRole('switch', { name: 'Ativo' }).click()
  await drawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(drawer.getByRole('alert')).toHaveText(refusal)

  // Trocar de setor também.
  await drawer.getByRole('switch', { name: 'Ativo' }).click()
  await chooseOption(page, 'Setor', other.sector.name)
  await drawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(drawer.getByRole('alert')).toHaveText(refusal)
  await drawer.getByRole('button', { name: 'Cancelar' }).click()
  await expect(row).toContainText('Ativo')
  await expect(row).toContainText(sector.name)

  // Editar o nome continua livre.
  await row.getByRole('button', { name: /^Editar/ }).click()
  await drawer.getByLabel('Nome').fill('Atendente renomeado')
  await drawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(drawer).toBeHidden()
  const renamed = page.getByRole('row', { name: new RegExp(agent) })
  await expect(renamed).toContainText('Atendente renomeado')

  // Depois de transferir, a desativação passa.
  const workload = (await (await agentApi.get(`/api/sectors/${sector.id}/workload`)).json()) as {
    id: number
    name: string
  }[]
  const target = workload.find((u) => u.name === supervisor.replace('.', ' ').split('@')[0])
  expect(
    (
      await agentApi.post(`/api/tickets/${tickets[0].id}/transfer`, {
        data: { assigneeId: target!.id },
      })
    ).ok(),
  ).toBeTruthy()
  await agentApi.dispose()

  await renamed.getByRole('button', { name: /^Editar/ }).click()
  await drawer.getByRole('switch', { name: 'Ativo' }).click()
  await drawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(drawer).toBeHidden()
  await expect(renamed).toContainText('Inativo')
})

test('administrador redefine a senha de um usuário', async ({ page, browser, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/usuarios')
  await page
    .getByRole('row', { name: new RegExp(agent) })
    .getByRole('button', { name: /^Editar/ })
    .click()
  const drawer = page.getByRole('dialog', { name: 'Editar usuário' })
  await drawer.getByLabel('Nova senha').fill('fraca')
  await drawer.getByRole('button', { name: 'Redefinir senha' }).click()
  await expect(drawer.getByText(/no mínimo 8 caracteres/).last()).toBeVisible()

  await drawer.getByLabel('Nova senha').fill('Nova#Senha9')
  await drawer.getByRole('button', { name: 'Redefinir senha' }).click()
  await expect(page.getByText('Senha redefinida')).toBeVisible()

  const context = await browser.newContext()
  const agentPage = await context.newPage()
  await login(agentPage, agent, 'Nova#Senha9')
  await expect(agentPage).toHaveURL(/\/$/)
  await context.close()
})

test('administrador não desativa a própria conta', async ({ page }) => {
  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/usuarios')
  await page.getByRole('button', { name: `Editar ${admin.name}` }).click()
  const drawer = page.getByRole('dialog', { name: 'Editar usuário' })
  await expect(drawer.getByRole('switch', { name: 'Ativo' })).toBeDisabled()
  await expect(drawer.getByLabel('Papel')).toBeDisabled()
  await expect(drawer.getByText('Você não pode desativar a própria conta.')).toBeVisible()
})

test('supervisor cadastra e desativa módulos do próprio setor', async ({ page, baseURL }) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)

  await expect(page.getByRole('link', { name: 'Módulos' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Setores' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Usuários' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Módulos' }).click()
  await expect(page.getByText(`Administração · ${sector.name}`)).toBeVisible()
  await expect(page.getByText('Nenhum módulo cadastrado.')).toBeVisible()

  for (const name of ['Folha de pagamento', 'Contabilidade geral']) {
    await page.getByRole('button', { name: 'Novo módulo' }).click()
    const drawer = page.getByRole('dialog', { name: 'Novo módulo' })
    await drawer.getByLabel('Nome').fill(name)
    await drawer.getByRole('button', { name: 'Cadastrar módulo' }).click()
    await expect(drawer).toBeHidden()
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('Ativo')
  }

  await page.getByRole('button', { name: 'Novo módulo' }).click()
  const duplicate = page.getByRole('dialog', { name: 'Novo módulo' })
  await duplicate.getByLabel('Nome').fill('FOLHA DE PAGAMENTO')
  await duplicate.getByRole('button', { name: 'Cadastrar módulo' }).click()
  await expect(duplicate.getByRole('alert')).toHaveText(
    'Já existe um módulo com este nome no setor.',
  )
  await duplicate.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('button', { name: 'Editar Folha de pagamento' }).click()
  const drawer = page.getByRole('dialog', { name: 'Editar módulo' })
  await drawer.getByRole('switch', { name: 'Ativo' }).click()
  await drawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Módulo salvo').last()).toBeVisible()
  await expect(page.getByRole('row', { name: /Folha de pagamento/ })).toContainText('Inativo')

  // Ativos primeiro: o módulo desativado vai para o fim da lista.
  await expect(page.getByRole('row').last()).toContainText('Folha de pagamento')

  await page.goto('/admin/usuarios')
  await expect(page).toHaveURL(/\/$/)
})

test('administrador gerencia módulos de qualquer setor', async ({ page, baseURL }) => {
  const { sector } = await seedSector(baseURL!)
  await signIn(page, admin.email, admin.password)
  await page.getByRole('link', { name: 'Módulos' }).click()
  await chooseOption(page, 'Setor', sector.name)
  await expect(page.getByText(`Administração · ${sector.name}`)).toBeVisible()

  await page.getByRole('button', { name: 'Novo módulo' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo módulo' })
  await drawer.getByLabel('Nome').fill('Prestação de contas')
  await drawer.getByRole('button', { name: 'Cadastrar módulo' }).click()
  await expect(page.getByRole('row', { name: /Prestação de contas/ })).toBeVisible()
})

test('atendente não acessa a administração', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()

  await expect(page.getByText('Administração')).toHaveCount(0)
  for (const name of ['Módulos', 'Setores', 'Usuários']) {
    await expect(page.getByRole('link', { name })).toHaveCount(0)
  }
  for (const path of ['/modulos', '/admin/setores', '/admin/usuarios']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/$/)
  }

  // O backend recusa mesmo chamando a API diretamente.
  expect((await page.request.get('/api/users')).status()).toBe(403)
  expect((await page.request.post('/api/sectors', { data: { name: 'X' } })).status()).toBe(403)
})

for (const theme of [
  { scheme: 'light' as const, sidebar: 'rgb(255, 255, 255)' },
  { scheme: 'dark' as const, sidebar: 'rgb(24, 31, 34)' },
]) {
  test(`telas de administração usam o design system no tema ${theme.scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme.scheme })
    await signIn(page, admin.email, admin.password)
    await page.goto('/admin/setores')
    await expect(page.locator('[data-slot=sidebar-inner]')).toHaveCSS(
      'background-color',
      theme.sidebar,
    )
    await expect(page.getByRole('heading', { name: 'Setores' })).toHaveCSS(
      'font-family',
      /IBM Plex Serif/,
    )
    await expect(page.getByText('GCASPP LAB')).toBeVisible()
  })
}
