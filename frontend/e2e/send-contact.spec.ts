import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {
  adminApi,
  json,
  municipalityId,
  ok,
  openQueued,
  seedSector,
  signIn,
  unique,
  userPassword,
} from './fixtures'

// Liga o número do setor pelo adaptador falso.
async function connectSector(baseURL: string, sectorId: number) {
  const api = await adminApi(baseURL)
  ok(await api.post(`/api/sectors/${sectorId}/connection`))
  await api.dispose()
}

async function phone(request: APIRequestContext, sectorId: number, action: string, data?: object) {
  ok(
    await request.post(`/api/test/messaging/sectors/${sectorId}/${action}`, {
      data,
    }),
  )
}

// Chamado assumido pelo atendente, com a conversa aberta.
async function openOwnTicket(page: Page, request: APIRequestContext, baseURL: string) {
  const { sector, agent } = await seedSector(baseURL)
  await connectSector(baseURL, sector.id)
  await phone(request, sector.id, 'pair')
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName: 'Paula Cliente',
    body: 'Bom dia',
  })
  await signIn(page, agent, userPassword)
  await openQueued(page, 'Paula Cliente')
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  return { conversation, sector, agent }
}

// Um órgão num município e os contatos dele no setor do chamado, pela API do administrador.
async function seedContacts(
  baseURL: string,
  sectorId: number,
  organizations: { name: string; municipality: string }[],
  contacts: { name: string; phone: string; organization: number; sector?: number }[],
) {
  const api = await adminApi(baseURL)
  const created: { id: number; name: string }[] = []
  for (const organization of organizations) {
    created.push(
      await json<{ id: number; name: string }>(
        await api.post('/api/organizations', {
          data: {
            name: organization.name,
            municipalityId: await municipalityId(api, organization.municipality),
          },
        }),
      ),
    )
  }
  for (const contact of contacts) {
    const response = await api.post('/api/contacts', {
      data: {
        name: contact.name,
        phone: contact.phone,
        organizationId: created[contact.organization].id,
        sectorIds: [contact.sector ?? sectorId],
      },
    })
    if (!response.ok()) {
      throw new Error(
        `contato ${contact.name} ${contact.phone}: ${response.status()} ${await response.text()}`,
      )
    }
  }
  await api.dispose()
  return created
}

