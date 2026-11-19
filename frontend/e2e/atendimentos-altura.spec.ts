import { type ElementHandle, expect, type Locator, type Page } from '@playwright/test'
import { seedSector, signIn, test, unique, userPassword } from './fixtures'

// Altura da janela na tela Atendimentos: a página não rola, só a lista (e a conversa na ficha).
// As medidas usam papéis, nomes acessíveis e posições, nunca nomes de classes CSS.

type Ticket = { id: number; contact: { name: string } }

const PAGE_SIZE = 20
const CLOSED = PAGE_SIZE + 3

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

// Mais chamados encerrados do que cabem numa página da lista, e um deles com histórico longo.
async function seedClosed(page: Page, sectorId: number) {
  const { id } = unique()
  for (let i = 0; i < CLOSED - 1; i++) {
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
  expect(tickets).toHaveLength(CLOSED)
  for (const ticket of tickets) {
    const assigned = await page.request.post(`/api/tickets/${ticket.id}/assign`)
    expect(assigned.ok()).toBeTruthy()
    const cancelled = await page.request.post(`/api/tickets/${ticket.id}/cancel`, {
      data: { reason: 'Engano.' },
    })
    expect(cancelled.ok()).toBeTruthy()
  }
  const longTicket = tickets.find((ticket) => ticket.contact.name === `Cliente longo ${id}`)!
  return { longTicketId: longTicket.id }
}

async function prepare(page: Page, baseURL: string) {
  const { sector, agent } = await seedSector(baseURL)
  await signIn(page, agent, userPassword)
  return seedClosed(page, sector.id)
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

async function chooseTextSize(page: Page, name: 'Padrão' | 'Grande' | 'Maior') {
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole('menuitemradio', { name }).click()
  await page.keyboard.press('Escape')
}

// A lista com a página fixa: a lista rola dentro do painel e a paginação, a busca e os filtros
// continuam à vista.
async function expectListFixed(page: Page) {
  const rows = page.getByRole('table').locator('tbody').getByRole('row')
  await expect(rows).toHaveCount(PAGE_SIZE)
  const pagination = page.getByRole('navigation', { name: 'Paginação' })
  await expect(pagination).toBeVisible()
  expect(await pageScrolls(page)).toBe(false)
  await expectInViewport(page, pagination)
  await expectInViewport(page, page.getByRole('searchbox', { name: 'Buscar chamados' }))
  await expectScrollsAlone(page, rows.first(), rows.last())
  // Rolar a lista não esconde a paginação nem o cabeçalho da tabela.
  await expectInViewport(page, pagination)
  await expectInViewport(page, page.getByRole('columnheader', { name: /Protocolo/ }))
}

test.describe('desktop 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('a página não rola, a lista rola no painel e a paginação continua funcionando', async ({
    page,
    baseURL,
  }) => {
    await prepare(page, baseURL!)
    await page.goto('/atendimentos')
    await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
    await expectListFixed(page)

    await page.getByRole('button', { name: 'Página 2' }).click()
    const rows = page.getByRole('table').locator('tbody').getByRole('row')
    await expect(rows).toHaveCount(CLOSED - PAGE_SIZE)
    expect(await pageScrolls(page)).toBe(false)
    await expectInViewport(page, page.getByRole('navigation', { name: 'Paginação' }))
  })

  test('a ficha do atendimento não rola a página; a conversa rola no painel', async ({
    page,
    baseURL,
  }) => {
    const { longTicketId } = await prepare(page, baseURL!)
    await page.goto(`/atendimentos/${longTicketId}`)
    const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
    await expect(conversation).toContainText('Mensagem número 39 do histórico')
    expect(await pageScrolls(page)).toBe(false)
    const history = conversation.getByRole('list')
    await expectScrollsAlone(page, history, history.getByRole('listitem').last())
    await expectInViewport(page, page.getByRole('region', { name: 'Atendimento', exact: true }))
  })
})

test.describe('tamanhos de texto', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('em Grande e Maior a página continua sem rolar e a lista rola no painel', async ({
    page,
    baseURL,
  }) => {
    await prepare(page, baseURL!)
    await page.goto('/atendimentos')
    await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
    for (const size of ['Grande', 'Maior'] as const) {
      await chooseTextSize(page, size)
      await expectListFixed(page)
    }
    await chooseTextSize(page, 'Padrão')
  })
})

test.describe('celular 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  // O tamanho vem do armazenamento: no celular o menu de Configurações fica dentro da barra lateral.
  for (const size of ['', 'large', 'larger']) {
    test(`a página não rola e a lista rola no painel, com o texto ${size || 'padrão'}`, async ({
      page,
      baseURL,
    }) => {
      if (size) {
        await page.addInitScript((value) => localStorage.setItem('text-size', value), size)
      }
      await prepare(page, baseURL!)
      await page.goto('/atendimentos')
      await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()
      const rows = page.getByRole('table').locator('tbody').getByRole('row')
      await expect(rows).toHaveCount(PAGE_SIZE)
      expect(await pageScrolls(page)).toBe(false)
      await expectInViewport(
        page,
        page.getByRole('banner').first().getByRole('button', { name: 'Abrir menu' }),
      )
      // Com os filtros altos, a área abaixo do cabeçalho rola; a página, nunca. A paginação é
      // alcançável sem deslocar a página.
      const pagination = page.getByRole('navigation', { name: 'Paginação' })
      await pagination.scrollIntoViewIfNeeded()
      await expectInViewport(page, pagination)
      expect(await pageScrolls(page)).toBe(false)
    })
  }

  test('a ficha cabe na janela e a conversa rola no painel', async ({ page, baseURL }) => {
    const { longTicketId } = await prepare(page, baseURL!)
    await page.goto(`/atendimentos/${longTicketId}`)
    const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
    await expect(conversation).toContainText('Mensagem número 39 do histórico')
    expect(await pageScrolls(page)).toBe(false)
    const history = conversation.getByRole('list')
    await expectScrollsAlone(page, history, history.getByRole('listitem').last())
  })
})
