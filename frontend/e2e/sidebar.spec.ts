import { expect, request as apiRequest, test, type Page } from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword } from './fixtures'

const sidebar = '[data-slot=sidebar-inner]'

test('barra lateral acompanha o tema escolhido', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, admin.email, admin.password)
  const inner = page.locator(sidebar)
  await expect(inner).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  const brand = page.getByRole('banner').locator('img:visible')
  await expect(brand).toHaveAttribute('src', /glab-simbolo(?!-escuro)/)

  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitemradio', { name: 'Escuro' }).click()
  await page.keyboard.press('Escape')
  await expect(inner).toHaveCSS('background-color', 'rgb(24, 31, 34)')
  await expect(brand).toHaveAttribute('src', /glab-simbolo-escuro/)
})

test('cabeçalho fica fixo com a marca e o sino de notificações, acima da barra lateral', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 400 })
  await signIn(page, admin.email, admin.password)
  const header = page.getByRole('banner')
  await expect(header).toContainText('GCASPP LAB')
  await expect(header).toContainText('Central de Atendimento')
  await expect(header.getByRole('button', { name: 'Notificações' })).toBeEnabled()

  const height = (await header.boundingBox())!.height
  expect((await page.locator(sidebar).boundingBox())!.y).toBe(height)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  expect((await header.boundingBox())!.y).toBe(0)
  expect((await page.locator(sidebar).boundingBox())!.y).toBe(height)
})

test('barra lateral recolhe para os ícones, com o botão à direita ou no centro, e lembra a escolha', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await signIn(page, admin.email, admin.password)
  const inner = page.locator(sidebar)
  const content = page.locator('[data-slot=sidebar-inset]')
  const openWidth = (await content.boundingBox())!.width
  const collapse = inner.getByRole('button', { name: 'Recolher menu' })
  const place = (await collapse.boundingBox())!
  const openBar = (await inner.boundingBox())!
  // Aberta, o botão fica à direita, com a mesma folga que tem no topo.
  expect(openBar.x + openBar.width - (place.x + place.width)).toBeCloseTo(place.y - openBar.y, 0)
  expect(place.x).toBeGreaterThan(openBar.x + openBar.width / 2)
  const brand = await page.getByRole('banner').getByText('GCASPP LAB').boundingBox()
  const settings = await inner.getByRole('button', { name: 'Configurações' }).boundingBox()
  const contacts = await inner.getByRole('link', { name: 'Contatos' }).boundingBox()

  await collapse.click()
  const expand = inner.getByRole('button', { name: 'Abrir menu' })
  await expect(expand).toBeVisible()
  await expect.poll(async () => (await inner.boundingBox())!.width).toBeLessThanOrEqual(49)
  await expect
    .poll(async () => (await content.boundingBox())!.width)
    .toBeGreaterThan(openWidth + 150)
  await expect(inner.getByText('Administrador E2E')).toBeHidden()

  // Recolhida, o botão fica no centro da coluna; a altura dele, a marca e os itens não mudam.
  expect((await inner.getByRole('link', { name: 'Contatos' }).boundingBox())!.y).toBe(contacts!.y)
  const centered = (await expand.boundingBox())!
  const closedBar = (await inner.boundingBox())!
  expect(centered.y).toBe(place.y)
  expect(centered.height).toBe(place.height)
  expect(centered.x + centered.width / 2).toBeCloseTo(closedBar.x + closedBar.width / 2, 0)
  expect(await page.getByRole('banner').getByText('GCASPP LAB').boundingBox()).toEqual(brand)
  expect((await inner.getByRole('button', { name: 'Configurações' }).boundingBox())!.y).toBe(
    settings!.y,
  )

  // Os itens continuam navegáveis e o menu de configurações continua abrindo.
  await inner.getByRole('link', { name: 'Contatos' }).click()
  await expect(page).toHaveURL(/\/contatos$/)
  await inner.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.reload()
  await expect(expand).toBeVisible()
  await expect(inner.getByText('Administrador E2E')).toBeHidden()

  await expand.click()
  await expect(inner.getByText('Administrador E2E')).toBeVisible()
  await expect
    .poll(() => inner.getByRole('button', { name: 'Recolher menu' }).boundingBox())
    .toEqual(place)
})

async function menuGroups(page: Page) {
  const groups = page.locator('[data-slot=sidebar-inner] [data-slot=sidebar-group]')
  return groups.evaluateAll((items) =>
    items.map((group) => [
      group.querySelector('[data-slot=sidebar-group-label]')?.textContent,
      ...Array.from(group.querySelectorAll('a')).map((link) => link.textContent),
    ]),
  )
}

