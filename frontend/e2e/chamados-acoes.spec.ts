import { expect, request as apiRequest, type Locator, type Page } from '@playwright/test'
import {
  admin,
  clearSession,
  seedDirectory,
  seedSector,
  signIn,
  test,
  unique,
  userPassword,
} from './fixtures'

// Ações do cabeçalho de Chamados: a principal fica visível (Assumir na fila, Encerrar em
// atendimento) e o resto vai no menu "Mais ações" (⋯), com Cancelar chamado em vermelho no fim,
// depois de um divisor. As medidas e as conferências usam papéis e nomes acessíveis.

type Ticket = { id: number; contact: { name: string } }

// Recebe uma mensagem e devolve o chamado na fila; opcionalmente já o assume como `assignee`.
async function seedTicket(
  baseURL: string,
  sectorId: number,
  assignee?: { email: string; password?: string },
): Promise<Ticket & { name: string }> {
  const { id, phone } = unique()
  const name = `Cliente ${id}`
  const api = await apiRequest.newContext({ baseURL })
  const received = await api.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
    data: { externalMessageId: `E2E-${id}`, phone, contactName: name, body: 'Olá' },
  })
  expect(received.ok()).toBeTruthy()
  const login = await api.post('/api/auth/login', {
    data: {
      email: assignee?.email ?? admin.email,
      password: assignee ? (assignee.password ?? userPassword) : admin.password,
    },
  })
  expect(login.ok()).toBeTruthy()
  const list = await api.get(`/api/sectors/${sectorId}/tickets`)
  const ticket = ((await list.json()) as Ticket[]).find((item) => item.contact.name === name)!
  if (assignee) expect((await api.post(`/api/tickets/${ticket.id}/assign`)).ok()).toBeTruthy()
  await api.dispose()
  return { ...ticket, name }
}

