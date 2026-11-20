import { randomUUID } from 'node:crypto'
import {
  expect,
  type APIRequestContext,
  type Page,
  request as apiRequest,
  test,
} from '@playwright/test'
import {
  admin,
  json,
  ok,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

type Ticket = { id: number }
type SentMessage = { id: number }

async function apiAs(baseURL: string, email: string) {
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email, password: userPassword } }))
  return api
}

// O adaptador falso do WhatsApp: pareamento, mensagem recebida e alterações feitas fora do XET.
async function phone(request: APIRequestContext, sectorId: number, action: string, data?: object) {
  ok(await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, { data }))
}

const requestId = () => randomUUID()

// Um atendimento encerrado com uma mensagem do XET editada e excluída só no XET e uma mensagem do
// cliente editada e depois excluída por ele: as versões e o conteúdo preservado ficam consultáveis
// em Atendimentos, só para leitura.
async function seedClosedChanges(baseURL: string, request: APIRequestContext) {
  const { sector, agent } = await seedSector(baseURL)
  const { id, phone: number } = unique()
  const contactName = `Nina ${id}`
  const [organization] = await seedDirectory(
    baseURL,
    [{ name: `Prefeitura ${id}` }],
    [{ name: contactName, phone: number, organization: 0, sector: sector.id }],
  )

  const admins = await apiRequest.newContext({ baseURL })
  ok(
    await admins.post('/api/auth/login', {
      data: { email: admin.email, password: admin.password },
    }),
  )
  ok(await admins.post(`/api/sectors/${sector.id}/connection`))
  const module = await json<{ id: number }>(
    await admins.post(`/api/sectors/${sector.id}/modules`, { data: { name: `Boleto ${id}` } }),
  )
  await admins.dispose()

  await phone(request, sector.id, 'pair')
  const externalMessageId = `E2E-294-${id}`
  await phone(request, sector.id, 'receive', {
    externalMessageId,
    phone: number,
    contactName,
    body: 'Preciso do boleto de setembro',
  })

  const api = await apiAs(baseURL, agent)
  const [ticket] = await json<Ticket[]>(await api.get(`/api/sectors/${sector.id}/tickets`))
  ok(await api.post(`/api/tickets/${ticket.id}/assign`))
  const sent = await json<SentMessage>(
    await api.post(`/api/tickets/${ticket.id}/messages`, {
      data: { clientRequestId: requestId(), body: 'Segue o boleto de setembro' },
    }),
  )
  // Duas versões do XET, a última excluída só para o setor (o conteúdo continua preservado).
  ok(
    await api.post(`/api/messages/${sent.id}/edit`, {
      data: { clientRequestId: requestId(), body: 'Segue o boleto de outubro' },
    }),
  )
  ok(
    await api.post(`/api/messages/${sent.id}/delete`, {
      data: { clientRequestId: requestId(), scope: 'local' },
    }),
  )

  // O cliente edita e exclui a mensagem dele, fora do XET.
  await phone(request, sector.id, 'edit', {
    targetExternalMessageId: externalMessageId,
    phone: number,
    body: 'Preciso do boleto de outubro',
  })
  await phone(request, sector.id, 'revoke', {
    targetExternalMessageId: externalMessageId,
    phone: number,
  })

  ok(
    await api.post(`/api/tickets/${ticket.id}/close`, {
      data: {
        subject: 'Boleto',
        resolution: 'Boleto enviado.',
        moduleIds: [module.id],
        organizationId: organization.id,
      },
    }),
  )
  await api.dispose()
  return { ticketId: ticket.id, agent, sector, contactName }
}

// A janela só de leitura das versões e da exclusão de uma mensagem.
const changesDialog = (page: Page) =>
  page.getByRole('dialog', { name: 'Versões e exclusão da mensagem' })

// Nada de alterar, restaurar ou reenviar em Atendimentos: conta o que a tela tentar chamar.
function countChangeRequests(page: Page) {
  const calls: string[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST' && /\/api\/messages\/\d+\/(edit|delete|retry)$/.test(req.url())) {
      calls.push(req.url())
    }
  })
  return calls
}

