import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
  request as apiRequest,
  test,
} from '@playwright/test'
import { format } from 'date-fns'
import {
  admin,
  chooseAction,
  seedDirectory,
  openQueued,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

const failedWarning =
  'A última mensagem ao cliente falhou. Cancele e use Reenviar na conversa para ele não ficar sem resposta.'
const sendingWarning =
  'A última mensagem ao cliente ainda está sendo enviada. Aguarde a entrega para ele não ficar sem resposta.'
const anyWarning = 'A última mensagem ao cliente'

// Chamado assumido por um atendente de um setor com um colega, um setor de destino e o contato
// já cadastrado: o encerramento só depende do formulário, sem o aviso de contato não cadastrado.
async function openAssigned(page: Page, request: APIRequestContext, baseURL: string) {
  const origin = await seedSector(baseURL)
  const destination = await seedSector(baseURL)
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  for (const { sector } of [origin, destination]) {
    expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
    expect((await request.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  }
  const { id, phone } = unique()
  const colleague = { email: `colega.${id}@e2e.test`, name: `Colega ${id}` }
  expect(
    (
      await api.post('/api/users', {
        data: {
          ...colleague,
          role: 'agent',
          sectorId: origin.sector.id,
          password: userPassword,
        },
      })
    ).ok(),
  ).toBeTruthy()
  expect(
    (await api.post(`/api/sectors/${origin.sector.id}/modules`, { data: { name: 'Folha' } })).ok(),
  ).toBeTruthy()
  await api.dispose()
  const contact = `Cliente ${id}`
  const organization = `Prefeitura ${id}`
  await seedDirectory(
    baseURL,
    [{ name: organization }],
    [{ name: contact, phone, organization: 0, sector: origin.sector.id }],
  )
  const control = (action: string, data?: object) =>
    request.post(`/api/test/messaging/sectors/${origin.sector.id}/${action}`, { data })
  expect(
    (
      await control('receive', {
        externalMessageId: `E2E-${unique().id}`,
        phone,
        contactName: contact,
        body: 'Olá',
      })
    ).ok(),
  ).toBeTruthy()
  await signIn(page, origin.agent, userPassword)
  await openQueued(page, contact)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  return { origin, destination, colleague, contact, organization, control }
}

// Responde ao cliente e devolve o identificador do envio, que o adaptador falso usa como id externo.
async function reply(page: Page, body: string) {
  const request = page.waitForRequest(
    (req) => req.url().endsWith('/messages') && req.method() === 'POST',
  )
  await page.getByRole('textbox', { name: 'Mensagem' }).fill(body)
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  return ((await request).postDataJSON() as { clientRequestId: string }).clientRequestId
}

const sentMessage = (page: Page, body: string) =>
  page.getByRole('listitem', { name: 'Mensagem enviada' }).filter({ hasText: body })

// Abre as três janelas e confere o aviso (ou a falta dele) em cada uma.
async function expectDialogs(page: Page, warning: string | null) {
  const check = async (dialog: Locator) => {
    if (warning) await expect(dialog).toContainText(warning)
    else await expect(dialog).not.toContainText(anyWarning)
  }
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const closing = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await check(closing)
  await closing.getByRole('button', { name: 'Cancelar', exact: true }).click()
  for (const [action, title] of [
    ['Transferir', 'Transferir chamado'],
    ['Outro setor', 'Transferir para outro setor'],
  ] as const) {
    await chooseAction(page, action)
    const dialog = page.getByRole('dialog', { name: title })
    await check(dialog)
    await dialog.getByRole('button', { name: /Cancelar|Fechar/ }).click()
    await expect(dialog).toHaveCount(0)
  }
}

test('avisa sobre a última mensagem de saída que falhou nas janelas', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  expect((await request.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  const { id, phone } = unique()
  const receive = (body: string) =>
    request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: `Cliente ${id}`, body },
    })
  expect((await receive('Olá')).ok()).toBeTruthy()
  await signIn(page, agent, userPassword)
  await openQueued(page, `Cliente ${id}`)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  expect((await request.post(`/api/test/messaging/sectors/${sector.id}/drop`)).ok()).toBeTruthy()
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Resposta')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(
    page.getByRole('listitem', { name: 'Mensagem enviada' }).filter({ hasText: 'Resposta' }),
  ).toContainText('Falhou')
  expect((await receive('Outra pergunta')).ok()).toBeTruthy()

  await page.getByRole('button', { name: 'Encerrar' }).click()
  const closing = page.getByRole('dialog', { name: 'Encerrar chamado' })
  const warning =
    'A última mensagem ao cliente falhou. Cancele e use Reenviar na conversa para ele não ficar sem resposta.'
  await expect(closing).toContainText(warning)
  await expect(closing.getByRole('alert').first()).toContainText(warning)
  await expect(closing).toContainText('Contato não cadastrado')
  await expect(closing.getByRole('button', { name: 'Encerrar' })).toBeEnabled()
  await closing.getByRole('button', { name: 'Cancelar', exact: true }).click()

  for (const [action, title] of [
    ['Transferir', 'Transferir chamado'],
    ['Outro setor', 'Transferir para outro setor'],
  ] as const) {
    await chooseAction(page, action)
    const dialog = page.getByRole('dialog', { name: title })
    await expect(dialog).toContainText(warning)
    await dialog.getByRole('button', { name: /Cancelar|Fechar/ }).click()
  }
  await chooseAction(page, 'Cancelar chamado')
  const cancel = page.getByRole('dialog', { name: 'Cancelar chamado' })
  await expect(cancel).not.toContainText(warning)
  await cancel.getByRole('button', { name: 'Voltar' }).click()

  await api.dispose()
})

