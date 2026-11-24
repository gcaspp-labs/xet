// Editar e excluir mensagens pela tela Chamados: ver features/edit-delete-messages-chamados.md.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('edit-delete-messages-chamados', async (t) => {
  const sector = await t.step('Preparar setor conectado com um atendente', () =>
    t.seedSector({ agents: 1 }),
  )
  const [agent] = sector.agents
  const phone = t.phone(sector.id)
  const maria = t.customer('Maria Cliente')
  await t.step('Mensagem do cliente chega à fila', () =>
    phone.receive(maria, 'Preciso do boleto de setembro'),
  )

  const page = await t.signIn(agent)
  const second = await t.signIn(agent)
  const conversation = page.getByRole('region', { name: 'Conversa', exact: true })
  const composer = page.getByRole('textbox', { name: 'Mensagem', exact: true })
  const sent = conversation.getByRole('listitem', { name: 'Mensagem enviada' })
  const menuOf = (bubble) => bubble.getByRole('button', { name: 'Ações da mensagem' })

  const ticketId = await t.step('Atendente assume e responde duas vezes', async () => {
    await page
      .getByRole('region', { name: 'Fila, assuntos e pendentes' })
      .getByRole('button', { name: 'Assumir chamado de Maria Cliente' })
      .click()
    await expect(page).toHaveURL(/\/chamados\/\d+$/)
    for (const text of ['Segue o boleto de setembro', 'Mensagem enviada por engano']) {
      await composer.fill(text)
      await composer.press('Enter')
      await expect(sent.filter({ hasText: text })).toContainText('Enviada')
    }
    await t.shot(page, 'mensagens-enviadas')
    return Number(page.url().split('/').pop())
  })
  await second.goto(page.url())
  const secondSent = second
    .getByRole('region', { name: 'Conversa', exact: true })
    .getByRole('listitem', { name: 'Mensagem enviada' })
  await expect(secondSent).toHaveCount(2)

  await t.step('O menu da mensagem oferece Responder, Editar e Excluir', async () => {
    await sent.first().hover()
    await menuOf(sent.first()).click()
    await expect(page.getByRole('menuitem')).toHaveText(['Responder', 'Editar', 'Excluir'])
    await t.shot(page, 'menu-da-mensagem')
    await page.keyboard.press('Escape')
  })

  await t.step('Editar: a faixa "Editando", o rascunho preservado e Cancelar', async () => {
    await composer.fill('Rascunho em andamento')
    await sent.first().hover()
    await menuOf(sent.first()).click()
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click()
    const banner = page.getByRole('group', { name: 'Editando mensagem' })
    await expect(banner).toContainText('Editando')
    await expect(page.getByRole('textbox', { name: 'Editar mensagem' })).toHaveValue(
      'Segue o boleto de setembro',
    )
    await t.shot(page, 'edicao-no-compositor')
    await banner.getByRole('button', { name: 'Cancelar' }).click()
    await expect(composer).toHaveValue('Rascunho em andamento')
    await composer.fill('')
  })

  await t.step('Editar e salvar: etiqueta Editada nas duas sessões', async () => {
    await sent.first().hover()
    await menuOf(sent.first()).click()
    await page.getByRole('menuitem', { name: 'Editar', exact: true }).click()
    const field = page.getByRole('textbox', { name: 'Editar mensagem' })
    await field.fill('Segue o boleto de outubro')
    await field.press('Enter')
    await expect(sent.first()).toContainText('Segue o boleto de outubro')
    await expect(sent.first()).toContainText('Editada')
    await expect(secondSent.first()).toContainText('Segue o boleto de outubro')
    await expect(secondSent.first()).toContainText('Editada')
    await expect(sent).toHaveCount(2)
    await t.shot(page, 'mensagem-editada')
  })

  await t.step('Excluir: a janela oferece as duas opções e Cancelar não exclui', async () => {
    await sent.nth(1).hover()
    await menuOf(sent.nth(1)).click()
    await page.getByRole('menuitem', { name: 'Excluir', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Excluir mensagem' })
    await expect(dialog.getByRole('button', { name: 'Excluir para todos' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Excluir para mim' })).toBeVisible()
    await t.shot(page, 'janela-de-exclusao')
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog).toHaveCount(0)
    await expect(sent.nth(1)).toContainText('Mensagem enviada por engano')
  })

  await t.step('Excluir para mim: aviso no lugar do conteúdo, nas duas sessões', async () => {
    await sent.nth(1).hover()
    await menuOf(sent.nth(1)).click()
    await page.getByRole('menuitem', { name: 'Excluir', exact: true }).click()
    await page
      .getByRole('dialog', { name: 'Excluir mensagem' })
      .getByRole('button', { name: 'Excluir para mim' })
      .click()
    await expect(sent.nth(1)).toContainText('Mensagem excluída no XET')
    await expect(conversation).not.toContainText('Mensagem enviada por engano')
    await expect(secondSent.nth(1)).toContainText('Mensagem excluída no XET')
    await page.reload()
    await expect(sent.nth(1)).toContainText('Mensagem excluída no XET')
    await t.shot(page, 'mensagem-ocultada')
  })

  await t.step('Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta', async () => {
    const [customerMessage] = t.sql(
      `select external_message_id as id from messages where ticket_id = ${ticketId} and origin = 'customer'`,
    )
    await phone.edit(maria, customerMessage.id, 'Preciso do boleto de outubro')
    const received = conversation.getByRole('listitem', { name: 'Mensagem recebida' })
    await expect(received).toContainText('Preciso do boleto de outubro')
    await expect(received).toContainText('Editada')
    await phone.revoke(maria, customerMessage.id)
    await expect(received).toContainText('Excluída')
    await expect(received).toContainText('Preciso do boleto de outubro')
    await t.shot(page, 'alteracao-externa')
  })

  await t.step('Estado final no banco', async () => {
    const messages = t.sql(
      `select body, edited_at is not null as edited, deletion_scope, deletion_origin, origin
         from messages where ticket_id = ${ticketId} order by id`,
    )
    expect(messages).toHaveLength(3)
    expect(messages[1]).toMatchObject({ edited: true, deletion_scope: null })
    expect(messages[1].body).toContain('Segue o boleto de outubro')
    expect(messages[2]).toMatchObject({ deletion_scope: 'local', deletion_origin: 'agent' })
    t.observe('Mensagens do chamado', messages)
    t.observe(
      'Ações (message_actions)',
      t.sql(
        `select kind, status from message_actions where ticket_id = ${ticketId} order by id`,
      ),
    )
  })
})
