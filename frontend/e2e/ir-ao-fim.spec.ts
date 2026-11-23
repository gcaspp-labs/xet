import {
  type ElementHandle,
  expect,
  request as apiRequest,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test'
import {
  admin,
  json,
  ok,
  openQueued,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

// Botão de ir à última mensagem na tela Chamados, com o contador de mensagens novas (regra 44 de
// conversation.md). As conferências usam papéis, nomes acessíveis e a posição da rolagem, nunca
// nomes de classes.

type Ticket = { id: number; status: string; contact: { name: string } }

async function messaging(
  request: APIRequestContext,
  sectorId: number,
  action: string,
  data?: object,
) {
  ok(await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, { data }))
}

// A área que rola da conversa: o ancestral mais próximo com rolagem vertical.
async function scrollerOf(inside: Locator) {
  const handle = await inside.evaluateHandle((element) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const overflow = getComputedStyle(node).overflowY
      if (overflow === 'auto' || overflow === 'scroll') return node
    }
    return null
  })
  const element = handle.asElement()
  expect(element).not.toBeNull()
  return element as ElementHandle<HTMLElement>
}

const position = (scroller: ElementHandle<HTMLElement>) =>
  scroller.evaluate((element) => ({
    top: element.scrollTop,
    distance: element.scrollHeight - element.scrollTop - element.clientHeight,
  }))

const goToEndButton = (page: Page) =>
  page.getByRole('button', { name: /^Ir para a última mensagem/ })

// Setor com o número ligado e um chamado com conversa longa, aberto e assumido pelo atendente.
async function openLongChat(
  page: Page,
  request: APIRequestContext,
  baseURL: string,
  contactName = 'Cliente Rola',
  count = 30,
) {
  const seed = await seedSector(baseURL)
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  ok(await api.post(`/api/sectors/${seed.sector.id}/connection`))
  await api.dispose()
  await messaging(request, seed.sector.id, 'pair')
  const { phone, id } = unique()
  const receive = (n: number, body = `Mensagem ${n} da conversa`) =>
    messaging(request, seed.sector.id, 'receive', {
      externalMessageId: `E2E-SCROLL-${id}-${n}-${Math.random()}`,
      phone,
      contactName,
      body,
    })
  for (let i = 1; i <= count; i++) await receive(i)
  await signIn(page, seed.agent, userPassword)
  await openQueued(page, contactName)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation.getByText(`Mensagem ${count} da conversa`)).toBeVisible()
  return {
    ...seed,
    phone,
    contactName,
    receive,
    conversation,
    scroller: await scrollerOf(conversation.getByRole('listitem').first()),
  }
}

test('com a conversa no fim não há botão; rolada para cima, ela não desce sozinha e conta as novas', async ({
  page,
  request,
  baseURL,
}) => {
  const { receive, conversation, scroller } = await openLongChat(
    page,
    request,
    baseURL!,
    'Cliente Conta',
  )

  // No fim, como hoje: sem botão.
  await expect(goToEndButton(page)).toHaveCount(0)
  await expect.poll(async () => (await position(scroller)).distance).toBeLessThanOrEqual(48)

  // Rolada para cima, o botão aparece e a leitura fica onde está.
  await scroller.evaluate((element) => element.scrollTo({ top: 0 }))
  await expect(
    page.getByRole('button', { name: 'Ir para a última mensagem', exact: true }),
  ).toBeVisible()
  expect((await position(scroller)).top).toBe(0)

  // Mensagem do cliente: não desce e aparece como 1 nova; a do celular do setor conta como 2.
  await receive(31, 'Chegou depois')
  await expect(
    page.getByRole('button', { name: 'Ir para a última mensagem, 1 nova', exact: true }),
  ).toBeVisible()
  expect((await position(scroller)).top).toBe(0)

  // Clique: desce até a última mensagem, e o botão some com o contador.
  await page.getByRole('button', { name: 'Ir para a última mensagem, 1 nova' }).click()
  await expect(goToEndButton(page)).toHaveCount(0)
  await expect(conversation.getByText('Chegou depois')).toBeVisible()
  await expect.poll(async () => (await position(scroller)).distance).toBeLessThanOrEqual(48)

  // Fora do fim de novo, a próxima conta 1; rolar à mão até o fim zera e esconde o botão.
  await scroller.evaluate((element) => element.scrollTo({ top: 0 }))
  await receive(32, 'Mais uma')
  await expect(
    page.getByRole('button', { name: 'Ir para a última mensagem, 1 nova', exact: true }),
  ).toBeVisible()
  await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
  await expect(goToEndButton(page)).toHaveCount(0)
})

