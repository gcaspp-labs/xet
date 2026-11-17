import { expect, request as apiRequest, test, type APIRequestContext } from '@playwright/test'
import {
  admin,
  defaultMunicipality,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

// Liga o número do setor pelo adaptador falso: conectar e o celular ler o QR code.
async function connectSector(baseURL: string, request: APIRequestContext, sectorId: number) {
  const api = await apiRequest.newContext({ baseURL })
  expect(
    (
      await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
    ).ok(),
  ).toBeTruthy()
  expect((await api.post(`/api/sectors/${sectorId}/connection`)).ok()).toBeTruthy()
  await api.dispose()
  expect((await request.post(`/api/test/messaging/sectors/${sectorId}/pair`)).ok()).toBeTruthy()
}

test('atendente busca um contato e inicia o chamado pelo número do setor', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await connectSector(baseURL!, request, sector.id)
  const { id, phone } = unique()
  const name = `Carla ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name, phone, organization: 0, sector: sector.id }],
  )

  await signIn(page, agent, userPassword)
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(name)
  // O município aparece ao lado do órgão na busca, no painel e no chamado.
  await expect(sheet.getByRole('button', { name: new RegExp(name) })).toContainText(
    `Prefeitura ${id} — ${defaultMunicipality}`,
  )
  await sheet.getByRole('button', { name: new RegExp(name) }).click()
  await sheet.getByRole('textbox', { name: 'Mensagem' }).fill('Bom dia, sua guia está pronta.')
  await sheet.getByRole('button', { name: 'Enviar' }).click()

  // O chamado nasce com o atendente, que já conduz a conversa.
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByText('Chamado iniciado')).toBeVisible()
  await expect(page.getByRole('heading', { name })).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const firstMessage = conversation
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ hasText: 'Bom dia, sua guia está pronta.' })
  await expect(firstMessage).toContainText('Enviada')
  await expect(firstMessage.locator('strong')).toHaveText(/agent \d+:/)
  await expect(firstMessage.locator('p.whitespace-pre-wrap')).toHaveText(
    /agent \d+:\nBom dia, sua guia está pronta\./,
  )
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  // Iniciar o chamado conta como assumir o chamado e fica registrado, antes da
  // primeira mensagem.
  await expect(conversation.getByRole('listitem').first()).toContainText(
    `${agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')} abriu e assumiu o chamado`,
  )
  const ticketUrl = page.url()
  // O chamado já nasce com o órgão do contato.
  const detail = await page.request.get(`/api/tickets/${ticketUrl.split('/').pop()}`)
  const organization = ((await detail.json()) as { organization: { name: string } }).organization
  expect(organization.name).toBe(`Prefeitura ${id}`)
  await page.goto(ticketUrl)

  // Outro integrante do setor que abre um chamado com o mesmo contato é levado ao
  // chamado existente, sem permissão de resposta.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await other.getByRole('button', { name: 'Novo chamado' }).click()
  const otherSheet = other.getByRole('dialog', { name: 'Novo chamado' })
  await otherSheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(name)
  await otherSheet.getByRole('button', { name: new RegExp(name) }).click()
  await expect(other).toHaveURL(ticketUrl)
  await expect(other.getByText('O contato já tem um chamado aberto no setor.')).toBeVisible()
  await expect(other.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    /Chamado com agent \d+\. Peça a transferência/,
  )
  await expect(other.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
  await otherContext.close()
})

test('contato com chamado na fila leva ao chamado existente', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, request, sector.id)
  const { id, phone } = unique()
  const name = `Cliente ${id}`
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${id}`,
          phone,
          contactName: name,
          body: 'Preciso de ajuda',
        },
      })
    ).ok(),
  ).toBeTruthy()

  await signIn(page, agent, userPassword)
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(phone)
  await sheet.getByRole('button', { name: new RegExp(name) }).click()

  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  await expect(conversation).toContainText('Preciso de ajuda')
  await expect(conversation).toContainText('Chamado na fila. Assuma o chamado para responder.')
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
})

test('atendente cadastra o contato em "Novo chamado" e envia a primeira mensagem', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  await connectSector(baseURL!, request, sector.id)
  const { id, phone } = unique()
  const taken = `Lia ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name: taken, phone, organization: 0, sector: sector.id }],
  )

  await signIn(page, agent, userPassword)
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(`Marta ${id}`)
  await expect(sheet.getByText('Nenhum contato encontrado.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Novo contato' }).click()

  // Telefone já cadastrado mostra o aviso, sem fechar o cadastro nem a conversa.
  const drawer = page.getByRole('dialog', { name: 'Novo contato' })
  await expect(drawer.getByRole('checkbox', { name: sector.name })).toBeChecked()
  await drawer.getByLabel('Nome').fill(`Marta ${id}`)
  await drawer.getByLabel('Telefone (WhatsApp)').fill(phone)
  await drawer.getByLabel('Órgão').fill(`Prefeitura ${id}`)
  await page.getByRole('option', { name: new RegExp(`Prefeitura ${id}`) }).click()
  await drawer.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(drawer.getByRole('alert')).toHaveText('Já existe um contato com este telefone.')

  // Desistir do cadastro volta para a conversa, com a busca como estava.
  await drawer.getByRole('button', { name: 'Cancelar' }).click()
  await expect(drawer).toBeHidden()
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('searchbox', { name: 'Buscar contato' })).toHaveValue(`Marta ${id}`)

  // Com bloqueio: Esc e clique fora não fecham o cadastro nem a conversa.
  await sheet.getByRole('button', { name: 'Novo contato' }).click()
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await page.mouse.click(10, 300)
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: 'Cancelar' }).click()
  await expect(drawer).toBeHidden()
  await expect(sheet).toBeVisible()

  // Ao salvar, o novo contato fica escolhido para a primeira mensagem.
  const newPhone = `5531${id}`
  await sheet.getByRole('button', { name: 'Novo contato' }).click()
  await drawer.getByLabel('Nome').fill(`Marta ${id}`)
  await drawer.getByLabel('Telefone (WhatsApp)').fill(newPhone)
  await drawer.getByLabel('Órgão').fill(`Prefeitura ${id}`)
  await page.getByRole('option', { name: new RegExp(`Prefeitura ${id}`) }).click()
  await drawer.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(drawer).toBeHidden()
  await expect(page.getByText('Contato salvo')).toBeVisible()
  await expect(sheet).toContainText(`Marta ${id}`)
  await expect(sheet.getByRole('button', { name: 'Trocar' })).toBeVisible()
  await sheet.getByRole('textbox', { name: 'Mensagem' }).fill('Bom dia, seu cadastro foi feito.')
  await sheet.getByRole('button', { name: 'Enviar' }).click()

  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByText('Chamado iniciado')).toBeVisible()
  await expect(page.getByRole('heading', { name: `Marta ${id}` })).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Conversa', exact: true })
      .getByRole('listitem', { name: 'Mensagem enviada' })
      .filter({ hasText: 'Bom dia, seu cadastro foi feito.' }),
  ).toContainText('Enviada')
})

