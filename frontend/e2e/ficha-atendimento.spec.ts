import { expect, request as apiRequest, type Page, test } from '@playwright/test'
import {
  admin,
  clearSession,
  json,
  ok,
  seedClosedTicket,
  seedDirectory,
  seedMergedTicket,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

const sidebar = '[data-slot=sidebar-inner]'
const conversation = (page: Page) => page.getByRole('region', { name: 'Conversa', exact: true })
const details = (page: Page) => page.getByRole('region', { name: 'Atendimento', exact: true })

// Tudo o que a ficha de um atendimento encerrado não oferece: escrever, gravar, anexar, agir no
// chamado e as telas que só servem ao atendimento ativo.
async function expectReadOnly(page: Page) {
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  for (const name of [
    'Gravar áudio',
    'Anexar arquivo',
    'Enviar mensagem',
    'Reenviar',
    'Assumir',
    'Encerrar',
    'Devolver à fila',
    'Transferir',
    'Outro setor',
    'Cancelar chamado',
    'Mais ações',
  ]) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
  await expect(page.getByLabel('Arquivo para enviar')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Fila do setor' })).toHaveCount(0)
  await expect(page.getByText('Conversas do setor')).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'Só leitura' })).toBeVisible()
  // Só as abas Detalhes e Histórico.
  await expect(details(page).getByRole('tab')).toHaveText(['Detalhes', 'Histórico'])
}

// Chamado ativo de um setor novo, assumido pelo atendente, que vira cancelado pela API.
async function seedCancelledTicket(baseURL: string) {
  const { sector, agent, supervisor } = await seedSector(baseURL)
  const admins = await apiRequest.newContext({ baseURL })
  ok(
    await admins.post('/api/auth/login', {
      data: { email: admin.email, password: admin.password },
    }),
  )
  ok(await admins.post(`/api/sectors/${sector.id}/connection`))
  ok(await admins.post(`/api/test/messaging/sectors/${sector.id}/pair`))
  const { id, phone } = unique()
  ok(
    await admins.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: {
        externalMessageId: `E2E-${id}`,
        phone,
        contactName: 'Golpe',
        body: 'Seu boleto venceu',
      },
    }),
  )
  await admins.dispose()
  const agentApi = await apiRequest.newContext({ baseURL })
  ok(await agentApi.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const [ticket] = await json<{ id: number }[]>(
    await agentApi.get(`/api/sectors/${sector.id}/tickets`),
  )
  ok(await agentApi.post(`/api/tickets/${ticket.id}/assign`))
  ok(
    await agentApi.post(`/api/tickets/${ticket.id}/cancel`, {
      data: { reason: 'Golpe do falso boleto.' },
    }),
  )
  await agentApi.dispose()
  return { ticketId: ticket.id, agent, supervisor }
}

test('a ficha do atendimento encerrado é só leitura e o Corrigir fica visível só para quem pode', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent, otherAgent, supervisor } = await seedClosedTicket(baseURL!)
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')

  // Quem encerrou lê a conversa completa e corrige, sem menu ⋯.
  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  await expect(
    conversation(page).getByRole('listitem', { name: 'Mensagem recebida' }),
  ).toContainText('Contracheque')
  await expect(
    conversation(page)
      .getByRole('listitem', { name: 'Registro do chamado' })
      .filter({ hasText: `${agentName} encerrou o chamado` }),
  ).toBeVisible()
  await expect(page.getByRole('status', { name: 'Só leitura' })).toContainText('Encerrado em')
  await expectReadOnly(page)
  await expect(page.locator(sidebar).getByRole('link', { name: 'Atendimentos' })).toHaveAttribute(
    'data-active',
    '',
  )
  await expect(details(page)).toContainText('Contracheque')
  await expect(details(page)).toContainText('Enviada a segunda via.')
  await details(page).getByRole('tab', { name: 'Histórico' }).click()
  await expect(details(page).getByRole('list', { name: 'Chamados do contato' })).toBeVisible()
  await details(page).getByRole('tab', { name: 'Detalhes' }).click()

  // A correção abre na própria ficha, sem trocar de endereço, e a ficha continua só leitura.
  const correctButton = page.getByRole('button', { name: 'Corrigir', exact: true })
  await expect(correctButton).toBeVisible()
  await correctButton.click()
  const sheet = page.getByRole('dialog', { name: 'Corrigir atendimento' })
  await expect(sheet).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ticketId}$`))
  await sheet.getByLabel('Resolução').fill('Segunda via enviada por e-mail.')
  await sheet.getByLabel('Motivo da correção').fill('Resolução incompleta.')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await expect(page.getByText('Atendimento corrigido')).toBeVisible()
  await expect(sheet).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ticketId}$`))
  await expect(details(page)).toContainText('Segunda via enviada por e-mail.')
  await expect(
    conversation(page)
      .getByRole('listitem', { name: 'Registro do chamado' })
      .filter({ hasText: `${agentName} corrigiu o atendimento` }),
  ).toBeVisible()
  await expectReadOnly(page)
  await clearSession(page)

  // Outro atendente do setor lê, mas não vê o Corrigir.
  await signIn(page, otherAgent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  await expect(details(page)).toContainText('Contracheque')
  await expectReadOnly(page)
  await expect(page.getByRole('button', { name: 'Corrigir', exact: true })).toHaveCount(0)
  await clearSession(page)

  // Supervisor do setor e administrador veem o Corrigir.
  for (const [email, password] of [
    [supervisor, userPassword],
    [admin.email, admin.password],
  ]) {
    await signIn(page, email, password)
    await page.goto(`/atendimentos/${ticketId}`)
    await expect(page.getByRole('button', { name: 'Corrigir', exact: true })).toBeVisible()
    await expectReadOnly(page)
    await clearSession(page)
  }
})

