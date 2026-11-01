import { expect, request as apiRequest, test } from '@playwright/test'
import {
  admin,
  formatCnpj,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  uniqueCnpj,
  userPassword,
} from './fixtures'

test('supervisor cadastra órgãos com CNPJ validado', async ({ page, baseURL }) => {
  const { supervisor } = await seedSector(baseURL!)
  const { id } = unique()
  const numeric = uniqueCnpj()
  const alphanumeric = uniqueCnpj(true)
  await signIn(page, supervisor, userPassword)

  await page.getByRole('link', { name: 'Órgãos' }).click()
  await expect(page.getByRole('heading', { name: 'Órgãos' })).toBeVisible()

  await page.getByRole('button', { name: 'Novo órgão' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo órgão' })
  await drawer.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(drawer.getByText('Informe o nome do órgão.')).toBeVisible()

  await drawer.getByLabel('Nome').fill(`Prefeitura ${id}`)
  // Dígito verificador trocado.
  await drawer.getByLabel('CNPJ').fill(numeric.slice(0, 13) + ((Number(numeric[13]) + 1) % 10))
  await drawer.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(drawer.getByText('CNPJ inválido. Confira os 14 caracteres.')).toBeVisible()

  await drawer.getByLabel('CNPJ').fill(formatCnpj(numeric))
  await drawer.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(page.getByText('Órgão salvo')).toBeVisible()
  await expect(drawer).toBeHidden()
  await expect(page.getByRole('row', { name: new RegExp(`Prefeitura ${id}`) })).toContainText(
    formatCnpj(numeric),
  )

  // CNPJ alfanumérico, digitado em minúsculas.
  await page.getByRole('button', { name: 'Novo órgão' }).click()
  const second = page.getByRole('dialog', { name: 'Novo órgão' })
  await second.getByLabel('Nome').fill(`Câmara ${id}`)
  await second.getByLabel('CNPJ').fill(alphanumeric.toLowerCase())
  await second.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(second).toBeHidden()
  await expect(page.getByRole('row', { name: new RegExp(`Câmara ${id}`) })).toContainText(
    formatCnpj(alphanumeric),
  )

  // CNPJ repetido é recusado pelo backend.
  await page.getByRole('button', { name: 'Novo órgão' }).click()
  const duplicate = page.getByRole('dialog', { name: 'Novo órgão' })
  await duplicate.getByLabel('Nome').fill(`Outro ${id}`)
  await duplicate.getByLabel('CNPJ').fill(numeric)
  await duplicate.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(duplicate.getByRole('alert')).toHaveText('Já existe um órgão com este CNPJ.')
  await duplicate.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('button', { name: `Editar Prefeitura ${id}` }).click()
  const edit = page.getByRole('dialog', { name: 'Editar órgão' })
  await expect(edit.getByLabel('CNPJ')).toHaveValue(formatCnpj(numeric))
  await edit.getByLabel('Nome').fill(`Prefeitura Municipal ${id}`)
  await edit.getByRole('button', { name: 'Salvar' }).click()
  await expect(
    page.getByRole('row', { name: new RegExp(`Prefeitura Municipal ${id}`) }),
  ).toBeVisible()
})

test('atendente cadastra contato vinculado a um órgão e não cadastra órgãos', async ({
  page,
  baseURL,
}) => {
  const { agent } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const [org, other] = await seedDirectory(
    baseURL!,
    [{ name: `Secretaria ${id}`, cnpj: uniqueCnpj() }, { name: `Autarquia ${id}` }],
    [],
  )
  await signIn(page, agent, userPassword)

  await page.getByRole('link', { name: 'Órgãos' }).click()
  await expect(page.getByRole('heading', { name: 'Órgãos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Novo órgão' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Editar/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'Contatos' }).click()
  await page.getByRole('button', { name: 'Novo contato' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo contato' })
  await drawer.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(drawer.getByText('Informe o nome do contato.')).toBeVisible()
  await expect(drawer.getByText('Informe o telefone com DDI e DDD.')).toBeVisible()
  await expect(drawer.getByText('Selecione o órgão do contato.')).toBeVisible()

  const formatted = `+55 (11) ${phone.slice(4, 9)}-${phone.slice(9)}`
  await drawer.getByLabel('Nome').fill(`Maria ${id}`)
  await drawer.getByLabel('Telefone (WhatsApp)').fill(formatted)
  await drawer.getByLabel('Órgão').fill(`Secretaria ${id}`)
  await page.getByRole('option', { name: new RegExp(`Secretaria ${id}`) }).click()
  await drawer.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(page.getByText('Contato salvo')).toBeVisible()
  await expect(drawer).toBeHidden()
  const row = page.getByRole('row', { name: new RegExp(`Maria ${id}`) })
  await expect(row).toContainText(formatted)
  await expect(row).toContainText(org.name)

  // Telefone repetido é recusado.
  await page.getByRole('button', { name: 'Novo contato' }).click()
  const duplicate = page.getByRole('dialog', { name: 'Novo contato' })
  await duplicate.getByLabel('Nome').fill(`Outra pessoa ${id}`)
  await duplicate.getByLabel('Telefone (WhatsApp)').fill(phone)
  await duplicate.getByLabel('Órgão').fill(`Autarquia ${id}`)
  await page.getByRole('option', { name: new RegExp(`Autarquia ${id}`) }).click()
  await duplicate.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(duplicate.getByRole('alert')).toHaveText('Já existe um contato com este telefone.')
  await duplicate.getByRole('button', { name: 'Cancelar' }).click()

  // Troca o órgão principal do contato.
  await page.getByRole('button', { name: `Editar Maria ${id}` }).click()
  const edit = page.getByRole('dialog', { name: 'Editar contato' })
  await expect(edit.getByLabel('Órgão')).toHaveValue(org.name)
  await edit.getByLabel('Órgão').fill(`Autarquia ${id}`)
  await page.getByRole('option', { name: new RegExp(`Autarquia ${id}`) }).click()
  await edit.getByRole('button', { name: 'Salvar' }).click()
  await expect(edit).toBeHidden()
  await expect(row).toContainText(other.name)
})

test('busca contatos por nome, telefone e CNPJ', async ({ page, baseURL }) => {
  const { agent, sector } = await seedSector(baseURL!)
  const { id } = unique()
  const cnpj = uniqueCnpj(true)
  const phones = [`5511${id}`, `5521${id}`]
  await seedDirectory(
    baseURL!,
    [{ name: `Tribunal ${id}`, cnpj }, { name: `Consórcio ${id}` }],
    [
      { name: `Beatriz ${id}`, phone: phones[0], organization: 0, sector: sector.id },
      { name: `Carlos ${id}`, phone: phones[1], organization: 1, sector: sector.id },
    ],
  )
  await signIn(page, agent, userPassword)
  await page.goto('/contatos')
  const search = page.getByLabel('Buscar contatos')
  const rows = page.getByRole('row').filter({ hasText: id })

  await search.fill(`beatriz ${id}`)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Beatriz ${id}`)

  // Nome do órgão.
  await search.fill(`Consórcio ${id}`)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Carlos ${id}`)

  // Nome do órgão sem acento.
  await search.fill(`consorcio ${id}`)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Carlos ${id}`)

  // Telefone formatado.
  await search.fill(`(21) ${id.slice(0, 5)}-${id.slice(5)}`)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Carlos ${id}`)

  // CNPJ alfanumérico do órgão, formatado e em minúsculas.
  await search.fill(formatCnpj(cnpj).toLowerCase())
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Beatriz ${id}`)

  await search.fill(`inexistente ${id}`)
  await expect(page.getByText('Nenhum contato encontrado.')).toBeVisible()

  // Órgãos por nome e CNPJ.
  await page.getByRole('link', { name: 'Órgãos' }).click()
  const orgSearch = page.getByLabel('Buscar órgãos')
  const orgRows = page.getByRole('row').filter({ hasText: id })
  await orgSearch.fill(`tribunal ${id}`)
  await expect(orgRows).toHaveCount(1)
  await orgSearch.fill(cnpj)
  await expect(orgRows).toHaveCount(1)
  await expect(orgRows.first()).toContainText(`Tribunal ${id}`)
})

test('filtra contatos por setor e módulo, e o atendente altera só o próprio setor', async ({
  page,
  baseURL,
}) => {
  const own = await seedSector(baseURL!)
  const other = await seedSector(baseURL!)
  const { id } = unique()
  const phone = `5531${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [
      { name: `Dora ${id}`, phone: `5511${id}`, organization: 0, sector: own.sector.id },
      { name: `Elias ${id}`, phone: `5521${id}`, organization: 0, sector: other.sector.id },
    ],
  )
  const api = await apiRequest.newContext({ baseURL })
  await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
  await api.post(`/api/sectors/${own.sector.id}/modules`, { data: { name: `Folha ${id}` } })
  await api.dispose()
  await signIn(page, own.agent, userPassword)
  await page.goto('/contatos')
  const rows = page.getByRole('row').filter({ hasText: id })

  // Abre em "Meu setor", com opção de ver todos.
  const sectorFilter = page.getByRole('combobox', { name: 'Filtrar por setor' })
  await expect(sectorFilter).toContainText('Meu setor')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Dora ${id}`)
  await sectorFilter.click()
  await page.getByRole('option', { name: 'Todos os setores' }).click()
  await expect(rows).toHaveCount(2)

  // No contato de outro setor, o vínculo fica só para leitura.
  await page.getByRole('button', { name: `Editar Elias ${id}` }).click()
  const edit = page.getByRole('dialog', { name: 'Editar contato' })
  await expect(edit).toContainText(`Também em: ${other.sector.name}.`)
  await expect(edit.getByRole('checkbox', { name: other.sector.name })).toHaveCount(0)
  await edit.getByRole('button', { name: 'Cancelar' }).click()

  // Cadastro: o setor de quem cadastra já vem marcado e ao menos um é obrigatório.
  await page.getByRole('button', { name: 'Novo contato' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo contato' })
  const ownCheckbox = drawer.getByRole('checkbox', { name: own.sector.name })
  await expect(ownCheckbox).toBeChecked()
  await drawer.getByLabel('Nome').fill(`Flora ${id}`)
  await drawer.getByLabel('Telefone (WhatsApp)').fill(phone)
  await drawer.getByLabel('Órgão').fill(`Prefeitura ${id}`)
  await page.getByRole('option', { name: new RegExp(`Prefeitura ${id}`) }).click()
  await ownCheckbox.click()
  await drawer.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(drawer.getByText('Selecione ao menos um setor.')).toBeVisible()
  await ownCheckbox.click()
  // Um módulo por setor, e a lista mostra o setor com o módulo.
  await drawer.getByRole('combobox', { name: `Módulo em ${own.sector.name}` }).click()
  await page.getByRole('option', { name: `Folha ${id}` }).click()
  await drawer.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(drawer).toBeHidden()
  const flora = page.getByRole('row', { name: new RegExp(`Flora ${id}`) })
  await expect(flora).toContainText(own.sector.name)
  await expect(flora).toContainText(`Folha ${id}`)

  // O módulo filtra a lista.
  await page.getByRole('combobox', { name: 'Filtrar por módulo' }).click()
  await page.getByRole('option', { name: `Folha ${id}` }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Flora ${id}`)
})

test('o administrador abre os contatos em todos os setores e escolhe o setor', async ({
  page,
  baseURL,
}) => {
  const first = await seedSector(baseURL!)
  const second = await seedSector(baseURL!)
  const { id } = unique()
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [
      { name: `Gil ${id}`, phone: `5511${id}`, organization: 0, sector: first.sector.id },
      { name: `Hana ${id}`, phone: `5521${id}`, organization: 0, sector: second.sector.id },
    ],
  )
  await signIn(page, admin.email, admin.password)
  await page.goto('/contatos')
  const rows = page.getByRole('row').filter({ hasText: id })
  const sectorFilter = page.getByRole('combobox', { name: 'Filtrar por setor' })
  await expect(sectorFilter).toContainText('Todos os setores')
  await expect(rows).toHaveCount(2)
  await sectorFilter.click()
  await page.getByRole('option', { name: second.sector.name }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Hana ${id}`)

  // Nenhum setor vem marcado no cadastro do administrador.
  await page.getByRole('button', { name: 'Novo contato' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo contato' })
  await expect(drawer.getByRole('checkbox', { name: first.sector.name })).not.toBeChecked()
  await expect(drawer.getByRole('checkbox', { name: second.sector.name })).not.toBeChecked()
})

async function connectBook(
  baseURL: string,
  sectorId: number,
  contacts: { name: string; phone: string }[],
) {
  const api = await apiRequest.newContext({ baseURL })
  const login = await api.post('/api/auth/login', {
    data: { email: admin.email, password: admin.password },
  })
  expect(login.ok()).toBeTruthy()
  const connect = await api.post(`/api/sectors/${sectorId}/connection`)
  expect(connect.ok()).toBeTruthy()
  const pair = await api.post(`/api/test/messaging/sectors/${sectorId}/pair`)
  expect(pair.ok()).toBeTruthy()
  const book = await api.post(`/api/test/messaging/sectors/${sectorId}/saved-contacts`, {
    data: { contacts },
  })
  expect(book.ok()).toBeTruthy()
  await api.dispose()
}

test('atendente importa contatos selecionados da agenda, com e sem órgão', async ({
  page,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id } = unique()
  // O final difere sempre do final do id: a busca pelo nome com o id não pode casar com um telefone.
  const phoneOf = (digit: number) => `5511${id.slice(0, -1)}${(Number(id.at(-1)) + digit) % 10}`
  await seedDirectory(baseURL!, [{ name: `Prefeitura ${id}` }], [])
  await connectBook(baseURL!, sector.id, [
    { name: `Ana ${id}`, phone: phoneOf(1) },
    { name: `Bia ${id}`, phone: phoneOf(2) },
    { name: `Caio ${id}`, phone: phoneOf(3) },
  ])
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Contatos' }).click()

  // Só os selecionados, com órgão: ficam cadastrados e no setor.
  await page.getByRole('button', { name: 'Importar contatos' }).click()
  const drawer = page.getByRole('dialog', { name: 'Importar contatos' })
  await drawer.getByRole('button', { name: 'Importar contatos' }).click()
  await expect(drawer.getByRole('alert')).toHaveText('Selecione ao menos um contato.')
  await drawer.getByRole('checkbox', { name: new RegExp(`Ana ${id}`) }).click()
  await drawer.getByLabel('Órgão').fill(`Prefeitura ${id}`)
  await page.getByRole('option', { name: `Prefeitura ${id}` }).click()
  await drawer.getByRole('button', { name: 'Importar contatos' }).click()
  await expect(drawer.getByText('1 contato criado.')).toBeVisible()
  await drawer.getByRole('button', { name: 'Fechar' }).first().click()
  await expect(page.getByRole('row', { name: new RegExp(`Ana ${id}`) })).toContainText(
    `Prefeitura ${id}`,
  )
  await expect(page.getByRole('row', { name: new RegExp(`Bia ${id}`) })).toHaveCount(0)

  // Selecionar todos, sem órgão: Ana já existe e continua com o órgão dela.
  await page.getByRole('button', { name: 'Importar contatos' }).click()
  const again = page.getByRole('dialog', { name: 'Importar contatos' })
  await expect(again.getByRole('listitem').filter({ hasText: `Ana ${id}` })).toContainText(
    'Já existe',
  )
  await expect(again.getByRole('listitem').filter({ hasText: `Bia ${id}` })).not.toContainText(
    'Já existe',
  )

  // A busca ignora acentos, e "Selecionar todos" vale para os mostrados.
  const search = again.getByRole('searchbox', { name: 'Buscar na agenda' })
  await search.fill(`CÁIO ${id}`)
  await search.press('Enter')
  await expect(again.getByRole('checkbox', { name: new RegExp(`Bia ${id}`) })).toHaveCount(0)
  await again.getByRole('checkbox', { name: 'Selecionar todos (1)' }).click()
  await search.fill(phoneOf(2))
  await expect(again.getByRole('checkbox', { name: new RegExp(`Caio ${id}`) })).toHaveCount(0)
  await again.getByRole('checkbox', { name: 'Selecionar todos (1)' }).click()
  await expect(again.getByText('2 contatos selecionados')).toBeVisible()
  await search.fill('nome que não existe')
  await expect(again.getByText('Nenhum contato encontrado.')).toBeVisible()
  await search.fill('')
  await expect(again.getByRole('checkbox', { name: new RegExp(`Caio ${id}`) })).toBeChecked()
  await again.getByRole('checkbox', { name: 'Selecionar todos (3)' }).click()
  await again.getByRole('button', { name: 'Importar contatos' }).click()
  await expect(again.getByText('2 contatos criados.')).toBeVisible()
  await expect(again.getByText(/^1 contato já existia/)).toBeVisible()
  await again.getByRole('button', { name: 'Fechar' }).first().click()
  await expect(page.getByRole('row', { name: new RegExp(`Bia ${id}`) })).toContainText('Sem órgão')
  await expect(page.getByRole('row', { name: new RegExp(`Ana ${id}`) })).toContainText(
    `Prefeitura ${id}`,
  )
})

test('importação mantém o contato da variante com nono dígito e só vincula o setor', async ({
  page,
  baseURL,
}) => {
  const first = await seedSector(baseURL!)
  const second = await seedSector(baseURL!)
  const { id } = unique()
  // 55 + DDD + 9 + 8 dígitos, e a mesma pessoa sem o nono dígito na agenda.
  const eight = `8${id.slice(-7)}`
  await seedDirectory(
    baseURL!,
    [{ name: `Órgão ${id}` }],
    [
      {
        name: `Cadastrada ${id}`,
        phone: `55119${eight}`,
        organization: 0,
        sector: first.sector.id,
      },
    ],
  )
  await connectBook(baseURL!, second.sector.id, [{ name: `Agenda ${id}`, phone: `5511${eight}` }])
  await signIn(page, second.supervisor, userPassword)
  await page.getByRole('link', { name: 'Contatos' }).click()

  await page.getByRole('button', { name: 'Importar contatos' }).click()
  const drawer = page.getByRole('dialog', { name: 'Importar contatos' })
  await expect(drawer.getByText('Já existe')).toBeVisible()
  await drawer.getByRole('checkbox', { name: 'Selecionar todos (1)' }).click()
  await drawer.getByRole('button', { name: 'Importar contatos' }).click()
  await expect(drawer.getByText('0 contatos criados.')).toBeVisible()
  await drawer.getByRole('button', { name: 'Fechar' }).first().click()

  const row = page.getByRole('row', { name: new RegExp(`Cadastrada ${id}`) })
  await expect(row).toContainText(second.sector.name)
  await expect(row).toContainText(`Órgão ${id}`)
  await expect(page.getByRole('row', { name: new RegExp(`Agenda ${id}`) })).toHaveCount(0)
})

test('administrador escolhe o setor; número desconectado mostra o aviso', async ({
  page,
  baseURL,
}) => {
  const connected = await seedSector(baseURL!)
  const disconnected = await seedSector(baseURL!)
  const { id, phone } = unique()
  await connectBook(baseURL!, connected.sector.id, [{ name: `Dora ${id}`, phone }])
  await signIn(page, admin.email, admin.password)
  await page.getByRole('link', { name: 'Contatos' }).click()

  await page.getByRole('button', { name: 'Importar contatos' }).click()
  const drawer = page.getByRole('dialog', { name: 'Importar contatos' })
  await drawer.getByLabel('Setor').click()
  await page.getByRole('option', { name: disconnected.sector.name }).click()
  await expect(drawer.getByRole('alert')).toHaveText('Número desconectado. Reconecte pelo QR code.')
  await expect(drawer.getByRole('button', { name: 'Importar contatos' })).toHaveCount(0)

  await drawer.getByLabel('Setor').click()
  await page.getByRole('option', { name: connected.sector.name }).click()
  await drawer.getByRole('checkbox', { name: new RegExp(`Dora ${id}`) }).click()
  await drawer.getByRole('button', { name: 'Importar contatos' }).click()
  await expect(drawer.getByText('1 contato criado.')).toBeVisible()
})