test('a busca de Novo chamado abre em "Meu setor", com opção de ver todos', async ({
  page,
  baseURL,
}) => {
  const own = await seedSector(baseURL!)
  const other = await seedSector(baseURL!)
  const { id } = unique()
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [
      { name: `Iara ${id}`, phone: `5511${id}`, organization: 0, sector: own.sector.id },
      { name: `Jonas ${id}`, phone: `5521${id}`, organization: 0, sector: other.sector.id },
    ],
  )
  await signIn(page, own.agent, userPassword)
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(id)
  await expect(sheet.getByRole('button', { name: new RegExp(`Iara ${id}`) })).toBeVisible()
  await expect(sheet.getByRole('button', { name: new RegExp(`Jonas ${id}`) })).toHaveCount(0)

  await sheet.getByRole('combobox', { name: 'Filtrar por setor' }).click()
  await page.getByRole('option', { name: 'Todos os setores' }).click()
  await expect(sheet.getByRole('button', { name: new RegExp(`Jonas ${id}`) })).toBeVisible()
})

test('a busca de Novo chamado filtra por município e órgão', async ({ page, baseURL }) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id } = unique()
  await seedDirectory(
    baseURL!,
    [
      { name: `Câmara ${id}`, municipality: 'Iacanga' },
      { name: `Prefeitura ${id}`, municipality: 'Iacanga' },
      { name: `Câmara ${id}`, municipality: 'Peruíbe' },
    ],
    [
      { name: `Kátia ${id}`, phone: `5511${id}`, organization: 0, sector: sector.id },
      { name: `Léo ${id}`, phone: `5521${id}`, organization: 1, sector: sector.id },
      { name: `Nina ${id}`, phone: `5531${id}`, organization: 2, sector: sector.id },
    ],
  )
  await signIn(page, agent, userPassword)
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  const contacts = sheet.getByRole('list', { name: 'Contatos' }).getByRole('button')
  const results = contacts.filter({ hasText: id })
  await expect(results).toHaveCount(3)

  await sheet.getByRole('combobox', { name: 'Filtrar por município' }).fill('iacanga')
  await page.getByRole('option', { name: 'Iacanga', exact: true }).click()
  await expect(results).toHaveCount(2)
  await expect(results.filter({ hasText: `Nina ${id}` })).toHaveCount(0)

  // A lista de órgãos acompanha o município.
  await sheet.getByRole('combobox', { name: 'Filtrar por órgão' }).fill(id)
  await expect(page.getByRole('option')).toHaveCount(2)
  await page.getByRole('option', { name: new RegExp(`Prefeitura ${id}\\s*Iacanga`) }).click()
  await expect(results).toHaveCount(1)
  await expect(results.first()).toContainText(`Léo ${id}`)

  // Combina com o texto digitado.
  const search = sheet.getByRole('searchbox', { name: 'Buscar contato' })
  await search.fill(`Kátia ${id}`)
  await expect(results).toHaveCount(0)
  await search.fill(`Léo ${id}`)
  await expect(results).toHaveCount(1)

  // A busca pelo município, sem acento e sem filtros, encontra os contatos dos órgãos dele.
  await search.fill('iacanga')
  await sheet.getByRole('button', { name: 'Limpar órgão' }).click()
  await sheet.getByRole('button', { name: 'Limpar município' }).click()
  await expect(results).toHaveCount(2)
  await expect(results.filter({ hasText: `Nina ${id}` })).toHaveCount(0)
})

