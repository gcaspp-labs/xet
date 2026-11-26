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
  unrouteAfterEach,
  userPassword,
} from './fixtures'

// Botão de copiar o telefone do cliente: no cabeçalho de /chamados/:id e na linha Contato da ficha
// de /atendimentos/:id. Copia só números, 44 + 0 + DDD + número, sem o +55; número de fora do Brasil
// copia só os dígitos. Sem telefone, sem botão.

type Ticket = { id: number; contact: { name: string; phone: string | null } }

// Recebe uma mensagem de `phone` e devolve o chamado assumido pelo atendente.
async function seedActiveTicket(baseURL: string, sectorId: number, agent: string, phone: string) {
  const { id } = unique()
  const name = `Cliente ${id}`
  const api = await apiRequest.newContext({ baseURL })
  ok(
    await api.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: name, body: 'Olá' },
    }),
  )
  ok(await api.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const list = await json<Ticket[]>(await api.get(`/api/sectors/${sectorId}/tickets`))
  const ticket = list.find((item) => item.contact.name === name)!
  ok(await api.post(`/api/tickets/${ticket.id}/assign`))
  await api.dispose()
  return { ticketId: ticket.id, name }
}

// Faz a API devolver o chamado sem telefone, como um contato que ainda não o tem.
async function withoutPhone(page: Page, ticketId: number) {
  await page.route(`**/api/tickets/${ticketId}`, async (route) => {
    const response = await route.fetch()
    const ticket = (await response.json()) as Ticket
    await route.fulfill({
      response,
      json: { ...ticket, contact: { ...ticket.contact, phone: null } },
    })
  })
}

const copied = (page: Page) => page.evaluate(() => navigator.clipboard.readText())

// O `withoutPhone` deixa uma rota respondendo até o fim do teste.
unrouteAfterEach()

test('copia o telefone no cabeçalho do chamado, com o 44, só números e sem o +55', async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const { sector, agent } = await seedSector(baseURL!)
  // 55 + DDD 61 + número de 9 dígitos → 44 + 0 + DDD + número.
  const phone = `5561${unique().id}`
  const { ticketId, name } = await seedActiveTicket(baseURL!, sector.id, agent, phone)
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(page.getByRole('heading', { name })).toBeVisible()

  // A tela continua mostrando o telefone formatado; só a cópia muda.
  const header = page.locator('header').filter({ has: page.getByRole('heading', { name }) })
  await expect(header).toContainText(`+55 (61) ${phone.slice(4, 9)}-${phone.slice(9)}`)
  const button = header.getByRole('button', { name: 'Copiar telefone' })
  await expect(button).toHaveAttribute('title', 'Copiar telefone')

  // Alcançável e acionável pelo teclado.
  await button.focus()
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Telefone copiado')).toBeVisible()
  expect(await copied(page)).toBe(`44061${phone.slice(4)}`)
})

test('número fora do Brasil copia só os dígitos, como estão', async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const { sector, agent } = await seedSector(baseURL!)
  const phone = `3519${unique().id}`
  const { ticketId, name } = await seedActiveTicket(baseURL!, sector.id, agent, phone)
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(page.getByRole('heading', { name })).toBeVisible()

  await page.getByRole('button', { name: 'Copiar telefone' }).click()
  await expect(page.getByText('Telefone copiado')).toBeVisible()
  expect(await copied(page)).toBe(phone)
})

test('se a cópia falhar, avisa e a tela continua funcionando', async ({ page, baseURL }) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { ticketId, name } = await seedActiveTicket(
    baseURL!,
    sector.id,
    agent,
    `5511${unique().id}`,
  )
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('negado')) },
    })
  })
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(page.getByRole('heading', { name })).toBeVisible()

  await page.getByRole('button', { name: 'Copiar telefone' }).click()
  await expect(page.getByText('Não foi possível copiar o telefone.')).toBeVisible()
  await expect(page.getByText('Telefone copiado')).toHaveCount(0)
  await expect(page.getByRole('heading', { name })).toBeVisible()
})

test('o chamado sem telefone mostra "Sem telefone" e não tem botão', async ({ page, baseURL }) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { ticketId, name } = await seedActiveTicket(
    baseURL!,
    sector.id,
    agent,
    `5511${unique().id}`,
  )
  await withoutPhone(page, ticketId)
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticketId}`)
  await expect(page.getByRole('heading', { name })).toBeVisible()

  await expect(page.getByText('Sem telefone')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copiar telefone' })).toHaveCount(0)
})

test('a ficha do atendimento copia o telefone na linha Contato, e sem telefone não há botão', async ({
  page,
  context,
  baseURL,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const { ticketId, agent } = await seedClosedTicket(baseURL!)
  await signIn(page, agent, userPassword)
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  const { contact } = await json<Ticket>(await api.get(`/api/tickets/${ticketId}`))
  await api.dispose()

  await page.goto(`/atendimentos/${ticketId}`)
  const details = page.getByRole('region', { name: 'Atendimento', exact: true })
  await expect(details).toContainText('Contato')
  await details.getByRole('button', { name: 'Copiar telefone' }).click()
  await expect(page.getByText('Telefone copiado')).toBeVisible()
  // 5511NNNNNNNNN → 44011NNNNNNNNN, sem o nome do contato.
  expect(await copied(page)).toBe(`440${contact.phone!.slice(2)}`)

  await withoutPhone(page, ticketId)
  await page.goto(`/atendimentos/${ticketId}`)
  await expect(details).toContainText('Sem telefone')
  await expect(page.getByRole('button', { name: 'Copiar telefone' })).toHaveCount(0)
})
