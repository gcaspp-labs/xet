import { execFileSync } from 'node:child_process'
import {
  expect,
  request as apiRequest,
  type APIRequestContext,
  type Page,
  type WebSocketRoute,
} from '@playwright/test'
import {
  admin,
  clearSession,
  login,
  seedDirectory,
  seedSector,
  seedSubjects,
  signIn,
  test,
  unique,
  userPassword,
  chooseAction,
} from './fixtures'

// Mensagem de texto de um contato, simulada pelo adaptador falso do backend.
async function receiveText(
  request: APIRequestContext,
  sectorId: number,
  message: { phone: string; contactName: string; body: string },
) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
    data: { externalMessageId: `E2E-${unique().id}`, ...message },
  })
  expect(response.ok()).toBeTruthy()
}

// Fila da tela Chamados e o item de cada contato nela.
const queueOf = (page: Page) => page.getByRole('region', { name: 'Fila, assuntos e pendentes' })
const queuedItems = (page: Page, contactName: string) =>
  queueOf(page).getByRole('listitem').filter({ hasText: contactName })

// Intermedia o WebSocket do app. `drop()` fecha a conexão atual e segura as tentativas de
// reconexão, que ficam pendentes (sem abrir nem fechar) até `restore()`. Assim a queda dura o
// que o teste quiser, e o que chega nesse intervalo só alcança a tela depois da reconexão.
async function holdableRealtime(page: Page) {
  const sockets: WebSocketRoute[] = []
  let gate: Promise<void> | null = null
  let release = () => {}
  await page.routeWebSocket(/\/api\/ws$/, async (ws) => {
    if (gate) await gate
    sockets.push(ws)
    ws.connectToServer()
  })
  return {
    sockets,
    async drop() {
      gate = new Promise<void>((resolve) => (release = resolve))
      await sockets[sockets.length - 1].close({ code: 1006 })
    },
    restore() {
      release()
      gate = null
    },
  }
}

function assumeIn(page: Page, name: string) {
  return page.getByRole('button', { name: `Assumir chamado de ${name}` })
}

test('Chamados funciona no menu recolhido e no celular', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await page.getByRole('button', { name: 'Recolher menu' }).click()
  const link = page.getByRole('link', { name: 'Chamados', exact: true })
  await link.hover()
  await expect(page.locator('[data-slot="tooltip-content"]', { hasText: 'Chamados' })).toBeVisible()
  await link.click()
  await expect(link).toHaveAttribute('aria-current', 'page')
  await page.setViewportSize({ width: 390, height: 800 })
  await page.getByRole('banner').getByRole('button', { name: 'Abrir menu' }).click()
  const mobileLink = page.getByRole('link', { name: 'Chamados', exact: true })
  await expect(mobileLink).toBeVisible()
  await mobileLink.click()
  await expect(page).toHaveURL(/\/chamados$/)
})

