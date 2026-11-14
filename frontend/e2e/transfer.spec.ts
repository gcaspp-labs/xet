import { expect, request as apiRequest, test } from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword } from './fixtures'

// Liga o número do setor pelo adaptador falso e cria um segundo atendente.
async function prepare(baseURL: string, sectorId: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sectorId}/connection`)).ok()).toBeTruthy()
  expect((await api.post(`/api/test/messaging/sectors/${sectorId}/pair`)).ok()).toBeTruthy()
  const { id } = unique()
  const email = `colega.${id}@e2e.test`
  const created = await api.post('/api/users', {
    data: { name: `Colega ${id}`, email, role: 'agent', sectorId, password: userPassword },
  })
  expect(created.ok()).toBeTruthy()
  await api.dispose()
  return { email, name: `Colega ${id}` }
}

test('responsável transfere o chamado e só o novo responsável responde', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const colleague = await prepare(baseURL!, sector.id)
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  const { phone: number } = unique()
  const received = await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
    data: {
      externalMessageId: `E2E-${unique().id}`,
      phone: number,
      contactName: 'Joana Cliente',
      body: 'Preciso da segunda via da guia',
    },
  })
  expect(received.ok()).toBeTruthy()

  // O atendente assume e transfere para o colega.
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Joana Cliente' }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText(`${agentName} assumiu o chamado`)

  // O colega acompanha em outra janela, sem poder responder nem transferir.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, colleague.email, userPassword)
  await other.goto(page.url())
  const otherConversation = other.getByRole('region', { name: 'Conversa', exact: true })
  await expect(otherConversation).toContainText(`Chamado com ${agentName}. Peça a transferência`)
  await expect(other.getByRole('button', { name: 'Transferir' })).toHaveCount(0)

  const ticketUrl = page.url()
  await page.getByRole('button', { name: 'Transferir' }).click()
  const sheet = page.getByRole('dialog', { name: 'Transferir chamado' })
  // O próprio responsável e administradores não aparecem como destino.
  await sheet.getByRole('combobox', { name: 'Transferir para' }).click()
  await expect(page.getByRole('option')).toHaveCount(2)
  await page.getByRole('option', { name: new RegExp(`^${colleague.name} · Atendente`) }).click()
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(page.getByText('Chamado transferido')).toBeVisible()

  // A transferência volta a Chamados sem chamado aberto.
  await expect(page).toHaveURL(/\/conversas$/)
  await expect(conversation).toHaveCount(0)
  await page.goto(ticketUrl)

  // O anterior perde a resposta; o histórico mostra a transferência.
  await expect(conversation).toContainText(`Chamado com ${colleague.name}. Peça a transferência`)
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Transferir' })).toHaveCount(0)
  const transferText = `${agentName} transferiu o chamado para ${colleague.name}`
  await expect(
    conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
      hasText: transferText,
    }),
  ).toBeVisible()
  await expect(conversation).toContainText('Preciso da segunda via da guia')

  // O novo responsável passa a responder sem recarregar a tela.
  await expect(otherConversation).toContainText(transferText)
  await other.getByRole('textbox', { name: 'Mensagem' }).fill('Assumi o seu atendimento.')
  await other.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  await expect(
    otherConversation
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .filter({ hasText: 'Assumi o seu atendimento.' }),
  ).toContainText('Enviada')
  await expect(conversation).toContainText('Assumi o seu atendimento.')

  // O supervisor transfere o chamado de outro atendente.
  const supContext = await browser.newContext()
  const sup = await supContext.newPage()
  await signIn(sup, supervisor, userPassword)
  await sup.goto(page.url())
  await sup.getByRole('button', { name: 'Transferir' }).click()
  const supSheet = sup.getByRole('dialog', { name: 'Transferir chamado' })
  await supSheet.getByRole('combobox', { name: 'Transferir para' }).click()
  await sup.getByRole('option', { name: new RegExp(`^${agentName} · Atendente`) }).click()
  await supSheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(sup.getByText('Chamado transferido')).toBeVisible()
  const supName = supervisor.replace(/^supervisor\.(\d+)@.*$/, 'supervisor $1')
  await expect(conversation).toContainText(
    `${supName} transferiu o chamado de ${colleague.name} para ${agentName}`,
  )
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)

  await otherContext.close()
  await supContext.close()
})