test('no fim, a mensagem recebida desce sozinha; enviada pelo compositor, desce e zera o contador', async ({
  page,
  request,
  baseURL,
}) => {
  const { receive, conversation, scroller } = await openLongChat(
    page,
    request,
    baseURL!,
    'Cliente Desce',
  )

  // No fim, a conversa continua descendo sozinha.
  await receive(31, 'Desce sozinha')
  await expect(conversation.getByText('Desce sozinha')).toBeVisible()
  await expect(goToEndButton(page)).toHaveCount(0)

  // Rolada para cima, enviar pelo compositor leva ao fim e zera o contador.
  await scroller.evaluate((element) => element.scrollTo({ top: 0 }))
  await expect(goToEndButton(page)).toBeVisible()
  const message = page.getByRole('textbox', { name: 'Mensagem' })
  await message.fill('Enviada daqui')
  await message.press('Enter')
  await expect(conversation.getByText('Enviada daqui')).toBeVisible()
  await expect(goToEndButton(page)).toHaveCount(0)
  await expect.poll(async () => (await position(scroller)).distance).toBeLessThanOrEqual(48)
  await expect(message).toHaveValue('')
})

test('aviso do sistema, reação, edição e exclusão não contam nem puxam a conversa', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, phone, receive, scroller } = await openLongChat(
    page,
    request,
    baseURL!,
    'Cliente Quieto',
  )
  await scroller.evaluate((element) => element.scrollTo({ top: 0 }))
  await expect(goToEndButton(page)).toBeVisible()
  const top = (await position(scroller)).top

  // Reação, edição e exclusão de mensagens que já estavam na tela: nada conta.
  const target = `E2E-QUIETO-${unique().id}`
  await messaging(request, sector.id, 'receive', {
    externalMessageId: target,
    phone,
    contactName: 'Cliente Quieto',
    body: 'Mensagem 31 da conversa',
  })
  await expect(
    page.getByRole('button', { name: 'Ir para a última mensagem, 1 nova', exact: true }),
  ).toBeVisible()
  await messaging(request, sector.id, 'react', {
    targetExternalMessageId: target,
    phone,
    emoji: '👍',
    fromSectorPhone: true,
  })
  await messaging(request, sector.id, 'edit', {
    targetExternalMessageId: target,
    phone,
    fromSector: true,
    body: 'Mensagem 31 da conversa, editada',
  })
  await messaging(request, sector.id, 'revoke', {
    targetExternalMessageId: target,
    phone,
    fromSector: true,
  })

  // Aviso do sistema (devolver à fila e assumir de novo): não conta nem desce.
  const tickets = await json<Ticket[]>(await page.request.get(`/api/sectors/${sector.id}/tickets`))
  const ticket = tickets.find((item) => item.status === 'in_progress')!
  ok(await page.request.post(`/api/tickets/${ticket.id}/return`))
  ok(await page.request.post(`/api/tickets/${ticket.id}/assign`))
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()

  await expect(goToEndButton(page)).toHaveAccessibleName('Ir para a última mensagem, 1 nova')
  expect((await position(scroller)).top).toBe(top)
  await receive(32, 'Só agora conta')
  await expect(
    page.getByRole('button', { name: 'Ir para a última mensagem, 2 novas', exact: true }),
  ).toBeVisible()
})

