import { expect, request as apiRequest, test } from '@playwright/test'
import {
  admin,
  clearSession,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  userPassword,
  chooseAction,
  json,
  ok,
  openQueued,
  queuedTicketId,
} from './fixtures'

// Liga os números dos setores pelo adaptador falso.
async function prepare(baseURL: string, origin: number, destination: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  for (const sectorId of [origin, destination]) {
    expect((await api.post(`/api/sectors/${sectorId}/connection`)).ok()).toBeTruthy()
    expect((await api.post(`/api/test/messaging/sectors/${sectorId}/pair`)).ok()).toBeTruthy()
  }
  await api.dispose()
}

test('transferência entre setores encerra a origem e o destino continua com o histórico', async ({
  page,
  request,
  baseURL,
}) => {
  const origin = await seedSector(baseURL!)
  const destination = await seedSector(baseURL!)
  await prepare(baseURL!, origin.sector.id, destination.sector.id)
  const { id, phone } = unique()
  const contact = `Lúcia ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name: contact, phone, organization: 0, sector: origin.sector.id }],
  )
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${origin.sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${id}`,
          phone,
          contactName: contact,
          body: 'Folha de março',
        },
      })
    ).ok(),
  ).toBeTruthy()

  // Na origem, o responsável abre "Outro setor": só o setor e o motivo, sem formulário de encerramento.
  await signIn(page, origin.agent, userPassword)
  await openQueued(page, contact)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await chooseAction(page, 'Outro setor')
  const sheet = page.getByRole('dialog', { name: 'Transferir para outro setor' })
  await expect(page.getByRole('dialog', { name: 'Encerrar chamado' })).toHaveCount(0)
  await expect(sheet.getByLabel('Assunto')).toHaveCount(0)
  await expect(sheet.getByLabel('Motivo da transferência (opcional)')).toBeVisible()
  // Sem escolher o setor, o aviso aparece no topo da janela e nada é enviado.
  let sent = false
  await page.route('**/api/tickets/*/sector-transfer', (route) => {
    sent = true
    return route.fallback()
  })
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(sheet.getByRole('alert')).toContainText('Escolha o setor de destino.')
  expect(sent).toBe(false)
  await sheet.getByLabel('Setor de destino').click()
  await page.getByRole('option', { name: destination.sector.name }).click()
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(page.getByText('Chamado transferido para outro setor')).toBeVisible()

  // Volta a Chamados sem chamado aberto; o painel mantém os realizados.
  await expect(page).toHaveURL(/\/chamados$/)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toHaveCount(0)
  await page.goto('/atendimentos')
  const doneRow = page.getByRole('row', { name: new RegExp(contact) })
  await expect(doneRow).toContainText('Transferido')
  await expect(doneRow).toContainText(`para ${destination.sector.name}`)
  await expect(doneRow).toContainText(origin.agent.replace(/^agent\.(\d+)@.*$/, 'agent $1'))

  // A origem fica encerrada e mostra para onde foi.
  await doneRow.getByRole('cell', { name: 'Transferido' }).click({ force: true })
  const details = page.getByRole('region', { name: 'Atendimento', exact: true })
  await expect(details).toContainText('Encerrado')
  await expect(details).toContainText('Destino · chamado novo neste setor')
  await expect(page.getByRole('status', { name: 'Só leitura' })).toContainText(
    `Transferido para ${destination.sector.name}`,
  )
  await expect(details).toContainText(destination.sector.name)
  const originName = origin.agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(
    conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
      hasText: `${originName} transferiu o chamado para o setor ${destination.sector.name}`,
    }),
  ).toBeVisible()
  await clearSession(page)

  // O destino recebe o chamado na fila, com a origem e a conversa anterior.
  await signIn(page, destination.agent, userPassword)
  await openQueued(page, contact)
  await expect(conversation).toContainText(
    `Transferido de ${origin.sector.name}. Assuma o chamado e envie a primeira mensagem ao cliente.`,
  )
  const destinationUrl = page.url()
  // O chamado anterior (da origem) abre em Atendimentos, só para leitura.
  const destinationTicket = await page.request.get(
    `/api/tickets/${destinationUrl.split('/').pop()}`,
  )
  const { previous: link } = (await destinationTicket.json()) as { previous: { id: number } }
  await page.goto(`/atendimentos/${link.id}`)
  await expect(conversation).toContainText('Folha de março')
  await expect(page.getByRole('button', { name: 'Corrigir' })).toHaveCount(0)
  await expect(details.getByRole('tab', { name: 'Notas' })).toHaveCount(0)

  // Ao assumir, o destino escreve a primeira mensagem pelo próprio número.
  await page.goto(destinationUrl)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await page.getByRole('textbox', { name: 'Mensagem' }).fill('Olá, aqui é o setor de destino.')
  await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
  await expect(
    conversation
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .filter({ hasText: 'Olá, aqui é o setor de destino.' }),
  ).toContainText('Enviada')

  // Encerrado o chamado do destino, a ficha mostra a origem e o link leva ao chamado anterior,
  // em Atendimentos.
  const destinationId = destinationUrl.split('/').pop()
  expect(
    (
      await page.request.post(`/api/tickets/${destinationId}/cancel`, {
        data: { reason: 'Encerrado no teste.' },
      })
    ).ok(),
  ).toBeTruthy()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${destinationId}$`))
  const previous = details.getByRole('region', { name: 'Chamado anterior' })
  await expect(previous).toContainText(origin.sector.name)
  await expect(previous).toContainText(`transferido por ${originName}`)
  await previous.getByRole('link', { name: 'Ver chamado anterior' }).click()
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${link.id}$`))
  await expect(conversation).toContainText('Folha de março')
})

