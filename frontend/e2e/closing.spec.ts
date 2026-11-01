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
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const { organization } = await prepare(baseURL!, sector.id)
  const { phone } = unique()
  const receive = (body: string) =>
    request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: 'Paulo Cliente', body },
    })
  expect((await receive('Preciso do contracheque')).ok()).toBeTruthy()

  // O supervisor acompanha os realizados do setor em outra janela.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  const otherDone = other.getByRole('region', { name: 'Realizados hoje' })
  await expect(otherDone).toContainText('Nenhum atendimento realizado hoje.')

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

  // Volta ao painel, com o atendimento nos realizados, marcado como próprio.
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  const done = page.getByRole('region', { name: 'Realizados hoje' })
  const doneRow = done.getByRole('row', { name: /Paulo Cliente/ })
  await expect(doneRow).toContainText('Você')
  await expect(doneRow).toContainText('Encerrado')

  // Quem já estava no painel vê o atendimento sem recarregar, com o nome do atendente.
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  const otherRow = otherDone.getByRole('row', { name: /Paulo Cliente/ })
  await expect(otherRow).toContainText(agentName)
  await expect(otherRow).not.toContainText('Você')
  await otherContext.close()

  // A linha reabre o chamado: o registro aparece nos detalhes e ninguém mais responde.
  await doneRow.getByRole('cell', { name: 'Encerrado' }).click({ force: true })
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText('Chamado encerrado.')
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

test('cancelamento pede o motivo, dispensa o cadastro e fica identificado', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await prepare(baseURL!, sector.id)
  const { phone } = unique()
  const receive = (body: string) =>
    request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: 'Paula Golpe', body },
    })
  expect((await receive('Seu boleto venceu')).ok()).toBeTruthy()

  // Na fila, o atendente cancela sem assumir e sem cadastrar o contato.
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Paula Golpe' }).click()
  await page.getByRole('button', { name: 'Cancelar chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Cancelar chamado' })
  await sheet.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(sheet).toContainText('Informe o motivo do cancelamento.')
  await sheet.getByLabel('Motivo').fill('Golpe do falso boleto.')
  await sheet.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(page.getByText('Chamado cancelado', { exact: true })).toBeVisible()

  // Volta ao painel, com o cancelado nos realizados.
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  const done = page.getByRole('region', { name: 'Realizados hoje' })
  const doneRow = done.getByRole('row', { name: /Paula Golpe/ })
  await expect(doneRow).toContainText('Você')
  await expect(doneRow).toContainText('Cancelado')

  // A conversa mostra quem cancelou e o motivo; não há correção nem nova ação.
  await doneRow.getByRole('cell', { name: 'Cancelado' }).click({ force: true })
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText('Chamado cancelado.')
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  const entry = conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
    hasText: `${agentName} cancelou o chamado`,
  })
  await expect(entry).toContainText('Motivo: Golpe do falso boleto.')
  const details = page.getByRole('region', { name: 'Chamado' })
  await expect(details).toContainText('Cancelado')
  await expect(details).toContainText('Cancelado em')
  await expect(details).not.toContainText('Histórico de alterações')
  await expect(details).not.toContainText('Assunto')
  for (const name of ['Corrigir', 'Cancelar chamado', 'Assumir']) {
    await expect(page.getByRole('button', { name })).toHaveCount(0)
  }
  await details.getByRole('tab', { name: 'Histórico' }).click()
  await expect(details.getByRole('list', { name: 'Chamados do contato' })).toContainText(
    'Cancelado',
  )

  // Notas internas continuam permitidas.
  await details.getByRole('tab', { name: 'Notas' }).click()
  await details.getByLabel('Nova nota').fill('Número bloqueado.')
  await details.getByRole('button', { name: 'Adicionar nota' }).click()
  await expect(page.getByText('Nota adicionada')).toBeVisible()

  // Nova mensagem do mesmo número abre outro chamado, na fila.
  expect((await receive('Última chance')).ok()).toBeTruthy()
  await page.getByRole('link', { name: 'Atendimento' }).click()
  const queue = page.getByRole('region', { name: 'Fila do setor' })
  await expect(queue.getByRole('link', { name: 'Paula Golpe' })).toHaveCount(1)
  await expect(queue).toContainText('Última chance')

  // Em atendimento, outro atendente não vê a ação; o supervisor cancela.
  await queue.getByRole('link', { name: 'Paula Golpe' }).click()
  const url = page.url()
  await page.getByRole('button', { name: 'Assumir' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()

  // No celular, as ações do responsável cabem na tela sem rolagem lateral.
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByRole('button', { name: 'Cancelar chamado' })).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeInViewport()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()

  const api = await apiRequest.newContext({ baseURL })
  await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
  const colleague = `colega.${unique().id}@e2e.test`
  expect(
    (
      await api.post('/api/users', {
        data: {
          name: 'Colega',
          email: colleague,
          role: 'agent',
          sectorId: sector.id,
          password: userPassword,
        },
      })
    ).ok(),
  ).toBeTruthy()
  await api.dispose()
  const colleagueContext = await browser.newContext()
  const colleaguePage = await colleagueContext.newPage()
  await signIn(colleaguePage, colleague, userPassword)
  await colleaguePage.goto(url)
  await expect(colleaguePage.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Peça a transferência',
  )
  await expect(colleaguePage.getByRole('button', { name: 'Cancelar chamado' })).toHaveCount(0)
  await colleagueContext.close()

  const supervisorContext = await browser.newContext()
  const supervisorPage = await supervisorContext.newPage()
  await signIn(supervisorPage, supervisor, userPassword)
  await supervisorPage.goto(url)
  await supervisorPage.getByRole('button', { name: 'Cancelar chamado' }).click()
  const supervisorSheet = supervisorPage.getByRole('dialog', { name: 'Cancelar chamado' })
  await supervisorSheet.getByLabel('Motivo').fill('Número bloqueado.')
  await supervisorSheet.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(supervisorPage.getByText('Chamado cancelado', { exact: true })).toBeVisible()
  await supervisorContext.close()
})