test('atendente vê só os itens do seu papel, sem Usuários em Configurações', async ({
  page,
  baseURL,
}) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)

  await expect
    .poll(() => menuGroups(page))
    .toEqual([
      ['Helpdesk', 'Atendimento', 'Conversas', 'Contatos'],
      ['Cadastro', 'Órgãos'],
    ])
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Usuários' })).toHaveCount(0)
})

test('supervisor vê também Conexão, Módulos e Assuntos, com o breadcrumb do grupo', async ({
  page,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  await signIn(page, supervisor, userPassword)

  await expect
    .poll(() => menuGroups(page))
    .toEqual([
      [undefined, 'Dashboard'],
      ['Helpdesk', 'Atendimento', 'Conversas', 'Contatos', 'Conexão'],
      ['Cadastro', 'Órgãos', 'Módulos', 'Assuntos'],
    ])
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Usuários' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  const content = page.locator('[data-slot=sidebar-inset]')
  await page.getByRole('link', { name: 'Conexão' }).click()
  await expect(content.getByText(`Helpdesk · ${sector.name}`, { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Módulos' }).click()
  await expect(content.getByText(`Cadastro · ${sector.name}`, { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Assuntos' }).click()
  await expect(page.getByRole('heading', { name: 'Assuntos' })).toBeVisible()
  await expect(content.getByText(`Cadastro · ${sector.name}`, { exact: true })).toBeVisible()
})

test('administrador vê tudo, com Usuários só em Configurações, e o breadcrumb do grupo', async ({
  page,
}) => {
  await signIn(page, admin.email, admin.password)

  await expect
    .poll(() => menuGroups(page))
    .toEqual([
      [undefined, 'Dashboard'],
      ['Helpdesk', 'Atendimento', 'Conversas', 'Contatos', 'Conexão'],
      ['Cadastro', 'Órgãos', 'Módulos', 'Assuntos', 'Setores'],
    ])
  await expect(page.getByRole('link', { name: 'Usuários' })).toHaveCount(0)

  const content = page.locator('[data-slot=sidebar-inset]')
  for (const [name, breadcrumb] of [
    ['Contatos', 'Helpdesk'],
    ['Órgãos', 'Cadastro'],
    ['Setores', 'Cadastro'],
  ]) {
    await page.getByRole('link', { name }).click()
    await expect(content.getByRole('heading', { name })).toBeVisible()
    await expect(content.getByText(breadcrumb, { exact: true })).toBeVisible()
  }

  // Usuários fica entre o tema e Sair, e o endereço não muda.
  await page.getByRole('button', { name: 'Configurações' }).click()
  const items = page.getByRole('menu').getByRole('menuitem')
  await expect(items).toHaveText(['Usuários', 'Sair'])
  await items.first().click()
  await expect(page).toHaveURL(/\/admin\/usuarios$/)
  await expect(content.getByRole('heading', { name: 'Usuários' })).toBeVisible()
  await expect(content.getByText('Configurações', { exact: true })).toBeVisible()
})

test('no celular, Usuários em Configurações fecha a gaveta', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await signIn(page, admin.email, admin.password)

  await page.getByRole('banner').getByRole('button', { name: 'Abrir menu' }).click()
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitem', { name: 'Usuários' }).click()
  await expect(page).toHaveURL(/\/admin\/usuarios$/)
  await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Contatos' })).toBeHidden()
})

test('botão de voltar leva da conversa à lista de atendimentos', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const api = await apiRequest.newContext({ baseURL })
  await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  await api.dispose()
  const messaging = `/api/test/messaging/sectors/${sector.id}`
  expect((await request.post(`${messaging}/pair`)).ok()).toBeTruthy()
  const { phone, id } = unique()
  const received = await request.post(`${messaging}/receive`, {
    data: {
      externalMessageId: `E2E-${id}`,
      phone,
      contactName: 'Clara Cliente',
      type: 'text',
      body: 'Bom dia',
    },
  })
  expect(received.ok()).toBeTruthy()

  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Clara Cliente' }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  for (const name of ['Detalhes', 'Notas', 'Histórico']) {
    await expect(page.getByRole('tab', { name, exact: true })).toBeVisible()
  }
  await expect(page.getByText('Falou com', { exact: true })).toBeVisible()
  await expect(page.locator(sidebar).getByRole('link', { name: 'Atendimento' })).toHaveAttribute(
    'data-active',
    '',
  )
  await expect(page.locator(sidebar).getByRole('link', { name: 'Conversas' })).not.toHaveAttribute(
    'data-active',
  )

  await page.getByRole('link', { name: 'Voltar à lista' }).click()
  await expect(page).toHaveURL(/\/atendimento$/)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
})
