import { expect, request as apiRequest, test, type Page } from '@playwright/test'
import { admin, adminApi, login, seedSector, signIn, unique, userPassword } from './fixtures'

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

  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitem', { name: 'Usuários' }).click()
  await expect(page).toHaveURL(/\/admin\/usuarios$/)
  const people = [
    {
      name: `Supervisora ${id}`,
      email: `sup.${id}@e2e.test`,
      role: 'Supervisor',
      home: 'Dashboard',
    },
    {
      name: `Atendente ${id}`,
      email: `agente.${id}@e2e.test`,
      role: 'Atendente',
      home: 'Chamados',
    },
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
    // A lista vem em páginas: a busca acha o usuário em qualquer uma.
    await page.getByRole('searchbox', { name: 'Buscar usuários' }).fill(person.email)
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
    await expect(userPage.getByRole('heading', { name: person.home, exact: true })).toBeVisible()
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

test('administrador cadastra, troca e limpa o e-mail do setor', async ({ page }) => {
  const { id } = unique()
  const name = `Financeiro ${id}`
  const email = `financeiro.${id}@e2e.test`
  const otherEmail = `contas.${id}@e2e.test`

  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/setores')
  await expect(page.getByRole('columnheader', { name: 'E-mail' })).toBeVisible()

  await page.getByRole('button', { name: 'Novo setor' }).click()
  const newDrawer = page.getByRole('dialog', { name: 'Novo setor' })
  await expect(newDrawer.getByText('Opcional. E-mail universal do setor.')).toBeVisible()
  await newDrawer.getByLabel('Nome').fill(name)
  await newDrawer.getByLabel('E-mail').fill('sem-arroba')
  await newDrawer.getByRole('button', { name: 'Cadastrar setor' }).click()
  await expect(newDrawer.getByText('Informe um e-mail válido.')).toBeVisible()
  await newDrawer.getByLabel('E-mail').fill(email)
  await newDrawer.getByRole('button', { name: 'Cadastrar setor' }).click()
  await expect(newDrawer).toBeHidden()

  const row = page.getByRole('row', { name: new RegExp(name) })
  await expect(row).toContainText(email)

  const editDrawer = page.getByRole('dialog', { name: 'Editar setor' })
  await page.getByRole('button', { name: `Editar ${name}` }).click()
  await expect(editDrawer.getByLabel('E-mail')).toHaveValue(email)
  await editDrawer.getByLabel('E-mail').fill(otherEmail)
  await editDrawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(editDrawer).toBeHidden()
  await expect(row).toContainText(otherEmail)

  await page.getByRole('button', { name: `Editar ${name}` }).click()
  await expect(editDrawer.getByLabel('E-mail')).toHaveValue(otherEmail)
  await editDrawer.getByLabel('E-mail').fill('')
  await editDrawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(editDrawer).toBeHidden()
  await expect(row.getByRole('cell').nth(1)).toHaveText('—')
})

test('e-mail repetido é recusado no cadastro e na edição do setor', async ({ page, baseURL }) => {
  const { sector } = await seedSector(baseURL!)
  const { id } = unique()
  const email = `setor.${id}@e2e.test`

  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/setores')

  await page.getByRole('button', { name: 'Novo setor' }).click()
  const newDrawer = page.getByRole('dialog', { name: 'Novo setor' })
  await newDrawer.getByLabel('Nome').fill(`Primeiro ${id}`)
  await newDrawer.getByLabel('E-mail').fill(email)
  await newDrawer.getByRole('button', { name: 'Cadastrar setor' }).click()
  await expect(newDrawer).toBeHidden()

  await page.getByRole('button', { name: 'Novo setor' }).click()
  await newDrawer.getByLabel('Nome').fill(`Segundo ${id}`)
  await newDrawer.getByLabel('E-mail').fill(email.toUpperCase())
  await newDrawer.getByRole('button', { name: 'Cadastrar setor' }).click()
  await expect(newDrawer.getByRole('alert')).toHaveText('Já existe um setor com este e-mail.')
  await newDrawer.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('button', { name: `Editar ${sector.name}` }).click()
  const editDrawer = page.getByRole('dialog', { name: 'Editar setor' })
  await editDrawer.getByLabel('E-mail').fill(email.toUpperCase())
  await editDrawer.getByRole('button', { name: 'Salvar' }).click()
  await expect(editDrawer.getByRole('alert')).toHaveText('Já existe um setor com este e-mail.')
})

test('e-mail longo quebra na coluna e deixa à vista as ações do setor, com o texto "Maior"', async ({
  page,
}) => {
  const { id } = unique()
  const name = `Longo ${id}`
  await signIn(page, admin.email, admin.password)
  await page.evaluate(() => localStorage.setItem('text-size', 'larger'))
  await page.goto('/admin/setores')

  await page.getByRole('button', { name: 'Novo setor' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo setor' })
  await drawer.getByLabel('Nome').fill(name)
  await drawer.getByLabel('E-mail').fill(`atendimento.financeiro.${id}@prefeitura-exemplo.test`)
  await drawer.getByRole('button', { name: 'Cadastrar setor' }).click()
  await expect(drawer).toBeHidden()

  await expect(page.getByRole('button', { name: `Editar ${name}` })).toBeInViewport({ ratio: 1 })
})

test('senha comum é recusada ao cadastrar usuário', async ({ page, baseURL }) => {
  const { sector } = await seedSector(baseURL!)
  const { id } = unique()
  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/usuarios')

  await page.getByRole('button', { name: 'Novo usuário' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo usuário' })
  await drawer.getByLabel('Nome').fill(`Atendente ${id}`)
  await drawer.getByLabel('E-mail').fill(`comum.${id}@e2e.test`)
  await chooseOption(page, 'Papel', 'Atendente')
  await chooseOption(page, 'Setor', sector.name)
  await drawer.getByLabel('Senha inicial').fill('Senha@123')
  await drawer.getByRole('button', { name: 'Cadastrar usuário' }).click()
  await expect(drawer.getByRole('alert')).toHaveText(
    'Senha muito comum. Escolha outra, mais difícil de adivinhar.',
  )

  await drawer.getByLabel('Senha inicial').fill(userPassword)
  await drawer.getByRole('button', { name: 'Cadastrar usuário' }).click()
  await expect(drawer).toBeHidden()
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

  await page.goto(`/admin/usuarios?busca=${encodeURIComponent(agent)}`)
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

  const api = await adminApi(baseURL!)
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  expect((await api.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  await api.dispose()
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
  await page.goto(`/admin/usuarios?busca=${encodeURIComponent(agent)}`)
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
  await page.goto(`/admin/usuarios?busca=${encodeURIComponent(agent)}`)
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
  await expect(agentPage).toHaveURL(/\/chamados$/)
  await context.close()
})

test('o olho mostra e oculta a Senha inicial e a Nova senha', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, admin.email, admin.password)
  await page.goto(`/admin/usuarios?busca=${encodeURIComponent(agent)}`)

  await page.getByRole('button', { name: 'Novo usuário' }).click()
  const create = page.getByRole('dialog', { name: 'Novo usuário' })
  const initial = create.getByLabel('Senha inicial')
  await initial.fill(userPassword)
  await expect(initial).toHaveAttribute('type', 'password')
  await create.getByRole('button', { name: 'Mostrar senha' }).click()
  await expect(initial).toHaveAttribute('type', 'text')
  await create.getByRole('button', { name: 'Ocultar senha' }).click()
  await expect(initial).toHaveAttribute('type', 'password')
  await page.keyboard.press('Escape')
  await expect(create).toBeHidden()

  await page
    .getByRole('row', { name: new RegExp(agent) })
    .getByRole('button', { name: /^Editar/ })
    .click()
  const edit = page.getByRole('dialog', { name: 'Editar usuário' })
  const reset = edit.getByLabel('Nova senha')
  await reset.fill('fraca')
  await expect(reset).toHaveAttribute('type', 'password')
  await edit.getByRole('button', { name: 'Mostrar senha' }).click()
  await expect(reset).toHaveAttribute('type', 'text')
  await edit.getByRole('button', { name: 'Ocultar senha' }).click()
  await expect(reset).toHaveAttribute('type', 'password')
})

test('administrador não desativa a própria conta', async ({ page }) => {
  await signIn(page, admin.email, admin.password)
  await page.goto(`/admin/usuarios?busca=${encodeURIComponent(admin.email)}`)
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
  await expect(page.getByText(`Cadastro · ${sector.name}`)).toBeVisible()
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
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('administrador gerencia módulos de qualquer setor', async ({ page, baseURL }) => {
  const { sector } = await seedSector(baseURL!)
  await signIn(page, admin.email, admin.password)
  await page.getByRole('link', { name: 'Módulos' }).click()
  await chooseOption(page, 'Setor', sector.name)
  await expect(page.getByText(`Cadastro · ${sector.name}`)).toBeVisible()

  await page.getByRole('button', { name: 'Novo módulo' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo módulo' })
  await drawer.getByLabel('Nome').fill('Prestação de contas')
  await drawer.getByRole('button', { name: 'Cadastrar módulo' }).click()
  await expect(page.getByRole('row', { name: /Prestação de contas/ })).toBeVisible()
})

test('atendente não acessa a administração', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible()

  await expect(page.getByText('Administração')).toHaveCount(0)
  for (const name of ['Módulos', 'Setores', 'Usuários']) {
    await expect(page.getByRole('link', { name })).toHaveCount(0)
  }
  for (const path of ['/modulos', '/admin/setores', '/admin/usuarios']) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/chamados$/)
  }

  // O backend recusa mesmo chamando a API diretamente.
  expect((await page.request.get('/api/users')).status()).toBe(403)
  expect((await page.request.post('/api/sectors', { data: { name: 'X' } })).status()).toBe(403)
})

for (const theme of [
  { scheme: 'light' as const, sidebar: 'rgb(255, 255, 255)' },
  { scheme: 'dark' as const, sidebar: 'rgb(24, 24, 27)' },
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

test('apelido acompanha o nome no cadastro e não muda na edição', async ({ page, baseURL }) => {
  const { sector } = await seedSector(baseURL!)
  const { id } = unique()
  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/usuarios')

  await page.getByRole('button', { name: 'Novo usuário' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo usuário' })
  const nickname = drawer.getByLabel('Apelido')
  await expect(drawer.getByText('O cliente vê este nome nas mensagens.')).toBeVisible()

  // A sugestão acompanha o nome digitado: primeiro e último nome.
  await drawer.getByLabel('Nome').fill('Ana')
  await expect(nickname).toHaveValue('Ana')
  await drawer.getByLabel('Nome').fill(`Ana Maria ${id}`)
  await expect(nickname).toHaveValue(`Ana ${id}`)

  // Editado à mão, o apelido para de acompanhar o nome, mesmo depois de ficar vazio.
  await nickname.fill(`Aninha ${id}`)
  await drawer.getByLabel('Nome').fill(`Ana Maria Souza ${id}`)
  await expect(nickname).toHaveValue(`Aninha ${id}`)
  await nickname.fill('')
  await drawer.getByLabel('Nome').fill(`Ana Clara ${id}`)
  await expect(nickname).toHaveValue('')

  // Vazio grava o primeiro e o último nome.
  await drawer.getByLabel('E-mail').fill(`ana.${id}@e2e.test`)
  await chooseOption(page, 'Setor', sector.name)
  await drawer.getByLabel('Senha inicial').fill(userPassword)
  await drawer.getByRole('button', { name: 'Cadastrar usuário' }).click()
  await expect(page.getByText('Usuário salvo')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Buscar usuários' }).fill(`ana.${id}@e2e.test`)

  // Na edição, mudar o nome não muda o apelido.
  await page.getByRole('button', { name: `Editar Ana Clara ${id}` }).click()
  const edit = page.getByRole('dialog', { name: 'Editar usuário' })
  await expect(edit.getByLabel('Apelido')).toHaveValue(`Ana ${id}`)
  await edit.getByLabel('Nome').fill(`Ana Beatriz Lima ${id}`)
  await expect(edit.getByLabel('Apelido')).toHaveValue(`Ana ${id}`)
  await edit.getByRole('button', { name: 'Salvar' }).click()
  await expect(edit).toHaveCount(0)
  await page.getByRole('button', { name: `Editar Ana Beatriz Lima ${id}` }).click()
  await expect(
    page.getByRole('dialog', { name: 'Editar usuário' }).getByLabel('Apelido'),
  ).toHaveValue(`Ana ${id}`)
})

test('apelido repetido é recusado no formulário', async ({ page, baseURL }) => {
  const { sector } = await seedSector(baseURL!)
  const { id } = unique()
  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/usuarios')

  const register = async (email: string) => {
    const drawer = page.getByRole('dialog', { name: 'Novo usuário' })
    await page.getByRole('button', { name: 'Novo usuário' }).click()
    await drawer.getByLabel('Nome').fill(`Rui Dias ${id}`)
    await drawer.getByLabel('E-mail').fill(email)
    await chooseOption(page, 'Setor', sector.name)
    await drawer.getByLabel('Senha inicial').fill(userPassword)
    await drawer.getByRole('button', { name: 'Cadastrar usuário' }).click()
    return drawer
  }

  await register(`rui.${id}@e2e.test`)
  await expect(page.getByText('Usuário salvo')).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Novo usuário' })).toHaveCount(0)

  // O segundo, com o mesmo nome, recebe o mesmo apelido e fica na janela com o aviso.
  const drawer = await register(`rui2.${id}@e2e.test`)
  await expect(drawer.getByText('Já existe um usuário com este apelido.')).toBeVisible()

  // Trocando o apelido, o cadastro passa.
  await drawer.getByLabel('Apelido').fill(`Rui D ${id}`)
  await drawer.getByRole('button', { name: 'Cadastrar usuário' }).click()
  await expect(drawer).toHaveCount(0)
})

test('lista de usuários em páginas de 20, com busca e ordem no endereço', async ({
  page,
  baseURL,
}) => {
  const { sector } = await seedSector(baseURL!)
  const { id } = unique()
  const api = await adminApi(baseURL!)
  // 23 atendentes com o mesmo marcador; os três últimos, inativos.
  const names = Array.from(
    { length: 23 },
    (_, i) => `Lista ${id} ${String(i + 1).padStart(2, '0')}`,
  )
  for (const [i, name] of names.entries()) {
    const created = await api.post('/api/users', {
      data: {
        name,
        email: `lista${i}.${id}@e2e.test`,
        role: 'agent',
        sectorId: sector.id,
        password: userPassword,
      },
    })
    expect(created.ok()).toBeTruthy()
    if (i >= 20) {
      const user = (await created.json()) as { id: number }
      const updated = await api.put(`/api/users/${user.id}`, {
        data: {
          name,
          email: `lista${i}.${id}@e2e.test`,
          role: 'agent',
          sectorId: sector.id,
          active: false,
        },
      })
      expect(updated.ok()).toBeTruthy()
    }
  }
  await api.dispose()

  await signIn(page, admin.email, admin.password)
  await page.goto('/admin/usuarios')
  const search = page.getByRole('searchbox', { name: 'Buscar usuários' })
  const rows = page.getByRole('row').filter({ hasText: `Lista ${id}` })
  const pagination = page.getByRole('navigation', { name: 'Paginação' })
  await expect(search).toHaveAttribute('placeholder', 'Nome, apelido ou e-mail')

  // A busca vai ao servidor antes de paginar: ordem inicial pelo nome, crescente.
  await search.fill(`LISTA ${id}`)
  await expect(page).toHaveURL(/busca=/)
  await expect(rows).toHaveCount(20)
  await expect(rows.first()).toContainText(names[0])
  await expect(page.getByText('Página 1 de 2 · 23 usuários')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Usuário' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
  await expect(pagination.getByRole('button', { name: 'Anterior' })).toBeDisabled()

  // Próxima página: o endereço guarda a página e a busca.
  await pagination.getByRole('button', { name: 'Próxima' }).click()
  await expect(page).toHaveURL(/pagina=2/)
  await expect(rows).toHaveCount(3)
  await expect(rows.last()).toContainText(names[22])
  await expect(rows.last()).toContainText('Inativo')
  await expect(pagination.getByRole('button', { name: 'Próxima' })).toBeDisabled()

  // Ordenar volta à página 1 e mantém a busca: Situação decrescente põe os inativos primeiro.
  await page.getByRole('button', { name: 'Situação', exact: true }).click()
  await expect(page).toHaveURL(/ordem=situacao/)
  await expect(page).not.toHaveURL(/pagina=/)
  await expect(search).toHaveValue(`LISTA ${id}`)
  await expect(rows.first()).toContainText(names[0])
  await page.getByRole('button', { name: 'Situação', exact: true }).click()
  await expect(page).toHaveURL(/direcao=desc/)
  await expect(rows.first()).toContainText(names[22])
  await expect(rows.first()).toContainText('Inativo')
  await expect(page.getByRole('columnheader', { name: 'Situação' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )

  // O endereço reabre a mesma lista; página além da última vira a última.
  await page.goto(
    `/admin/usuarios?busca=${encodeURIComponent(`lista ${id}`)}&ordem=situacao&direcao=desc&pagina=9`,
  )
  await expect(page).toHaveURL(/pagina=2/)
  await expect(rows).toHaveCount(3)
  await expect(page.getByText('Página 2 de 2 · 23 usuários')).toBeVisible()

  // Mudar a busca volta à página 1 e mantém a coluna e a direção; com tudo numa página, a faixa some.
  await search.fill(`lista2.${id}@e2e`)
  await expect(page).not.toHaveURL(/pagina=/)
  await expect(page).toHaveURL(/ordem=situacao/)
  await expect(page).toHaveURL(/direcao=desc/)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(names[2])
  await expect(pagination).toBeHidden()

  // Editar continua a partir da lista paginada.
  await page.getByRole('button', { name: `Editar ${names[2]}` }).click()
  await expect(page.getByRole('dialog', { name: 'Editar usuário' })).toBeVisible()
  await page.keyboard.press('Escape')

  // Busca sem resultado.
  await search.fill(`ninguém ${id}`)
  await expect(page.getByText('Nenhum usuário encontrado.')).toBeVisible()
  await expect(rows).toHaveCount(0)

  // No celular, Papel e Setor viram legenda embaixo do nome, e Editar cabe na tela.
  await page.setViewportSize({ width: 390, height: 844 })
  await search.fill(`lista2.${id}@e2e`)
  await expect(rows.first()).toContainText(`Atendente · ${sector.name}`)
  await expect(page.getByRole('columnheader', { name: 'Papel' })).toBeHidden()
  await expect(page.getByRole('button', { name: `Editar ${names[2]}` })).toBeInViewport({
    ratio: 1,
  })
})
