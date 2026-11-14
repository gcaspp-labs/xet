import { expect, request as apiRequest, test } from '@playwright/test'
import {
  admin,
  clearSession,
  expectLockedDialog,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

type Response = { ok(): boolean; json(): Promise<unknown> }

const ok = (response: Response) => expect(response.ok()).toBeTruthy()

const json = async <T>(response: Response) => {
  ok(response)
  return (await response.json()) as T
}

// Atendimento de um contato cadastrado, encerrado pelo atendente pela API, e
// um segundo atendente do setor, que não encerrou.
async function closedTicket(baseURL: string) {
  const { sector, agent, supervisor } = await seedSector(baseURL)
  const { id, phone } = unique()
  const [organization] = await seedDirectory(
    baseURL,
    [{ name: `Prefeitura ${id}` }],
    [{ name: `Rita ${id}`, phone, organization: 0, sector: sector.id }],
  )

  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  ok(await api.post(`/api/sectors/${sector.id}/connection`))
  ok(await api.post(`/api/test/messaging/sectors/${sector.id}/pair`))
  const modules: { id: number }[] = []
  for (const name of ['Folha', 'Patrimônio']) {
    modules.push(
      await json(await api.post(`/api/sectors/${sector.id}/modules`, { data: { name } })),
    )
  }
  const otherAgent = `agent2.${id}@e2e.test`
  ok(
    await api.post('/api/users', {
      data: {
        name: `agent2 ${id}`,
        email: otherAgent,
        role: 'agent',
        sectorId: sector.id,
        password: userPassword,
      },
    }),
  )
  ok(
    await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: 'Rita', body: 'Contracheque' },
    }),
  )
  await api.dispose()

  const agentApi = await apiRequest.newContext({ baseURL })
  ok(await agentApi.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const [ticket] = await json<{ id: number }[]>(
    await agentApi.get(`/api/sectors/${sector.id}/tickets`),
  )
  ok(await agentApi.post(`/api/tickets/${ticket.id}/assign`))
  ok(
    await agentApi.post(`/api/tickets/${ticket.id}/close`, {
      data: {
        subject: 'Contracheque',
        resolution: 'Enviada a segunda via.',
        moduleIds: modules.map((module) => module.id),
        organizationId: organization.id,
      },
    }),
  )
  await agentApi.dispose()
  return { ticketId: ticket.id, agent, otherAgent, supervisor, sector, modules }
}

test('correção do atendimento encerrado exige motivo e fica na auditoria', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent, otherAgent, supervisor } = await closedTicket(baseURL!)
  const details = page.getByRole('region', { name: 'Chamado', exact: true })

  // O atendente que não encerrou não vê a correção, e a API o bloqueia.
  await signIn(page, otherAgent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(details).toContainText('Contracheque')
  await expect(page.getByRole('button', { name: 'Corrigir' })).toHaveCount(0)
  const blocked = await page.request.post(`/api/tickets/${ticketId}/correct`, {
    data: {
      subject: 'Outro',
      resolution: 'Outra',
      moduleIds: [1],
      organizationId: 1,
      startedAt: new Date(Date.now() - 3_600_000).toISOString(),
      endedAt: new Date(Date.now() - 60_000).toISOString(),
      spokeWith: '',
      reason: 'Teste',
    },
  })
  expect(blocked.status()).toBe(403)
  await clearSession(page)

  // Quem encerrou corrige; sem motivo, a correção é recusada.
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await page.getByRole('button', { name: 'Corrigir' }).click()
  const sheet = page.getByRole('dialog', { name: 'Corrigir atendimento' })
  await expect(sheet.getByLabel('Assunto')).toHaveValue('Contracheque')
  await expect(sheet.getByRole('checkbox', { name: 'Folha' })).toBeChecked()
  await sheet.getByLabel('Assunto').fill('Segunda via do contracheque')
  await sheet.getByRole('checkbox', { name: 'Patrimônio' }).click()
  await sheet.getByLabel('Falou com').fill('Rita, filha')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await expect(sheet).toContainText('Informe o motivo da correção.')

  await sheet.getByLabel('Motivo da correção').fill('Assunto registrado errado.')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  // O assunto alterado não está na lista do setor: a janela pergunta antes de gravar.
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Atendimento corrigido')).toBeVisible()
  await expect(sheet).toHaveCount(0)

  // Os detalhes mostram os dados corrigidos e o histórico de alterações.
  await expect(details).toContainText('Rita, filha')
  const history = details.getByRole('list', { name: 'Histórico de alterações' })
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  await expect(history).toContainText(agentName)
  await expect(history).toContainText('Motivo: Assunto registrado errado.')
  await expect(history).toContainText('Contracheque → Segunda via do contracheque')
  await expect(history).toContainText('Folha, Patrimônio → Folha')
  await expect(history).toContainText('Não informado → Rita, filha')
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(
    conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
      hasText: `${agentName} corrigiu o atendimento`,
    }),
  ).toBeVisible()

  // Sem nenhuma alteração, o backend recusa.
  await page.getByRole('button', { name: 'Corrigir' }).click()
  await sheet.getByLabel('Motivo da correção').fill('Conferência.')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await expect(sheet).toContainText('Nenhum dado foi alterado.')
  await clearSession(page)

  // O supervisor do setor também corrige.
  await signIn(page, supervisor, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(page.getByRole('button', { name: 'Corrigir' })).toBeVisible()
})

test('correção exige marcar módulo ativo e preserva os módulos antigos', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent, sector, modules } = await closedTicket(baseURL!)
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  for (const [index, name] of ['Folha', 'Patrimônio'].entries()) {
    ok(
      await api.put(`/api/sectors/${sector.id}/modules/${modules[index].id}`, {
        data: { name, active: false },
      }),
    )
  }
  const replacement = await json<{ id: number }>(
    await api.post(`/api/sectors/${sector.id}/modules`, { data: { name: 'Novo sistema' } }),
  )
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await page.getByRole('button', { name: 'Corrigir' }).click()
  const sheet = page.getByRole('dialog', { name: 'Corrigir atendimento' })
  await sheet.getByLabel('Assunto').fill('Novo assunto')
  await sheet.getByLabel('Motivo da correção').fill('Corrigir assunto.')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await expect(sheet.getByText('Marque ao menos um módulo ativo para salvar.')).toBeVisible()
  await sheet.getByRole('checkbox', { name: 'Novo sistema' }).check()
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await sheet.getByRole('button', { name: 'Adicionar', exact: true }).click()
  await expect(page.getByText('Atendimento corrigido')).toBeVisible()
  const result = await json<{ id: number }[]>(
    await page.request.get(`/api/tickets/${ticketId}/modules`),
  )
  expect(result.map((module) => module.id).sort((a, b) => a - b)).toEqual(
    [...modules.map((module) => module.id), replacement.id].sort((a, b) => a - b),
  )
  await api.dispose()
})

test('a janela de correção tem bloqueio', async ({ page, baseURL }) => {
  const { ticketId, agent } = await closedTicket(baseURL!)
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await page.getByRole('button', { name: 'Corrigir' }).click()
  await expectLockedDialog(page, page.getByRole('dialog', { name: 'Corrigir atendimento' }), {
    field: 'Motivo da correção',
  })
})