test('menu Chamados abre a tela sem chamados', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await expect(page).toHaveURL(/\/chamados$/)
  await expect(page.getByText('Sem atendimentos disponíveis')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Fila' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Chamados', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('assumir pela fila abre o chamado e permite consultar assuntos', async ({
  page,
  request,
  baseURL,
  browser,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const received = await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
    data: {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName: 'Cliente da fila com nome bastante comprido',
      body: 'Olá',
    },
  })
  expect(received.ok()).toBeTruthy()
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page
    .getByRole('button', { name: 'Assumir chamado de Cliente da fila com nome bastante comprido' })
    .click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  const title = page.getByRole('heading', { name: 'Cliente da fila com nome bastante comprido' })
  await expect(title).toBeVisible()
  expect(await title.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText('Olá')
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  await page.getByRole('tab', { name: 'Assuntos' }).click()
  await expect(page.getByRole('searchbox', { name: 'Buscar assuntos e soluções' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver chamado' })).toHaveCount(0)
  for (const name of ['Detalhes', 'Notas', 'Histórico', 'Falou com']) {
    await expect(page.getByRole('tab', { name })).toHaveCount(0)
  }
  await expect(page.getByRole('link', { name: 'Chamados', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const other = await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
    data: {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName: 'Outro cliente',
      body: 'Preciso de ajuda',
    },
  })
  expect(other.ok()).toBeTruthy()
  await expect(page.getByRole('tab', { name: 'Fila, 1 a assumir' })).toContainText('1')
  const otherContext = await browser.newContext()
  const otherPage = await otherContext.newPage()
  await signIn(otherPage, supervisor, userPassword)
  await otherPage.goto(page.url())
  await expect(otherPage.getByRole('tab', { name: 'Assuntos' })).toHaveCount(0)
  await expect(otherPage.getByRole('button', { name: 'Encerrar' })).toHaveCount(0)
  await otherPage.getByRole('link', { name: 'Chamados', exact: true }).click()
  await otherPage.getByRole('button', { name: 'Assumir chamado de Outro cliente' }).click()
  await expect(page.getByRole('tab', { name: 'Fila', exact: true })).toHaveText('Fila')
  await otherContext.close()
  await chooseAction(page, 'Devolver à fila')
  await expect(page.getByRole('dialog', { name: 'Devolver à fila' })).toContainText(
    'mensagens e histórico continuam no chamado.',
  )
  await page
    .getByRole('dialog', { name: 'Devolver à fila' })
    .getByRole('button', { name: 'Devolver à fila' })
    .click()
  await expect(page).toHaveURL(/\/chamados$/)
  await expect(page.getByText('Sem atendimentos disponíveis')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Fila, 1 a assumir' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
})

test('segunda mensagem de chamado ainda na fila atualiza a prévia nas duas sessões e mantém um só item', async ({
  page,
  request,
  baseURL,
  browser,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  for (const session of [page, other]) {
    await expect(queueOf(session).getByText('Nenhum chamado esperando.')).toBeVisible()
  }

  const { phone } = unique()
  await receiveText(request, sector.id, { phone, contactName: 'Maria Cliente', body: 'Bom dia' })
  const [ticket] = (await (await page.request.get(`/api/sectors/${sector.id}/tickets`)).json()) as {
    protocol: string
  }[]
  expect(ticket.protocol).toMatch(/^\d{4}-\d{6}$/)
  for (const session of [page, other]) {
    const item = queuedItems(session, 'Maria Cliente')
    await expect(item).toContainText('Bom dia')
    // A linha mostra o protocolo do chamado.
    await expect(item).toContainText(ticket.protocol)
    await expect(item).toHaveCount(1)
  }

  // Nova mensagem do mesmo contato: a prévia muda nas duas telas, e continua um único item.
  await receiveText(request, sector.id, {
    phone,
    contactName: 'Maria Cliente',
    body: 'Preciso de ajuda',
  })
  for (const session of [page, other]) {
    const item = queuedItems(session, 'Maria Cliente')
    await expect(item).toContainText('Preciso de ajuda')
    await expect(item).not.toContainText('Bom dia')
    await expect(item).toContainText(ticket.protocol)
    await expect(item).toHaveCount(1)
    await expect(queueOf(session).getByRole('listitem')).toHaveCount(1)
    await expect(session.getByRole('tab', { name: 'Fila, 1 a assumir' })).toBeVisible()
  }
  await otherContext.close()
})

test('queda do tempo real: o aviso aparece, e ao reconectar some e a fila mostra o chamado recebido na queda', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const realtime = await holdableRealtime(page)
  await signIn(page, agent, userPassword)
  const note = page
    .getByRole('alert')
    .filter({ hasText: 'Atualização em tempo real interrompida.' })
  await expect(queueOf(page).getByText('Nenhum chamado esperando.')).toBeVisible()
  await expect.poll(() => realtime.sockets.length).toBeGreaterThan(0)
  await expect(note).toBeHidden()
  const opened = realtime.sockets.length

  // Queda: o aviso aparece e continua, porque a reconexão fica pendente. A mensagem que chega
  // nesse intervalo não alcança a tela.
  await realtime.drop()
  await expect(note).toBeVisible()
  await receiveText(request, sector.id, {
    phone: unique().phone,
    contactName: 'Contato na queda',
    body: 'Olá',
  })
  await expect(queuedItems(page, 'Contato na queda')).toHaveCount(0)
  await expect(note).toBeVisible()

  // Reconexão: o aviso some e a fila recarrega, com o chamado recebido durante a queda.
  realtime.restore()
  await expect.poll(() => realtime.sockets.length, { timeout: 15_000 }).toBeGreaterThan(opened)
  await expect(note).toBeHidden()
  const item = queuedItems(page, 'Contato na queda')
  await expect(item).toHaveCount(1)
  await expect(item).toContainText('Olá')
})

test('lista só atendimentos próprios, ordena pela atividade e permite alternar', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const receive = async (name: string, phone: string, body: string) => {
    expect(
      (
        await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
          data: { externalMessageId: `E2E-${unique().id}`, phone, contactName: name, body },
        })
      ).ok(),
    ).toBeTruthy()
  }
  const first = unique().phone
  await receive('Primeiro cliente', first, 'Mensagem inicial')
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page.getByRole('button', { name: 'Assumir chamado de Primeiro cliente' }).click()
  await receive('Segundo cliente', unique().phone, 'Segunda mensagem')
  await page.getByRole('button', { name: 'Assumir chamado de Segundo cliente' }).click()
  const mine = page.getByRole('navigation', { name: 'Meus chamados' })
  await expect(mine.getByRole('link')).toHaveCount(2)
  await expect(mine.getByRole('link').first()).toContainText('Segundo cliente')
  await expect(mine.getByRole('link').first()).toHaveAttribute('aria-current', 'page')
  await receive('Primeiro cliente', first, 'Nova atividade')
  await expect(mine.getByRole('link').first()).toContainText('Primeiro cliente')
  await expect(mine.getByRole('link').first()).toContainText('Nova atividade')
  await page.getByRole('tab', { name: 'Assuntos' }).click()
  await mine.getByRole('link', { name: /Primeiro cliente/ }).click()
  await expect(page.getByRole('tab', { name: /Fila/ })).toHaveAttribute('aria-selected', 'true')
  await expect(mine.getByRole('link').first()).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Nova atividade',
  )
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await expect(page.getByText('Selecione um atendimento')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Assuntos' })).toHaveCount(0)
  await page.context().clearCookies()
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await expect(page.getByText('Você não tem atendimentos ativos.')).toBeVisible()
})

test('cancelar na tela Chamados retorna ao estado sem chamado aberto', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${unique().id}`,
          phone: unique().phone,
          contactName: 'Cliente cancelado',
          body: 'Olá',
        },
      })
    ).ok(),
  ).toBeTruthy()
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page.getByRole('button', { name: 'Assumir chamado de Cliente cancelado' }).click()
  await chooseAction(page, 'Cancelar chamado')
  const dialog = page.getByRole('dialog', { name: 'Cancelar chamado' })
  await dialog.getByLabel('Motivo').fill('Atendimento iniciado por engano')
  await dialog.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expect(page).toHaveURL(/\/chamados$/)
  await expect(page.getByText('Sem atendimentos disponíveis')).toBeVisible()
})

test('supervisor e administrador assumem na fila dos setores permitidos', async ({
  page,
  request,
  baseURL,
  browser,
}) => {
  const first = await seedSector(baseURL!)
  const second = await seedSector(baseURL!)
  for (const [sector, name] of [
    [first.sector, 'Cliente do setor'],
    [second.sector, 'Cliente de outro setor'],
  ] as const) {
    expect(
      (
        await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
          data: {
            externalMessageId: `E2E-${unique().id}`,
            phone: unique().phone,
            contactName: name,
            body: 'Olá',
          },
        })
      ).ok(),
    ).toBeTruthy()
  }
  await signIn(page, first.supervisor, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Assumir chamado de Cliente de outro setor' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Assumir chamado de Cliente do setor' }).click()
  await expect(page.getByRole('navigation', { name: 'Meus chamados' })).toContainText(
    'Cliente do setor',
  )
  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await signIn(adminPage, admin.email, admin.password)
  // O administrador é um só para todos os testes: seus chamados ativos de outros testes não
  // dizem nada sobre este, então a tela vazia não é conferida; o chamado assumido é.
  await adminPage.getByRole('button', { name: 'Assumir chamado de Cliente de outro setor' }).click()
  await expect(adminPage.getByRole('navigation', { name: 'Meus chamados' })).toContainText(
    'Cliente de outro setor',
  )
  await adminContext.close()
})

test('disputa na fila mostra aviso e remove o chamado já assumido', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${unique().id}`,
          phone: unique().phone,
          contactName: 'Cliente disputado',
          body: 'Olá',
        },
      })
    ).ok(),
  ).toBeTruthy()
  const context = await browser.newContext()
  const other = await context.newPage()
  await other.routeWebSocket(/\/api\/ws$/, () => {})
  await signIn(other, supervisor, userPassword)
  await other.getByRole('link', { name: 'Chamados', exact: true }).click()
  const contested = other.getByRole('button', { name: 'Assumir chamado de Cliente disputado' })
  await expect(contested).toBeVisible()
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page.getByRole('button', { name: 'Assumir chamado de Cliente disputado' }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await contested.click()
  await expect(
    other
      .getByRole('alert')
      .filter({ hasText: 'Este chamado já foi assumido por outro atendente.' }),
  ).toBeVisible()
  await expect(contested).toHaveCount(0)
  await context.close()
})

