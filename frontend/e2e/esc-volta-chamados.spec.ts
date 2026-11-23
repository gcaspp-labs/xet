import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import {
  admin,
  openQueued,
  seedClosedTicket,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

// Esc na tela Chamados: com um chamado aberto e nada por cima, volta para /chamados sem chamado
// aberto. Com algo aberto por cima, fecha só aquilo (ou nada, nas janelas com bloqueio) e o
// chamado continua aberto. O texto digitado fica guardado no rascunho do chamado.

// PNG de 1×1 pixel, para a pré-visualização da imagem carregar de verdade.
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

// Setor com o número ligado e um chamado na fila, aberto em Chamados e já assumido pelo atendente.
// Com `image`, o cliente também manda uma imagem, que abre no visualizador.
async function openTicket(
  page: Page,
  request: APIRequestContext,
  baseURL: string,
  contactName: string,
  options: { image?: boolean } = {},
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
  const { phone: number, id } = unique()
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${id}`,
          phone: number,
          contactName,
          body: 'Olá, preciso de ajuda',
        },
      })
    ).ok(),
  ).toBeTruthy()
  if (options.image) {
    expect(
      (
        await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
          data: {
            externalMessageId: `E2E-IMG-${id}`,
            phone: number,
            contactName,
            type: 'image',
            body: 'Foto do recibo',
            media: { data: png, mimeType: 'image/png' },
          },
        })
      ).ok(),
    ).toBeTruthy()
  }
  await signIn(page, agent, userPassword)
  await openQueued(page, contactName)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  return page.getByRole('textbox', { name: 'Mensagem' })
}

test('com o chamado aberto e nada por cima, Esc volta para Chamados e o texto digitado fica guardado', async ({
  page,
  request,
  baseURL,
}) => {
  const message = await openTicket(page, request, baseURL!, 'Cliente Esc')
  const ticketUrl = page.url()
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toBeVisible()

  await message.fill('Texto que não pode se perder')
  await message.press('Escape')

  // Sem chamado aberto: a conversa sai da tela e o endereço é o de Chamados.
  await expect(page).toHaveURL(/\/chamados$/)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toHaveCount(0)

  // Ao reabrir o mesmo chamado, o rascunho está lá.
  await page.goto(ticketUrl)
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveValue(
    'Texto que não pode se perder',
  )
})

test('Esc com o seletor de emojis aberto fecha só o seletor e o chamado continua aberto', async ({
  page,
  request,
  baseURL,
}) => {
  await openTicket(page, request, baseURL!, 'Cliente Emoji Esc')
  const ticketUrl = page.url()

  await page.getByRole('button', { name: 'Inserir emoji' }).click()
  await expect(page.getByLabel('Emojis', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Emojis', { exact: true })).toHaveCount(0)
  await expect(page).toHaveURL(ticketUrl)

  // Sem nada por cima, o Esc seguinte volta.
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/chamados$/)
})

test('Esc com o visualizador de imagem aberto fecha só o visualizador e o chamado continua aberto', async ({
  page,
  request,
  baseURL,
}) => {
  await openTicket(page, request, baseURL!, 'Cliente Imagem Esc', { image: true })
  const ticketUrl = page.url()

  await page.getByRole('button', { name: 'Ampliar imagem' }).click()
  const viewer = page.getByRole('dialog', { name: 'Imagem ampliada' })
  await expect(viewer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(viewer).toHaveCount(0)
  await expect(page).toHaveURL(ticketUrl)

  // Sem nada por cima, o Esc seguinte volta.
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/chamados$/)
})

test('Esc durante a edição de uma mensagem cancela a edição e não sai do chamado', async ({
  page,
  request,
  baseURL,
}) => {
  const message = await openTicket(page, request, baseURL!, 'Cliente Edição Esc')
  const ticketUrl = page.url()

  // Envia uma mensagem para editar.
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await message.fill('Preciso corrigir esta mensagem')
  await message.press('Enter')
  const bubble = conversation.getByRole('listitem', { name: 'Mensagem enviada' }).last()
  await expect(bubble).toContainText('Preciso corrigir esta mensagem')

  // Abre a edição no lugar do compositor e muda o texto.
  await bubble.hover()
  await bubble.getByRole('button', { name: 'Ações da mensagem' }).click()
  await page.getByRole('menuitem', { name: 'Editar', exact: true }).click()
  const editor = page.getByRole('textbox', { name: 'Editar mensagem' })
  await expect(editor).toBeVisible()
  await editor.fill('Texto novo que vai ser descartado')

  // O Esc cancela a edição: a faixa some, a mensagem continua como foi enviada e o chamado segue aberto.
  await editor.press('Escape')
  await expect(page.getByRole('group', { name: 'Editando mensagem' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toBeVisible()
  await expect(bubble).toContainText('Preciso corrigir esta mensagem')
  await expect(bubble).not.toContainText('Texto novo que vai ser descartado')
  await expect(page).toHaveURL(ticketUrl)
})

test('Esc com o menu da mensagem aberto fecha só o menu e o chamado continua aberto', async ({
  page,
  request,
  baseURL,
}) => {
  const message = await openTicket(page, request, baseURL!, 'Cliente Menu Esc')
  const ticketUrl = page.url()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })

  // Envia uma mensagem e abre o menu dela pelo mouse.
  await message.fill('Mensagem com menu')
  await message.press('Enter')
  const bubble = conversation.getByRole('listitem', { name: 'Mensagem enviada' }).last()
  await expect(bubble).toContainText('Mensagem com menu')
  await bubble.hover()
  await bubble.getByRole('button', { name: 'Ações da mensagem' }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Responder', exact: true })).toBeVisible()

  // O Esc fecha só o menu: o chamado continua aberto, com a conversa na tela.
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(page).toHaveURL(ticketUrl)
  await expect(conversation).toBeVisible()

  // Sem nada por cima, o Esc seguinte volta.
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/chamados$/)
})

test('Esc com uma janela com bloqueio aberta não fecha a janela nem volta para Chamados', async ({
  page,
  request,
  baseURL,
}) => {
  await openTicket(page, request, baseURL!, 'Cliente Janela Esc')
  const ticketUrl = page.url()

  await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeVisible()
  await expect(page).toHaveURL(ticketUrl)

  // Fechada a janela pelo Cancelar, o chamado continua aberto e o Esc volta.
  await drawer.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(drawer).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/chamados$/)
})

test('Esc em Atendimentos não navega', async ({ page, baseURL }) => {
  const { ticketId, agent } = await seedClosedTicket(baseURL!)
  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ticketId}$`))
})
