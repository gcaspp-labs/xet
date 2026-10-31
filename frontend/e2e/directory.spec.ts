import { expect, test } from '@playwright/test'
import {
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
  const { agent } = await seedSector(baseURL!)
  const { id } = unique()
  const cnpj = uniqueCnpj(true)
  const phones = [`5511${id}`, `5521${id}`]
  await seedDirectory(
    baseURL!,
    [{ name: `Tribunal ${id}`, cnpj }, { name: `Consórcio ${id}` }],
    [
      { name: `Beatriz ${id}`, phone: phones[0], organization: 0 },
      { name: `Carlos ${id}`, phone: phones[1], organization: 1 },
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
