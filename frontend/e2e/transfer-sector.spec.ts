import { expect, request as apiRequest, test } from '@playwright/test'
import { admin, seedDirectory, seedSector, signIn, unique, userPassword } from './fixtures'

// Liga os números dos setores pelo adaptador falso e cadastra os módulos da origem.
async function prepare(baseURL: string, origin: number, destination: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  for (const sectorId of [origin, destination]) {
    expect((await api.post(`/api/sectors/${sectorId}/connection`)).ok()).toBeTruthy()
    expect((await api.post(`/api/test/messaging/sectors/${sectorId}/pair`)).ok()).toBeTruthy()
  }
  expect(
    (await api.post(`/api/sectors/${origin}/modules`, { data: { name: 'Folha' } })).ok(),
  ).toBeTruthy()
  await api.dispose()
}

test('transferência entre setores encerra a origem e o destino continua com o histórico', async ({
  page,
  request,
  baseURL,
}) => {
  const origin = await seedSector(baseURL!)
  const destination = await seedSector(baseURL!)
  await prepare(baseURL!, origin.sector.id, destination.sector.id)
  const { id, phone } = unique()
  const contact = `Lúcia ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name: contact, phone, organization: 0, sector: origin.sector.id }],
  )
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${origin.sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${id}`,
          phone,
          contactName: contact,
          body: 'Folha de março',
        },
      })
    ).ok(),
  ).toBeTruthy()

  // Na origem, o responsável preenche o formulário completo e escolhe o destino.
  await signIn(page, origin.agent, userPassword)
  await page.getByRole('link', { name: contact }).click()
  await page.getByRole('button', { name: 'Assumir' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await page.getByRole('button', { name: 'Outro setor' }).click()
  const sheet = page.getByRole('dialog', { name: 'Transferir para outro setor' })
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(sheet).toContainText('Escolha o setor de destino.')
  await expect(sheet).toContainText('Informe o assunto.')
  await sheet.getByLabel('Assunto').fill('Folha de março')
  await sheet.getByLabel('Resolução').fill('Encaminhado ao setor responsável.')
  await sheet.getByRole('checkbox', { name: 'Folha' }).click()
  await sheet.getByLabel('Setor de destino').click()
  await page.getByRole('option', { name: destination.sector.name }).click()
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(page.getByText('Chamado transferido para outro setor')).toBeVisible()

  // Volta ao painel, com o atendimento identificado nos realizados.
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  const doneRow = page
    .getByRole('region', { name: 'Realizados hoje' })
    .getByRole('row', { name: new RegExp(contact) })
  await expect(doneRow).toContainText('Transferido')
  await expect(doneRow).toContainText('Você')

  // A origem fica encerrada e mostra para onde foi.
  await doneRow.getByRole('link', { name: contact }).click()
  const details = page.getByRole('region', { name: 'Chamado' })
  await expect(details).toContainText('Encerrado')
  await expect(details).toContainText('Transferido para')
  await expect(details).toContainText(destination.sector.name)
  const originName = origin.agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(
    conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
      hasText: `${originName} transferiu o chamado para o setor ${destination.sector.name}`,
    }),
  ).toBeVisible()
  await page.context().clearCookies()

  // O destino recebe o chamado na fila, com a origem e a conversa anterior.
  await signIn(page, destination.agent, userPassword)
  await page.getByRole('link', { name: contact }).click()
  await expect(conversation).toContainText(
    `Transferido de ${origin.sector.name}. Assuma o chamado e envie a primeira mensagem ao cliente.`,
  )
  const previous = details.getByRole('region', { name: 'Chamado anterior' })
  await expect(previous).toContainText(origin.sector.name)
  await expect(previous).toContainText('Folha de março')
  await expect(previous).toContainText('Encaminhado ao setor responsável.')
  await expect(previous).toContainText(`Transferido por ${originName}`)
  const destinationUrl = page.url()
  await previous.getByRole('link', { name: 'Ver conversa anterior' }).click()
  await expect(conversation).toContainText('Folha de março')
  await expect(page.getByRole('button', { name: 'Corrigir' })).toHaveCount(0)
  await details.getByRole('tab', { name: 'Notas' }).click()
  await expect(details.getByLabel('Nova nota')).toHaveCount(0)

  // Ao assumir, o destino escreve a primeira mensagem pelo próprio número.
  await page.goto(destinationUrl)
  await page.getByRole('button', { name: 'Assumir' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Olá, aqui é o setor de destino.')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  await expect(
    conversation
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .filter({ hasText: 'Olá, aqui é o setor de destino.' }),
  ).toContainText('Enviada')
})
