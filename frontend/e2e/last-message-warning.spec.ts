import { expect, request as apiRequest, test } from '@playwright/test'
import {
  admin,
  chooseAction,
  openQueued,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

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

  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  const sending = page.waitForRequest(
    (req) => req.url().endsWith('/messages') && req.method() === 'POST',
  )
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Nova resposta')
  await page.getByRole('button', { name: 'Enviar mensagem' }).click()
  const { clientRequestId } = (await sending).postDataJSON() as { clientRequestId: string }
  const sent = page
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Nova resposta' })
  await expect(sent).toContainText('Enviada')
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/status`, {
        data: { status: 'delivered', externalMessageIds: [`fake-msg-${clientRequestId}`] },
      })
    ).ok(),
  ).toBeTruthy()
  await expect(sent).toContainText('Entregue')
  await page.getByRole('button', { name: 'Encerrar' }).click()
  await expect(closing).not.toContainText('A última mensagem ao cliente')
  await api.dispose()
})
