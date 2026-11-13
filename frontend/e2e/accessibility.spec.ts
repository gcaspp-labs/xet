import { expect, request as apiRequest, test, type Page } from '@playwright/test'
import { admin, seedSector, signIn, unique, userPassword } from './fixtures'

type Preferences = { theme?: 'light' | 'dark'; size?: 'large' | 'larger'; contrast?: boolean }

// Grava a escolha antes de abrir a página, como quem já escolheu antes.
async function prefer(page: Page, { theme, size, contrast }: Preferences) {
  await page.addInitScript(
    (stored) => {
      for (const [key, value] of Object.entries(stored)) {
        if (value) {
          localStorage.setItem(key, value)
        }
      }
    },
    { theme: theme ?? '', 'text-size': size ?? '', contrast: contrast ? 'high' : '' },
  )
}

async function connectedSector(baseURL: string) {
  const seed = await seedSector(baseURL)
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${seed.sector.id}/connection`)).ok()).toBeTruthy()
  expect((await api.post(`/api/test/messaging/sectors/${seed.sector.id}/pair`)).ok()).toBeTruthy()
  await api.dispose()
  return seed
}

// Chamado na fila do setor, com um contato de nome único.
async function receive(baseURL: string, sectorId: number) {
  const contact = `Cliente ${unique().id}`
  const api = await apiRequest.newContext({ baseURL })
  const response = await api.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
    data: {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName: contact,
      body: 'Preciso do contracheque deste mês, com urgência',
    },
  })
  expect(response.ok()).toBeTruthy()
  await api.dispose()
  return contact
}

// Abre a conversa e assume: a tela de maior densidade, com o formulário de encerramento a um clique.
async function openAssignedTicket(page: Page, contact: string) {
  await page.getByRole('link', { name: contact }).first().click()
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeVisible()
}

const fontSize = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => parseFloat(getComputedStyle(element).fontSize))

// Tamanho de fonte de cada texto visível, na ordem da tela.
const textSizes = (page: Page) =>
  page.evaluate(() => {
    const sizes: { text: string; size: number }[] = []
    for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim())
        .join('')
      if (text && element.getClientRects().length > 0 && element.tagName !== 'SCRIPT') {
        sizes.push({ text, size: parseFloat(getComputedStyle(element).fontSize) })
      }
    }
    return sizes
  })

// Mede o contraste de todo texto visível, somando as transparências até o fundo da página.
// Devolve o que ficou abaixo do mínimo e quantos textos foram medidos.
const auditContrast = (page: Page, minimum: number) =>
  page.evaluate((min) => {
    // Mede o estado final, sem pegar uma cor ou opacidade no meio da animação de abertura.
    document.getAnimations().forEach((animation) => animation.finish())
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    type Color = [number, number, number, number]
    const parse = (color: string): Color => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
      return [r, g, b, a / 255]
    }
    const over = (top: Color, alpha: number, bottom: number[]) =>
      [0, 1, 2].map((i) => top[i] * top[3] * alpha + bottom[i] * (1 - top[3] * alpha))
    const luminance = (rgb: number[]) => {
      const [r, g, b] = rgb.map((value) => {
        const c = value / 255
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a: number[], b: number[]) => {
      const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (high + 0.05) / (low + 0.05)
    }
    const chain = (element: Element) => {
      const list: Element[] = []
      for (let at: Element | null = element; at; at = at.parentElement) {
        list.push(at)
      }
      return list
    }
    const opacityOf = (elements: Element[]) =>
      elements.reduce((total, at) => total * parseFloat(getComputedStyle(at).opacity), 1)
    const backgroundOf = (element: Element) => {
      const elements = chain(element)
      let result = [255, 255, 255]
      for (let i = elements.length - 1; i >= 0; i--) {
        const color = parse(getComputedStyle(elements[i]).backgroundColor)
        result = over(color, opacityOf(elements.slice(i)), result)
      }
      return result
    }
    const failures: { text: string; ratio: number }[] = []
    let measured = 0
    const measure = (element: Element, text: string, color: string) => {
      const background = backgroundOf(element)
      const value = ratio(over(parse(color), opacityOf(chain(element)), background), background)
      measured++
      if (value < min) {
        failures.push({ text: text.slice(0, 50), ratio: Math.round(value * 100) / 100 })
      }
    }
    for (const element of document.body.querySelectorAll<HTMLElement>('*')) {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      if (style.visibility !== 'visible' || rect.width <= 1 || rect.height <= 1) {
        continue
      }
      if (opacityOf(chain(element)) === 0 || element.tagName === 'SCRIPT') {
        continue
      }
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        if (element.value) {
          measure(element, element.value, style.color)
        }
        if (element.placeholder) {
          const placeholder = getComputedStyle(element, '::placeholder').color
          measure(element, element.placeholder, placeholder)
        }
        continue
      }
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim())
        .join('')
      if (text) {
        measure(element, text, style.color)
      }
    }
    return { failures, measured }
  }, minimum)

async function expectContrast(page: Page, screen: string) {
  const { failures, measured } = await auditContrast(page, 7)
  expect(measured, `${screen}: textos medidos`).toBeGreaterThan(3)
  expect(failures, `${screen}: textos abaixo de 7:1`).toEqual([])
}

// Contraste entre duas propriedades de cor do mesmo elemento.
const contrastOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const channels = (color: string) => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d', { willReadFrequently: true })!
        context.fillStyle = color
        context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const luminance = (rgb: number[]) => {
        const [r, g, b] = rgb.map((value) => {
          const c = value / 255
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const style = getComputedStyle(element)
      const [high, low] = [
        luminance(channels(style.color)),
        luminance(channels(style.backgroundColor)),
      ].sort((x, y) => y - x)
      return (high + 0.05) / (low + 0.05)
    })

async function expectNoPageScroll(page: Page, screen: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, `${screen}: rolagem horizontal`).toBeLessThanOrEqual(0)
}

async function chooseInMenu(page: Page, role: 'menuitemradio' | 'menuitemcheckbox', name: string) {
  await page.getByRole('button', { name: 'Configurações' }).click()
  await page.getByRole(role, { name }).click()
  await page.keyboard.press('Escape')
}

test('tamanho do texto muda o texto medido e sobrevive ao recarregar', async ({ page }) => {
  await signIn(page, admin.email, admin.password)
  const html = page.locator('html')
  const heading = page.getByRole('heading', { name: 'Atendimento' })
  await expect(heading).toBeVisible()
  expect(await fontSize(page, 'body')).toBe(14)
  expect(await fontSize(page, 'h1')).toBe(19)

  for (const [label, attribute, scale] of [
    ['Grande', 'large', 1.15],
    ['Maior', 'larger', 1.3],
  ] as const) {
    await chooseInMenu(page, 'menuitemradio', label)
    await expect(html).toHaveAttribute('data-text-size', attribute)
    expect(await fontSize(page, 'body')).toBeCloseTo(14 * scale, 1)
    expect(await fontSize(page, 'h1')).toBeCloseTo(19 * scale, 1)

    await page.reload()
    await expect(heading).toBeVisible()
    expect(await fontSize(page, 'body')).toBeCloseTo(14 * scale, 1)
    await page.getByRole('button', { name: 'Configurações' }).click()
    await expect(page.getByRole('menuitemradio', { name: label })).toBeChecked()
    await page.keyboard.press('Escape')
  }

  await chooseInMenu(page, 'menuitemradio', 'Padrão')
  await expect(html).not.toHaveAttribute('data-text-size')
  expect(await fontSize(page, 'body')).toBe(14)
  await page.reload()
  await expect(heading).toBeVisible()
  expect(await fontSize(page, 'body')).toBe(14)
})

test('o aviso temporário acompanha o tamanho escolhido', async ({ page, baseURL }) => {
  const { sector, agent } = await connectedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()

  for (const [label, expected] of [
    ['Padrão', 13],
    ['Grande', 13 * 1.15],
    ['Maior', 13 * 1.3],
  ] as const) {
    await chooseInMenu(page, 'menuitemradio', label)
    const contact = await receive(baseURL!, sector.id)
    const title = page.locator('[data-sonner-toast] [data-title]', {
      hasText: `Chamado recebido: ${contact}`,
    })
    await expect(title).toBeVisible()
    expect(await title.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(
      expected,
      1,
    )
  }
})

test('em "Maior", na largura do celular, o aviso com ação cabe na tela', async ({
  browser,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!)
  const contact = await receive(baseURL!, sector.id)

  const context = await browser.newContext({ viewport: { width: 375, height: 700 } })
  const page = await context.newPage()
  await prefer(page, { size: 'larger' })
  await signIn(page, agent, userPassword)
  // No painel, assumir leva à conversa e o aviso vem sem ação; pelo sino, ele traz "Abrir conversa".
  await page
    .getByRole('banner')
    .getByRole('button', { name: /^Notificações/ })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: `Assumir chamado de ${contact}` })
    .click()

  const toast = page.locator('[data-sonner-toast]', { hasText: 'Chamado assumido' })
  const action = toast.getByRole('link', { name: 'Abrir conversa' })
  await expect(action).toBeVisible()
  const [toastBox, actionBox] = [await toast.boundingBox(), await action.boundingBox()]
  expect(toastBox!.x).toBeGreaterThanOrEqual(0)
  expect(toastBox!.x + toastBox!.width).toBeLessThanOrEqual(375)
  expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(toastBox!.x + toastBox!.width)
  await expectNoPageScroll(page, 'aviso com ação')
  await context.close()
})

test('todo texto das telas densas acompanha o tamanho escolhido', async ({ browser, baseURL }) => {
  test.slow()
  const { sector, agent } = await connectedSector(baseURL!)
  const contact = await receive(baseURL!, sector.id)

  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, agent, userPassword)
  await openAssignedTicket(page, contact)
  await expect(page.getByText('Chamado assumido')).toBeHidden()
  await page.getByRole('button', { name: 'Encerrar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await expect(sheet).toBeVisible()
  const standard = await textSizes(page)
  await sheet.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(sheet).toBeHidden()

  await chooseInMenu(page, 'menuitemradio', 'Maior')
  await page.getByRole('button', { name: 'Encerrar' }).click()
  await expect(sheet).toBeVisible()
  const larger = await textSizes(page)

  // O mesmo texto pode aparecer em mais de um lugar: compara cada ocorrência, na ordem da tela.
  const occurrences = (items: { text: string; size: number }[]) => {
    const seen = new Map<string, number>()
    return new Map(
      items.map((item) => {
        const count = (seen.get(item.text) ?? 0) + 1
        seen.set(item.text, count)
        return [`${item.text}#${count}`, item.size]
      }),
    )
  }
  const before = occurrences(standard)
  const compared = [...occurrences(larger)].filter(([key]) => before.has(key))
  expect(compared.length).toBeGreaterThan(10)
  const unscaled = compared.filter(([key, size]) => Math.abs(size / before.get(key)! - 1.3) > 0.01)
  expect(unscaled).toEqual([])
  await context.close()
})