for (const action of ['Encerrar', 'Outro setor', 'Transferir'] as const) {
  test(`${action} na tela Chamados volta à lista sem chamado aberto`, async ({
    page,
    request,
    baseURL,
  }) => {
    const origin = await seedSector(baseURL!)
    const destination = await seedSector(baseURL!)
    const api = await apiRequest.newContext({ baseURL })
    expect(
      (
        await api.post('/api/auth/login', {
          data: { email: admin.email, password: admin.password },
        })
      ).ok(),
    ).toBeTruthy()
    for (const sector of [origin.sector, destination.sector]) {
      expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
      expect((await api.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
    }
    expect(
      (
        await api.post(`/api/sectors/${origin.sector.id}/modules`, { data: { name: 'Folha' } })
      ).ok(),
    ).toBeTruthy()
    await api.dispose()
    const { id, phone } = unique()
    const contact = `Cliente ${id}`
    await seedDirectory(
      baseURL!,
      [{ name: `Prefeitura ${id}` }],
      [{ name: contact, phone, organization: 0, sector: origin.sector.id }],
    )
    expect(
      (
        await request.post(`/api/test/messaging/sectors/${origin.sector.id}/receive`, {
          data: { externalMessageId: `E2E-${id}`, phone, contactName: contact, body: 'Olá' },
        })
      ).ok(),
    ).toBeTruthy()
    await signIn(page, origin.agent, userPassword)
    await page.getByRole('link', { name: 'Chamados', exact: true }).click()
    await page.getByRole('button', { name: `Assumir chamado de ${contact}` }).click()
    if (action === 'Encerrar') await page.getByRole('button', { name: action, exact: true }).click()
    else await chooseAction(page, action)
    if (action === 'Transferir') {
      const sheet = page.getByRole('dialog', { name: 'Transferir chamado' })
      await sheet.getByRole('combobox', { name: 'Transferir para' }).click()
      await page.getByRole('option', { name: /^supervisor .* · Supervisor/ }).click()
      await sheet.getByRole('button', { name: 'Transferir' }).click()
    } else {
      const sheet = page.getByRole('dialog', {
        name: action === 'Encerrar' ? 'Encerrar chamado' : 'Transferir para outro setor',
      })
      if (action === 'Outro setor') {
        // Sem formulário: só o setor de destino.
        await sheet.getByLabel('Setor de destino').click()
        await page.getByRole('option', { name: destination.sector.name }).click()
        await sheet.getByRole('button', { name: 'Transferir' }).click()
      } else {
        await sheet.getByLabel('Assunto').fill('Folha de março')
        await sheet.getByLabel('Resolução').fill('Solicitação atendida.')
        await sheet.getByRole('checkbox', { name: 'Folha' }).click()
        await sheet.getByRole('button', { name: 'Encerrar' }).click()
        await sheet.getByRole('button', { name: 'Não adicionar' }).click()
      }
    }
    await expect(page).toHaveURL(/\/chamados$/)
    await expect(page.getByText('Sem atendimentos disponíveis')).toBeVisible()
  })
}

test('fila do administrador ignora setores inativos e preserva os demais perfis', async ({
  page,
  request,
  baseURL,
  browser,
}) => {
  const active = await seedSector(baseURL!)
  const inactive = await seedSector(baseURL!)
  const receive = async (sectorId: number, name: string) =>
    expect(
      (
        await request.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
          data: {
            externalMessageId: `E2E-${unique().id}`,
            phone: unique().phone,
            contactName: name,
            body: 'Olá',
          },
        })
      ).ok(),
    ).toBeTruthy()
  const ownName = `Cliente próprio ${unique().id}`
  const inactiveName = `Cliente do setor inativo ${unique().id}`
  const activeName = `Cliente do setor ativo ${unique().id}`
  await receive(inactive.sector.id, ownName)
  await receive(inactive.sector.id, inactiveName)
  await receive(active.sector.id, activeName)

  // Quem atende no setor inativo assume antes de ele ser desativado: o chamado próprio segue na lista.
  await signIn(page, inactive.agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page.getByRole('button', { name: `Assumir chamado de ${ownName}` }).click()
  await expect(page.getByRole('navigation', { name: 'Meus chamados' })).toContainText(ownName)
  await clearSession(page)

  // A API não desativa setores; usa o banco isolado criado por make test-e2e.
  expect(Number.isSafeInteger(inactive.sector.id)).toBeTruthy()
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
    `UPDATE sectors SET active = false WHERE id = ${inactive.sector.id}`,
  ])

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await signIn(adminPage, admin.email, admin.password)
  await adminPage.getByRole('link', { name: 'Chamados', exact: true }).click()
  await expect(assumeIn(adminPage, activeName)).toBeVisible()
  await expect(assumeIn(adminPage, inactiveName)).toHaveCount(0)
  // O contador do administrador não conta o chamado do setor inativo: a aba mostra só os ativos
  // (o banco é compartilhado, então confere a contagem pelo que a lista exibe).
  const queue = adminPage.getByRole('tab', { name: /^Fila/ })
  // Outros testes mexem na fila em paralelo: compara de novo até a aba e a lista concordarem.
  await expect
    .poll(async () => {
      const shown = await adminPage.getByRole('button', { name: /^Assumir chamado de/ }).count()
      return shown > 0 && (await queue.getAttribute('aria-label')) === `Fila, ${shown} a assumir`
    })
    .toBe(true)

  // Atendente do setor inativo mantém a fila e a lista própria como hoje.
  await clearSession(page)
  await signIn(page, inactive.agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await expect(page.getByRole('navigation', { name: 'Meus chamados' })).toContainText(ownName)
  await expect(assumeIn(page, inactiveName)).toBeVisible()
  await adminContext.close()
})