test('os módulos do contato vêm marcados no encerramento e podem ser alterados', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const organization = `Prefeitura ${id}`
  const api = await apiRequest.newContext({ baseURL })
  await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
  await api.post(`/api/sectors/${sector.id}/connection`)
  await api.post(`/api/test/messaging/sectors/${sector.id}/pair`)
  const org = (await (
    await api.post('/api/organizations', { data: { name: organization } })
  ).json()) as { id: number }
  const moduleIds: number[] = []
  for (const name of ['Folha', 'Patrimônio']) {
    const created = await api.post(`/api/sectors/${sector.id}/modules`, { data: { name } })
    moduleIds.push(((await created.json()) as { id: number }).id)
  }
  const contact = await api.post('/api/contacts', {
    data: {
      name: `Vera ${id}`,
      phone,
      organizationId: org.id,
      sectorIds: [sector.id],
      moduleIds: [moduleIds[0]],
    },
  })
  expect(contact.ok()).toBeTruthy()
  await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
    data: { externalMessageId: `E2E-${id}`, phone, contactName: `Vera ${id}`, body: 'Bom dia' },
  })
  await api.dispose()

  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: `Vera ${id}` }).click()
  await page.getByRole('button', { name: 'Assumir' }).click()
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await expect(sheet.getByRole('checkbox', { name: 'Folha' })).toBeChecked()
  await expect(sheet.getByRole('checkbox', { name: 'Patrimônio' })).not.toBeChecked()

  await sheet.getByRole('checkbox', { name: 'Folha' }).click()
  await sheet.getByRole('checkbox', { name: 'Patrimônio' }).click()
  await sheet.getByLabel('Assunto').fill('Consulta')
  await sheet.getByLabel('Resolução').fill('Respondida.')
  await sheet.getByRole('button', { name: 'Encerrar' }).click()
  await expect(page.getByText('Chamado encerrado', { exact: true })).toBeVisible()
})