test('tamanho e contraste são aplicados antes de o aplicativo carregar', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/login')
  await page.evaluate(() => {
    localStorage.setItem('text-size', 'larger')
    localStorage.setItem('contrast', 'high')
  })

  // Sem o JavaScript do aplicativo, só o script de index.html pode aplicar a escolha.
  await page.route(/\.(js|tsx?)(\?.*)?$/, (route) => route.abort())
  await page.reload({ waitUntil: 'commit' })
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'larger')
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
  await expect(page.locator('body')).toHaveCSS('font-size', '18.2px')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

test('alto contraste muda as cores nos temas claro e escuro e combina com o tamanho', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, admin.email, admin.password)
  const html = page.locator('html')
  const body = page.locator('body')
  await expect(body).toHaveCSS('background-color', 'rgb(237, 239, 237)')

  await chooseInMenu(page, 'menuitemcheckbox', 'Alto contraste')
  await expect(html).toHaveAttribute('data-contrast', 'high')
  await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(body).toHaveCSS('color', 'rgb(0, 0, 0)')

  await chooseInMenu(page, 'menuitemradio', 'Escuro')
  await expect(body).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(body).toHaveCSS('color', 'rgb(255, 255, 255)')

  // Tema Sistema com o sistema operacional no escuro, e o claro forçado sobre ele.
  await chooseInMenu(page, 'menuitemradio', 'Sistema')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(body).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await chooseInMenu(page, 'menuitemradio', 'Claro')
  await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)')

  await chooseInMenu(page, 'menuitemradio', 'Maior')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  await expect(body).toHaveCSS('font-size', '18.2px')
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('menuitemcheckbox', { name: 'Alto contraste' })).toBeChecked()
  await page.getByRole('menuitemcheckbox', { name: 'Alto contraste' }).click()
  await page.keyboard.press('Escape')
  await expect(html).not.toHaveAttribute('data-contrast')
  await expect(body).toHaveCSS('background-color', 'rgb(237, 239, 237)')
  await expect(body).toHaveCSS('font-size', '18.2px')
})

