// Chamado mesclado num pendente, em Atendimentos e na ficha: ver features/mesclado-no-atendimento.md.
import { atendimentosRowOf, conversationOf, expect, journey } from '../scripts/journey-lib.mjs'

await journey('mesclado-no-atendimento', async (t) => {
  const data = await t.step(
    'Preparar um atendimento encerrado mesclado num chamado pendente',
    async () => {
      const sector = await t.seedSector({ agents: 1, modules: ['Folha'] })
      const org = await t.seedOrganization()
      const customer = t.customer('Sônia Reis')
      const orgId = Number(t.sql(`select id from organizations where name = '${org.name}'`)[0].id)
      const moduleId = Number(
        t.sql(`select id from modules where sector_id = ${sector.id} and name = 'Folha'`)[0].id,
      )
      await t.apiOk(
        t.admin.post('/api/contacts', {
          data: {
            name: customer.name,
            phone: customer.phone,
            organizationId: orgId,
            sectorIds: [sector.id],
          },
        }),
        `cadastrar ${customer.name}`,
      )

      const phone = t.phone(sector.id)
      const agent = await t.apiAs(sector.agents[0])
      const take = async () => {
        const tickets = await (await agent.get(`/api/sectors/${sector.id}/tickets`)).json()
        const ticket = tickets.find(
          (item) => item.contact.name === customer.name && item.status === 'queued',
        )
        expect(ticket, 'chamado do contato na fila').toBeTruthy()
        await t.apiOk(agent.post(`/api/tickets/${ticket.id}/assign`), 'assumir')
        return ticket
      }

      // O pendente nasce primeiro, com o cliente esperando. Ele volta a escrever e abre o chamado
      // novo, que o atendente assume, encerra e mescla no pendente pela correção.
      await phone.receive(customer, 'Preciso da segunda via do contracheque')
      const original = await take()
      await t.apiOk(
        agent.post(`/api/tickets/${original.id}/pending`, {
          data: { reason: 'Aguardando o cliente' },
        }),
        'marcar pendente',
      )

      await phone.receive(customer, 'Agora preciso do comprovante de férias')
      const merged = await take()
      await t.apiOk(
        agent.post(`/api/tickets/${merged.id}/close`, {
          data: {
            subject: 'Comprovante de férias',
            resolution: 'Enviado por e-mail.',
            moduleIds: [moduleId],
            organizationId: orgId,
          },
        }),
        'encerrar',
      )
      await t.apiOk(
        agent.post(`/api/tickets/${merged.id}/merge-into-pending`, {
          data: { pendingTicketId: original.id },
        }),
        'mesclar o encerrado no pendente',
      )
      return { sector, customer, merged, original }
    },
  )

  const { sector, merged, original } = data
  const page = await t.signIn(sector.agents[0], { viewport: { width: 1440, height: 900 } })
  const linkTo = (protocol) => page.getByRole('link', { name: `Ver chamado ${protocol}` })

  await t.step(
    'Atendimentos: o mesclado aparece com a situação Mesclado e o link para o original',
    async () => {
      const row = await atendimentosRowOf(page, merged.protocol)
      await expect(row).toContainText('Mesclado')
      await expect(row).not.toContainText('Encerrado')
      await expect(linkTo(original.protocol)).toBeVisible()
      await t.shot(page, 'lista-com-mesclado')
    },
  )

  await t.step(
    'O link da lista abre o chamado original, já encerrado, em Atendimentos',
    async () => {
      await linkTo(original.protocol).click()
      await expect(page).toHaveURL(new RegExp(`/atendimentos/${original.id}$`))
      await expect(page.getByRole('heading', { name: 'Sônia Reis' })).toBeVisible()
      await expect(page.getByText('Comprovante de férias').first()).toBeVisible()
      await t.shot(page, 'original-em-atendimentos')
    },
  )

  await t.step(
    'A ficha do mesclado só avisa a mesclagem, com o link, sem conversa e sem Corrigir',
    async () => {
      await page.goto(`/atendimentos/${merged.id}`)
      const conversation = conversationOf(page)
      await expect(conversation).toContainText('Chamado mesclado')
      await expect(conversation).toContainText(
        'As mensagens deste chamado foram para o chamado original.',
      )
      await expect(conversation).toContainText(`Ver chamado ${original.protocol}`)
      await expect(page.getByText('Agora preciso do comprovante de férias')).toHaveCount(0)
      await expect(page.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Corrigir', exact: true })).toHaveCount(0)
      await expect(page.getByRole('status', { name: 'Só leitura' })).toBeVisible()
      await t.shot(page, 'ficha-do-mesclado')
      await conversation.getByRole('link', { name: `Ver chamado ${original.protocol}` }).click()
      await expect(page).toHaveURL(new RegExp(`/atendimentos/${original.id}$`))
    },
  )

  await t.step('O histórico do contato mostra o mesclado com a situação Mesclado', async () => {
    await page.getByRole('tab', { name: 'Histórico' }).click()
    const entry = page
      .getByRole('list', { name: 'Chamados do contato' })
      .getByRole('listitem')
      .filter({ hasText: merged.protocol })
    await expect(entry).toContainText('Mesclado')
    await expect(entry).not.toContainText('Encerrado')
    await t.shot(page, 'historico-do-contato')
  })

  await t.step('Estado final no banco', async () => {
    const mergedRow = t.sql(
      `select status, closure_type, merged_into_ticket_id from tickets where id = ${merged.id}`,
    )
    t.observe('Chamado mesclado (banco)', JSON.stringify(mergedRow))
    expect(mergedRow[0]).toEqual({
      status: 'closed',
      closure_type: 'merged',
      merged_into_ticket_id: original.id,
    })
    const originalRow = t.sql(
      `select status, closure_type, subject from tickets where id = ${original.id}`,
    )
    t.observe('Chamado original (banco)', JSON.stringify(originalRow))
    expect(originalRow[0]).toEqual({
      status: 'closed',
      closure_type: 'resolved',
      subject: 'Comprovante de férias',
    })
  })
})