test('a ficha do chamado cancelado é só leitura e nunca oferece Corrigir', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent, supervisor } = await seedCancelledTicket(baseURL!)
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')

  for (const [email, password] of [
    [agent, userPassword],
    [supervisor, userPassword],
    [admin.email, admin.password],
  ]) {
    await signIn(page, email, password)
    await page.goto(`/atendimentos/${ticketId}`)
    await expect(
      conversation(page)
        .getByRole('listitem', { name: 'Registro do chamado' })
        .filter({ hasText: `${agentName} cancelou o chamado` }),
    ).toContainText('Motivo: Golpe do falso boleto.')
    await expect(page.getByRole('status', { name: 'Só leitura' })).toContainText('Cancelado em')
    await expect(details(page)).toContainText('Cancelado')
    await expect(details(page)).not.toContainText('Histórico de alterações')
    await expectReadOnly(page)
    await expect(page.getByRole('button', { name: 'Corrigir', exact: true })).toHaveCount(0)
    await clearSession(page)
  }
})

test('a ficha mostra a cadeia de transferências e o destino lê o chamado anterior', async ({
  page,
  baseURL,
}) => {
  const origin = await seedSector(baseURL!)
  const destination = await seedSector(baseURL!)
  const { id, phone } = unique()
  const contact = `Lúcia ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name: contact, phone, organization: 0, sector: origin.sector.id }],
  )
  const admins = await apiRequest.newContext({ baseURL })
  ok(
    await admins.post('/api/auth/login', {
      data: { email: admin.email, password: admin.password },
    }),
  )
  for (const sectorId of [origin.sector.id, destination.sector.id]) {
    ok(await admins.post(`/api/sectors/${sectorId}/connection`))
    ok(await admins.post(`/api/test/messaging/sectors/${sectorId}/pair`))
  }
  ok(
    await admins.post(`/api/test/messaging/sectors/${origin.sector.id}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: contact, body: 'Folha de março' },
    }),
  )
  await admins.dispose()

  const originApi = await apiRequest.newContext({ baseURL })
  ok(
    await originApi.post('/api/auth/login', {
      data: { email: origin.agent, password: userPassword },
    }),
  )
  const [originTicket] = await json<{ id: number }[]>(
    await originApi.get(`/api/sectors/${origin.sector.id}/tickets`),
  )
  ok(await originApi.post(`/api/tickets/${originTicket.id}/assign`))
  const next = await json<{ id: number; protocol: string }>(
    await originApi.post(`/api/tickets/${originTicket.id}/sector-transfer`, {
      data: { sectorId: destination.sector.id },
    }),
  )
  await originApi.dispose()
  const originName = origin.agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')

  // A origem lê a ficha: o desfecho, o destino na cadeia e a conversa só para leitura.
  await signIn(page, origin.agent, userPassword)
  await page.goto(`/atendimentos/${originTicket.id}`)
  await expect(page.getByRole('status', { name: 'Só leitura' })).toContainText(
    `Transferido para ${destination.sector.name}`,
  )
  const chain = details(page).getByRole('region', { name: 'Cadeia de transferências' })
  await expect(chain).toContainText(origin.sector.name)
  await expect(chain).toContainText(destination.sector.name)
  await expect(chain).toContainText(next.protocol)
  await expect(chain.getByRole('region', { name: 'Chamado anterior' })).toHaveCount(0)
  await expectReadOnly(page)
  await clearSession(page)

  // O destino cancela o chamado novo; a ficha dele traz a origem e o link abre /atendimentos/:id.
  const destinationApi = await apiRequest.newContext({ baseURL })
  ok(
    await destinationApi.post('/api/auth/login', {
      data: { email: destination.agent, password: userPassword },
    }),
  )
  ok(await destinationApi.post(`/api/tickets/${next.id}/assign`))
  ok(await destinationApi.post(`/api/tickets/${next.id}/cancel`, { data: { reason: 'Teste.' } }))
  await destinationApi.dispose()

  await signIn(page, destination.agent, userPassword)
  await page.goto(`/atendimentos/${next.id}`)
  const previous = details(page).getByRole('region', { name: 'Chamado anterior' })
  await expect(previous).toContainText(origin.sector.name)
  await expect(previous).toContainText(`transferido por ${originName}`)
  await expectReadOnly(page)
  await previous.getByRole('link', { name: 'Ver chamado anterior' }).click()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${originTicket.id}$`))
  await expect(conversation(page)).toContainText('Folha de março')
  await expectReadOnly(page)
  // O destino só lê o chamado de outro setor: sem Corrigir.
  await expect(page.getByRole('button', { name: 'Corrigir', exact: true })).toHaveCount(0)
})

// O mesclado num pendente: as mensagens foram para o original, e a ficha só avisa e leva a ele.
test('o mesclado só avisa a mesclagem com o link, sem conversa e sem Corrigir', async ({
  page,
  baseURL,
}) => {
  const m = await seedMergedTicket(baseURL!)
  await signIn(page, m.agent, userPassword)
  await page.goto(`/atendimentos/${m.merged.id}`)

  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText('Chamado mesclado')
  await expect(conversation).toContainText(
    'As mensagens deste chamado foram para o chamado original.',
  )
  const link = conversation.getByRole('link', { name: `Ver chamado ${m.original.protocol}` })
  await expect(link).toBeVisible()

  // Sem conversa (as mensagens estão no original), sem Corrigir, e a situação nos Detalhes.
  await expect(page.getByText('Preciso da segunda via do contracheque')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Corrigir', exact: true })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await expect(details(page)).toContainText('Mesclado')

  // O pendente ficou encerrado com os dados do mesclado, então o link abre em Atendimentos.
  await link.click()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${m.original.id}$`))
})
