import { expect, request as apiRequest, test, type Locator, type Page } from '@playwright/test'
import {
  admin,
  expectClosableDialog,
  expectLockedDialog,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

// Setor conectado, com um módulo, e um chamado de contato não cadastrado na fila.
async function queuedTicket(baseURL: string, extraSector = false) {
  const seed = await seedSector(baseURL)
  const other = extraSector ? await seedSector(baseURL) : undefined
  const api = await apiRequest.newContext({ baseURL })
  const ok = async (response: Promise<{ ok(): boolean }>) =>
    expect((await response).ok()).toBeTruthy()
  await ok(api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } }))
  for (const sectorId of [seed.sector.id, ...(other ? [other.sector.id] : [])]) {
    await ok(api.post(`/api/sectors/${sectorId}/connection`))
    await ok(api.post(`/api/test/messaging/sectors/${sectorId}/pair`))
  }
  await ok(api.post(`/api/sectors/${seed.sector.id}/modules`, { data: { name: 'Folha' } }))
  const { id, phone } = unique()
  const contact = `Cliente ${id}`
  await ok(
    api.post(`/api/test/messaging/sectors/${seed.sector.id}/receive`, {
      data: { externalMessageId: `E2E-${id}`, phone, contactName: contact, body: 'Bom dia' },
    }),
  )
  await api.dispose()
  return { ...seed, contact, other }
}

async function openAssigned(page: Page, contact: string) {
  await page.getByRole('link', { name: contact }).first().click()
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Encerrar' })).toBeVisible()
}

test('as janelas do atendimento têm bloqueio', async ({ page, baseURL }) => {
  const { agent, contact, supervisor } = await queuedTicket(baseURL!, true)
  await signIn(page, agent, userPassword)
  await openAssigned(page, contact)

  await page.getByRole('button', { name: 'Encerrar' }).click()
  await expectLockedDialog(page, page.getByRole('dialog', { name: 'Encerrar chamado' }), {
    field: 'Assunto',
  })

  await page.getByRole('button', { name: 'Outro setor' }).click()
  await expectLockedDialog(
    page,
    page.getByRole('dialog', { name: 'Transferir para outro setor' }),
    {
      field: 'Assunto',
    },
  )

  await page.getByRole('button', { name: 'Cancelar chamado' }).click()
  await expectLockedDialog(page, page.getByRole('dialog', { name: 'Cancelar chamado' }), {
    field: 'Motivo',
    cancel: 'Voltar',
  })

  await page.getByRole('button', { name: 'Devolver à fila' }).click()
  await expectLockedDialog(page, page.getByRole('dialog', { name: 'Devolver à fila' }))

  // Sem texto a digitar, a escolha do seletor é o que precisa continuar.
  const supervisorName = supervisor.replace(/^supervisor\.(\d+)@.*$/, 'supervisor $1')
  await page.getByRole('button', { name: 'Transferir', exact: true }).click()
  const transfer = page.getByRole('dialog', { name: 'Transferir chamado' })
  const target = transfer.getByRole('combobox', { name: 'Transferir para' })
  await target.click()
  await page.getByRole('option', { name: supervisorName }).click()
  await expect(target).toContainText(supervisorName)
  await page.keyboard.press('Escape')
  await page.mouse.click(10, 300)
  await expect(transfer).toBeVisible()
  await expect(target).toContainText(supervisorName)
  await expectLockedDialog(page, transfer)

  // O cadastro de contato aberto pela conversa também tem bloqueio.
  await page
    .getByRole('region', { name: 'Conversa', exact: true })
    .getByRole('button', { name: /Cadastrar/ })
    .click()
  await expectLockedDialog(page, page.getByRole('dialog', { name: 'Cadastrar contato' }), {
    field: 'Nome',
  })
})

test('cancelar o cadastro aberto pelo encerramento volta à janela com os dados mantidos', async ({
  page,
  baseURL,
}) => {
  const { agent, contact } = await queuedTicket(baseURL!)
  await signIn(page, agent, userPassword)
  await openAssigned(page, contact)

  await page.getByRole('button', { name: 'Encerrar' }).click()
  const closing = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await closing.getByLabel('Assunto').fill('Contracheque de maio')
  await closing.getByRole('button', { name: 'Cadastrar contato' }).click()
  const registration = page.getByRole('dialog', { name: /contato/i })
  await expect(registration).toBeVisible()

  // Nem Esc nem clique fora fecham qualquer uma das duas.
  await page.keyboard.press('Escape')
  await page.mouse.click(10, 300)
  await expect(registration).toBeVisible()
  await expect(registration.getByRole('button', { name: 'Fechar', exact: true })).toHaveCount(0)

  await registration.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(registration).toBeHidden()
  await expect(closing).toBeVisible()
  await expect(closing.getByLabel('Assunto')).toHaveValue('Contracheque de maio')
  await expectLockedDialog(page, closing, { field: 'Assunto' })
})

