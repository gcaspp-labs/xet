import {
  type ElementHandle,
  expect,
  type Locator,
  type Page,
  type WebSocketRoute,
} from '@playwright/test'
import { admin, seedSector, signIn, test, unique, userPassword } from './fixtures'

// Altura da janela na tela Chamados: a página não rola, só as listas e o histórico. As medidas
// usam papéis, nomes acessíveis e posições, nunca nomes de classes CSS.

type Ticket = { id: number; status: string; contact: { name: string } }

async function receive(page: Page, sectorId: number, phone: string, name: string, body: string) {
  const response = await page.request.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
    data: {
      externalMessageId: `E2E-${unique().id}-${Math.random()}`,
      phone,
      contactName: name,
      body,
    },
  })
  expect(response.ok()).toBeTruthy()
}

// Muitos chamados na fila e em atendimento, e um chamado com histórico longo.
async function seedBusySector(page: Page, sectorId: number) {
  const { id } = unique()
  for (let i = 0; i < 14; i++) {
    await receive(
      page,
      sectorId,
      `5511${id}${i.toString().padStart(2, '0')}`,
      `Cliente ${id} ${i}`,
      'Olá',
    )
  }
  const long = `5511${id}99`
  for (let i = 0; i < 40; i++) {
    await receive(page, sectorId, long, `Cliente longo ${id}`, `Mensagem número ${i} do histórico`)
  }
  const list = await page.request.get(`/api/sectors/${sectorId}/tickets`)
  const tickets = (await list.json()) as Ticket[]
  // Assume 14 dos chamados (o longo entre eles); o resto fica na fila.
  const own = tickets.filter((ticket) => ticket.contact.name !== `Cliente ${id} 13`).slice(0, 14)
  for (const ticket of own) {
    const assigned = await page.request.post(`/api/tickets/${ticket.id}/assign`)
    expect(assigned.ok()).toBeTruthy()
  }
  const longTicket = tickets.find((ticket) => ticket.contact.name === `Cliente longo ${id}`)!
  return { longTicketId: longTicket.id }
}

async function pageScrolls(page: Page) {
  return page.evaluate(
    () =>
      Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) >
      window.innerHeight,
  )
}

async function expectInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()!
  expect(box).not.toBeNull()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
}

// A área que rola é o elemento mais próximo (ele mesmo ou um ancestral) com rolagem vertical pelo
// estilo calculado, sem depender de nomes de classes.
async function scrollerOf(locator: Locator) {
  const handle = await locator.evaluateHandle((element) => {
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

// A área em volta de `inside` rola sozinha: tem conteúdo além do espaço e o último item é
// alcançável sem deslocar a página.
async function expectScrollsAlone(page: Page, inside: Locator, last: Locator) {
  const scroller = await scrollerOf(inside)
  const overflows = await scroller.evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  )
  expect(overflows).toBe(true)
  await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
  const box = (await scroller.boundingBox())!
  const lastBox = (await last.boundingBox())!
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(box.y + box.height + 1)
  expect(await pageScrolls(page)).toBe(false)
}

// Enche a fila do setor com chamados além da altura da janela.
async function seedLongQueue(page: Page, sectorId: number) {
  const { id } = unique()
  for (let i = 0; i < 16; i++) {
    await receive(
      page,
      sectorId,
      `5511${id}${i.toString().padStart(2, '0')}`,
      `Fila ${id} ${i}`,
      'Olá',
    )
  }
}

async function prepare(page: Page, baseURL: string, who: 'agent' | 'admin' = 'agent') {
  const { sector, agent } = await seedSector(baseURL)
  await signIn(
    page,
    who === 'agent' ? agent : admin.email,
    who === 'agent' ? userPassword : admin.password,
  )
  const { longTicketId } = await seedBusySector(page, sector.id)
  return { sector, longTicketId }
}

test.describe('desktop 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('com conversa aberta e cabeçalho em várias linhas, só as listas e o histórico rolam', async ({
    page,
    baseURL,
  }) => {
    const { longTicketId } = await prepare(page, baseURL!, 'admin')
    await page.goto(`/chamados/${longTicketId}`)
    const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
    await expect(conversation).toContainText('Mensagem número 39 do histórico')
    const header = page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::header[1]')
    // O cabeçalho da página ocupa mais de uma linha e mesmo assim nada passa da janela.
    expect((await header.boundingBox())!.height).toBeGreaterThan(100)
    expect(await pageScrolls(page)).toBe(false)
    await expectInViewport(page, page.getByRole('textbox', { name: 'Mensagem' }))

    const mine = page.getByRole('navigation', { name: 'Meus chamados' })
    await expect(mine.getByRole('link').nth(13)).toBeVisible()
    await expectScrollsAlone(page, mine, mine.getByRole('link').last())
    const history = conversation.getByRole('list')
    await expectScrollsAlone(page, history, history.getByRole('listitem').last())
    expect(await pageScrolls(page)).toBe(false)
    await expectInViewport(page, page.getByRole('textbox', { name: 'Mensagem' }))
  })

  test('sem conversa, a página não rola e Meus chamados rola sozinha', async ({
    page,
    baseURL,
  }) => {
    await prepare(page, baseURL!, 'admin')
    await page.goto('/chamados')
    const mine = page.getByRole('navigation', { name: 'Meus chamados' })
    await expect(mine.getByRole('link').nth(13)).toBeVisible()
    expect(await pageScrolls(page)).toBe(false)
    await expectScrollsAlone(page, mine, mine.getByRole('link').last())
    await expect(page.getByText('Selecione um atendimento')).toBeVisible()
    // Com um bloco por coluna, o estado vazio não aponta lado nenhum.
    await expect(page.getByText(/esquerda|direita/)).toHaveCount(0)
  })

  test('a fila rola sozinha quando tem muitos chamados', async ({ page, baseURL }) => {
    const { sector, agent } = await seedSector(baseURL!)
    await signIn(page, agent, userPassword)
    await seedLongQueue(page, sector.id)
    await page.goto('/chamados')
    const queue = page.getByRole('region', { name: 'Fila e assuntos' })
    const buttons = queue.getByRole('button', { name: /^Assumir chamado de/ })
    await expect(buttons.first()).toBeVisible()
    expect(await pageScrolls(page)).toBe(false)
    await expectScrollsAlone(page, buttons.first(), buttons.last())
  })
})

