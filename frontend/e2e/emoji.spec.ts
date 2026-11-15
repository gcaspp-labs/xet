import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import { admin, openQueued, seedSector, signIn, unique, userPassword } from './fixtures'

async function openEmojiChat(
  page: Page,
  request: APIRequestContext,
  baseURL: string,
  contactName: string,
) {
  const { sector, agent } = await seedSector(baseURL)
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  await api.dispose()
  expect((await request.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${unique().id}`,
          phone: unique().phone,
          contactName,
          body: 'Olá 😊',
        },
      })
    ).ok(),
  ).toBeTruthy()
  await signIn(page, agent, userPassword)
  await openQueued(page, contactName)
  await expect(page.getByRole('button', { name: 'Inserir emoji' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  return page.getByRole('textbox', { name: 'Mensagem' })
}

test('responsável busca e insere emoji na mensagem pelo teclado', async ({
  page,
  request,
  baseURL,
}) => {
  const message = await openEmojiChat(page, request, baseURL!, 'Cliente Emoji')
  await message.fill('Olá mundo')
  await message.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 9))
  const externalRequests: string[] = []
  page.on('request', (req) => {
    if (!req.url().startsWith(baseURL!)) externalRequests.push(req.url())
  })
  await page.getByRole('button', { name: 'Inserir emoji' }).click()
  const search = page.getByRole('searchbox', { name: 'Buscar emoji' })
  await expect(search).toBeFocused()
  await search.fill('emoji inexistente xyz')
  await expect(page.getByText('Nenhum emoji encontrado.')).toBeVisible()
  await search.fill('coração')
  await search.press('ArrowDown')
  await expect(page.getByLabel('Emojis').getByRole('button').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(message).toBeFocused()
  await page.getByRole('button', { name: 'Inserir emoji' }).click()
  await search.fill('coração vermelho')
  await search.press('Enter')
  await expect(message).toHaveValue('Olá ❤️')
  await expect(message).toBeFocused()
  await message.press('Enter')
  const sent = page
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Olá ❤️' })
  await expect(sent).toContainText(/agent \d+/)
  await page.reload()
  await expect(sent).toContainText('Olá ❤️')
  await expect(page.getByRole('listitem', { name: 'Mensagem recebida' })).toContainText('Olá 😊')
  expect(externalRequests).toEqual([])
})

test('emoji entra no meio do texto, sem apagar o que vem depois', async ({
  page,
  request,
  baseURL,
}) => {
  const message = await openEmojiChat(page, request, baseURL!, 'Cliente Meio')
  const search = page.getByRole('searchbox', { name: 'Buscar emoji' })
  const caret = () =>
    message.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd])

  // cursor interno: "Olá |mundo" -> "Olá ❤️mundo"
  await message.fill('Olá mundo')
  await message.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 4))
  await page.getByRole('button', { name: 'Inserir emoji' }).click()
  await search.fill('coração vermelho')
  await search.press('Enter')
  await expect(message).toHaveValue('Olá ❤️mundo')
  await expect(message).toBeFocused()
  expect(await caret()).toEqual([6, 6])

  // seleção interna: "Olá [velho ]mundo" -> "Olá ❤️mundo"
  await message.fill('Olá velho mundo')
  await message.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(4, 10))
  await page.getByRole('button', { name: 'Inserir emoji' }).click()
  await search.fill('coração vermelho')
  await search.press('Enter')
  await expect(message).toHaveValue('Olá ❤️mundo')
  await expect(message).toBeFocused()
  expect(await caret()).toEqual([6, 6])
})

test('seletor de emoji funciona por inteiro pelo teclado', async ({ page, request, baseURL }) => {
  const message = await openEmojiChat(page, request, baseURL!, 'Cliente Teclado')
  const search = page.getByRole('searchbox', { name: 'Buscar emoji' })
  const emojis = page.getByLabel('Emojis').getByRole('button')
  const faces = page.getByRole('tab', { name: 'Rostos e emoções' })
  const people = page.getByRole('tab', { name: 'Pessoas e corpo' })

  // abre pelo teclado, a partir do campo: Shift+Tab chega ao botão
  await message.fill('Oi ')
  await message.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Inserir emoji' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(search).toBeFocused()

  // setas na busca editam o termo: não levam o foco à grade
  await search.fill('abc')
  await search.press('ArrowLeft')
  await expect(search).toBeFocused()
  expect(await search.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(2)
  await search.fill('')

  // Tab leva às categorias; setas trocam de aba sem entrar na grade
  await page.keyboard.press('Tab')
  await expect(faces).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(people).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(people).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(faces).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(people).toBeFocused()

  // seta para baixo entra na grade; setas navegam entre emojis
  await page.keyboard.press('ArrowDown')
  await expect(emojis.nth(0)).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(emojis.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(emojis.nth(9)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(emojis.nth(1)).toBeFocused()
  const chosen = (await emojis.nth(1).textContent())!.trim()

  // Enter escolhe: o emoji entra, o balão fecha e o foco volta ao campo
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Emojis')).toHaveCount(0)
  await expect(message).toHaveValue(`Oi ${chosen}`)
  await expect(message).toBeFocused()

  // Esc, vindo das categorias, fecha e devolve o foco ao campo
  await page.getByRole('button', { name: 'Inserir emoji' }).click()
  await page.keyboard.press('Tab')
  await expect(people).toBeFocused() // a categoria escolhida antes continua selecionada
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Emojis')).toHaveCount(0)
  await expect(message).toBeFocused()
})
