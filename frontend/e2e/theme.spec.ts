import { expect, test, type Page } from '@playwright/test'
import { admin, seedSector, signIn, unique } from './fixtures'

const lightPaper = 'rgb(228, 228, 231)'
const darkPaper = 'rgb(9, 9, 11)'

async function chooseTheme(page: Page, label: string) {
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitemradio', { name: label }).click()
  await page.keyboard.press('Escape')
}

test('tema escolhido persiste ao recarregar e vale na tela de login', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, admin.email, admin.password)
  const html = page.locator('html')
  const body = page.locator('body')
  await expect(body).toHaveCSS('background-color', lightPaper)

  await chooseTheme(page, 'Escuro')
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(body).toHaveCSS('background-color', darkPaper)
  await expect(html).toHaveCSS('color-scheme', 'dark')

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible()
  await expect(body).toHaveCSS('background-color', darkPaper)

  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'Escuro' })).toBeChecked()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(body).toHaveCSS('background-color', darkPaper)
  await expect(page.getByRole('img', { name: 'GCASPP' })).toHaveAttribute(
    'src',
    /gcaspp-horizontal-escuro/,
  )

  await page.reload()
  await expect(body).toHaveCSS('background-color', darkPaper)
})

test('tema claro vale mesmo com o sistema operacional no escuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await signIn(page, admin.email, admin.password)
  await expect(page.locator('body')).toHaveCSS('background-color', darkPaper)

  await chooseTheme(page, 'Claro')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('body')).toHaveCSS('background-color', lightPaper)
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
})

test('"Sistema" segue o sistema operacional', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, admin.email, admin.password)
  const html = page.locator('html')
  const body = page.locator('body')

  // Sem escolha, vale Sistema.
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'Sistema' })).toBeChecked()
  await page.keyboard.press('Escape')

  await chooseTheme(page, 'Escuro')
  await expect(body).toHaveCSS('background-color', darkPaper)

  await chooseTheme(page, 'Sistema')
  await expect(html).not.toHaveAttribute('data-theme')
  await expect(body).toHaveCSS('background-color', lightPaper)
  await expect(html).toHaveCSS('color-scheme', 'light dark')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(body).toHaveCSS('background-color', darkPaper)

  await page.reload()
  await expect(html).not.toHaveAttribute('data-theme')
  await expect(body).toHaveCSS('background-color', darkPaper)
})

test('tema é aplicado antes de o aplicativo carregar', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/login')
  await page.evaluate(() => localStorage.setItem('theme', 'dark'))

  // Sem o JavaScript do aplicativo, só o script de index.html pode aplicar o tema.
  await page.route(/\.(js|tsx?)(\?.*)?$/, (route) => route.abort())
  await page.reload({ waitUntil: 'commit' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('body')).toHaveCSS('background-color', darkPaper)
})

test('avisos acompanham o tema escolhido', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await signIn(page, admin.email, admin.password)
  await chooseTheme(page, 'Claro')

  await page.getByRole('link', { name: 'Setores' }).click()
  await page.getByRole('button', { name: 'Novo setor' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo setor' })
  await drawer.getByLabel('Nome').fill(`Tema ${unique().id}`)
  await drawer.getByRole('button', { name: 'Cadastrar setor' }).click()

  await expect(page.getByText('Setor salvo')).toBeVisible()
  await expect(page.locator('[data-sonner-toaster]')).toHaveAttribute('data-sonner-theme', 'light')
})

test('menu de configurações funciona por teclado', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, admin.email, admin.password)
  const trigger = page.getByRole('button', { name: 'Configurações' })

  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitemradio', { name: 'Claro' })).toBeFocused()

  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitemradio', { name: 'Escuro' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('menuitemradio', { name: 'Escuro' })).toBeChecked()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toBeHidden()
  await expect(trigger).toBeFocused()

  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('End')
  await expect(page.getByRole('menuitem', { name: 'Sair' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/login$/)
})

test('menu de configurações funciona na gaveta do celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 })
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, admin.email, admin.password)

  await page.getByRole('button', { name: 'Abrir menu' }).click()
  await chooseTheme(page, 'Escuro')
  await expect(page.locator('body')).toHaveCSS('background-color', darkPaper)

  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

// Camada de cinza do projeto (index.css): fundo da página, cartão e cabeçalho de tabela se distinguem.
// O alto contraste fica como estava: página e cartão brancos (ou pretos) e cabeçalho sem fundo.
const transparent = 'rgba(0, 0, 0, 0)'
const grayLayers = [
  {
    mode: 'claro',
    theme: 'light',
    contrast: '',
    paper: 'rgb(228, 228, 231)',
    card: 'rgb(255, 255, 255)',
    head: 'rgb(244, 244, 245)',
  },
  {
    mode: 'escuro',
    theme: 'dark',
    contrast: '',
    paper: 'rgb(9, 9, 11)',
    card: 'rgb(24, 24, 27)',
    head: 'rgb(39, 39, 42)',
  },
  {
    mode: 'alto contraste claro',
    theme: 'light',
    contrast: 'high',
    paper: 'rgb(255, 255, 255)',
    card: 'rgb(255, 255, 255)',
    head: transparent,
  },
  {
    mode: 'alto contraste escuro',
    theme: 'dark',
    contrast: 'high',
    paper: 'rgb(0, 0, 0)',
    card: 'rgb(11, 11, 11)',
    head: transparent,
  },
] as const

for (const layer of grayLayers) {
  test(`fundo, cartão e cabeçalho de tabela no tema ${layer.mode}`, async ({ page, baseURL }) => {
    await seedSector(baseURL!)
    await page.addInitScript(
      ({ theme, contrast }) => {
        localStorage.setItem('theme', theme)
        if (contrast) {
          localStorage.setItem('contrast', contrast)
        }
      },
      { theme: layer.theme, contrast: layer.contrast },
    )
    await signIn(page, admin.email, admin.password)

    // Dashboard e Atendimentos: fundo da página e cartão.
    for (const screen of ['/dashboard', '/atendimentos']) {
      await page.goto(screen)
      await expect(page.locator('[data-slot="card"]').first()).toBeVisible()
      await expect(page.locator('body')).toHaveCSS('background-color', layer.paper)
      await expect(page.locator('[data-slot="card"]').first()).toHaveCSS(
        'background-color',
        layer.card,
      )
    }

    // Uma tela com tabela sempre preenchida (o setor acima), para o cabeçalho.
    await page.goto('/admin/setores')
    await expect(page.locator('[data-slot="table-header"]').first()).toBeVisible()
    await expect(page.locator('[data-slot="table-header"]').first()).toHaveCSS(
      'background-color',
      layer.head,
    )
  })
}