// Transferência sem formulário, pela rota nova, com e sem motivo: o quadro de origem e os avisos
// da conversa nos dois chamados.
for (const withReason of [true, false]) {
  test(`transferência sem formulário ${withReason ? 'com' : 'sem'} motivo aparece no quadro de origem e nos avisos`, async ({
    page,
    request,
    baseURL,
  }) => {
    const origin = await seedSector(baseURL!)
    const destination = await seedSector(baseURL!)
    await prepare(baseURL!, origin.sector.id, destination.sector.id)
    const { id, phone } = unique()
    const contact = `Marta ${id}`
    await seedDirectory(
      baseURL!,
      [{ name: `Prefeitura ${id}` }],
      [{ name: contact, phone, organization: 0, sector: origin.sector.id }],
    )
    ok(
      await request.post(`/api/test/messaging/sectors/${origin.sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${id}`,
          phone,
          contactName: contact,
          body: 'Férias de julho',
        },
      }),
    )
    const reason = 'Quem cuida de férias é o RH.'
    const originName = origin.agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')

    // A origem assume e transfere pela rota nova, sem formulário.
    await signIn(page, origin.agent, userPassword)
    const originId = await queuedTicketId(page, contact)
    ok(await page.request.post(`/api/tickets/${originId}/assign`))
    const next = await json<{ id: number; protocol: string }>(
      await page.request.post(`/api/tickets/${originId}/sector-transfer`, {
        data: withReason
          ? { sectorId: destination.sector.id, reason }
          : { sectorId: destination.sector.id },
      }),
    )

    // O aviso da origem mostra quem transferiu, para onde e o motivo, quando houver.
    await page.goto(`/atendimentos/${originId}`)
    const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
    const notice = conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
      hasText: `${originName} transferiu o chamado para o setor ${destination.sector.name}`,
    })
    await expect(notice).toBeVisible()
    if (withReason) {
      await expect(notice).toContainText(`Motivo: ${reason}`)
    } else {
      await expect(notice).not.toContainText('Motivo')
    }
    await clearSession(page)

    // O destino vê o mesmo aviso, com o setor de origem, na conversa do chamado novo na fila.
    await signIn(page, destination.agent, userPassword)
    await page.goto(`/chamados/${next.id}`)
    const arrival = conversation.getByRole('listitem', { name: 'Registro do chamado' }).filter({
      hasText: `${originName} transferiu o chamado do setor ${origin.sector.name} para o setor ${destination.sector.name}`,
    })
    await expect(arrival).toBeVisible()
    if (withReason) {
      await expect(arrival).toContainText(`Motivo: ${reason}`)
    } else {
      await expect(arrival).not.toContainText('Motivo')
    }

    // Encerrado o chamado do destino, o quadro de origem mostra setor, protocolo, quem
    // transferiu e o motivo, sem assunto nem resolução vazios.
    ok(await page.request.post(`/api/tickets/${next.id}/assign`))
    ok(await page.request.post(`/api/tickets/${next.id}/cancel`, { data: { reason: 'Teste.' } }))
    await page.goto(`/atendimentos/${next.id}`)
    const previous = page
      .getByRole('region', { name: 'Atendimento', exact: true })
      .getByRole('region', { name: 'Chamado anterior' })
    await expect(previous).toContainText(origin.sector.name)
    await expect(previous).toContainText(`transferido por ${originName}`)
    if (withReason) {
      await expect(previous).toContainText(`Motivo: ${reason}`)
    } else {
      await expect(previous).not.toContainText('Motivo')
    }
    await expect(previous).not.toContainText('Assunto:')
    await expect(previous).not.toContainText('Resolução:')
    await expect(previous.getByRole('link', { name: 'Ver chamado anterior' })).toBeVisible()
  })
}