test('abrir outro chamado abre no fim, sem botão e sem contador herdado', async ({
  page,
  request,
  baseURL,
}) => {
  const first = await openLongChat(page, request, baseURL!, 'Cliente Primeiro', 30)
  const firstUrl = page.url()
  await first.scroller.evaluate((element) => element.scrollTo({ top: 0 }))
  await expect(goToEndButton(page)).toBeVisible()

  // Outro chamado do mesmo setor, já assumido.
  await messaging(request, first.sector.id, 'receive', {
    externalMessageId: `E2E-SCROLL-SECOND-${unique().id}`,
    phone: unique().phone,
    contactName: 'Cliente Segundo',
    body: 'Outra conversa',
  })
  const tickets = await json<Ticket[]>(
    await page.request.get(`/api/sectors/${first.sector.id}/tickets`),
  )
  const second = tickets.find((item) => item.contact.name === 'Cliente Segundo')!
  ok(await page.request.post(`/api/tickets/${second.id}/assign`))
  await page.goto(`/chamados/${second.id}`)
  const other = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(other.getByText('Outra conversa')).toBeVisible()
  await expect(goToEndButton(page)).toHaveCount(0)

  // De volta ao primeiro: no fim, sem botão e sem o contador de antes.
  await page.goto(firstUrl)
  await expect(
    page
      .getByRole('region', { name: 'Conversa', exact: true })
      .getByText('Mensagem 30 da conversa'),
  ).toBeVisible()
  await expect(goToEndButton(page)).toHaveCount(0)
})

test('o botão é alcançável pelo teclado e o Enter leva à última mensagem', async ({
  page,
  request,
  baseURL,
}) => {
  const chat = await openLongChat(page, request, baseURL!, 'Cliente Teclado', 12)
  await chat.scroller.evaluate((element) => element.scrollTo({ top: 0 }))
  const button = page.getByRole('button', { name: 'Ir para a última mensagem', exact: true })
  await expect(button).toBeVisible()

  await button.focus()
  await expect(button).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(button).toHaveCount(0)
  expect((await position(chat.scroller)).distance).toBeLessThanOrEqual(48)
})

test('Atendimentos abre no fim e não tem o botão', async ({ page, request, baseURL }) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const [organization] = await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name: `Rita ${id}`, phone, organization: 0, sector: sector.id }],
  )
  const api = await apiRequest.newContext({ baseURL })
  ok(await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  ok(await api.post(`/api/sectors/${sector.id}/connection`))
  ok(await api.post(`/api/test/messaging/sectors/${sector.id}/pair`))
  const module = await json<{ id: number }>(
    await api.post(`/api/sectors/${sector.id}/modules`, { data: { name: 'Folha' } }),
  )
  for (let i = 1; i <= 30; i++) {
    await messaging(request, sector.id, 'receive', {
      externalMessageId: `E2E-CLOSED-${id}-${i}`,
      phone,
      contactName: `Rita ${id}`,
      body: `Mensagem ${i} do atendimento`,
    })
  }
  await api.dispose()

  const agentApi = await apiRequest.newContext({ baseURL })
  ok(await agentApi.post('/api/auth/login', { data: { email: agent, password: userPassword } }))
  const [ticket] = await json<Ticket[]>(await agentApi.get(`/api/sectors/${sector.id}/tickets`))
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
  await agentApi.dispose()

  await signIn(page, agent, userPassword)
  await page.goto(`/atendimentos/${ticket.id}`)
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const last = conversation.getByText('Mensagem 30 do atendimento')
  await expect(last).toBeVisible()
  // No fim, como a tela abre hoje, e sem o botão: ele é só de Chamados.
  await expect(last).toBeInViewport()
  await expect(goToEndButton(page)).toHaveCount(0)
})