for (const theme of ['light', 'dark'] as const) {
  test(`alto contraste mede 7:1 ou mais no texto das telas densas, tema ${theme}`, async ({
    browser,
    baseURL,
  }) => {
    test.slow()
    const { sector, agent } = await connectedSector(baseURL!)
    const queued = await receive(baseURL!, sector.id)
    const contact = await receive(baseURL!, sector.id)

    const context = await browser.newContext()
    const page = await context.newPage()
    await prefer(page, { theme, contrast: true })
    await signIn(page, agent, userPassword)

    // Painel, com barra lateral e status.
    await expect(page.getByRole('link', { name: queued }).first()).toBeVisible()
    await expectContrast(page, 'painel')

    // Sino aberto, com a fila.
    await page
      .getByRole('banner')
      .getByRole('button', { name: /^Notificações/ })
      .click()
    await expect(page.getByRole('dialog', { name: 'Notificações' })).toContainText(queued)
    await expectContrast(page, 'sino')
    await page.keyboard.press('Escape')

    // Conversa assumida, com o responsável e o campo de resposta.
    await openAssignedTicket(page, contact)
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Preciso do contracheque' }).last(),
    ).toBeVisible()
    await page.getByRole('textbox', { name: 'Mensagem' }).fill('Resposta para teste de contraste')
    await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
    await expect(page.getByRole('listitem', { name: 'Mensagem enviada' })).toBeVisible()
    await expectContrast(page, 'conversa')
    await page.getByLabel('Arquivo para enviar').setInputFiles({
      name: 'documento.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('teste'),
    })
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()
    await expect(page.getByRole('link', { name: /documento.txt/ })).toBeVisible()
    await expectContrast(page, 'documento enviado')
    await context.grantPermissions(['microphone'])
    await page.getByRole('button', { name: 'Gravar áudio' }).click()
    await expect(page.getByRole('status', { name: 'Gravação de áudio' })).toBeVisible()
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: 'Concluir gravação' }).click()
    await page.getByRole('button', { name: 'Enviar áudio' }).click()
    await expect(
      page
        .getByRole('listitem', { name: 'Mensagem enviada' })
        .getByRole('group', { name: 'Áudio' }),
    ).toBeVisible({ timeout: 15000 })
    await expectContrast(page, 'áudio enviado')
    expect(
      (await page.request.post(`/api/test/messaging/sectors/${sector.id}/drop`)).ok(),
    ).toBeTruthy()
    await page.getByRole('textbox', { name: 'Mensagem' }).fill('Teste de falha')
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()
    await expect(page.getByText('Número do setor desconectado.')).toBeVisible()
    await expectContrast(page, 'falha no envio')
    expect(await contrastOf(page, '[aria-label="Mensagem recebida"]')).toBeGreaterThanOrEqual(7)
    expect(await contrastOf(page, '[aria-label="Mensagem enviada"]')).toBeGreaterThanOrEqual(7)
    await page.getByRole('link', { name: 'Ver chamado' }).click()
    await expect(page.locator('[data-slot="badge"]').first()).toBeVisible()
    expect(await contrastOf(page, '[data-slot="badge"]')).toBeGreaterThanOrEqual(7)

    // Formulário de encerramento, com os erros de validação em cor de perigo.
    await page.getByRole('button', { name: 'Encerrar' }).click()
    const sheet = page.getByRole('dialog', { name: 'Encerrar chamado' })
    const submit = sheet.getByRole('button', { name: 'Encerrar' })
    expect(await submit.evaluate((element) => element.getAttribute('data-slot'))).toBe('button')
    await submit.click()
    await expect(sheet).toContainText('Informe o assunto.')
    await expectContrast(page, 'formulário de encerramento')
    expect(
      await contrastOf(page, '[role="dialog"] [data-slot="button"].bg-primary'),
    ).toBeGreaterThanOrEqual(7)
    await context.close()
  })

  test(`alto contraste deixa foco e aviso de número desconectado visíveis, tema ${theme}`, async ({
    browser,
    baseURL,
  }) => {
    const { supervisor } = await seedSector(baseURL!)
    const context = await browser.newContext()
    const page = await context.newPage()
    await prefer(page, { theme, contrast: true })
    await signIn(page, supervisor, userPassword)
    await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()

    // Foco em 3px, com contraste medido contra o fundo; vale até para os campos de texto.
    const bell = page.getByRole('banner').getByRole('button', { name: /^Notificações/ })
    await bell.focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    await expect(bell).toBeFocused()
    await expect(bell).toHaveCSS('outline-width', '3px')
    await expect(bell).toHaveCSS(
      'outline-color',
      theme === 'light' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)',
    )

    await bell.click()
    await expect(page.getByRole('dialog', { name: 'Notificações' })).toContainText('desconectado')
    await expectContrast(page, 'sino com número desconectado')
    await page.keyboard.press('Escape')

    await page.getByRole('link', { name: 'Conexão' }).click()
    await expect(page.getByText('Desconectado').first()).toBeVisible()
    await expectContrast(page, 'conexão')
    await context.close()
  })
}

