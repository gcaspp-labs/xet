import { expect, test } from '@playwright/test'
import { admin, seedDirectory, seedSector, signIn, unique, userPassword } from './fixtures'

test('abre e cancela novo chamado na tela Chamados vazia', async ({ page, baseURL }) => {
  const { agent } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: 'Cancelar' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/\/conversas$/)
})

test('cancela com chamado selecionado e inicia outro pelo próprio setor', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, agent } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const name = `Cliente novo ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name, phone, organization: 0, sector: sector.id }],
  )
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${id}`,
          phone: unique().phone,
          contactName: 'Cliente selecionado',
          body: 'Olá',
        },
      })
    ).ok(),
  ).toBeTruthy()
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page.getByRole('button', { name: 'Assumir chamado de Cliente selecionado' }).click()
  await expect(page).toHaveURL(/\/conversas\/\d+$/)
  const selectedUrl = page.url()
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  await sheet.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page).toHaveURL(selectedUrl)
  await expect(page.getByRole('heading', { name: 'Cliente selecionado' })).toBeVisible()
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(name)
  await sheet.getByRole('button', { name: new RegExp(name) }).click()
  await sheet.getByRole('textbox', { name: 'Mensagem' }).fill('Primeira mensagem de teste')
  await sheet.getByRole('button', { name: 'Enviar' }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Primeira mensagem de teste',
  )
})

test('supervisor encontra chamado aberto sem enviar outra mensagem', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector, supervisor } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const name = `Contato existente ${id}`
  expect(
    (
      await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
        data: {
          externalMessageId: `E2E-${id}`,
          phone,
          contactName: name,
          body: 'Mensagem existente',
        },
      })
    ).ok(),
  ).toBeTruthy()
  await signIn(page, supervisor, userPassword)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(phone)
  await sheet.getByRole('button', { name: new RegExp(name) }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByText('O contato já tem um chamado aberto no setor.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Mensagem existente',
  )
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
})

test('administrador escolhe o setor para iniciar o chamado', async ({ page, baseURL }) => {
  const { sector } = await seedSector(baseURL!)
  const { id, phone } = unique()
  const name = `Contato administrador ${id}`
  await seedDirectory(
    baseURL!,
    [{ name: `Prefeitura ${id}` }],
    [{ name, phone, organization: 0, sector: sector.id }],
  )
  await signIn(page, admin.email, admin.password)
  await page.getByRole('link', { name: 'Chamados', exact: true }).click()
  await page.getByRole('combobox', { name: 'Setor', exact: true }).click()
  await page.getByRole('option', { name: sector.name, exact: true }).click()
  await page.getByRole('button', { name: 'Novo chamado' }).click()
  const sheet = page.getByRole('dialog', { name: 'Novo chamado' })
  await sheet.getByRole('searchbox', { name: 'Buscar contato' }).fill(name)
  await sheet.getByRole('button', { name: new RegExp(name) }).click()
  await sheet.getByRole('textbox', { name: 'Mensagem' }).fill('Mensagem do setor escolhido')
  await sheet.getByRole('button', { name: 'Enviar' }).click()
  await expect(page).toHaveURL(/\/chamados\/\d+$/)
  await expect(page.getByRole('heading', { name })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Mensagem do setor escolhido',
  )
  await expect(page.getByText(sector.name).first()).toBeVisible()
})