// Um contato que ainda não foi cadastrado também transfere, e o motivo digitado na janela
// chega ao chamado de destino.
test('contato não cadastrado transfere pela janela, com motivo', async ({
  page,
  request,
  baseURL,
}) => {
  const origin = await seedSector(baseURL!)
  const destination = await seedSector(baseURL!)
  await prepare(baseURL!, origin.sector.id, destination.sector.id)
  const { id, phone } = unique()
  const contact = `Nilton ${id}`
  ok(
    await request.post(`/api/test/messaging/sectors/${origin.sector.id}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: contact, body: 'Segunda via' },
    }),
  )
  const reason = 'Segunda via de guia é com o financeiro.'
  const originName = origin.agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')

  await signIn(page, origin.agent, userPassword)
  await openQueued(page, contact)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await chooseAction(page, 'Outro setor')
  const sheet = page.getByRole('dialog', { name: 'Transferir para outro setor' })
  await expect(sheet).not.toContainText('Contato não cadastrado')
  await sheet.getByLabel('Setor de destino').click()
  await page.getByRole('option', { name: destination.sector.name }).click()
  await sheet.getByLabel('Motivo da transferência (opcional)').fill(reason)
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(page.getByText('Chamado transferido para outro setor')).toBeVisible()
  await expect(page).toHaveURL(/\/chamados$/)
  await clearSession(page)

  await signIn(page, destination.agent, userPassword)
  await openQueued(page, contact)
  await expect(
    page
      .getByRole('region', { name: 'Conversa', exact: true })
      .getByRole('listitem', { name: 'Registro do chamado' })
      .filter({ hasText: `${originName} transferiu o chamado do setor` }),
  ).toContainText(`Motivo: ${reason}`)
})

// Contato com chamado aberto no destino: o aviso do servidor aparece na janela, os campos
// continuam preenchidos e nada é encerrado.
test('recusa por chamado aberto no destino mantém a janela e os campos', async ({
  page,
  request,
  baseURL,
}) => {
  const origin = await seedSector(baseURL!)
  const destination = await seedSector(baseURL!)
  await prepare(baseURL!, origin.sector.id, destination.sector.id)
  const { id, phone } = unique()
  const contact = `Olavo ${id}`
  for (const [sectorId, body] of [
    [origin.sector.id, 'Folha de março'],
    [destination.sector.id, 'Férias'],
  ] as const) {
    ok(
      await request.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
        data: { externalMessageId: `E2E-${sectorId}-${id}`, phone, contactName: contact, body },
      }),
    )
  }

  await signIn(page, origin.agent, userPassword)
  await openQueued(page, contact)
  const ticketUrl = page.url()
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await chooseAction(page, 'Outro setor')
  const sheet = page.getByRole('dialog', { name: 'Transferir para outro setor' })
  const reason = 'Pedido de férias.'
  await sheet.getByLabel('Setor de destino').click()
  await page.getByRole('option', { name: destination.sector.name }).click()
  await sheet.getByLabel('Motivo da transferência (opcional)').fill(reason)
  await sheet.getByRole('button', { name: 'Transferir' }).click()

  await expect(sheet.getByRole('alert')).toContainText(
    'O contato já tem chamado aberto no setor de destino. Nada foi transferido.',
  )
  await expect(sheet.getByLabel('Setor de destino')).toContainText(destination.sector.name)
  await expect(sheet.getByLabel('Motivo da transferência (opcional)')).toHaveValue(reason)
  await expect(sheet.getByRole('button', { name: 'Transferir' })).toBeEnabled()
  await sheet.getByRole('button', { name: 'Cancelar' }).click()
  await expect(sheet).toHaveCount(0)
  // O chamado continua em atendimento na origem.
  await expect(page).toHaveURL(ticketUrl)
  await expect(page.getByRole('button', { name: 'Mais ações' })).toBeVisible()
})

// Enquanto envia, os campos e Transferir ficam desabilitados e Cancelar continua clicável.
test('enviando, campos e Transferir ficam desabilitados e Cancelar continua clicável', async ({
  page,
  request,
  baseURL,
}) => {
  const origin = await seedSector(baseURL!)
  const destination = await seedSector(baseURL!)
  await prepare(baseURL!, origin.sector.id, destination.sector.id)
  const { id, phone } = unique()
  const contact = `Pedro ${id}`
  ok(
    await request.post(`/api/test/messaging/sectors/${origin.sector.id}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: contact, body: 'Olá' },
    }),
  )

  await signIn(page, origin.agent, userPassword)
  await openQueued(page, contact)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await chooseAction(page, 'Outro setor')
  const sheet = page.getByRole('dialog', { name: 'Transferir para outro setor' })
  await sheet.getByLabel('Setor de destino').click()
  await page.getByRole('option', { name: destination.sector.name }).click()

  let release: () => void = () => undefined
  const gate = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/tickets/*/sector-transfer', async (route) => {
    await gate
    await route.fallback()
  })
  await sheet.getByRole('button', { name: 'Transferir' }).click()
  await expect(sheet.getByRole('button', { name: 'Transferir' })).toBeDisabled()
  await expect(sheet.getByLabel('Setor de destino')).toBeDisabled()
  await expect(sheet.getByLabel('Motivo da transferência (opcional)')).toBeDisabled()
  await expect(sheet.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
  release()
  await expect(page).toHaveURL(/\/chamados$/)
})

// Sem outro setor ativo, a janela só avisa: seletor desabilitado, sem motivo e sem Transferir.
test('sem setores disponíveis, a janela só tem o botão Fechar', async ({
  page,
  request,
  baseURL,
}) => {
  const origin = await seedSector(baseURL!)
  const { id, phone } = unique()
  const contact = `Sara ${id}`
  ok(
    await request.post(`/api/test/messaging/sectors/${origin.sector.id}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: contact, body: 'Olá' },
    }),
  )

  await signIn(page, origin.agent, userPassword)
  await openQueued(page, contact)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  // Os outros testes criam setores no mesmo banco: a lista de destinos vazia vem da resposta.
  await page.route('**/api/tickets/*/transfer-sectors', (route) => route.fulfill({ json: [] }))
  await chooseAction(page, 'Outro setor')
  const sheet = page.getByRole('dialog', { name: 'Transferir para outro setor' })
  await expect(sheet).toContainText('Não há outro setor ativo para receber o chamado.')
  await expect(sheet.getByLabel('Setor de destino')).toBeDisabled()
  await expect(sheet.getByLabel('Motivo da transferência (opcional)')).toHaveCount(0)
  await expect(sheet.getByRole('button', { name: 'Transferir' })).toHaveCount(0)
  await expect(sheet.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Fechar' }).click()
  await expect(sheet).toHaveCount(0)
})