test('enquanto envia, avisa nas três janelas; Enviada, Entregue e Lida não avisam', async ({
  page,
  request,
  baseURL,
}) => {
  const { control } = await openAssigned(page, request, baseURL!)
  // O adaptador segura o envio: a mensagem fica em Enviando até a liberação.
  expect((await control('hold')).ok()).toBeTruthy()
  const clientRequestId = await reply(page, 'Resposta lenta')
  await expect(sentMessage(page, 'Resposta lenta')).toContainText('Enviando')
  await expectDialogs(page, sendingWarning)

  expect((await control('release')).ok()).toBeTruthy()
  await expect(sentMessage(page, 'Resposta lenta')).toContainText('Enviada')
  await expectDialogs(page, null)

  for (const [status, label] of [
    ['delivered', 'Entregue'],
    ['read', 'Lida'],
  ] as const) {
    expect(
      (
        await control('status', {
          status,
          externalMessageIds: [`fake-msg-${clientRequestId}`],
        })
      ).ok(),
    ).toBeTruthy()
    await expect(sentMessage(page, 'Resposta lenta')).toContainText(label)
    await expectDialogs(page, null)
  }
})

// Última mensagem em Falhou: o aviso aparece e a ação conclui normalmente.
async function failLastMessage(
  page: Page,
  control: (action: string) => Promise<{ ok(): boolean }>,
) {
  expect((await control('drop')).ok()).toBeTruthy()
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Resposta que falha')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  await expect(sentMessage(page, 'Resposta que falha')).toContainText('Falhou')
}

test('com a última mensagem em Falhou, encerra o chamado', async ({ page, request, baseURL }) => {
  const { contact, organization, control } = await openAssigned(page, request, baseURL!)
  await failLastMessage(page, control)
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await expect(sheet.getByRole('alert').first()).toContainText(failedWarning)
  await expect(sheet).not.toContainText('Contato não cadastrado')
  await sheet.getByLabel('Assunto').fill('Contracheque')
  await sheet.getByLabel('Resolução').fill('Enviada a segunda via.')
  await sheet.getByRole('checkbox', { name: 'Folha' }).click()
  await sheet.getByLabel('Órgão').fill(organization)
  await page.getByRole('option', { name: organization }).click()
  const local = (minutesAgo: number) =>
    format(new Date(Date.now() - minutesAgo * 60_000), "yyyy-MM-dd'T'HH:mm")
  await sheet.getByLabel('Início').fill(local(120))
  await sheet.getByLabel('Fim').fill(local(60))
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/chamados$/)
  await page.goto('/atendimentos')
  const row = page.getByRole('row', { name: new RegExp(contact) })
  await expect(row).toContainText('Encerrado')
})

test('com a última mensagem em Falhou, transfere para o colega', async ({
  page,
  request,
  baseURL,
}) => {
  const { colleague, control } = await openAssigned(page, request, baseURL!)
  await failLastMessage(page, control)
  const ticketUrl = page.url()
  await chooseAction(page, 'Transferir')
  const sheet = page.getByRole('dialog', { name: 'Transferir chamado' })
  await expect(sheet.getByRole('alert').first()).toContainText(failedWarning)
  await sheet.getByRole('combobox', { name: 'Transferir para' }).click()
  await page.getByRole('option', { name: new RegExp(`^${colleague.name} · Atendente`) }).click()
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(page.getByText('Chamado transferido')).toBeVisible()
  await expect(page).toHaveURL(/\/chamados$/)
  await page.goto(ticketUrl)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    `Chamado com ${colleague.name}. Peça a transferência`,
  )
})

test('com a última mensagem em Falhou, transfere para outro setor', async ({
  page,
  request,
  baseURL,
}) => {
  const { destination, contact, control } = await openAssigned(page, request, baseURL!)
  await failLastMessage(page, control)
  await chooseAction(page, 'Outro setor')
  const sheet = page.getByRole('dialog', { name: 'Transferir para outro setor' })
  await expect(sheet.getByRole('alert').first()).toContainText(failedWarning)
  await sheet.getByLabel('Setor de destino').click()
  await page.getByRole('option', { name: destination.sector.name }).click()
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(page.getByText('Chamado transferido para outro setor')).toBeVisible()
  await expect(page).toHaveURL(/\/chamados$/)
  await page.goto('/atendimentos')
  const row = page.getByRole('row', { name: new RegExp(contact) })
  await expect(row).toContainText('Transferido')
  await expect(row).toContainText(`para ${destination.sector.name}`)
})
