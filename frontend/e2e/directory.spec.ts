import { expect, type Locator, type Page, request as apiRequest, test } from '@playwright/test'
import {
  admin,
  defaultMunicipality,
  fakeCnpjResponse,
  formatCnpj,
  seedDirectory,
  seedSector,
  signIn,
  unique,
  uniqueCnpj,
  userPassword,
} from './fixtures'

// Escolhe o município no seletor com busca do formulário de órgão.
async function chooseMunicipality(page: Page, drawer: Locator, query: string, name: string) {
  await drawer.getByLabel('Município').fill(query)
  await page.getByRole('option', { name, exact: true }).click()
}

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
  await expect(drawer.getByText('Selecione o município do órgão.')).toBeVisible()

  await drawer.getByLabel('Nome').fill(`Prefeitura ${id}`)
  await chooseMunicipality(page, drawer, 'peruibe', 'Peruíbe')
  // Dígito verificador trocado.
  await drawer.getByLabel('CNPJ').fill(numeric.slice(0, 13) + ((Number(numeric[13]) + 1) % 10))
  await drawer.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(drawer.getByText('CNPJ inválido. Confira os 14 caracteres.')).toBeVisible()

  await drawer.getByLabel('CNPJ').fill(formatCnpj(numeric))
  await drawer.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(page.getByText('Órgão salvo')).toBeVisible()
  await expect(drawer).toBeHidden()
  const row = page.getByRole('row', { name: new RegExp(`Prefeitura ${id}`) })
  await expect(row).toContainText(formatCnpj(numeric))
  await expect(row).toContainText('Peruíbe')

  // CNPJ alfanumérico, digitado em minúsculas.
  await page.getByRole('button', { name: 'Novo órgão' }).click()
  const second = page.getByRole('dialog', { name: 'Novo órgão' })
  await second.getByLabel('Nome').fill(`Câmara ${id}`)
  await chooseMunicipality(page, second, 'Itu', 'Itu')
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
  await chooseMunicipality(page, duplicate, 'Itu', 'Itu')
  await duplicate.getByLabel('CNPJ').fill(numeric)
  await duplicate.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(duplicate.getByRole('alert')).toHaveText('Já existe um órgão com este CNPJ.')

  // O nome não se repete no município, sem diferenciar maiúsculas e acentos; em outra cidade, sim.
  await duplicate.getByLabel('CNPJ').fill('')
  await duplicate.getByLabel('Nome').fill(`CAMARA ${id}`)
  await duplicate.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(duplicate.getByRole('alert')).toHaveText(
    'Já existe um órgão com este nome neste município.',
  )
  await chooseMunicipality(page, duplicate, 'Salto', 'Salto')
  await duplicate.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(duplicate).toBeHidden()
  await expect(page.getByRole('row', { name: new RegExp(`CAMARA ${id}`) })).toContainText('Salto')

  // A busca encontra o órgão pelo município, sem acento.
  const search = page.getByLabel('Buscar órgãos')
  const found = page.getByRole('row').filter({ hasText: id })
  await search.fill('peruibe')
  await expect(found).toHaveCount(1)
  await expect(found.first()).toContainText(`Prefeitura ${id}`)
  await search.fill('')

  await page.getByRole('button', { name: `Editar Prefeitura ${id}` }).click()
  const edit = page.getByRole('dialog', { name: 'Editar órgão' })
  await expect(edit.getByLabel('CNPJ')).toHaveValue(formatCnpj(numeric))
  await expect(edit.getByLabel('Município')).toHaveValue('Peruíbe')
  await edit.getByLabel('Nome').fill(`Prefeitura Municipal ${id}`)
  await chooseMunicipality(page, edit, 'Salto', 'Salto')
  await edit.getByRole('button', { name: 'Salvar' }).click()
  await expect(
    page.getByRole('row', { name: new RegExp(`Prefeitura Municipal ${id}`) }),
  ).toContainText('Salto')
})