test('novo chamado e o cadastro aberto por ela têm bloqueio', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  const query = `Sem resultado ${unique().id}`
  await signIn(page, agent, userPassword)

  const open = () => page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  await open()
  await expectLockedDialog(page, sheet, { field: 'Buscar contato' })

  await open()
  await sheet.getByLabel('Buscar contato').fill(query)
  await sheet.getByRole('button', { name: 'Novo contato' }).click()
  const registration = page.getByRole('dialog', { name: 'Novo contato' })
  await registration.getByLabel('Nome').fill('Marta')
  await page.keyboard.press('Escape')
  await page.mouse.click(10, 300)
  await expect(registration).toBeVisible()
  await expect(registration.getByLabel('Nome')).toHaveValue('Marta')
  await expect(registration.getByRole('button', { name: 'Fechar', exact: true })).toHaveCount(0)

  await registration.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(registration).toBeHidden()
  await expect(sheet).toBeVisible()
  await expect(sheet.getByLabel('Buscar contato')).toHaveValue(query)
})

test('contatos, importação e histórico fecham por X, Esc e clique fora', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const name = `Rita ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name, phone, organization: 0, sector: sector.id }],
  )
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Contatos' }).click()

  // O mesmo cadastro de contato: aqui, com fechamento normal.
  await expectClosableDialog(page, page.getByRole('dialog', { name: 'Novo contato' }), () =>
    page.getByRole('button', { name: 'Novo contato' }).click(),
  )
  await expectClosableDialog(page, page.getByRole('dialog', { name: 'Importar contatos' }), () =>
    page.getByRole('button', { name: 'Importar contatos' }).click(),
  )
  await expectClosableDialog(page, page.getByRole('dialog', { name: 'Histórico' }), () =>
    page.getByRole('button', { name: `Histórico de ${name}` }).click(),
  )
})

test('cadastros do administrador fecham por X, Esc e clique fora', async ({ page, baseURL }) => {
  const { id } = unique()
  const organization = `Prefeitura ${id}`
  await seedDirectory(baseURL!, [{ name: organization }], [])
  await signIn(page, admin.email, admin.password)

  await page.goto('/admin/usuarios')
  await expectClosableDialog(page, page.getByRole('dialog', { name: 'Novo usuário' }), () =>
    page.getByRole('button', { name: 'Novo usuário' }).click(),
  )
  await page.goto('/admin/setores')
  await expectClosableDialog(page, page.getByRole('dialog', { name: 'Novo setor' }), () =>
    page.getByRole('button', { name: 'Novo setor' }).click(),
  )
  await page.goto(`/orgaos`)
  await expectClosableDialog(page, page.getByRole('dialog', { name: 'Novo órgão' }), () =>
    page.getByRole('button', { name: 'Novo órgão' }).click(),
  )
  await page.getByRole('searchbox').fill(organization)
  await expectClosableDialog(page, page.getByRole('dialog', { name: 'Histórico' }), () =>
    page.getByRole('button', { name: `Histórico de ${organization}` }).click(),
  )
})

test('módulos e desvincular número fecham por X, Esc e clique fora', async ({ page, baseURL }) => {
  const { supervisor } = await queuedTicket(baseURL!)
  await signIn(page, supervisor, userPassword)

  await page.goto('/modulos')
  await expectClosableDialog(page, page.getByRole('dialog', { name: 'Novo módulo' }), () =>
    page.getByRole('button', { name: 'Novo módulo' }).click(),
  )
  await page.goto('/conexao')
  await expectClosableDialog(page, page.getByRole('dialog', { name: 'Desvincular número' }), () =>
    page.getByRole('button', { name: 'Desvincular número' }).click(),
  )
})

test('seletores funcionam dentro da janela, e o Esc fecha só a lista', async ({
  page,
  baseURL,
}) => {
  const { agent, contact } = await queuedTicket(baseURL!)
  const { id } = unique()
  await seedDirectory(baseURL!, [{ name: `Prefeitura ${id}` }], [])
  await signIn(page, agent, userPassword)

  // Com bloqueio: a lista fecha, e a janela e o texto do formulário continuam.
  await openAssigned(page, contact)
  await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
  const closing = page.getByRole('dialog', { name: 'Encerrar chamado' })
  const closingOption = page.getByRole('option', { name: new RegExp(`Prefeitura ${id}`) })
  await closing.getByLabel('Assunto').fill('Contracheque de maio')
  await closing.getByLabel('Órgão').fill(`Prefeitura ${id}`)
  await expect(closingOption).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(closingOption).toBeHidden()
  await expect(closing).toBeVisible()
  await expect(closing.getByLabel('Assunto')).toHaveValue('Contracheque de maio')
  await closing.getByLabel('Órgão').fill(`Prefeitura ${id}`)
  await closingOption.click()
  await expect(closing.getByLabel('Órgão')).toHaveValue(new RegExp(`Prefeitura ${id}`))
  await closing.getByRole('button', { name: 'Cancelar', exact: true }).click()

  // Com fechamento normal: o primeiro Esc fecha só a lista.
  await page.getByRole('link', { name: 'Contatos' }).click()
  await page.getByRole('button', { name: 'Novo contato' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo contato' })

  const option = page.getByRole('option', { name: new RegExp(`Prefeitura ${id}`) })
  await dialog.getByLabel('Órgão').fill(`Prefeitura ${id}`)
  await expect(option).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(option).toBeHidden()
  await expect(dialog).toBeVisible()

  await dialog.getByLabel('Órgão').fill(`Prefeitura ${id}`)
  await option.click()
  await expect(dialog.getByLabel('Órgão')).toHaveValue(new RegExp(`Prefeitura ${id}`))
  await expect(dialog).toBeVisible()
})

const noPageScroll = async (page: Page, what: string) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, what).toBeLessThanOrEqual(0)
}

// A janela inteira cabe na tela, centralizada.
async function expectInsideScreen(page: Page, dialog: Locator) {
  const viewport = page.viewportSize()!
  const box = (await dialog.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1)
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1)
}

test('em formulário longo, só o corpo rola e o rodapé fica visível', async ({ page, baseURL }) => {
  const { agent, contact } = await queuedTicket(baseURL!)
  await page.setViewportSize({ width: 1280, height: 480 })
  await signIn(page, agent, userPassword)
  await openAssigned(page, contact)

  await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Encerrar chamado' })
  await expect(dialog).toBeVisible()
  await expectInsideScreen(page, dialog)

  const body = dialog.locator('[data-slot="dialog-body"]')
  const submit = dialog.getByRole('button', { name: 'Encerrar', exact: true })
  const title = dialog.getByRole('heading', { name: 'Encerrar chamado' })
  const submitBefore = (await submit.boundingBox())!
  const titleBefore = (await title.boundingBox())!
  expect(submitBefore.y + submitBefore.height).toBeLessThanOrEqual(480)

  const scrolled = await body.evaluate((element) => {
    const room = element.scrollHeight - element.clientHeight
    element.scrollTop = room
    return { room, top: element.scrollTop }
  })
  expect(scrolled.room).toBeGreaterThan(0)
  expect(scrolled.top).toBeGreaterThan(0)
  expect((await submit.boundingBox())!.y).toBe(submitBefore.y)
  expect((await title.boundingBox())!.y).toBe(titleBefore.y)
})

test('no celular, a barra lateral continua como gaveta', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await signIn(page, admin.email, admin.password)

  await page.getByRole('banner').getByRole('button', { name: 'Abrir menu' }).click()
  const drawer = page.getByRole('dialog', { name: 'Menu' })
  await expect(drawer).toBeVisible()
  await expect(drawer).toHaveAttribute('data-side', 'left')
  await expect
    .poll(async () => {
      const box = await drawer.boundingBox()
      return [box?.x, box?.y, box?.height]
    })
    .toEqual([0, 0, 800])
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
})

// Capturas para a revisão visual: cada tema e largura, nos tamanhos Padrão e Maior.
for (const theme of ['light', 'dark'] as const) {
  for (const [device, width, height] of [
    ['desktop', 1280, 800],
    ['celular', 375, 667],
  ] as const) {
    test(`janelas sem rolagem horizontal, tema ${theme}, ${device}`, async ({
      browser,
      baseURL,
    }, testInfo) => {
      test.slow()
      const { agent, contact } = await queuedTicket(baseURL!)
      for (const size of ['', 'larger']) {
        const context = await browser.newContext({ viewport: { width, height } })
        const page = await context.newPage()
        await page.addInitScript(
          (stored) => {
            localStorage.setItem('theme', stored.theme)
            if (stored.size) {
              localStorage.setItem('text-size', stored.size)
            }
          },
          { theme, size },
        )
        await signIn(page, agent, userPassword)
        const capture = async (name: string, dialog: Locator) => {
          await expect(dialog).toBeVisible()
          await expectInsideScreen(page, dialog)
          await noPageScroll(page, `${name}, ${size || 'padrão'}`)
          // Espera a transição de abertura para a captura não sair translúcida.
          await page.waitForTimeout(300)
          await page.screenshot({
            path: testInfo.outputPath(
              `${name}-${theme === 'light' ? 'claro' : 'escuro'}-${device}-${size ? 'maior' : 'padrao'}.png`,
            ),
          })
        }
        if (size) {
          await page.getByRole('link', { name: contact }).first().click()
        } else {
          await openAssigned(page, contact)
          // O aviso aparece sobre o rodapé da janela: a captura espera ele sair.
          await expect(page.getByText('Chamado assumido')).toBeHidden()
        }

        // Curto: cancelar.
        await page.getByRole('button', { name: 'Cancelar chamado' }).click()
        const short = page.getByRole('dialog', { name: 'Cancelar chamado' })
        await capture('curto', short)
        await short.getByRole('button', { name: 'Voltar', exact: true }).click()
        await expect(short).toBeHidden()

        // Longo: encerrar. Aninhado: o cadastro de contato aberto por ele.
        await page.getByRole('button', { name: 'Encerrar', exact: true }).click()
        const closing = page.getByRole('dialog', { name: 'Encerrar chamado' })
        await capture('longo', closing)
        await closing.getByRole('button', { name: 'Cadastrar contato' }).click()
        await capture('aninhado', page.getByRole('dialog', { name: /contato/i }))
        await context.close()
      }
    })
  }
}