// Tab até o alvo receber o foco, para o teste não depender de quantos filtros existem na janela.
async function tabTo(page: Page, target: Locator, steps = 12) {
  for (let step = 0; step < steps; step++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Enviar contato' })
const search = (page: Page) => dialog(page).getByRole('searchbox', { name: 'Buscar contato' })
const results = (page: Page) => dialog(page).getByRole('list', { name: 'Contatos' })
const row = (page: Page, name: string) =>
  results(page).getByRole('button', { name: new RegExp(name) })
const empty = (page: Page) => dialog(page).getByText('Nenhum contato encontrado.')

// Abre a janela "Enviar contato" pelo menu do clipe.
async function openSendContact(page: Page) {
  await page.getByRole('button', { name: 'Anexar arquivo' }).click()
  await page.getByRole('menuitem', { name: 'Contato', exact: true }).click()
  await expect(dialog(page)).toBeVisible()
}

// Mensagens do chamado como a API devolve, para conferir o que ficou gravado e a situação de
// entrega que o provedor falso devolveu.
async function messages(page: Page, ticketId: number) {
  return json<
    {
      id: number
      type: string
      status: string | null
      body: string | null
      contactCards: { name: string; organization: string | null; phones: { phone: string }[] }[]
    }[]
  >(await page.request.get(`/api/tickets/${ticketId}/messages`))
}

const sentCard = (page: Page, name: string) =>
  page
    .getByRole('region', { name: 'Conversa', exact: true })
    .getByRole('listitem', { name: 'Mensagem enviada' })
    .filter({ has: page.getByRole('group', { name: new RegExp(`^Contato: ${name},`) }) })

test('o responsável abre o menu, escolhe Contato, busca por nome, telefone, órgão e município, confere a prévia e envia', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector } = await openOwnTicket(page, request, baseURL!)
  const { id } = unique()
  const phones = {
    alves: `55119${id.slice(-8)}`,
    prado: `55119${String(Number(id.slice(-8)) + 1).padStart(8, '0')}`,
  }
  const names = { alves: `Joana ${id} Alves`, prado: `Joana ${id} Prado` }
  const organizations = { prefeitura: `Prefeitura ${id}`, camara: `Câmara ${id}` }
  await seedContacts(
    baseURL!,
    sector.id,
    [
      { name: organizations.prefeitura, municipality: 'Campinas' },
      { name: organizations.camara, municipality: 'Itu' },
    ],
    [
      { name: names.alves, phone: phones.alves, organization: 0 },
      { name: names.prado, phone: phones.prado, organization: 1 },
    ],
  )

  // O clipe abre um menu com "Arquivo" (o de sempre) e "Contato".
  await page.getByRole('button', { name: 'Anexar arquivo' }).click()
  await expect(page.getByRole('menuitem', { name: 'Arquivo', exact: true })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Contato', exact: true }).click()
  await expect(dialog(page)).toBeVisible()
  await expect(search(page)).toBeFocused()

  // Busca por nome: os dois homônimos, cada linha com telefone e órgão com o município.
  await search(page).fill(`Joana ${id}`)
  await expect(results(page).getByRole('button')).toHaveCount(2)
  await expect(row(page, names.alves)).toContainText('+55 (11)')
  await expect(row(page, names.alves)).toContainText(`${organizations.prefeitura} — Campinas`)
  await expect(row(page, names.prado)).toContainText(`${organizations.camara} — Itu`)

  // Busca por telefone, por órgão e por município.
  await search(page).fill(phones.alves)
  await expect(row(page, names.alves)).toBeVisible()
  await expect(row(page, names.prado)).toHaveCount(0)
  await search(page).fill(organizations.camara)
  await expect(row(page, names.prado)).toBeVisible()
  await expect(row(page, names.alves)).toHaveCount(0)
  await search(page).fill('Itu')
  await expect(row(page, names.prado)).toBeVisible()
  await expect(row(page, names.alves)).toHaveCount(0)

  // A prévia mostra o cartão como o cliente recebe; Voltar devolve à busca.
  await search(page).fill(names.alves)
  await row(page, names.alves).click()
  const card = dialog(page).getByRole('group', { name: new RegExp(`^Contato: ${names.alves},`) })
  await expect(card).toBeVisible()
  await expect(card).toContainText(names.alves)
  await expect(card).toContainText('+55 (11)')
  await expect(card).toContainText(`${organizations.prefeitura} — Campinas`)
  await expect(dialog(page)).toContainText(
    'Sem legenda, como o áudio. O cliente toca para conversar ou salvar.',
  )
  await dialog(page).getByRole('button', { name: 'Voltar' }).click()
  await expect(search(page)).toBeVisible()
  await search(page).fill(names.alves)
  await row(page, names.alves).click()

  // Enviar: a janela fecha, o cartão entra na conversa com a situação de entrega e o foco volta ao
  // campo de mensagem.
  await dialog(page).getByRole('button', { name: 'Enviar' }).click()
  await expect(dialog(page)).toHaveCount(0)
  const ticketCard = sentCard(page, names.alves)
  await expect(ticketCard).toContainText('Enviada')
  await expect(ticketCard).toContainText(`${organizations.prefeitura} — Campinas`)
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeFocused()

  // O falso recebeu o contato: a mensagem ficou gravada como cartão, e a situação "Enviada" só vem
  // depois de o adaptador falso aceitar o envio e devolver o identificador.
  const ticketId = (await page.request
    .get(`/api/sectors/${sector.id}/tickets`)
    .then((r) => r.json())) as {
    id: number
    contact: { name: string }
  }[]
  const ticket = ticketId.find((item) => item.contact.name === 'Paula Cliente')!.id
  const list = await messages(page, ticket)
  const last = list.at(-1)!
  expect(last.type).toBe('contact')
  expect(last.status).toBe('sent')
  expect(last.body).toBeNull()
  expect(last.contactCards[0].name).toBe(names.alves)
  expect(last.contactCards[0].phones[0].phone).toBe(phones.alves)
  expect(last.contactCards[0].organization).toContain('Campinas')
})

test('a busca abre em Meu setor, mostra todos com a opção e deixa de fora contato de outro setor e não cadastrado', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector } = await openOwnTicket(page, request, baseURL!)
  const { id } = unique()
  const other = await seedSector(baseURL!)
  const names = { own: `Bruno ${id} Setor`, other: `Bia ${id} Outro`, unknown: `Zeca ${id} Sem` }
  await seedContacts(
    baseURL!,
    sector.id,
    [{ name: `Órgão ${id}`, municipality: 'Itu' }],
    [
      { name: names.own, phone: `5511${id.slice(-9)}`, organization: 0 },
      {
        name: names.other,
        phone: `5511${String(Number(id.slice(-9)) + 1).padStart(9, '0')}`,
        organization: 0,
        sector: other.sector.id,
      },
    ],
  )
  // Contato não cadastrado: chegou por mensagem de um número desconhecido, na fila do setor.
  await phone(request, sector.id, 'receive', {
    externalMessageId: `E2E-${id}-desconhecido`,
    phone: unique().phone,
    contactName: names.unknown,
    body: 'Oi',
  })

  await openSendContact(page)
  // Abre em "Meu setor": o contato do próprio setor aparece, o do outro não.
  await expect(dialog(page).getByRole('combobox', { name: 'Filtrar por setor' })).toContainText(
    'Meu setor',
  )
  await search(page).fill(names.own)
  await expect(row(page, names.own)).toBeVisible()
  await search(page).fill(names.other)
  await expect(empty(page)).toBeVisible()

  // "Todos os setores" mostra o contato do outro setor.
  await dialog(page).getByRole('combobox', { name: 'Filtrar por setor' }).click()
  await page.getByRole('option', { name: 'Todos os setores' }).click()
  await search(page).fill(names.other)
  await expect(row(page, names.other)).toBeVisible()

  // Contato não cadastrado não aparece.
  await search(page).fill(names.unknown)
  await expect(empty(page)).toBeVisible()
})