test('a busca de Assuntos é lembrada por chamado e a Fila abre ao trocar', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await seedSubjects(baseURL!, sector.id, {
    Férias: ['Regra de férias do setor'],
    Ponto: ['Regra do ponto eletrônico'],
  })
  for (const name of ['Cliente A', 'Cliente B']) {
    expect(
      (
        await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
          data: {
            externalMessageId: `E2E-${unique().id}`,
            phone: unique().phone,
            contactName: name,
            body: 'Preciso de ajuda',
          },
        })
      ).ok(),
    ).toBeTruthy()
  }
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  const mine = page.getByRole('navigation', { name: 'Meus chamados' })
  const search = page.getByRole('searchbox', { name: 'Buscar assuntos e soluções' })
  const vacation = page.getByText('Regra de férias do setor')
  const timeclock = page.getByText('Regra do ponto eletrônico')
  const fila = page.getByRole('tab', { name: /Fila/ })
  const openSubjects = () => page.getByRole('tab', { name: 'Assuntos' }).click()

  await assumeIn(page, 'Cliente A').click()
  await expect(mine.getByRole('link', { name: /Cliente A/ })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await openSubjects()
  await search.fill('ferias')
  await expect(vacation).toBeVisible()
  await expect(timeclock).toHaveCount(0)

  // B ainda não visitado: busca vazia, sem vazar a de A.
  await fila.click()
  await assumeIn(page, 'Cliente B').click()
  await expect(mine.getByRole('link', { name: /Cliente B/ })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(fila).toHaveAttribute('aria-selected', 'true')
  await openSubjects()
  await expect(search).toHaveValue('')
  await expect(vacation).toBeVisible()
  await expect(timeclock).toBeVisible()
  await search.fill('ponto')
  await expect(timeclock).toBeVisible()
  await expect(vacation).toHaveCount(0)

  // De volta a A: Fila por padrão, e a busca de A restaurada ao abrir Assuntos.
  await mine.getByRole('link', { name: /Cliente A/ }).click()
  await expect(fila).toHaveAttribute('aria-selected', 'true')
  await openSubjects()
  await expect(search).toHaveValue('ferias')
  await expect(vacation).toBeVisible()
  await expect(timeclock).toHaveCount(0)

  // E B mantém a própria.
  await mine.getByRole('link', { name: /Cliente B/ }).click()
  await expect(fila).toHaveAttribute('aria-selected', 'true')
  await openSubjects()
  await expect(search).toHaveValue('ponto')

  // Recarregar apaga as buscas.
  await page.reload()
  await expect(fila).toHaveAttribute('aria-selected', 'true')
  await openSubjects()
  await expect(search).toHaveValue('')
  await search.fill('ponto')
  await mine.getByRole('link', { name: /Cliente A/ }).click()
  await openSubjects()
  await expect(search).toHaveValue('')

  // Sair do sistema também apaga: a mesma pessoa entra de novo e a busca começa vazia.
  await mine.getByRole('link', { name: /Cliente B/ }).click()
  await openSubjects()
  await expect(search).toHaveValue('ponto')
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitem', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await login(page, agent, userPassword)
  await expect(page).not.toHaveURL(/\/login$/)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await mine.getByRole('link', { name: /Cliente B/ }).click()
  await openSubjects()
  await expect(search).toHaveValue('')
})