test('na largura do celular, em "Maior", a página não rola para o lado', async ({
  browser,
  baseURL,
}) => {
  test.slow()
  const { sector, agent } = await connectedSector(baseURL!)
  const contact = await receive(baseURL!, sector.id)
  await receive(baseURL!, sector.id)

  const adminContext = await browser.newContext({ viewport: { width: 375, height: 700 } })
  const adminPage = await adminContext.newPage()
  await prefer(adminPage, { size: 'larger' })
  await adminPage.goto('/login')
  await expectNoPageScroll(adminPage, 'login')
  await signIn(adminPage, admin.email, admin.password)
  for (const [path, title] of [
    ['/atendimento', 'Atendimento'],
    ['/dashboard', 'Dashboard'],
    ['/contatos', 'Contatos'],
    ['/orgaos', 'Órgãos'],
    ['/modulos', 'Módulos'],
    ['/conexao', 'Conexão do WhatsApp'],
    ['/admin/setores', 'Setores'],
    ['/admin/usuarios', 'Usuários'],
  ]) {
    await adminPage.goto(path)
    await expect(adminPage.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expectNoPageScroll(adminPage, path)
  }

  // Menu de configurações cabe na tela e chega ao último item.
  await adminPage.getByRole('button', { name: 'Abrir menu' }).click()
  await adminPage.getByRole('button', { name: 'Configurações' }).click()
  const leave = adminPage.getByRole('menuitem', { name: 'Sair' })
  await leave.scrollIntoViewIfNeeded()
  await expect(leave).toBeInViewport()
  await expectNoPageScroll(adminPage, 'menu de configurações')
  await adminContext.close()

  const context = await browser.newContext({ viewport: { width: 375, height: 700 } })
  const page = await context.newPage()
  await prefer(page, { size: 'larger', contrast: true })
  await signIn(page, agent, userPassword)
  await expectNoPageScroll(page, 'painel do atendente')

  const bell = page.getByRole('banner').getByRole('button', { name: /^Notificações/ })
  await bell.click()
  const list = page.getByRole('dialog', { name: 'Notificações' })
  await expect(list).toContainText(contact)
  const box = await list.boundingBox()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(375)
  await expectNoPageScroll(page, 'sino')
  await page.keyboard.press('Escape')

  await openAssignedTicket(page, contact)
  await expectNoPageScroll(page, 'conversa')
  await page.getByRole('button', { name: 'Encerrar' }).click()
  await expect(page.getByRole('dialog', { name: 'Encerrar chamado' })).toBeVisible()
  await expectNoPageScroll(page, 'formulário de encerramento')
  await context.close()
})

test('em "Maior", no computador, as ações do painel e o título da conversa ficam à vista', async ({
  browser,
  baseURL,
}) => {
  const { sector, agent } = await connectedSector(baseURL!)
  const contact = await receive(baseURL!, sector.id)

  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await context.newPage()
  await prefer(page, { size: 'larger' })
  await signIn(page, agent, userPassword)
  const queue = page.getByRole('region', { name: 'Fila do setor' })
  await expect(queue.getByRole('button', { name: 'Assumir' })).toBeInViewport({ ratio: 1 })

  await openAssignedTicket(page, contact)
  const title = page.getByRole('heading', { level: 1 })
  await expect(title).toHaveText(contact)
  const fits = await title.evaluate((element) => element.scrollWidth <= element.clientWidth)
  expect(fits).toBe(true)
  await context.close()
})

test('o medidor de contraste aponta os textos fracos do tema normal', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await signIn(page, admin.email, admin.password)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  const { failures } = await auditContrast(page, 7)
  expect(failures.length).toBeGreaterThan(0)
})

test('a escolha de uma aba vale nas outras', async ({ context, page }) => {
  await signIn(page, admin.email, admin.password)
  const other = await context.newPage()
  await other.goto('/atendimento')
  await expect(other.getByRole('heading', { name: 'Atendimento' })).toBeVisible()

  await chooseInMenu(page, 'menuitemradio', 'Grande')
  await chooseInMenu(page, 'menuitemcheckbox', 'Alto contraste')
  await expect(other.locator('html')).toHaveAttribute('data-text-size', 'large')
  await expect(other.locator('html')).toHaveAttribute('data-contrast', 'high')
})