test.describe('1024×768', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('Conversa e Fila ocupam a altura da janela e rolam sozinhas', async ({ page, baseURL }) => {
    const { longTicketId } = await prepare(page, baseURL!)
    await page.goto(`/chamados/${longTicketId}`)
    const selector = page.getByRole('tablist', { name: 'Mostrar' })
    await expect(selector.getByRole('tab', { name: 'Conversa' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
    await expect(conversation).toContainText('Mensagem número 39 do histórico')
    expect(await pageScrolls(page)).toBe(false)
    await expectInViewport(page, page.getByRole('textbox', { name: 'Mensagem' }))
    const history = conversation.getByRole('list')
    await expectScrollsAlone(page, history, history.getByRole('listitem').last())

    await selector.getByRole('tab', { name: /^Fila/ }).click()
    const queue = page.getByRole('region', { name: 'Fila e assuntos' })
    await expect(queue).toBeVisible()
    await expect(conversation).toBeHidden()
    expect(await pageScrolls(page)).toBe(false)
  })

  test('a Fila com muitos chamados rola sozinha e o último item é alcançável', async ({
    page,
    baseURL,
  }) => {
    const { sector, agent } = await seedSector(baseURL!)
    await signIn(page, agent, userPassword)
    await seedLongQueue(page, sector.id)
    await page.goto('/chamados')
    const selector = page.getByRole('tablist', { name: 'Mostrar' })
    await selector.getByRole('tab', { name: /^Fila/ }).click()
    const queue = page.getByRole('region', { name: 'Fila e assuntos' })
    const buttons = queue.getByRole('button', { name: /^Assumir chamado de/ })
    await expect(buttons).toHaveCount(16)
    expect(await pageScrolls(page)).toBe(false)
    await expectScrollsAlone(page, buttons.first(), buttons.last())
    await expect(buttons.last()).toBeInViewport()
  })
})

test.describe('conexão em tempo real interrompida', () => {
  // Derruba o WebSocket e mantém a API: depois da primeira conexão, cada nova tentativa fecha
  // logo. O aviso de reconexão ocupa altura acima da tela Chamados.
  async function dropRealtime(page: Page) {
    const sockets: WebSocketRoute[] = []
    let dropped = false
    await page.routeWebSocket(/\/api\/ws$/, (ws) => {
      if (dropped) {
        void ws.close({ code: 1006 })
        return
      }
      sockets.push(ws)
      ws.connectToServer()
    })
    return async () => {
      dropped = true
      await expect.poll(() => sockets.length).toBeGreaterThan(0)
      await sockets[sockets.length - 1].close({ code: 1006 })
    }
  }

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    test(`com o aviso, a página não rola e o campo Mensagem fica na janela em ${viewport.width}×${viewport.height}`, async ({
      page,
      baseURL,
    }) => {
      await page.setViewportSize(viewport)
      const drop = await dropRealtime(page)
      const { longTicketId } = await prepare(page, baseURL!)
      await page.goto(`/chamados/${longTicketId}`)
      const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
      await expect(conversation).toContainText('Mensagem número 39 do histórico')
      await drop()
      const note = page
        .getByRole('alert')
        .filter({ hasText: 'Atualização em tempo real interrompida.' })
      await expect(note).toBeVisible()
      await expect.poll(() => pageScrolls(page)).toBe(false)
      await expectInViewport(page, page.getByRole('textbox', { name: 'Mensagem' }))
      const history = conversation.getByRole('list')
      await expectScrollsAlone(page, history, history.getByRole('listitem').last())
    })
  }
})

test.describe('celular 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Conversa e Meus cabem na janela; o menu lateral aberto não faz a página rolar', async ({
    page,
    baseURL,
  }) => {
    const { longTicketId } = await prepare(page, baseURL!)
    await page.goto(`/chamados/${longTicketId}`)
    const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
    await expect(conversation).toContainText('Mensagem número 39 do histórico')
    expect(await pageScrolls(page)).toBe(false)
    await expectInViewport(page, page.getByRole('textbox', { name: 'Mensagem' }))
    // A barra do topo continua visível.
    await expectInViewport(
      page,
      page.getByRole('banner').first().getByRole('button', { name: 'Abrir menu' }),
    )

    const selector = page.getByRole('tablist', { name: 'Mostrar' })
    await selector.getByRole('tab', { name: /^Meus/ }).click()
    const mine = page.getByRole('navigation', { name: 'Meus chamados' })
    await expect(mine.getByRole('link')).toHaveCount(14)
    expect(await pageScrolls(page)).toBe(false)
    await expectScrollsAlone(page, mine, mine.getByRole('link').last())

    await selector.getByRole('tab', { name: 'Conversa' }).click()
    await page.getByRole('banner').first().getByRole('button', { name: 'Abrir menu' }).click()
    await expect(page.getByRole('link', { name: 'Chamados', exact: true })).toBeVisible()
    expect(await pageScrolls(page)).toBe(false)
    await page.keyboard.press('Escape')
    await expect(conversation).toBeVisible()
    await expectInViewport(page, page.getByRole('textbox', { name: 'Mensagem' }))
  })

  test('sem chamado, o seletor começa em Meus e mostra um bloco por vez', async ({
    page,
    baseURL,
  }) => {
    const { agent } = await seedSector(baseURL!)
    await signIn(page, agent, userPassword)
    await page.goto('/chamados')
    // Sem chamado aberto o bloco inicial é Meus.
    const selector = page.getByRole('tablist', { name: 'Mostrar' })
    await expect(selector.getByRole('tab', { name: /^Meus/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByRole('region', { name: 'Fila e assuntos' })).toBeHidden()
    await expect(page.getByText('Você não tem atendimentos ativos.')).toBeVisible()
    // O estado vazio fica em Conversa e, com um bloco só na tela, não aponta lado nenhum.
    await selector.getByRole('tab', { name: 'Conversa' }).click()
    await expect(page.getByText('Sem atendimentos disponíveis')).toBeVisible()
    await expect(page.getByText('Assuma um chamado na Fila.')).toBeVisible()
    await expect(page.getByText(/esquerda|direita/)).toHaveCount(0)
  })
})

test.describe('seletor abaixo de xl com chamados', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('abrir um chamado de Meus e assumir da Fila levam para Conversa', async ({
    page,
    baseURL,
  }) => {
    const { sector, agent } = await seedSector(baseURL!)
    await signIn(page, agent, userPassword)
    const { id } = unique()
    await receive(page, sector.id, `5511${id}01`, `Primeiro ${id}`, 'Primeira')
    await receive(page, sector.id, `5511${id}02`, `Segundo ${id}`, 'Segunda')
    await page.goto('/chamados')
    const selector = page.getByRole('tablist', { name: 'Mostrar' })
    await expect(selector.getByRole('tab', { name: /^Fila \(2\)/ })).toBeVisible()
    await selector.getByRole('tab', { name: /^Fila/ }).click()
    const queue = page.getByRole('region', { name: 'Fila e assuntos' })
    const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
    await expect(queue).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Meus chamados' })).toHaveCount(0)
    await expect(conversation).toHaveCount(0)

    await page.getByRole('button', { name: `Assumir chamado de Primeiro ${id}` }).click()
    await expect(page).toHaveURL(/\/chamados\/\d+$/)
    await expect(selector.getByRole('tab', { name: 'Conversa' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(conversation).toContainText('Primeira')
    await expect(queue).toBeHidden()

    await selector.getByRole('tab', { name: /^Fila/ }).click()
    await page.getByRole('button', { name: `Assumir chamado de Segundo ${id}` }).click()
    await expect(conversation).toContainText('Segunda')

    await selector.getByRole('tab', { name: /^Meus \(2\)/ }).click()
    const mine = page.getByRole('navigation', { name: 'Meus chamados' })
    await expect(mine).toBeVisible()
    await expect(conversation).toBeHidden()
    // O chamado já aberto também leva para Conversa.
    await mine.getByRole('link', { name: /Segundo/ }).click()
    await expect(selector.getByRole('tab', { name: 'Conversa' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await selector.getByRole('tab', { name: /^Meus/ }).click()
    await mine.getByRole('link', { name: /Primeiro/ }).click()
    await expect(conversation).toContainText('Primeira')
    await expect(mine).toBeHidden()
  })
})
