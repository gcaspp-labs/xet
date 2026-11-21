import { expect, type Locator, type Page, test } from '@playwright/test'
import { format } from 'date-fns'
import {
  admin,
  adminApi,
  json,
  municipalityId,
  ok,
  recordToasts,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

type Organization = { id: number; name: string; municipality: { name: string } }

// Setor sem número conectado, com um módulo, um assunto com solução e um contato
// cadastrado com o módulo no setor: o que a janela precisa para registrar.
async function seedPhoneSector(baseURL: string) {
  const seed = await seedSector(baseURL)
  const api = await adminApi(baseURL)
  const module = await json<{ id: number }>(
    await api.post(`/api/sectors/${seed.sector.id}/modules`, { data: { name: 'Tributos' } }),
  )
  const subject = await json<{ id: number }>(
    await api.post(`/api/sectors/${seed.sector.id}/subjects`, {
      data: { name: 'Certidão negativa', moduleId: module.id },
    }),
  )
  const solution = 'Certidão emitida depois do ajuste do convênio do órgão.'
  ok(
    await api.post(`/api/sectors/${seed.sector.id}/subjects/${subject.id}/solutions`, {
      data: { body: solution },
    }),
  )
  const { id, phone } = unique()
  const contactName = `Maria ${id}`
  const organization = await json<Organization>(
    await api.post('/api/organizations', {
      data: { name: `Prefeitura ${id}`, municipalityId: await municipalityId(api) },
    }),
  )
  const contact = await json<{ id: number }>(
    await api.post('/api/contacts', {
      data: {
        name: contactName,
        phone,
        organizationId: organization.id,
        sectorIds: [seed.sector.id],
        moduleIds: [module.id],
      },
    }),
  )
  await api.dispose()
  return { ...seed, module, solution, organization, contact, contactName }
}

async function openWindow(page: Page) {
  await page.getByRole('button', { name: 'Registrar atendimento por telefone' }).click()
  const dialog = page.getByRole('dialog', { name: 'Registrar atendimento por telefone' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function chooseContact(dialog: Locator, name: string) {
  // A lista de contatos é a do cadastro inteiro: busca pelo nome único do teste.
  await dialog.getByLabel('Buscar contato').fill(name)
  await dialog.getByRole('button', { name: new RegExp(name) }).click()
  // O formulário do contato chega com o órgão e o módulo sugeridos.
  await expect(dialog.getByRole('checkbox', { name: 'Tributos' })).toBeChecked()
}

// Preenche o atendimento com o assunto e a solução da lista: sem pergunta ao salvar.
async function fillService(page: Page, dialog: Locator, solution: string) {
  await dialog.getByLabel('Assunto').fill('Certidão negativa')
  await dialog.getByLabel('Soluções sugeridas').click()
  await page.getByRole('option', { name: solution }).click()
}

// Os registros por telefone do contato, pela API como administrador.
async function phoneRecords(baseURL: string, contactId: number) {
  const api = await adminApi(baseURL)
  const page = await json<{ items: { channel: string; protocol: string }[] }>(
    await api.get(`/api/contacts/${contactId}/tickets`),
  )
  await api.dispose()
  return page.items.filter((item) => item.channel === 'phone')
}

test('o atendente registra por telefone e vê o protocolo e a marca na lista', async ({
  page,
  baseURL,
}) => {
  const seed = await seedPhoneSector(baseURL!)
  const toasts = await recordToasts(page)
  await signIn(page, seed.agent, userPassword)
  await page.goto('/atendimentos')
  await expect(page.getByRole('heading', { name: 'Atendimentos' })).toBeVisible()

  const dialog = await openWindow(page)
  // Atendente registra no próprio setor, sem escolha.
  await expect(dialog).toContainText(seed.sector.name)
  await expect(dialog).toContainText('só o administrador troca.')
  await expect(dialog.getByRole('combobox', { name: 'Setor' })).toHaveCount(0)
  await chooseContact(dialog, seed.contactName)
  await expect(dialog.getByLabel('Órgão')).toHaveValue(
    `${seed.organization.name} — ${seed.organization.municipality.name}`,
  )
  await fillService(page, dialog, seed.solution)
  await expect(dialog.getByLabel('Resolução')).toHaveValue(seed.solution)
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()

  await expect(dialog).toBeHidden()
  const message = (await toasts()).find((text) => text.startsWith('Atendimento registrado'))
  expect(message).toBeDefined()
  const protocol = /protocolo (\S+)$/.exec(message!)![1]

  // A lista se atualiza com o registro, já encerrado e com a marca Telefone.
  const row = page.getByRole('row', { name: new RegExp(seed.contactName) })
  await expect(row).toContainText(protocol)
  await expect(row).toContainText('Encerrado')
  await expect(row).toContainText('Telefone')
  await expect(row).toContainText('Certidão negativa')
  await expect(row).toContainText('Tributos')

  // Sem número conectado, nada foi enviado e o atendimento não tem conversa.
  expect(await phoneRecords(baseURL!, seed.contact.id)).toHaveLength(1)
  await row.getByRole('link', { name: protocol }).click()
  await expect(page.getByRole('region', { name: 'Atendimento por telefone' })).toContainText(
    'Atendimento por telefone, sem conversa',
  )
})

test('cadastrar o contato pela janela deixa o contato escolhido', async ({ page, baseURL }) => {
  const seed = await seedPhoneSector(baseURL!)
  await signIn(page, seed.agent, userPassword)
  await page.goto('/atendimentos')
  const dialog = await openWindow(page)

  const { id, phone } = unique()
  const newContact = `João ${id}`
  await dialog.getByRole('button', { name: 'Novo contato' }).click()
  const registration = page.getByRole('dialog', { name: 'Novo contato' })
  await registration.getByLabel('Nome').fill(newContact)
  await registration.getByLabel('Telefone').fill(phone)
  await registration.getByLabel('Órgão').fill(seed.organization.name)
  await page
    .getByRole('option', { name: new RegExp(seed.organization.name) })
    .first()
    .click()
  await registration.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(page.getByText('Contato salvo')).toBeVisible()

  // O contato salvo já fica escolhido, com o órgão sugerido.
  await expect(registration).toBeHidden()
  await expect(dialog).toContainText(newContact)
  await expect(dialog.getByLabel('Órgão')).toHaveValue(
    `${seed.organization.name} — ${seed.organization.municipality.name}`,
  )
})

test('trocar o contato e pedir Novo contato abre um cadastro vazio', async ({ page, baseURL }) => {
  const seed = await seedPhoneSector(baseURL!)
  await signIn(page, seed.agent, userPassword)
  await page.goto('/atendimentos')
  const dialog = await openWindow(page)
  await chooseContact(dialog, seed.contactName)

  // Trocar esconde o resumo e volta à busca; o cadastro novo não pode trazer o anterior.
  await dialog.getByRole('button', { name: 'Trocar' }).click()
  await dialog.getByLabel('Buscar contato').fill(seed.contactName)
  await dialog.getByRole('button', { name: 'Novo contato' }).click()
  const registration = page.getByRole('dialog', { name: 'Novo contato' })
  await expect(registration.getByLabel('Nome')).toHaveValue('')
  await expect(registration.getByLabel('Telefone')).toHaveValue('')

  // O contato salvo fica escolhido, com o órgão sugerido, no lugar do anterior.
  const { id, phone } = unique()
  const newContact = `João ${id}`
  await registration.getByLabel('Nome').fill(newContact)
  await registration.getByLabel('Telefone').fill(phone)
  await registration.getByLabel('Órgão').fill(seed.organization.name)
  await page
    .getByRole('option', { name: new RegExp(seed.organization.name) })
    .first()
    .click()
  await registration.getByRole('button', { name: 'Cadastrar contato' }).click()
  await expect(registration).toBeHidden()
  await expect(dialog.getByRole('button', { name: 'Trocar' })).toBeVisible()
  await expect(dialog).toContainText(newContact)
  await expect(dialog).not.toContainText(seed.contactName)
})

test('durante a troca, salvar pede o contato de quem ligou', async ({ page, baseURL }) => {
  const seed = await seedPhoneSector(baseURL!)
  await signIn(page, seed.agent, userPassword)
  await page.goto('/atendimentos')
  const dialog = await openWindow(page)
  await chooseContact(dialog, seed.contactName)
  await fillService(page, dialog, seed.solution)

  // O contato anterior fica oculto na troca: salvar não registra nele.
  await dialog.getByRole('button', { name: 'Trocar' }).click()
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toContainText('Escolha o contato de quem ligou.')
  await expect(dialog).not.toContainText('Atendimento registrado')
  expect(await phoneRecords(baseURL!, seed.contact.id)).toHaveLength(0)

  // Escolhido de novo, o mesmo preenchimento salva uma única vez.
  await chooseContact(dialog, seed.contactName)
  await fillService(page, dialog, seed.solution)
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toBeHidden()
  expect(await phoneRecords(baseURL!, seed.contact.id)).toHaveLength(1)
})

test('cada campo obrigatório que falta é avisado sem perder o resto preenchido', async ({
  page,
  baseURL,
}) => {
  const seed = await seedPhoneSector(baseURL!)
  await signIn(page, seed.agent, userPassword)
  await page.goto('/atendimentos')
  const dialog = await openWindow(page)
  await chooseContact(dialog, seed.contactName)
  await fillService(page, dialog, seed.solution)
  const organization = `${seed.organization.name} — ${seed.organization.municipality.name}`

  // Sem módulo.
  await dialog.getByRole('checkbox', { name: 'Tributos' }).click()
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toContainText('Selecione ao menos um módulo.')
  await expect(dialog.getByLabel('Assunto')).toHaveValue('Certidão negativa')
  await expect(dialog.getByLabel('Resolução')).toHaveValue(seed.solution)
  await expect(dialog.getByLabel('Órgão')).toHaveValue(organization)
  await dialog.getByRole('checkbox', { name: 'Tributos' }).click()

  // Sem assunto.
  await dialog.getByLabel('Assunto').fill('')
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toContainText('Informe o assunto.')
  await expect(dialog.getByLabel('Resolução')).toHaveValue(seed.solution)
  await expect(dialog.getByRole('checkbox', { name: 'Tributos' })).toBeChecked()
  await expect(dialog.getByLabel('Órgão')).toHaveValue(organization)
  await dialog.getByLabel('Assunto').fill('Certidão negativa')

  // Sem resolução.
  await dialog.getByLabel('Resolução').fill('')
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toContainText('Informe a resolução.')
  await expect(dialog.getByLabel('Assunto')).toHaveValue('Certidão negativa')
  await expect(dialog.getByRole('checkbox', { name: 'Tributos' })).toBeChecked()
  await expect(dialog.getByLabel('Órgão')).toHaveValue(organization)

  // Sem contato: o anterior fica oculto na troca, e o resto continua preenchido.
  await dialog.getByLabel('Resolução').fill(seed.solution)
  await dialog.getByRole('button', { name: 'Trocar' }).click()
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toContainText('Escolha o contato de quem ligou.')
  await expect(dialog.getByRole('checkbox', { name: 'Tributos' })).toBeChecked()
  await expect(dialog.getByLabel('Assunto')).toHaveValue('Certidão negativa')
  await expect(dialog.getByLabel('Resolução')).toHaveValue(seed.solution)
  await expect(dialog.getByLabel('Órgão')).toHaveValue(organization)
})

test('sem contato, módulo, assunto ou resolução a janela avisa no campo sem perder o preenchido', async ({
  page,
  baseURL,
}) => {
  const seed = await seedPhoneSector(baseURL!)
  await signIn(page, seed.agent, userPassword)
  await page.goto('/atendimentos')
  const dialog = await openWindow(page)

  // Vazia, a janela avisa cada campo obrigatório.
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toContainText('Confira os campos marcados.')
  await expect(dialog).toContainText('Escolha o contato de quem ligou.')
  await expect(dialog).toContainText('Selecione ao menos um módulo.')
  await expect(dialog).toContainText('Informe o assunto.')
  await expect(dialog).toContainText('Informe a resolução.')

  // Só o contato: o módulo do contato vem marcado.
  await chooseContact(dialog, seed.contactName)
  await expect(dialog).not.toContainText('Escolha o contato de quem ligou.')
  await dialog.getByLabel('Assunto').fill('Dúvida no acesso')
  await dialog.getByLabel('Resolução').fill('Orientado a redefinir a senha.')

  // O fim no futuro e o fim antes do início são recusados, com o resto preenchido.
  const local = (minutes: number) =>
    format(new Date(Date.now() + minutes * 60_000), "yyyy-MM-dd'T'HH:mm")
  await dialog.getByLabel('Fim').fill(local(60))
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toContainText('O fim não pode estar no futuro.')
  await expect(dialog.getByLabel('Assunto')).toHaveValue('Dúvida no acesso')
  await expect(dialog.getByLabel('Resolução')).toHaveValue('Orientado a redefinir a senha.')
  await dialog.getByLabel('Fim').fill(local(-120))
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toContainText('O fim precisa ser depois do início.')
  await expect(dialog.getByLabel('Assunto')).toHaveValue('Dúvida no acesso')
})

test('o administrador escolhe o setor na janela, e o supervisor registra no próprio', async ({
  page,
  baseURL,
}) => {
  const seed = await seedPhoneSector(baseURL!)
  const other = await seedSector(baseURL!)

  // Administrador: o setor é uma escolha, e define os módulos.
  await signIn(page, admin.email, admin.password)
  await page.goto('/atendimentos')
  const dialog = await openWindow(page)
  await expect(dialog).toContainText('só o administrador troca.')
  // Troca para outro setor e volta: o formulário acompanha o setor escolhido.
  await dialog.getByRole('combobox', { name: 'Setor' }).click()
  await page.getByRole('option', { name: other.sector.name }).click()
  await dialog.getByRole('combobox', { name: 'Setor' }).click()
  await page.getByRole('option', { name: seed.sector.name }).click()
  await chooseContact(dialog, seed.contactName)
  await fillService(page, dialog, seed.solution)
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row', { name: new RegExp(seed.contactName) })).toContainText(
    seed.sector.name,
  )
})

test('o supervisor registra no próprio setor, e o duplo clique cria um único registro', async ({
  page,
  baseURL,
}) => {
  const seed = await seedPhoneSector(baseURL!)
  await signIn(page, seed.supervisor, userPassword)
  await page.goto('/atendimentos')
  const dialog = await openWindow(page)

  // O setor do supervisor não é uma escolha.
  await expect(dialog.getByRole('combobox', { name: 'Setor' })).toHaveCount(0)
  await expect(dialog).toContainText(seed.sector.name)
  await chooseContact(dialog, seed.contactName)
  await fillService(page, dialog, seed.solution)

  // Duplo clique: o identificador da requisição devolve o mesmo registro.
  await dialog.getByRole('button', { name: 'Registrar atendimento' }).dblclick()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row', { name: new RegExp(seed.contactName) })).toHaveCount(1)
  expect(await phoneRecords(baseURL!, seed.contact.id)).toHaveLength(1)
})