test('Voltar na prévia volta à busca, e Cancelar fecha sem enviar nada', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector } = await openOwnTicket(page, request, baseURL!)
  const { id } = unique()
  const name = `Célia ${id} Rocha`
  await seedContacts(
    baseURL!,
    sector.id,
    [{ name: `Órgão ${id}`, municipality: 'Itu' }],
    [{ name, phone: `55119${id.slice(-8)}`, organization: 0 }],
  )
  const ticket = (
    (await (await page.request.get(`/api/sectors/${sector.id}/tickets`)).json()) as {
      id: number
      contact: { name: string }
    }[]
  ).find((item) => item.contact.name === 'Paula Cliente')!.id
  const before = await messages(page, ticket)

  await openSendContact(page)
  await search(page).fill(name)
  await row(page, name).click()
  await expect(
    dialog(page).getByRole('group', { name: new RegExp(`^Contato: ${name},`) }),
  ).toBeVisible()

  // Voltar devolve à busca, com o foco nela.
  await dialog(page).getByRole('button', { name: 'Voltar' }).click()
  await expect(search(page)).toBeFocused()
  await search(page).fill(name)
  await row(page, name).click()

  // Cancelar fecha sem enviar nada, e o foco volta ao campo de mensagem.
  await dialog(page).getByRole('button', { name: 'Cancelar' }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeFocused()
  expect(await messages(page, ticket)).toEqual(before)
})

test('o fluxo inteiro funciona pelo teclado, com nomes acessíveis', async ({
  page,
  request,
  baseURL,
}) => {
  const { sector } = await openOwnTicket(page, request, baseURL!)
  const { id } = unique()
  const name = `Dora ${id} Lima`
  const phoneNumber = `55119${id.slice(-8)}`
  await seedContacts(
    baseURL!,
    sector.id,
    [{ name: `Órgão ${id}`, municipality: 'Itu' }],
    [{ name, phone: phoneNumber, organization: 0 }],
  )

  // O menu abre pelo teclado, e as setas percorrem os itens.
  const trigger = page.getByRole('button', { name: 'Anexar arquivo' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Arquivo', exact: true })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('menuitem', { name: 'Contato', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeVisible()
  await expect(search(page)).toBeFocused()

  // Digitar busca, Tab pelos filtros até a linha e Enter escolhe o contato.
  await page.keyboard.type(name)
  await expect(row(page, name)).toBeVisible()
  await tabTo(page, row(page, name))
  await page.keyboard.press('Enter')
  const card = dialog(page).getByRole('group', { name: new RegExp(`^Contato: ${name},`) })
  await expect(card).toBeVisible()

  // Tab percorre o rodapé até "Enviar", e Enter envia.
  await tabTo(page, dialog(page).getByRole('button', { name: 'Voltar' }))
  await page.keyboard.press('Tab')
  await expect(dialog(page).getByRole('button', { name: 'Cancelar' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog(page).getByRole('button', { name: 'Enviar' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toHaveCount(0)
  await expect(sentCard(page, name)).toContainText('Enviada')
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeFocused()
})

test('Esc fecha a janela e o foco volta ao campo de mensagem; "Arquivo" pelo menu segue anexando', async ({
  page,
  request,
  baseURL,
}) => {
  const { conversation } = await openOwnTicket(page, request, baseURL!)

  await openSendContact(page)
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Mensagem' })).toBeFocused()

  // "Arquivo" no menu escolhe o arquivo como o botão de antes.
  await page.getByRole('button', { name: 'Anexar arquivo' }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('menuitem', { name: 'Arquivo', exact: true }).click()
  await (
    await chooser
  ).setFiles({ name: 'balancete.pdf', mimeType: 'application/pdf', buffer: Buffer.from('x') })
  await expect(conversation.getByText('balancete.pdf')).toBeVisible()
})

// Sem o chamado aberto para o atendente, não há menu do anexo: nada de "Contato" nem de colar e
// soltar, como no anexo de antes.
test('quem não é o responsável não vê o menu do anexo', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  await openOwnTicket(page, request, baseURL!)
  const other = await seedSector(baseURL!)

  const context = await browser.newContext()
  const outsider = await context.newPage()
  await signIn(outsider, other.agent, userPassword)
  // Um chamado do próprio setor, na fila: sem responsável, o campo de mensagem nem aparece.
  await phone(request, other.sector.id, 'receive', {
    externalMessageId: `E2E-${unique().id}`,
    phone: unique().phone,
    contactName: 'Rita Cliente',
    body: 'Bom dia',
  })
  await openQueued(outsider, 'Rita Cliente', other.sector.id)
  await expect(outsider.getByRole('button', { name: 'Anexar arquivo' })).toHaveCount(0)
  await expect(outsider.getByRole('button', { name: 'Contato', exact: true })).toHaveCount(0)
  await context.close()
})
