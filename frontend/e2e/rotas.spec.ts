import { expect, request as apiRequest, type Page } from '@playwright/test'
import {
  admin,
  json,
  ok,
  seedClosedTicket,
  seedSector,
  signIn,
  test,
  unique,
  userPassword,
  chooseAction,
} from './fixtures'

const sidebar = '[data-slot=sidebar-inner]'
const notFound = (page: Page) => page.getByRole('heading', { name: 'Não encontrado' })

// Chamado ativo de um setor novo: na fila, ou já assumido pelo atendente do setor.
async function activeTicket(baseURL: string, { assigned }: { assigned: boolean }) {
  const { sector, agent, supervisor } = await seedSector(baseURL)
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  ok(await api.post(`/api/sectors/${sector.id}/connection`))
  ok(await api.post(`/api/test/messaging/sectors/${sector.id}/pair`))
  const { id, phone } = unique()
  const name = `Rota ${id}`
  ok(
    await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: name, body: 'Bom dia' },
    }),
  )
  await api.dispose()
  const agentApi = await apiRequest.newContext({ baseURL })
  ok(await agentApi.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const [ticket] = await json<{ id: number }[]>(
    await agentApi.get(`/api/sectors/${sector.id}/tickets`),
  )
  if (assigned) {
    ok(await agentApi.post(`/api/tickets/${ticket.id}/assign`))
  }
  return { ticketId: ticket.id, name, agent, supervisor, sector, agentApi }
}

// Nenhum item do menu fica ativo (o roteador marca o ativo com aria-current).
async function expectNoActiveMenuItem(page: Page) {
  await expect(page.locator(sidebar).getByRole('link', { name: 'Atendimentos' })).toBeVisible()
  await expect(page.locator(`${sidebar} [aria-current="page"]`)).toHaveCount(0)
  await expect(page.locator(`${sidebar} [data-active]`)).toHaveCount(0)
}

test('chamado ativo abre em Chamados, com o item do menu ativo', async ({ page, baseURL }) => {
  const { ticketId, agent, agentApi } = await activeTicket(baseURL!, { assigned: true })
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(page).toHaveURL(new RegExp(`/chamados/${ticketId}$`))
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toBeVisible()
  const menu = page.locator(sidebar)
  await expect(menu.getByRole('link', { name: 'Chamados', exact: true })).toHaveAttribute(
    'data-active',
    '',
  )
  await expect(menu.getByRole('link', { name: 'Atendimentos' })).not.toHaveAttribute('data-active')
  await page.getByRole('link', { name: 'Atendimentos' }).click()
  await expect(page).toHaveURL(/\/atendimentos$/)
  await expect(menu.getByRole('link', { name: 'Atendimentos' })).toHaveAttribute('data-active', '')
  await agentApi.dispose()
})

test('chamado encerrado em /chamados/:id vai para /atendimentos/:id, trocando o histórico', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent } = await seedClosedTicket(baseURL!)
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ticketId}$`))
  await expect(page.getByRole('tab', { name: 'Detalhes', exact: true })).toBeVisible()
  await expect(page.locator(sidebar).getByRole('link', { name: 'Atendimentos' })).toHaveAttribute(
    'data-active',
    '',
  )
  // O endereço antigo foi substituído: voltar não passa por /chamados/:id.
  await page.goBack()
  await expect(page).toHaveURL(/\/atendimentos$/)
})

test('quem está com o chamado aberto em Chamados vai para Atendimentos quando ele é encerrado por outra pessoa', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent, agentApi } = await activeTicket(baseURL!, { assigned: true })
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toBeVisible()
  // Cancelado por outra sessão: o tempo real atualiza a tela aberta.
  ok(await agentApi.post(`/api/tickets/${ticketId}/cancel`, { data: { reason: 'Engano.' } }))
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ticketId}$`))
  await expect(page.getByText('Cancelado').first()).toBeVisible()
  await agentApi.dispose()
})

test('quem cancela pela própria tela volta a /chamados e não é levado a Atendimentos', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent, agentApi } = await activeTicket(baseURL!, { assigned: true })
  await agentApi.dispose()
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await chooseAction(page, 'Cancelar chamado')
  const sheet = page.getByRole('dialog', { name: 'Cancelar chamado' })
  await sheet.getByLabel('Motivo').fill('Aberto por engano.')
  await sheet.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(page.getByText('Chamado cancelado')).toBeVisible()
  await expect(page).toHaveURL(/\/chamados$/)
  // A volta de quem agiu prevalece: o endereço não troca depois.
  await page.waitForTimeout(1000)
  await expect(page).toHaveURL(/\/chamados$/)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toHaveCount(0)
})

