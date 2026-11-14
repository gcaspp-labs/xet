// Acesso à tela Chamados pelo menu, com dados fictícios.
import { expect, journey } from '../scripts/journey-lib.mjs'

await journey('conversas-menu', async (t) => {
  const sector = await t.step('Preparar setor e atendente', () => t.seedSector())
  const agent = sector.agents[0]
  const page = await t.signIn(agent)

  await t.step('Abrir Chamados pelo menu', async () => {
    await page.getByRole('link', { name: 'Chamados', exact: true }).click()
    await expect(page).toHaveURL(/\/conversas$/)
    await expect(page.getByText('Sem atendimentos disponíveis')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Fila' })).toBeVisible()
    await t.shot(page, 'conversas-vazia')
  })

  await t.step('Abrir um chamado e conferir os temas', async () => {
    const customer = t.customer('Cliente de teste')
    await t.phone(sector.id).receive(customer, 'Bom dia, preciso de ajuda')
    await expect(page.getByRole('button', { name: 'Assumir chamado de Cliente de teste' })).toBeVisible()
    await t.shot(page, 'fila-com-chamado')
    await page.getByRole('button', { name: 'Assumir chamado de Cliente de teste' }).click()
    await page.getByRole('textbox', { name: 'Mensagem' }).fill('Olá, como posso ajudar?')
    await page.getByRole('textbox', { name: 'Mensagem' }).press('Enter')
    await expect(page.getByRole('listitem', { name: 'Mensagem enviada' })).toBeVisible()
    await t.shot(page, 'conversa-claro')
    await page.getByRole('button', { name: 'Configurações' }).click()
    await page.getByRole('menuitemradio', { name: 'Escuro' }).click()
    await page.keyboard.press('Escape')
    await t.shot(page, 'conversa-escuro')
    await page.getByRole('button', { name: 'Configurações' }).click()
    await page.getByRole('menuitemradio', { name: 'Claro' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Configurações' }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Alto contraste' }).click()
    await page.keyboard.press('Escape')
    await t.shot(page, 'conversa-alto-contraste')
  })

  await t.step('Estado final do setor', async () => {
    const [result] = t.sql(`select count(*) as n from tickets where sector_id = ${sector.id} and status = 'in_progress'`)
    expect(Number(result.n)).toBe(1)
    t.observe('Chamados em atendimento no setor', { quantidade: Number(result.n) })
  })
})