test('o atendimento encerrado mostra versões e exclusões só para leitura, por teclado e em todos os temas', async ({
  page,
  request,
  baseURL,
}) => {
  const { ticketId, agent } = await seedClosedChanges(baseURL!, request)
  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)

  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toBeVisible()
  await expect(conversation).toContainText('Só leitura.')

  // O conteúdo preservado das duas mensagens continua à vista, com as etiquetas de sempre.
  const sent = conversation.getByRole('listitem', { name: 'Mensagem enviada' })
  await expect(sent).toContainText('Segue o boleto de outubro')
  await expect(sent).toContainText('Editada')
  await expect(sent).toContainText('Excluída')
  const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toContainText('Preciso do boleto de outubro')
  await expect(received).toContainText('Editada')
  await expect(received).toContainText('Excluída')

  // Somente leitura: sem campo de mensagem, sem menu, sem reenviar, sem responder.
  await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ações da mensagem' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reenviar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Responder' })).toHaveCount(0)
  const calls = countChangeRequests(page)

  // As versões da mensagem do XET: original, edição e a exclusão só no XET, com o alcance dito.
  const sentTrigger = sent.getByRole('button', { name: 'Ver versões e exclusão' })
  const receivedTrigger = received.getByRole('button', { name: 'Ver versões e exclusão' })
  await expect(sentTrigger).toBeVisible()
  await expect(receivedTrigger).toBeVisible()
  const first = sentTrigger
  await first.focus()
  await expect(first).toBeFocused()
  await page.keyboard.press('Enter')
  let dialog = changesDialog(page)
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Somente leitura.')
  await expect(dialog.getByTestId('message-version')).toHaveCount(2)
  await expect(dialog.getByTestId('message-version').first()).toContainText('Original')
  await expect(dialog.getByTestId('message-version').first()).toContainText(
    'Segue o boleto de setembro',
  )
  await expect(dialog.getByTestId('message-version').last()).toContainText('Editada')
  await expect(dialog.getByTestId('message-version').last()).toContainText('Atual')
  await expect(dialog.getByTestId('message-version').last()).toContainText('pelo XET')
  await expect(dialog.getByTestId('message-deletion')).toContainText('Excluída')
  await expect(dialog.getByTestId('message-deletion')).toContainText('Para mim (oculta no XET)')
  await expect(
    dialog.getByRole('button', { name: /Editar|Excluir|Reenviar|Restaurar/ }),
  ).toHaveCount(0)

  // O foco entra na janela, e Esc a fecha devolvendo-o ao botão.
  await page.keyboard.press('Tab')
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(first).toBeFocused()

  // A mensagem do cliente: a alteração e a exclusão externas, com o autor e o alcance registrados.
  await receivedTrigger.click()
  dialog = changesDialog(page)
  await expect(dialog.getByTestId('message-version')).toHaveCount(2)
  await expect(dialog.getByTestId('message-version').first()).toContainText(
    'Preciso do boleto de setembro',
  )
  await expect(dialog.getByTestId('message-version').last()).toContainText(
    'Preciso do boleto de outubro',
  )
  await expect(dialog.getByTestId('message-version').last()).toContainText('pelo cliente')
  await expect(dialog.getByTestId('message-deletion')).toContainText(
    'Para todos (também no WhatsApp)',
  )
  await expect(dialog.getByTestId('message-deletion')).toContainText('pelo cliente')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  // Depois de recarregar, o mesmo conteúdo e as mesmas etiquetas.
  await page.reload()
  await expect(sent).toContainText('Segue o boleto de outubro')
  await expect(received).toContainText('Preciso do boleto de outubro')
  await sent.getByRole('button', { name: 'Ver versões e exclusão' }).click()
  await expect(changesDialog(page).getByTestId('message-version')).toHaveCount(2)
  await page.keyboard.press('Escape')

  // Nenhuma alteração, restauração ou reenvio chamou a API.
  expect(calls).toEqual([])

  // Claro, escuro e alto contraste (claro e escuro): a janela abre e mostra o mesmo.
  for (const { theme, contrast } of [
    { theme: 'light', contrast: '' },
    { theme: 'dark', contrast: '' },
    { theme: 'light', contrast: 'high' },
    { theme: 'dark', contrast: 'high' },
  ]) {
    await page.evaluate(
      ({ theme, contrast }) => {
        localStorage.setItem('theme', theme)
        if (contrast) localStorage.setItem('contrast', contrast)
        else localStorage.removeItem('contrast')
      },
      { theme, contrast },
    )
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    if (contrast) {
      await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
    } else {
      await expect(page.locator('html')).not.toHaveAttribute('data-contrast')
    }
    await sent.getByRole('button', { name: 'Ver versões e exclusão' }).click()
    const layer = changesDialog(page)
    await expect(layer).toBeVisible()
    await expect(layer.getByTestId('message-deletion')).toContainText('Excluída')
    await page.keyboard.press('Escape')
    await expect(layer).toHaveCount(0)
  }
})

test('quem não é do setor do atendimento não lê as versões nem o conteúdo preservado', async ({
  page,
  request,
  baseURL,
}) => {
  const { ticketId } = await seedClosedChanges(baseURL!, request)
  const other = await seedSector(baseURL!)
  await signIn(page, other.agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  // Sem acesso ao setor, a ficha não abre: o aviso de sempre, sem conversa nem versões.
  await expect(page.getByRole('alert')).toContainText('Você não tem acesso a este setor.')
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toHaveCount(0)
  await expect(page.getByText('Segue o boleto de outubro')).toHaveCount(0)
  await expect(page.getByText('Preciso do boleto de setembro')).toHaveCount(0)
})
