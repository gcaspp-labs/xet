import { expect, request, test } from '@playwright/test'
import {
  admin,
  json,
  ok,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

// Um órgão com seis atendimentos encerrados, de seis contatos: com mais de cinco, a aba
// Histórico da ficha oferece abrir o histórico inteiro do órgão.
async function seedOrganizationHistory(baseURL: string) {
  const { sector, agent } = await seedSector(baseURL)
  const { id } = unique()
  const names = ['Rita', 'Bruno', 'Carla', 'Davi', 'Elisa', 'Fábio'].map((name) => `${name} ${id}`)
  const phones = names.map((_, i) => `55${String(21 + i)}${id}`)
  const [organization] = await seedDirectory(
    baseURL,
    [{ name: `Prefeitura ${id}` }],
    names.map((name, i) => ({ name, phone: phones[i], organization: 0, sector: sector.id })),
  )

  const api = await request.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  ok(await api.post(`/api/sectors/${sector.id}/connection`))
  ok(await api.post(`/api/test/messaging/sectors/${sector.id}/pair`))
  const module = await json<{ id: number }>(
    await api.post(`/api/sectors/${sector.id}/modules`, { data: { name: 'Folha' } }),
  )
  for (const [i, phone] of phones.entries()) {
    ok(
      await api.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: { externalMessageId: `E2E-${id}-${i}`, phone, contactName: 'Contato', body: 'Oi' },
      }),
    )
  }
  await api.dispose()

  const agentApi = await request.newContext({ baseURL })
  ok(await agentApi.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const tickets = await json<{ id: number; contact: { name: string } }[]>(
    await agentApi.get(`/api/sectors/${sector.id}/tickets`),
  )
  expect(tickets).toHaveLength(names.length)
  for (const ticket of tickets) {
    ok(await agentApi.post(`/api/tickets/${ticket.id}/assign`))
    ok(
      await agentApi.post(`/api/tickets/${ticket.id}/close`, {
        data: {
          subject: 'Contracheque',
          resolution: 'Enviada a segunda via.',
          moduleIds: [module.id],
          organizationId: organization.id,
        },
      }),
    )
  }
  await agentApi.dispose()
  const ticketOf = (name: string) => tickets.find((ticket) => ticket.contact.name === name)!.id
  return {
    agent,
    id,
    rita: names[0],
    bruno: names[1],
    ritaTicket: ticketOf(names[0]),
    brunoTicket: ticketOf(names[1]),
  }
}

// Retorno encadeado corrigido na PR #176: histórico → chamado → outro histórico → outro
// chamado, e o "Voltar ao histórico" leva passo a passo até o histórico de origem.
test('voltar ao histórico, com um histórico aberto dentro de outro, chega à origem', async ({
  page,
  baseURL,
}) => {
  const { agent, id, rita, bruno, ritaTicket, brunoTicket } = await seedOrganizationHistory(
    baseURL!,
  )
  await signIn(page, agent, userPassword)
  const history = page.getByRole('dialog', { name: 'Histórico' })
  const back = page.getByRole('link', { name: 'Voltar ao histórico' })

  // 1. Histórico do contato, aberto em Contatos.
  await page.goto(`/contatos?busca=${encodeURIComponent(rita)}`)
  await page.getByRole('button', { name: `Histórico de ${rita}` }).click()
  await expect(history).toContainText(rita)
  await expect(page).toHaveURL(/\/contatos\?.*historico=contact/)
  const origin = page.url()

  // 2. Chamado da Rita, aberto pelo histórico.
  await history.getByRole('link').first().click()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ritaTicket}$`))
  await expect(back).toBeVisible()

  // 3. Outro histórico, o do órgão, aberto na ficha do chamado.
  await page.getByRole('tab', { name: 'Histórico' }).click()
  await page.getByRole('button', { name: 'Ver os 6 chamados' }).click()
  await expect(history).toContainText(`Prefeitura ${id}`)
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ritaTicket}\\?.*historico=organization`))
  const organizationHistory = page.url()

  // 4. Chamado do Bruno, aberto pelo histórico do órgão.
  await history.getByRole('row').filter({ hasText: bruno }).getByRole('link').click()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${brunoTicket}$`))
  await expect(back).toBeVisible()

  // 5. Voltar ao histórico: o do órgão, na ficha da Rita.
  await back.click()
  await expect(page).toHaveURL(organizationHistory)
  await expect(history).toContainText(`Prefeitura ${id}`)

  // 6. Fechar esse histórico não perde o caminho: o voltar ainda leva ao histórico de origem.
  await page.keyboard.press('Escape')
  await expect(history).toBeHidden()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${ritaTicket}$`))
  await back.click()
  await expect(page).toHaveURL(origin)
  await expect(history).toContainText(rita)
})
