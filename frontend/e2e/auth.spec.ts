import { expect, test } from '@playwright/test'
import { admin, login, unique } from './fixtures'

test('sem sessão, a página inicial leva ao login', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Central de Atendimento' })).toBeVisible()
})

test('senha incorreta mostra aviso', async ({ page }) => {
  await login(page, admin.email, 'Errada@123')
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await expect(page).toHaveURL(/\/login$/)
})

test('login bloqueia depois de tentativas erradas seguidas', async ({ page }) => {
  const email = `bloqueio.${unique().id}@e2e.test`
  for (let attempt = 0; attempt < 5; attempt++) {
    await login(page, email, 'Errada@123')
    await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  }
  await login(page, email, 'Errada@123')
  await expect(page.getByRole('alert')).toHaveText(
    'Login bloqueado por excesso de tentativas. Aguarde até 15 minutos e tente novamente.',
  )
})

test('campos vazios são validados antes do envio', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  await expect(page.getByText('Informe a senha.')).toBeVisible()
})

test('usuário entra, mantém a sessão ao recarregar e sai', async ({ page }) => {
  await login(page, admin.email, admin.password)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()

  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  const me = await page.request.get('/api/auth/me')
  expect(me.status()).toBe(401)
})

for (const theme of [
  {
    scheme: 'light' as const,
    paper: 'rgb(237, 239, 237)',
    accent: 'rgb(31, 94, 99)',
    logo: 'gcaspp-lab-horizontal',
  },
  {
    scheme: 'dark' as const,
    paper: 'rgb(16, 21, 23)',
    accent: 'rgb(95, 180, 184)',
    logo: 'gcaspp-lab-horizontal-escuro',
  },
]) {
  test(`tela de login usa o design system no tema ${theme.scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme.scheme })
    await page.goto('/login')
    await page.evaluate(() => document.fonts.ready)

    const body = page.locator('body')
    await expect(body).toHaveCSS('background-color', theme.paper)
    await expect(body).toHaveCSS('font-family', /IBM Plex Sans/)
    await expect(page.getByRole('heading', { name: 'Central de Atendimento' })).toHaveCSS(
      'font-family',
      /IBM Plex Serif/,
    )
    await expect(page.getByRole('button', { name: 'Entrar' })).toHaveCSS(
      'background-color',
      theme.accent,
    )
    expect(await page.evaluate(() => document.fonts.check('14px "IBM Plex Sans"'))).toBe(true)

    const logo = page.getByRole('img', { name: 'GCASPP LAB' })
    await expect(logo).toHaveCount(1)
    await expect(logo).toBeVisible()
    // O build de produção acrescenta um hash de 8 caracteres ao nome do arquivo.
    await expect(logo).toHaveAttribute('src', new RegExp(`/${theme.logo}(-[\\w-]{8})?\\.svg$`))
  })
}

test('favicon é o símbolo do design system', async ({ request }) => {
  const response = await request.get('/favicon.svg')
  expect(response.ok()).toBeTruthy()
  expect(await response.text()).toContain('<svg')
})