test('a lista de Novo chamado carrega o resto dos contatos ao rolar até o fim', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id } = unique()
  // 23 contatos com o mesmo marcador: uma página cheia de 20 e mais 3.
  const names = Array.from(
    { length: 23 },
    (_, i) => `Contato ${id} ${String(i + 1).padStart(2, '0')}`,
  )
  await seedDirectory(
    baseURL!,
    // O último contato é de um órgão em outro município, para o filtro.
    [{ name: `Prefeitura ${id}` }, { name: `Câmara ${id}`, municipality: 'Iacanga' }],
    names.map((name, i) => ({
      name,
      phone: `5511${id.slice(0, 7)}${String(i).padStart(2, '0')}`,
      organization: i === 22 ? 1 : 0,
      sector: sector.id,
    })),
  )
  await signIn(page, agent, userPassword)
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  const search = sheet.getByRole('searchbox', { name: 'Buscar contato' })
  const contacts = sheet.getByRole('list', { name: 'Contatos' }).getByRole('button')
  const results = contacts.filter({ hasText: id })
  const body = sheet.locator('[data-slot="dialog-body"]')
  const scrollToEnd = () =>
    body.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))

  // A busca mostra os 20 primeiros, sem rodapé de contagem nem pedido para refinar.
  await search.fill(id)
  await expect(results).toHaveCount(20)
  await expect(results.last()).toContainText(names[19])
  await expect(sheet.getByText(/Mostrando \d+ de/)).toHaveCount(0)
  await expect(sheet.getByText(/refinar/i)).toHaveCount(0)

  // Rolar até o fim traz o resto, e a lista para de crescer.
  await scrollToEnd()
  await expect(results).toHaveCount(23)
  await expect(results.last()).toContainText(names[22])
  await expect(sheet.getByText(/Mostrando \d+ de/)).toHaveCount(0)

  // Mudar a busca recomeça na página 1, e a rolagem volta ao topo.
  await search.fill(`${id} 0`)
  await expect(results).toHaveCount(9)
  await search.fill(id)
  await expect(results).toHaveCount(20)
  expect(await body.evaluate((element) => element.scrollTop)).toBe(0)

  // Mudar um filtro também recomeça na página 1, e limpá-lo volta à lista de 20.
  await scrollToEnd()
  await expect(results).toHaveCount(23)
  await sheet.getByRole('combobox', { name: 'Filtrar por município' }).fill('iacanga')
  await page.getByRole('option', { name: 'Iacanga', exact: true }).click()
  await expect(results).toHaveCount(1)
  await expect(results.first()).toContainText(names[22])
  await sheet.getByRole('button', { name: 'Limpar município' }).click()
  await expect(results).toHaveCount(20)
  expect(await body.evaluate((element) => element.scrollTop)).toBe(0)
})

test('Novo chamado alcança e escolhe um contato depois do 20º só pelo teclado', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id } = unique()
  const names = Array.from(
    { length: 23 },
    (_, i) => `Contato ${id} ${String(i + 1).padStart(2, '0')}`,
  )
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    names.map((name, i) => ({
      name,
      phone: `5511${id.slice(0, 7)}${String(i).padStart(2, '0')}`,
      organization: 0,
      sector: sector.id,
    })),
  )
  await signIn(page, agent, userPassword)
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  const search = sheet.getByRole('searchbox', { name: 'Buscar contato' })
  const contacts = sheet.getByRole('list', { name: 'Contatos' }).getByRole('button')
  const results = contacts.filter({ hasText: id })
  await search.fill(id)
  await expect(results).toHaveCount(20)

  // Do campo de busca, Tab chega ao primeiro contato; as setas descem e voltam.
  await search.focus()
  for (
    let i = 0;
    i < 20 && !(await results.first().evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press('Tab')
  }
  await expect(results.first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(results.nth(1)).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(results.first()).toBeFocused()

  // Chegar ao 20º contato carrega o resto, e a seta seguinte chega ao 21º.
  for (let i = 0; i < 19; i++) {
    await page.keyboard.press('ArrowDown')
  }
  await expect(results.nth(19)).toBeFocused()
  await expect(results).toHaveCount(23)
  await page.keyboard.press('ArrowDown')
  await expect(results.nth(20)).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(results.nth(22)).toBeFocused()

  // Enter escolhe o 23º contato: a janela passa para a mensagem.
  await page.keyboard.press('Enter')
  await expect(sheet.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()
  await expect(sheet.getByText(names[22])).toBeVisible()
})