test('consulta de CNPJ sugere nome e município, e nada é salvo sem confirmação', async ({
  page,
  baseURL,
}) => {
  const { supervisor } = await seedSector(baseURL!)
  const { id } = unique()
  const cnpj = uniqueCnpj()
  await fakeCnpjResponse(cnpj, 200, {
    razao_social: `MUNICIPIO ${id}`,
    municipio: 'PERUIBE',
    codigo_municipio_ibge: 3537602,
  })
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Órgãos' }).click()

  // Consultar e cancelar não cadastra o órgão.
  await page.getByRole('button', { name: 'Novo órgão' }).click()
  let drawer = page.getByRole('dialog', { name: 'Novo órgão' })
  await drawer.getByLabel('CNPJ').fill(formatCnpj(cnpj))
  await drawer.getByRole('button', { name: 'Consultar' }).click()
  await expect(drawer.getByLabel('Nome')).toHaveValue(`MUNICIPIO ${id}`)
  await expect(drawer.getByLabel('Município')).toHaveValue('Peruíbe')
  await expect(drawer.getByText('Confira os dados antes de salvar.')).toBeVisible()
  await drawer.getByRole('button', { name: 'Cancelar' }).click()
  await expect(drawer).toBeHidden()
  await page.getByLabel('Buscar órgãos').fill(id)
  await expect(page.getByText('Nenhum órgão encontrado.')).toBeVisible()

  // Quem cadastra confere, corrige o nome sugerido e só então salva.
  await page.getByRole('button', { name: 'Novo órgão' }).click()
  drawer = page.getByRole('dialog', { name: 'Novo órgão' })
  await drawer.getByLabel('CNPJ').fill(cnpj)
  await drawer.getByRole('button', { name: 'Consultar' }).click()
  await expect(drawer.getByLabel('Nome')).toHaveValue(`MUNICIPIO ${id}`)
  await drawer.getByLabel('Nome').fill(`Prefeitura ${id}`)
  await drawer.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(drawer).toBeHidden()
  const row = page.getByRole('row', { name: new RegExp(`Prefeitura ${id}`) })
  await expect(row).toContainText('Peruíbe')
  await expect(row).toContainText(formatCnpj(cnpj))
})

