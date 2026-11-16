import {
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test'
import { admin, json, queuedTicketId, seedSector, signIn, unique, userPassword } from './fixtures'

type Quote = { messageId: number | null; type: string | null; text: string | null }
type ApiMessage = { id: number; body: string | null; quote: Quote | null }

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

async function simulateMessaging(
  request: APIRequestContext,
  sectorId: number,
  action: string,
  data?: object,
) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, {
    data,
  })
  expect(response.ok()).toBeTruthy()
}

const listMessages = async (page: Page, ticketId: number) =>
  json<ApiMessage[]>(await page.request.get(`/api/tickets/${ticketId}/messages`))

// A citação recebida chega pela rota de teste do adaptador falso, sai na API de mensagens do
// chamado nos três casos do provedor (com trecho, só com o identificador e sem citação) e continua
// depois de recarregar a página. Sem tela nesta tarefa: não confere o visual.
test('citação recebida do cliente chega pela API e continua depois de recarregar', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await simulateMessaging(request, sector.id, 'pair')
  const { phone, id } = unique()
  const receive = (externalMessageId: string, body: string, quote?: object) =>
    simulateMessaging(request, sector.id, 'receive', {
      externalMessageId,
      phone,
      contactName: 'Clara Cita',
      body,
      quote,
    })

  const first = `E2E-QUOTE-${id}-1`
  await receive(first, 'Qual o prazo da nota?')
  // Cita a mensagem do chamado, com o trecho do WhatsApp.
  await receive(`E2E-QUOTE-${id}-2`, 'Isso mesmo', {
    externalMessageId: first,
    snippet: { text: 'Qual o prazo da nota?' },
  })
  // Cita um arquivo que o XET não tem: tipo e nome, sem ligação.
  await receive(`E2E-QUOTE-${id}-3`, 'E este?', {
    externalMessageId: `ANTES-DO-XET-${id}`,
    snippet: { type: 'document', text: 'contrato.pdf' },
  })
  // Só o identificador, de mensagem que o XET não tem.
  await receive(`E2E-QUOTE-${id}-4`, 'Oi?', { externalMessageId: `SEM-TRECHO-${id}` })

  await signIn(page, agent, userPassword)
  const ticketId = await queuedTicketId(page, 'Clara Cita')

  const quotes = async () => {
    const messages = await listMessages(page, ticketId)
    const firstId = messages.find((m) => m.body === 'Qual o prazo da nota?')?.id
    return {
      firstId,
      byBody: Object.fromEntries(messages.map((m) => [m.body, m.quote])),
    }
  }
  const expectQuotes = async () => {
    const { firstId, byBody } = await quotes()
    expect(firstId).toBeTruthy()
    expect(byBody).toEqual({
      'Qual o prazo da nota?': null,
      'Isso mesmo': { messageId: firstId, type: 'text', text: 'Qual o prazo da nota?' },
      'E este?': { messageId: null, type: 'document', text: 'contrato.pdf' },
      'Oi?': { messageId: null, type: null, text: null },
    })
  }

  await expectQuotes()
  await page.reload()
  await expectQuotes()
})
