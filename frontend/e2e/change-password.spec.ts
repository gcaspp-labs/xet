import { expect, test, type Page } from '@playwright/test'
import {
  admin,
  clearSession,
  login,
  recordToasts,
  seedSector,
  signIn,
  userPassword,
} from './fixtures'

// Troca da própria senha pelo menu Configurações (access.md, regra 2).

async function openChangePassword(page: Page) {
  await page.getByRole('button', { name: 'Configurações' }).click()
  const items = page.getByRole('menuitem')
  // O item fica logo antes de "Sair".
  await expect(items.last()).toHaveText('Sair')
  await expect(items.nth((await items.count()) - 2)).toHaveText('Alterar senha')
  await page.getByRole('menuitem', { name: 'Alterar senha' }).click()
  const dialog = page.getByRole('dialog', { name: 'Alterar senha' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText(
    'Ao alterar, as suas outras sessões abertas são encerradas. Esta continua conectada.',
  )
  return dialog
}

test('administrador e supervisor abrem "Alterar senha" em Configurações', async ({
  page,
  baseURL,
}) => {
  const { supervisor } = await seedSector(baseURL!)
  for (const [email, password] of [
    [admin.email, admin.password],
    [supervisor, userPassword],
  ]) {
    await login(page, email, password)
    await expect(page).not.toHaveURL(/\/login$/)
    const dialog = await openChangePassword(page)
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toBeHidden()
    await clearSession(page)
  }
})

test('o atendente troca a própria senha e continua conectado', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  const calls: string[] = []
  page.on('request', (request) => {
    if (request.url().endsWith('/api/auth/me/password')) calls.push(request.method())
  })
  const toasts = await recordToasts(page)
  await signIn(page, agent, userPassword)

  const dialog = await openChangePassword(page)
  const current = dialog.getByLabel('Senha atual')
  const next = dialog.getByLabel('Nova senha', { exact: true })
  const confirm = dialog.getByLabel('Confirmar nova senha')
  const submit = dialog.getByRole('button', { name: 'Alterar senha' })
  await expect(dialog).toContainText('No mínimo 8 caracteres')

  // Senha atual vazia e confirmação diferente: erros do formulário, sem chamar a API.
  await next.fill('Nova#Senha26')
  await confirm.fill('Nova#Senha62')
  await submit.click()
  await expect(dialog).toContainText('Informe a senha atual.')
  await expect(dialog).toContainText('A confirmação está diferente da nova senha.')
  expect(calls).toEqual([])

  // Senha atual errada: o erro fica no campo e a sessão continua.
  await current.fill('Errada#Azul47')
  await confirm.fill('Nova#Senha26')
  await submit.click()
  await expect(dialog).toContainText('Senha atual incorreta.')
  await expect(current).toHaveAttribute('aria-invalid', 'true')
  await expect(page).not.toHaveURL(/\/login$/)
  expect(calls).toEqual(['PUT'])

  // Nova igual à atual: o erro fica em "Nova senha", no lugar da dica.
  await current.fill(userPassword)
  await next.fill(userPassword)
  await confirm.fill(userPassword)
  await submit.click()
  await expect(dialog).toContainText('A nova senha precisa ser diferente da atual.')
  await expect(next).toHaveAttribute('aria-invalid', 'true')
  await expect(dialog).not.toContainText('No mínimo 8 caracteres')

  await next.fill('Nova#Senha26')
  await confirm.fill('Nova#Senha26')
  await submit.click()
  await expect(dialog).toBeHidden()
  await expect.poll(toasts).toContain('Senha alterada')

  // A sessão continua: recarregar mantém o usuário em Chamados.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible()

  // A senha antiga não entra mais; a nova, sim.
  await clearSession(page)
  await login(page, agent, userPassword)
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await login(page, agent, 'Nova#Senha26')
  await expect(page).not.toHaveURL(/\/login$/)
})