async function openMenu(page: Page) {
  await page.getByRole('button', { name: 'Mais ações' }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  return menu
}

const itemNames = (menu: Locator) => menu.getByRole('menuitem').allTextContents()

async function expectNoOldActions(page: Page) {
  await expect(page.getByRole('link', { name: 'Ver chamado' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Corrigir' })).toHaveCount(0)
}

test('responsável vê Encerrar e o ⋯ com as ações, e Cancelar chamado fica no fim, separado e em vermelho', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const ticket = await seedTicket(baseURL!, sector.id, { email: agent })
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticket.id}`)
  await expect(page.getByRole('heading', { name: ticket.name })).toBeVisible()

  await expect(page.getByRole('button', { name: 'Encerrar', exact: true })).toBeVisible()
  // As ações movidas para o ⋯ não ficam mais soltas no cabeçalho.
  for (const name of ['Devolver à fila', 'Transferir', 'Outro setor', 'Cancelar chamado']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
  await expectNoOldActions(page)

  const menu = await openMenu(page)
  expect(await itemNames(menu)).toEqual([
    'Devolver à fila',
    'Colocar como pendente',
    'Transferir',
    'Outro setor',
    'Cancelar chamado',
  ])
  // Um divisor só, entre Outro setor e Cancelar chamado.
  const separator = menu.getByRole('separator')
  await expect(separator).toHaveCount(1)
  const [before, line, after] = await Promise.all([
    menu.getByRole('menuitem', { name: 'Outro setor' }).boundingBox(),
    separator.boundingBox(),
    menu.getByRole('menuitem', { name: 'Cancelar chamado' }).boundingBox(),
  ])
  expect(line!.y).toBeGreaterThanOrEqual(before!.y + before!.height - 1)
  expect(after!.y).toBeGreaterThanOrEqual(line!.y)
  // Cancelar chamado é o único item em vermelho.
  const colorOf = (name: string) =>
    menu.getByRole('menuitem', { name }).evaluate((element) => getComputedStyle(element).color)
  const cancelColor = await colorOf('Cancelar chamado')
  // A cor esperada é a do token destrutivo (--danger), resolvida pelo navegador em rgb(...).
  const dangerColor = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.color = 'var(--danger)'
    document.body.appendChild(probe)
    const resolved = getComputedStyle(probe).color
    probe.remove()
    return resolved
  })
  expect(dangerColor).toMatch(/^rgb\(/)
  expect(cancelColor).toBe(dangerColor)
  expect(await colorOf('Transferir')).not.toBe(cancelColor)
  expect(await colorOf('Devolver à fila')).not.toBe(cancelColor)

  // Escolher um item abre a janela existente, que mantém o bloqueio.
  await menu.getByRole('menuitem', { name: 'Cancelar chamado' }).click()
  await expect(page.getByRole('dialog', { name: 'Cancelar chamado' })).toBeVisible()
})

test('supervisor em chamado de outra pessoa não vê Encerrar nem Outro setor', async ({
  page,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const ticket = await seedTicket(baseURL!, sector.id, { email: agent })
  await signIn(page, supervisor, userPassword)
  await page.goto(`/chamados/${ticket.id}`)
  await expect(page.getByRole('heading', { name: ticket.name })).toBeVisible()

  await expect(page.getByRole('button', { name: 'Encerrar', exact: true })).toHaveCount(0)
  await expectNoOldActions(page)
  const menu = await openMenu(page)
  expect(await itemNames(menu)).toEqual(['Devolver à fila', 'Transferir', 'Cancelar chamado'])
  await expect(menu.getByRole('separator')).toHaveCount(1)
})

test('atendente em chamado de outra pessoa não vê ações nem o ⋯', async ({ page, baseURL }) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const ticket = await seedTicket(baseURL!, sector.id, { email: supervisor })
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticket.id}`)
  await expect(page.getByRole('heading', { name: ticket.name })).toBeVisible()

  for (const name of ['Encerrar', 'Mais ações', 'Assumir']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
  await expectNoOldActions(page)
})

test('na fila, Assumir fica visível e Cancelar chamado fica no ⋯', async ({ page, baseURL }) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const ticket = await seedTicket(baseURL!, sector.id)
  await signIn(page, agent, userPassword)
  await page.goto(`/chamados/${ticket.id}`)
  await expect(page.getByRole('heading', { name: ticket.name })).toBeVisible()

  await expect(page.getByRole('button', { name: 'Assumir', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Encerrar', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cancelar chamado', exact: true })).toHaveCount(0)
  await expectNoOldActions(page)
  const menu = await openMenu(page)
  expect(await itemNames(menu)).toEqual(['Cancelar chamado'])
  // Com um só item, não há o que separar.
  await expect(menu.getByRole('separator')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // A supervisão vê o mesmo na fila.
  await page.context().clearCookies()
  await signIn(page, supervisor, userPassword)
  await page.goto(`/chamados/${ticket.id}`)
  await expect(page.getByRole('button', { name: 'Assumir', exact: true })).toBeVisible()
  expect(await itemNames(await openMenu(page))).toEqual(['Cancelar chamado'])
})

test('o "+" de Meus chamados abre Novo chamado, e o botão do topo saiu', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const name = `Contato ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name, phone, organization: 0, sector: sector.id }],
  )
  await signIn(page, agent, userPassword)
  await page.goto('/chamados')
  // Um só elemento com o nome "Novo chamado" na tela, e ele está em Meus chamados, não no topo.
  const open = page.getByRole('button', { name: 'Novo chamado', exact: true })
  await expect(open).toHaveCount(1)
  const mine = page.getByRole('region', { name: /^Meus chamados/ })
  await expect(mine.getByRole('button', { name: 'Novo chamado', exact: true })).toBeVisible()
  await expect(page.getByRole('banner').getByRole('button', { name: 'Novo chamado' })).toHaveCount(
    0,
  )

  // Cancelar a janela deixa a tela como estava.
  await open.click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado', exact: true })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Cancelar' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/\/chamados$/)

  // Criar abre o chamado em /chamados/:id.
  await open.click()
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(name)
  await sheet.getByRole('button', { name: new RegExp(name) }).click()
  await sheet.getByRole('textbox', { name: 'Mensagem' }).fill('Primeira mensagem')
  await sheet.getByRole('button', { name: 'Enviar' }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Primeira mensagem',
  )
  await expect(mine.getByRole('link', { name: new RegExp(name) })).toBeVisible()
})

test.describe('desktop 1440×900', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  // As ações do cabeçalho cabem em uma linha: cerca de 72 px sem chamado aberto, e cerca de 90 px
  // com ele, por causa da linha do telefone do cliente abaixo do nome (#239); com o seletor Setor do
  // administrador a altura é a mesma, porque o texto à esquerda é mais alto que o seletor. Sem
  // altura fixa: a medida é a do conteúdo.
  const headerOf = (page: Page) =>
    page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::header[1]')

  test('o cabeçalho cabe em uma linha, com e sem chamado aberto', async ({ page, baseURL }) => {
    const { sector, agent } = await seedSector(baseURL!)
    const ticket = await seedTicket(baseURL!, sector.id, { email: agent })
    await signIn(page, agent, userPassword)
    for (const [path, min, max] of [
      ['/chamados', 68, 76],
      [`/chamados/${ticket.id}`, 84, 94],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      const height = (await headerOf(page).boundingBox())!.height
      expect(height).toBeGreaterThanOrEqual(min)
      expect(height).toBeLessThanOrEqual(max)
    }
  })

  test('para o administrador, com o seletor Setor, o cabeçalho cabe em uma linha', async ({
    page,
    baseURL,
  }) => {
    const { sector } = await seedSector(baseURL!)
    const ticket = await seedTicket(baseURL!, sector.id, {
      email: admin.email,
      password: admin.password,
    })
    await signIn(page, admin.email, admin.password)
    await page.goto(`/chamados/${ticket.id}`)
    await expect(page.getByRole('heading', { name: ticket.name })).toBeVisible()
    await expect(page.getByLabel('Setor')).toBeVisible()
    const height = (await headerOf(page).boundingBox())!.height
    expect(height).toBeGreaterThanOrEqual(84)
    expect(height).toBeLessThanOrEqual(94)
  })
})

// Seletor de setor do administrador (#222): na mesma linha do Encerrar, com "Setor: <nome>" dentro
// dele e sem rótulo acima. As medidas usam papéis, nomes acessíveis e posições.
test.describe('seletor de setor do administrador', () => {
  const centerY = async (locator: Locator) => {
    const box = (await locator.boundingBox())!
    return box.y + box.height / 2
  }
  const headerOf = (page: Page) =>
    page.getByRole('heading', { level: 1 }).locator('xpath=ancestor::header[1]')

  test.describe('desktop 1440×900', () => {
    test.use({ viewport: { width: 1440, height: 900 } })

    test('alinha com o Encerrar e mostra o setor dentro do seletor', async ({ page, baseURL }) => {
      const { sector } = await seedSector(baseURL!)
      const ticket = await seedTicket(baseURL!, sector.id, {
        email: admin.email,
        password: admin.password,
      })
      await signIn(page, admin.email, admin.password)
      await page.goto(`/chamados/${ticket.id}`)
      await expect(page.getByRole('heading', { name: ticket.name })).toBeVisible()

      const picker = page.getByRole('combobox', { name: 'Setor' })
      await expect(picker).toBeVisible()
      // O administrador é compartilhado entre testes: escolhe o setor do teste para conferir o texto.
      await picker.click()
      await page.getByRole('option', { name: sector.name }).click()
      await expect(picker).toContainText(`Setor:${sector.name}`)
      // Sem rótulo "Setor" separado acima do seletor.
      await expect(page.locator('label', { hasText: /^Setor$/ })).toHaveCount(0)

      const close = page.getByRole('button', { name: 'Encerrar', exact: true })
      await expect(close).toBeVisible()
      expect(Math.abs((await centerY(picker)) - (await centerY(close)))).toBeLessThanOrEqual(1)
      const height = (await headerOf(page).boundingBox())!.height
      expect(height).toBeGreaterThanOrEqual(84)
      expect(height).toBeLessThanOrEqual(94)
    })

    test('sem chamado aberto o seletor fica centralizado no cabeçalho', async ({
      page,
      baseURL,
    }) => {
      await seedSector(baseURL!)
      await signIn(page, admin.email, admin.password)
      const picker = page.getByRole('combobox', { name: 'Setor' })
      await expect(picker).toBeVisible()
      await expect(picker).toContainText('Setor: ')
      const header = headerOf(page)
      const box = (await header.boundingBox())!
      expect(Math.abs((await centerY(picker)) - (box.y + box.height / 2))).toBeLessThanOrEqual(2)
    })

    test('atendente e supervisor não veem o seletor', async ({ page, baseURL }) => {
      const { sector, agent, supervisor } = await seedSector(baseURL!)
      const ticket = await seedTicket(baseURL!, sector.id, { email: agent })
      for (const email of [agent, supervisor]) {
        await clearSession(page)
        await signIn(page, email, userPassword)
        await page.goto(`/chamados/${ticket.id}`)
        await expect(page.getByRole('heading', { name: ticket.name })).toBeVisible()
        await expect(page.getByRole('combobox', { name: 'Setor' })).toHaveCount(0)
      }
    })
  })

  for (const [label, viewport, larger] of [
    ['celular 390×844', { width: 390, height: 844 }, false],
    ['texto maior em 1440×900', { width: 1440, height: 900 }, true],
  ] as const) {
    test(`sem sobreposição em ${label}`, async ({ page, baseURL }) => {
      await page.setViewportSize(viewport)
      if (larger) await page.addInitScript(() => localStorage.setItem('text-size', 'larger'))
      const { sector } = await seedSector(baseURL!)
      const ticket = await seedTicket(baseURL!, sector.id, {
        email: admin.email,
        password: admin.password,
      })
      await signIn(page, admin.email, admin.password)
      await page.goto(`/chamados/${ticket.id}`)
      await expect(page.getByRole('heading', { name: ticket.name })).toBeVisible()
      const picker = (await page.getByRole('combobox', { name: 'Setor' }).boundingBox())!
      const close = (await page
        .getByRole('button', { name: 'Encerrar', exact: true })
        .boundingBox())!
      const apart =
        picker.x + picker.width <= close.x ||
        close.x + close.width <= picker.x ||
        picker.y + picker.height <= close.y ||
        close.y + close.height <= picker.y
      expect(apart).toBe(true)
      expect(picker.x).toBeGreaterThanOrEqual(0)
      expect(picker.x + picker.width).toBeLessThanOrEqual(viewport.width)
    })
  }
})

test('o X da fila pede confirmação no item; Voltar e Esc não cancelam, e o Cancelar chamado cancela sem motivo', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const ticket = await seedTicket(baseURL!, sector.id)
  await signIn(page, agent, userPassword)
  await page.goto('/chamados')
  const queue = page.getByRole('region', { name: 'Fila e assuntos' })
  const x = queue.getByRole('button', { name: `Cancelar chamado de ${ticket.name}` })
  await expect(x).toBeVisible()

  // O X fica no fim da linha de ações, à direita do Assumir, e não junto do horário.
  const assumir = queue.getByRole('button', { name: `Assumir chamado de ${ticket.name}` })
  const xBox = (await x.boundingBox())!
  const assumirBox = (await assumir.boundingBox())!
  expect(xBox.x).toBeGreaterThanOrEqual(assumirBox.x + assumirBox.width)

  // O clique não cancela: o próprio item troca as ações pela confirmação, com o Voltar em foco.
  await x.click()
  await expect(queue).toContainText(`Cancelar o chamado de ${ticket.name}? Ele não é reaberto.`)
  await expect(queue.getByRole('button', { name: 'Voltar' })).toBeFocused()
  await expect(page.getByRole('dialog', { name: 'Cancelar chamado' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(x).toBeVisible()
  await expect(queue).not.toContainText('Ele não é reaberto.')

  // Voltar também desfaz, e o chamado continua na fila.
  await x.click()
  await queue.getByRole('button', { name: 'Voltar' }).click()
  await expect(assumir).toBeVisible()

  // "Cancelar chamado" cancela direto, sem janela e sem motivo, com o aviso, e o item sai da Fila.
  await x.click()
  await queue.getByRole('button', { name: 'Cancelar chamado', exact: true }).click()
  await expect(page.getByText('Chamado cancelado', { exact: true })).toBeVisible()
  await expect(queue.getByText(ticket.name)).toHaveCount(0)

  // Em Atendimentos o chamado aparece como Cancelado, e o registro na conversa fica sem "Motivo:".
  await page.getByRole('link', { name: 'Atendimentos', exact: true }).click()
  const row = page.getByRole('row', { name: ticket.name })
  await expect(row).toContainText('Cancelado')
  await row.getByRole('cell', { name: 'Cancelado' }).click({ force: true })
  const entry = page
    .getByRole('listitem', { name: 'Registro do chamado' })
    .filter({ hasText: 'cancelou o chamado' })
  await expect(entry).toHaveCount(1)
  await expect(entry).not.toContainText('Motivo:')
})
