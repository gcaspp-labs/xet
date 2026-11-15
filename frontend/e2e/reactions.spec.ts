import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test'
import { admin, json, queuedTicketId, seedSector, signIn, unique, userPassword } from './fixtures'

type Reactions = {
  customer: { emoji: string; at: string } | null
  sector: { emoji: string; at: string; by: unknown; viaPhone: boolean } | null
}
type ApiMessage = { id: number; body: string | null; reactions: Reactions }

async function connectSector(baseURL: string, sectorId: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sectorId}/connection`)).ok()).toBeTruthy()
  await api.dispose()
}

async function phone(request: APIRequestContext, sectorId: number, action: string, data?: object) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, {
    data,
  })
  expect(response.ok()).toBeTruthy()
}

// Jornada mínima da reação recebida, sem conferir o visual (a exibição é de outra tarefa): a
// reação chega pela API de mensagens do chamado, troca, some quando removida, e sobrevive a
// recarregar a página.
test('reação do cliente e do celular do setor chegam pela API e continuam depois de recarregar', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { phone: number, id } = unique()
  const messageId = `E2E-REACT-${id}`
  await phone(request, sector.id, 'receive', {
    externalMessageId: messageId,
    phone: number,
    contactName: 'Clara Cliente',
    body: 'Bom dia, preciso de ajuda',
  })

  await signIn(page, agent, userPassword)
  const ticketId = await queuedTicketId(page, 'Clara Cliente')
  const reactions = async () => {
    const messages = await json<ApiMessage[]>(
      await page.request.get(`/api/tickets/${ticketId}/messages`),
    )
    const message = messages.find((m) => m.body === 'Bom dia, preciso de ajuda')
    expect(message).toBeTruthy()
    return message!.reactions
  }
  const react = (emoji: string, fromSectorPhone = false) =>
    phone(request, sector.id, 'react', {
      targetExternalMessageId: messageId,
      phone: number,
      emoji,
      fromSectorPhone,
    })

  expect(await reactions()).toEqual({ customer: null, sector: null })

  await react('👍')
  await expect.poll(async () => (await reactions()).customer?.emoji).toBe('👍')

  // A troca substitui a anterior; a do celular do setor fica no outro lado, "pelo celular".
  await react('❤️')
  await react('🙏', true)
  await expect.poll(async () => (await reactions()).customer?.emoji).toBe('❤️')
  const both = await reactions()
  expect(both.sector).toMatchObject({ emoji: '🙏', viaPhone: true, by: null })

  await page.reload()
  const afterReload = await reactions()
  expect(afterReload.customer?.emoji).toBe('❤️')
  expect(afterReload.sector?.emoji).toBe('🙏')

  // Reação vazia remove só o lado do cliente.
  await react('')
  await expect.poll(async () => (await reactions()).customer).toBeNull()
  expect((await reactions()).sector?.emoji).toBe('🙏')

  // Nada foi gravado como mensagem: continua uma só, e o chamado é o mesmo.
  const messages = await json<ApiMessage[]>(
    await page.request.get(`/api/tickets/${ticketId}/messages`),
  )
  expect(messages).toHaveLength(1)
})