for (const old of ['/conversas', '/conversas/1', '/atendimento']) {
  test(`endereço antigo ${old} mostra Não encontrado, sem redirecionar nem item ativo`, async ({
    page,
    baseURL,
  }) => {
    const { agent } = await seedSector(baseURL!)
    await signIn(page, agent, userPassword)
    await page.goto(old)
    await expect(notFound(page)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${old}$`))
    await expect(page.getByRole('alert')).toContainText('Esta página não existe')
    await expectNoActiveMenuItem(page)
    // Aberto direto, sem página anterior no app: Voltar vai ao início (a tela Chamados, para o atendente).
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page).toHaveURL(/\/chamados$/)
  })
}

test('endereço desconhecido, logado, mostra Não encontrado no layout e Voltar à página anterior', async ({
  page,
  baseURL,
}) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Contatos' }).click()
  await expect(page).toHaveURL(/\/contatos$/)
  // Entrada de histórico do próprio roteador, como a de um clique num link para um endereço desconhecido.
  await page.evaluate(() => {
    history.pushState({ usr: null, key: 'rota-desconhecida', idx: 99 }, '', '/qualquer-coisa')
    dispatchEvent(new PopStateEvent('popstate', { state: history.state }))
  })
  await expect(notFound(page)).toBeVisible()
  await expect(
    page.locator(sidebar).getByRole('link', { name: 'Chamados', exact: true }),
  ).toBeVisible()
  await expectNoActiveMenuItem(page)
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page).toHaveURL(/\/contatos$/)

  // Aberto direto, Voltar vai ao início.
  await page.goto('/qualquer-coisa')
  await expect(notFound(page)).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page).toHaveURL(/\/chamados$/)
})

test('sem sessão, qualquer endereço desconhecido vai para o login', async ({ page }) => {
  for (const address of ['/qualquer-coisa', '/conversas', '/atendimento', '/atendimentos/1']) {
    await page.goto(address)
    await expect(page).toHaveURL(/\/login$/)
  }
})

test('chamado inexistente ou com id inválido mostra Não encontrado com o item da seção ativo', async ({
  page,
  baseURL,
}) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  const calls: string[] = []
  page.on('request', (request) => {
    if (/\/api\/tickets\/\d+$/.test(request.url())) calls.push(request.url())
  })
  for (const [address, item] of [
    ['/chamados/99999999', 'Chamados'],
    ['/chamados/abc', 'Chamados'],
    ['/atendimentos/99999999', 'Atendimentos'],
    ['/atendimentos/abc', 'Atendimentos'],
  ]) {
    await page.goto(address)
    // O 404 não é repetido: a tela aparece logo, sem os ~7 s de busca repetida.
    await expect(notFound(page)).toBeVisible({ timeout: 3000 })
    await expect(page).toHaveURL(new RegExp(`${address}$`))
    await expect(
      page.locator(sidebar).getByRole('link', { name: item, exact: true }),
    ).toHaveAttribute('data-active', '')
  }
  // Uma consulta só para cada id numérico e nenhuma para o id inválido.
  expect(calls).toHaveLength(2)
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page).toHaveURL(/\/chamados$/)
})

test('/atendimentos/:id de chamado ativo mostra Não encontrado com Voltar', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent, agentApi } = await activeTicket(baseURL!, { assigned: true })
  await agentApi.dispose()
  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  await expect(notFound(page)).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ticketId}$`))
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page).toHaveURL(/\/chamados$/)
})

test('/atendimentos/:id de chamado encerrado abre a ficha só leitura, com o histórico por situação', async ({
  page,
  baseURL,
}) => {
  const { ticketId, agent } = await seedClosedTicket(baseURL!)
  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticketId}`)
  await expect(page.getByRole('heading', { name: 'Rita' })).toBeVisible()
  await expect(notFound(page)).toHaveCount(0)
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await expect(
    page.getByRole('list', { name: 'Chamados do contato' }).getByRole('link').first(),
  ).toHaveAttribute('href', new RegExp(`^/atendimentos/${ticketId}$`))
})

test('sem acesso (403) segue com o erro de hoje, sem Não encontrado, e a seta volta a Atendimentos', async ({
  page,
  baseURL,
}) => {
  const { ticketId } = await activeTicket(baseURL!, { assigned: true })
  const { ticketId: closedId } = await seedClosedTicket(baseURL!)
  const { agent: stranger } = await seedSector(baseURL!)
  await signIn(page, stranger, userPassword)
  for (const address of [`/chamados/${ticketId}`, `/atendimentos/${closedId}`]) {
    await page.goto(address)
    await expect(page.getByText('Você não tem acesso a este setor.')).toBeVisible({ timeout: 3000 })
    await expect(notFound(page)).toHaveCount(0)
  }
  await expect(page.getByRole('link', { name: 'Voltar à lista' })).toHaveAttribute(
    'href',
    '/atendimentos',
  )
})

test('erro do servidor continua com novas tentativas', async ({ page, baseURL }) => {
  const { ticketId, agent, agentApi } = await activeTicket(baseURL!, { assigned: true })
  await agentApi.dispose()
  await signIn(page, agent, userPassword)
  let failures = 0
  await page.route(new RegExp(`/api/tickets/${ticketId}$`), async (route) => {
    if (failures < 1) {
      failures++
      await route.fulfill({ status: 500, json: { error: 'Erro inesperado.' } })
      return
    }
    await route.continue()
  })
  await page.goto(`/chamados/${ticketId}`)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toBeVisible({
    timeout: 10000,
  })
  expect(failures).toBe(1)
})
