import { expect, request as apiRequest, test } from '@playwright/test'
import { format } from 'date-fns'
import { admin, seedSector, signIn, unique, userPassword } from './fixtures'

// Liga o número do setor pelo adaptador falso e cadastra um órgão e os módulos do setor.
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
  const organization = `Prefeitura ${id}`
  expect((await api.post('/api/organizations', { data: { name: organization } })).ok()).toBeTruthy()
  for (const name of ['Folha', 'Patrimônio']) {
    expect(
      (await api.post(`/api/sectors/${sectorId}/modules`, { data: { name } })).ok(),
    ).toBeTruthy()
  }
  await api.dispose()
  return { organization }
}

test('encerramento exige o formulário completo e o cadastro do contato', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { organization } = await prepare(baseURL!, sector.id)
  const { phone } = unique()
  const receive = (body: string) =>
    request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: 'Paulo Cliente', body },
    })
  expect((await receive('Preciso do contracheque')).ok()).toBeTruthy()

  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Paulo Cliente' }).click()
  await page.getByRole('button', { name: 'Assumir' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  // Número desconhecido: o formulário pede o cadastro e não encerra com campos vazios.
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await expect(sheet).toContainText('Contato não cadastrado')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(sheet).toContainText('Informe o assunto.')
  await expect(sheet).toContainText('Informe a resolução.')
  await expect(sheet).toContainText('Selecione ao menos um módulo.')
  await expect(sheet).toContainText('Selecione o órgão do atendimento.')

  // Preenchido, mas com o contato ainda sem cadastro, o backend recusa.
  await sheet.getByLabel('Assunto').fill('Contracheque')
  await sheet.getByLabel('Resolução').fill('Enviada a segunda via.')
  await sheet.getByRole('checkbox', { name: 'Folha' }).click()
  await sheet.getByRole('checkbox', { name: 'Patrimônio' }).click()
  await sheet.getByLabel('Órgão').fill(organization)
  await page.getByRole('option', { name: organization }).click()
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(sheet).toContainText('Cadastre o contato e vincule-o a um órgão antes de encerrar.')

  // Cadastra o contato pelo próprio formulário e encerra.
  await sheet.getByRole('button', { name: 'Cadastrar contato' }).click()
  const contactSheet = page.getByRole('dialog', { name: 'Editar contato' })
  await contactSheet.getByLabel('Órgão').fill(organization)
  await page.getByRole('option', { name: organization }).click()
  await contactSheet.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByText('Contato salvo')).toBeVisible()
  await expect(sheet).not.toContainText('Contato não cadastrado')
  // O cadastro já dá ao chamado o órgão do contato.
  const ticketId = page.url().split('/').pop()
  const detail = await page.request.get(`/api/tickets/${ticketId}`)
  expect(((await detail.json()) as { organization: { name: string } }).organization.name).toBe(
    organization,
  )

  // O fim não pode ficar antes do início.
  await sheet.getByLabel('Fim').fill('2000-01-01T10:00')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(sheet).toContainText('O fim precisa ser depois do início.')
  // Corrige o início e o fim para horários passados.
  const local = (minutesAgo: number) =>
    format(new Date(Date.now() - minutesAgo * 60_000), "yyyy-MM-dd'T'HH:mm")
  await sheet.getByLabel('Início').fill(local(120))
  await sheet.getByLabel('Fim').fill(local(60))
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()

  // O registro aparece nos detalhes e ninguém mais responde.
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText('Chamado encerrado.')
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  await expect(
    conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
      hasText: `${agentName} encerrou o chamado`,
    }),
  ).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Encerrar' })).toHaveCount(0)
  const details = page.getByRole('region', { name: 'Chamado' })
  await expect(details).toContainText('Encerrado')
  await expect(details).toContainText('Contracheque')
  await expect(details).toContainText('Enviada a segunda via.')
  await expect(details).toContainText('Folha')
  await expect(details).toContainText('Patrimônio')
  await expect(details).toContainText(organization)

  // Nova mensagem do cliente abre outro chamado, na fila.
  expect((await receive('Agora é sobre férias')).ok()).toBeTruthy()
  await page.getByRole('link', { name: 'Atendimento' }).click()
  const queue = page.getByRole('region', { name: 'Fila do setor' })
  await expect(queue.getByRole('link', { name: 'Paulo Cliente' })).toHaveCount(1)
  await expect(queue).toContainText('Agora é sobre férias')
})
