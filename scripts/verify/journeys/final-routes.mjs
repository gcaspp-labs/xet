// Endereços finais de Chamados e Atendimentos: ver features/final-routes.md.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('final-routes', async (t) => {
  const { sector, closed } = await t.step(
    'Preparar setor, um chamado encerrado e um ainda na fila',
    async () => {
      const seeded = await t.seedSector({ agents: 1, modules: ['Folha'] })
      const org = await t.seedOrganization()
      const [{ id: orgId }] = t.sql(`select id from organizations where name = '${org.name}'`)
      const [{ id: moduleId }] = t.sql(
        `select id from modules where sector_id = ${seeded.id} and name = 'Folha'`,
      )
      const rita = t.customer('Rita Encerrada')
      await t.apiOk(
        t.admin.post('/api/contacts', {
          data: {
            name: rita.name,
            phone: rita.phone,
            organizationId: Number(orgId),
            sectorIds: [seeded.id],
          },
        }),
        'cadastrar contato',
      )
      await t.phone(seeded.id).receive(rita, 'Preciso do contracheque')
      const agentApi = await t.apiAs(seeded.agents[0])
      const [ticket] = await (await agentApi.get(`/api/sectors/${seeded.id}/tickets`)).json()
      await t.apiOk(agentApi.post(`/api/tickets/${ticket.id}/assign`), 'assumir')
      await t.apiOk(
        agentApi.post(`/api/tickets/${ticket.id}/close`, {
          data: {
            subject: 'Contracheque',
            resolution: 'Enviada a segunda via.',
            moduleIds: [Number(moduleId)],
            organizationId: Number(orgId),
          },
        }),
        'encerrar',
      )
      await t.phone(seeded.id).receive(t.customer('Tiago Na Fila'), 'Olá')
      return { sector: seeded, closed: { id: ticket.id, name: rita.name } }
    },
  )

  const page = await t.signIn(sector.agents[0])
  const notFound = page.getByRole('heading', { name: 'Não encontrado' })

  // Aberto direto, sem página anterior no app: Voltar leva ao início, que é a tela Chamados.
  const expectNotFound = async (address, shot) => {
    await page.goto(address)
    await expect(notFound).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${address}$`))
    await expect(page.getByRole('alert')).toContainText('Esta página não existe')
    if (shot) await t.shot(page, shot)
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page).toHaveURL(/\/chamados$/)
  }

  await t.step('Os três endereços antigos mostram Não encontrado, com Voltar', async () => {
    await expectNotFound('/conversas', 'conversas')
    await expectNotFound('/conversas/1')
    await expectNotFound('/atendimento')
  })

  await t.step('Um endereço desconhecido qualquer mostra Não encontrado, com Voltar', async () => {
    await expectNotFound('/qualquer-coisa-que-nao-existe', 'endereco-desconhecido')
  })

  await t.step('Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar', async () => {
    await expectNotFound('/chamados/99999999', 'chamado-inexistente')
    await expectNotFound('/chamados/abc')
  })

  await t.step('/chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id', async () => {
    await page.goto(`/chamados/${closed.id}`)
    await expect(page).toHaveURL(new RegExp(`/atendimentos/${closed.id}$`))
    await expect(page.getByRole('heading', { name: closed.name })).toBeVisible()
    await expect(page.getByRole('status', { name: 'Só leitura' })).toContainText('Encerrado em')
    await expect(notFound).toHaveCount(0)
    await t.shot(page, 'encerrado-leva-a-ficha')
  })

  await t.step('Estado final: navegar pelos endereços não mudou nenhum chamado', async () => {
    const tickets = t.sql(
      `select status, closure_type from tickets where sector_id = ${sector.id} order by id`,
    )
    expect(tickets).toEqual([
      { status: 'closed', closure_type: 'resolved' },
      { status: 'queued', closure_type: null },
    ])
    t.observe('Chamados do setor (banco)', tickets)
  })
})