test('município fora da lista fica para escolher à mão', async ({ page, baseURL }) => {
  const { supervisor } = await seedSector(baseURL!)
  const { id } = unique()
  const cnpj = uniqueCnpj()
  await fakeCnpjResponse(cnpj, 200, {
    razao_social: `ORGAO ${id}`,
    municipio: 'BRASILIA',
    codigo_municipio_ibge: 5300108,
  })
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Órgãos' }).click()

  await page.getByRole('button', { name: 'Novo órgão' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo órgão' })
  await drawer.getByLabel('CNPJ').fill(cnpj)
  await drawer.getByRole('button', { name: 'Consultar' }).click()
  await expect(drawer.getByLabel('Nome')).toHaveValue(`ORGAO ${id}`)
  await expect(
    drawer.getByText('Município não encontrado na lista.', { exact: false }),
  ).toBeVisible()
  await drawer.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(drawer.getByText('Selecione o município do órgão.')).toBeVisible()

  await chooseMunicipality(page, drawer, 'Itu', 'Itu')
  await drawer.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(drawer).toBeHidden()
  await expect(page.getByRole('row', { name: new RegExp(`ORGAO ${id}`) })).toContainText('Itu')
})

test('CNPJ não encontrado e API fora do ar não impedem o cadastro manual', async ({
  page,
  baseURL,
}) => {
  const { supervisor } = await seedSector(baseURL!)
  const { id } = unique()
  const missing = uniqueCnpj()
  const failing = uniqueCnpj(true)
  await fakeCnpjResponse(failing, 500)
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Órgãos' }).click()

  await page.getByRole('button', { name: 'Novo órgão' }).click()
  const drawer = page.getByRole('dialog', { name: 'Novo órgão' })
  await drawer.getByLabel('Nome').fill(`Câmara ${id}`)
  await chooseMunicipality(page, drawer, 'Itu', 'Itu')

  // CNPJ inválido nem chega à consulta.
  await drawer.getByLabel('CNPJ').fill('123')
  await drawer.getByRole('button', { name: 'Consultar' }).click()
  await expect(drawer.getByText('CNPJ inválido. Confira os 14 caracteres.')).toBeVisible()

  await drawer.getByLabel('CNPJ').fill(missing)
  await drawer.getByRole('button', { name: 'Consultar' }).click()
  await expect(
    drawer.getByText('CNPJ não encontrado na consulta. Preencha os dados manualmente.'),
  ).toBeVisible()

  await drawer.getByLabel('CNPJ').fill(failing)
  await expect(drawer.getByText('CNPJ não encontrado na consulta.', { exact: false })).toBeHidden()
  await drawer.getByRole('button', { name: 'Consultar' }).click()
  await expect(
    drawer.getByText('Consulta de CNPJ indisponível. Preencha os dados manualmente.'),
  ).toBeVisible()

  // Os dados digitados continuam no formulário, e o cadastro segue.
  await expect(drawer.getByLabel('Nome')).toHaveValue(`Câmara ${id}`)
  await expect(drawer.getByLabel('Município')).toHaveValue('Itu')
  await drawer.getByRole('button', { name: 'Cadastrar órgão' }).click()
  await expect(drawer).toBeHidden()
  await expect(page.getByRole('row', { name: new RegExp(`Câmara ${id}`) })).toContainText(
    formatCnpj(failing),
  )
})

test('atendente não consulta CNPJ', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Órgãos' }).click()
  await expect(page.getByRole('heading', { name: 'Órgãos' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Novo órgão' })).toHaveCount(0)
  const response = await page.request.get(`/api/cnpj/${uniqueCnpj()}`)
  expect(response.status()).toBe(403)
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
  // O atendente vê o município ao lado do órgão, mesmo sem cadastrar.
  await page.getByLabel('Buscar órgãos').fill(org.name)
  await expect(page.getByRole('row', { name: new RegExp(org.name) })).toContainText(
    defaultMunicipality,
  )

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
  await expect(row).toContainText(`${org.name} — ${defaultMunicipality}`)

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
  await expect(edit.getByLabel('Órgão')).toHaveValue(`${org.name} — ${defaultMunicipality}`)
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
  await page.goto(`/contatos?busca=${id}`)
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

test('filtra contatos por município e órgão, junto com setor, módulo e texto', async ({
  page,
  baseURL,
}) => {
  const own = await seedSector(baseURL!)
  const other = await seedSector(baseURL!)
  const { id } = unique()
  const organizations = await seedDirectory(
    baseURL!,
    [
      { name: `Câmara ${id}`, municipality: 'Ibiúna' },
      { name: `Prefeitura ${id}`, municipality: 'Ibiúna' },
      { name: `Câmara ${id}`, municipality: 'Salto' },
    ],
    [
      { name: `Gina ${id}`, phone: `5511${id}`, organization: 0, sector: own.sector.id },
      { name: `Hugo ${id}`, phone: `5521${id}`, organization: 1, sector: own.sector.id },
      { name: `Igor ${id}`, phone: `5531${id}`, organization: 2, sector: own.sector.id },
      { name: `Júlia ${id}`, phone: `5541${id}`, organization: 1, sector: other.sector.id },
    ],
  )
  const api = await apiRequest.newContext({ baseURL })
  await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
  const moduleResponse = await api.post(`/api/sectors/${own.sector.id}/modules`, {
    data: { name: `Folha ${id}` },
  })
  const folha = (await moduleResponse.json()) as { id: number }
  const lia = await api.post('/api/contacts', {
    data: {
      name: `Lia ${id}`,
      phone: `5551${id}`,
      organizationId: organizations[1].id,
      sectorIds: [own.sector.id],
      moduleIds: [folha.id],
    },
  })
  expect(lia.ok()).toBeTruthy()
  await api.dispose()

  await signIn(page, own.agent, userPassword)
  await page.goto('/contatos')
  const rows = page.getByRole('row').filter({ hasText: id })
  await expect(rows).toHaveCount(4)
  const municipalityFilter = page.getByRole('combobox', { name: 'Filtrar por município' })
  const organizationFilter = page.getByRole('combobox', { name: 'Filtrar por órgão' })

  // O filtro de município mostra só os que têm órgão.
  await municipalityFilter.fill('Zacarias')
  const empty = page.getByText('Nenhum município encontrado.')
  await expect(empty).toBeVisible()
  await expect(empty).toHaveCSS('padding', '16px 12px')
  await municipalityFilter.fill('ibiuna')
  await page.getByRole('option', { name: 'Ibiúna', exact: true }).click()
  await expect(rows).toHaveCount(3)
  await expect(rows.filter({ hasText: `Igor ${id}` })).toHaveCount(0)

  // A lista de órgãos acompanha o município.
  await organizationFilter.fill(id)
  const options = page.getByRole('option')
  await expect(options).toHaveCount(2)
  await expect(options.filter({ hasText: 'Salto' })).toHaveCount(0)
  await page.getByRole('option', { name: `Prefeitura ${id} — Ibiúna` }).click()
  await expect(organizationFilter).toHaveValue(`Prefeitura ${id} — Ibiúna`)
  await expect(rows).toHaveCount(2)
  await expect(rows.filter({ hasText: `Gina ${id}` })).toHaveCount(0)

  // Combina com módulo, texto digitado e setor.
  await page.getByRole('combobox', { name: 'Filtrar por módulo' }).click()
  await page.getByRole('option', { name: `Folha ${id}` }).click()
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Lia ${id}`)
  await page.getByRole('combobox', { name: 'Filtrar por módulo' }).click()
  await page.getByRole('option', { name: 'Todos os módulos' }).click()
  await expect(rows).toHaveCount(2)
  const search = page.getByRole('searchbox', { name: 'Buscar contatos' })
  await search.fill(`Hugo ${id}`)
  await expect(rows).toHaveCount(1)
  await search.fill(`Gina ${id}`)
  await expect(rows).toHaveCount(0)
  // O banco é compartilhado: em todos os setores, a busca fica nos contatos deste teste.
  await search.fill(id)
  await page.getByRole('combobox', { name: 'Filtrar por setor' }).click()
  await page.getByRole('option', { name: 'Todos os setores' }).click()
  await expect(rows).toHaveCount(3)
  await expect(rows.filter({ hasText: `Júlia ${id}` })).toHaveCount(1)

  // Trocar de município tira o órgão de outra cidade do filtro.
  await municipalityFilter.fill('Salto')
  await page.getByRole('option', { name: 'Salto', exact: true }).click()
  await expect(organizationFilter).toHaveValue('')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Igor ${id}`)

  // Limpar o município volta a mostrar todos.
  await page.getByRole('button', { name: 'Limpar município' }).click()
  await expect(municipalityFilter).toHaveValue('')
  await expect(rows).toHaveCount(5)

  // O órgão também filtra sem município e também pode ser limpo.
  await organizationFilter.fill(`Câmara ${id}`)
  await page.getByRole('option', { name: `Câmara ${id} — Salto` }).click()
  await expect(rows).toHaveCount(1)
  await page.getByRole('button', { name: 'Limpar órgão' }).click()
  await expect(rows).toHaveCount(5)

  // A busca pelo município encontra os contatos dos órgãos dele, com ou sem acento.
  for (const term of ['ibiuna', 'Ibiúna']) {
    await search.fill(term)
    await expect(rows).toHaveCount(4)
    await expect(rows.filter({ hasText: `Igor ${id}` })).toHaveCount(0)
  }
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
  await page.goto(`/contatos?busca=${id}`)
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

test('contatos em páginas de 20, ordenados pela coluna, com página e ordem no endereço', async ({
  page,
  baseURL,
}) => {
  const own = await seedSector(baseURL!)
  const { id } = unique()
  const names = Array.from(
    { length: 23 },
    (_, i) => `Pessoa ${id} ${String(i + 1).padStart(2, '0')}`,
  )
  await seedDirectory(
    baseURL!,
    [{ name: `Câmara ${id}` }, { name: `Autarquia ${id}` }],
    names.map((name, i) => ({
      name,
      phone: `55${String(11 + i)}${id}`,
      // A última pessoa fica no órgão que vem primeiro na ordem por órgão.
      organization: i === 22 ? 1 : 0,
      sector: own.sector.id,
    })),
  )
  await signIn(page, own.agent, userPassword)
  await page.goto('/contatos')
  const rows = page.getByRole('row').filter({ hasText: id })
  const pagination = page.getByRole('navigation', { name: 'Paginação' })

  // Primeira página por nome, crescente.
  await expect(rows).toHaveCount(20)
  await expect(rows.first()).toContainText(names[0])
  await expect(page.getByText('Página 1 de 2 · 23 contatos')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Contato' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )

  // Próxima página: o endereço guarda a página.
  await pagination.getByRole('button', { name: 'Próxima' }).click()
  await expect(page).toHaveURL(/\?pagina=2$/)
  await expect(rows).toHaveCount(3)
  await expect(rows.last()).toContainText(names[22])
  await expect(pagination.getByRole('button', { name: 'Próxima' })).toBeDisabled()

  // Clicar na coluna ativa inverte a direção e volta à página 1.
  await page.getByRole('button', { name: 'Contato', exact: true }).click()
  await expect(page).toHaveURL(/\?direcao=desc$/)
  await expect(rows.first()).toContainText(names[22])
  await expect(page.getByRole('columnheader', { name: 'Contato' })).toHaveAttribute(
    'aria-sort',
    'descending',
  )

  // Outra coluna começa crescente: a Autarquia vem antes da Câmara.
  await page.getByRole('button', { name: 'Órgão', exact: true }).click()
  await expect(page).toHaveURL(/\?ordem=orgao$/)
  await expect(rows.first()).toContainText(names[22])
  await expect(page.getByRole('columnheader', { name: 'Contato' })).toHaveAttribute(
    'aria-sort',
    'none',
  )

  // O endereço reabre a mesma lista; página além da última vira a última.
  await page.goto('/contatos?ordem=orgao&pagina=9')
  await expect(page).toHaveURL(/pagina=2/)
  await expect(rows).toHaveCount(3)
  await expect(page.getByText('Página 2 de 2 · 23 contatos')).toBeVisible()

  // Abrir a consulta do histórico, ir a outra tela e voltar conserva página e ordem.
  await page.getByRole('button', { name: `Histórico de ${names[19]}` }).click()
  const history = page.getByRole('dialog', { name: 'Histórico' })
  await expect(history).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(history).toBeHidden()
  await page.getByRole('link', { name: 'Órgãos' }).click()
  await expect(page).toHaveURL(/\/orgaos/)
  await page.goBack()
  await expect(page).toHaveURL(/ordem=orgao/)
  await expect(page).toHaveURL(/pagina=2/)
  await expect(rows).toHaveCount(3)
  await expect(rows.first()).toContainText(names[19])

  // A busca vai para o endereço e volta à página 1; com tudo numa página, a faixa some.
  await page.getByLabel('Buscar contatos').fill(`${id} 1`)
  await expect(page).toHaveURL(/busca=/)
  await expect(page).not.toHaveURL(/pagina=/)
  await expect(rows).toHaveCount(10)
  await expect(pagination).toBeHidden()
  await page.reload()
  await expect(page.getByLabel('Buscar contatos')).toHaveValue(`${id} 1`)
  await expect(rows).toHaveCount(10)

  // Coluna desconhecida no endereço volta à ordem padrão inteira: nome, crescente.
  await page.goto('/contatos?ordem=inexistente&direcao=desc')
  await expect(rows.first()).toContainText(names[0])
  await expect(page.getByRole('columnheader', { name: 'Contato' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )
})

test('reabrir o endereço com órgão restaura o filtro, mesmo sem contatos encontrados', async ({
  page,
  baseURL,
}) => {
  const own = await seedSector(baseURL!)
  const { id } = unique()
  const organizations = await seedDirectory(
    baseURL!,
    [
      { name: `Câmara ${id}`, municipality: 'Ibiúna' },
      { name: `Prefeitura ${id}`, municipality: 'Ibiúna' },
    ],
    [
      { name: `Gina ${id}`, phone: `5511${id}`, organization: 0, sector: own.sector.id },
      { name: `Hugo ${id}`, phone: `5521${id}`, organization: 1, sector: own.sector.id },
    ],
  )
  const cityHallId = organizations[1].id
  await signIn(page, own.agent, userPassword)
  const rows = page.getByRole('row').filter({ hasText: id })
  const organizationFilter = page.getByRole('combobox', { name: 'Filtrar por órgão' })
  const municipalityFilter = page.getByRole('combobox', { name: 'Filtrar por município' })

  // Lista vazia: o órgão do endereço continua no campo.
  await page.goto(`/contatos?orgao=${cityHallId}&busca=${encodeURIComponent(`${id} ninguém`)}`)
  await expect(page.getByText('Nenhum contato encontrado')).toBeVisible()
  await expect(organizationFilter).toHaveValue(`Prefeitura ${id} — Ibiúna`)

  // Escolher o município do órgão restaurado mantém o órgão no filtro.
  await page.goto(`/contatos?orgao=${cityHallId}&busca=${id}`)
  await expect(organizationFilter).toHaveValue(`Prefeitura ${id} — Ibiúna`)
  await municipalityFilter.fill('ibiuna')
  await page.getByRole('option', { name: 'Ibiúna', exact: true }).click()
  await expect(page).toHaveURL(/municipio=/)
  await expect(page).toHaveURL(new RegExp(`orgao=${cityHallId}`))
  await expect(organizationFilter).toHaveValue(`Prefeitura ${id} — Ibiúna`)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(`Hugo ${id}`)
})
