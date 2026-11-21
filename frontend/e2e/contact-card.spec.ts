import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword, openQueued } from './fixtures'

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

// Até a fatia da tela (spec #312), o contato recebido é gravado com os cartões, mas a conversa e a
// última mensagem da lista continuam como antes: "Tipo de mensagem não suportado".
test('contato recebido continua aparecendo como não suportado até a tela do cartão', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, sector.id)
  await phone(request, sector.id, 'pair')
  const { phone: number, id } = unique()
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${id}`,
    phone: number,
    contactName: 'Clara Cliente',
    type: 'contact',
    contactCards: [
      {
        name: 'João Silva',
        organization: 'Prefeitura de Itu',
        phones: [{ phone: '5511977776666', whatsAppId: '5511977776666' }],
      },
    ],
  })

  await signIn(page, agent, userPassword)
  await expect(page.getByText('Tipo de mensagem não suportado')).toBeVisible()
  await openQueued(page, 'Clara Cliente')

  const received = page
    .getByRole('region', { name: 'Conversa', exact: true })
    .getByRole('listitem', { name: 'Mensagem recebida' })
  await expect(received).toHaveCount(1)
  await expect(received).toContainText('Tipo de mensagem não suportado')
  await expect(received).not.toContainText('João Silva')
})
