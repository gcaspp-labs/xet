import { execFileSync } from 'node:child_process'
import { expect, request as apiRequest, test } from '@playwright/test'
import {
  admin,
  clearSession,
  expectLockedDialog,
  json,
  ok,
  seedClosedTicket,
  signIn,
  userPassword,
} from './fixtures'

test('correção do atendimento encerrado exige motivo e fica na auditoria', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent, otherAgent, supervisor } = await seedClosedTicket(baseURL!)
  const details = page.getByRole('region', { name: 'Atendimento', exact: true })

  // O atendente que não encerrou não vê a correção, e a API o bloqueia.
  await signIn(page, otherAgent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
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
      reason: 'Teste',
    },
  })
  expect(blocked.status()).toBe(403)
  await clearSession(page)

  // Quem encerrou corrige; sem motivo, a correção é recusada.
  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  await page.getByRole('button', { name: 'Corrigir' }).click()
  const sheet = page.getByRole('dialog', { name: 'Corrigir atendimento' })
  await expect(sheet.getByLabel('Assunto')).toHaveValue('Contracheque')
  await expect(sheet.getByRole('checkbox', { name: 'Folha' })).toBeChecked()
  await sheet.getByLabel('Assunto').fill('Segunda via do contracheque')
  await sheet.getByRole('checkbox', { name: 'Patrimônio' }).click()
  await expect(sheet.getByLabel('Falou com')).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  await expect(sheet).toContainText('Informe o motivo da correção.')

  await sheet.getByLabel('Motivo da correção').fill('Assunto registrado errado.')
  await sheet.getByRole('button', { name: 'Salvar correção' }).click()
  // O assunto alterado não está na lista do setor: a janela pergunta antes de gravar.
  await sheet.getByRole('button', { name: 'Não adicionar' }).click()
  await expect(page.getByText('Atendimento corrigido')).toBeVisible()
  await expect(sheet).toHaveCount(0)

  // Os detalhes mostram os dados corrigidos e o histórico de alterações.
  await expect(details).not.toContainText('Falou com')
  const history = details.getByRole('list', { name: 'Histórico de alterações' })
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  await expect(history).toContainText(agentName)
  await expect(history).toContainText('Motivo: Assunto registrado errado.')
  await expect(history).toContainText('Contracheque → Segunda via do contracheque')
  await expect(history).toContainText('Folha, Patrimônio → Folha')
  await expect(history).not.toContainText('Falou com')
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
  await page.goto(`/atendimentos/${ticketId}`)
  await expect(page.getByRole('button', { name: 'Corrigir' })).toBeVisible()
})

// Até a migração que apaga os dados, a API ainda devolve o "falou com" de correções
// antigas: a tela esconde essas mudanças e a correção que só mudou isso. Os registros
// antigos (dados fictícios) entram no banco isolado criado por make test-e2e, e a página
// consulta a API real.
test('o histórico de alterações esconde o "falou com" de correções antigas', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent } = await seedClosedTicket(baseURL!)
  expect(Number.isSafeInteger(ticketId)).toBeTruthy()
  expect(agent).toMatch(/^[\w.@+-]+$/)
  const legacy = (reason: string, changes: object, createdAt: string) =>
    `INSERT INTO audit_logs (ticket_id, entity_type, entity_id, action, actor_id, reason, changes, created_at)
     VALUES (${ticketId}, 'ticket', ${ticketId}, 'ticket_corrected',
             (SELECT id FROM users WHERE email = '${agent}'),
             '${reason}', '${JSON.stringify(changes)}'::jsonb, '${createdAt}')`
  execFileSync('docker', [
    'exec',
    'xet-e2e-db',
    'psql',
    '-U',
    'xet',
    '-d',
    'xet',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    legacy(
      'Assunto e quem atendeu.',
      {
        subject: { from: 'Contracheque', to: 'Segunda via' },
        spoke_with: { from: null, to: 'Maria, esposa' },
      },
      '2026-11-01T12:00:00Z',
    ),
    '-c',
    legacy(
      'Só quem atendeu.',
      { spoke_with: { from: 'Maria, esposa', to: 'Rita, filha' } },
      '2026-11-02T12:00:00Z',
    ),
  ])

  // A API real ainda devolve as duas correções antigas, com o "falou com".
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const corrections = await json<{ reason: string; changes: { field: string }[] }[]>(
    await api.get(`/api/tickets/${ticketId}/corrections`),
  )
  await api.dispose()
  expect(corrections.map((c) => c.reason)).toEqual(
    expect.arrayContaining(['Assunto e quem atendeu.', 'Só quem atendeu.']),
  )
  expect(corrections.flatMap((c) => c.changes.map((change) => change.field))).toContain(
    'spoke_with',
  )

  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  const history = page
    .getByRole('region', { name: 'Atendimento', exact: true })
    .getByRole('list', { name: 'Histórico de alterações' })
  await expect(history.getByRole('listitem')).toHaveCount(1)
  await expect(history).toContainText('Motivo: Assunto e quem atendeu.')
  await expect(history).toContainText('Contracheque → Segunda via')
  await expect(history).not.toContainText('Falou com')
  await expect(history).not.toContainText('Maria')
  await expect(history).not.toContainText('Só quem atendeu.')
})

test('correção exige marcar módulo ativo e preserva os módulos antigos', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent, sector, modules } = await seedClosedTicket(baseURL!)
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
  await page.goto(`/atendimentos/${ticketId}`)
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
  const { ticketId, agent } = await seedClosedTicket(baseURL!)
  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  await page.getByRole('button', { name: 'Corrigir' }).click()
  await expectLockedDialog(page, page.getByRole('dialog', { name: 'Corrigir atendimento' }), {
    field: 'Motivo da correção',
  })
})
