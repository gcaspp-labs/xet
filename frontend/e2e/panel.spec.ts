import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { seedSector, signIn, unique, userPassword } from './fixtures'

// Mensagem de texto de um contato, simulada pelo adaptador falso do backend.
async function receive(
  request: APIRequestContext,
  sectorId: number,
  message: { phone: string; contactName: string; body: string },
) {
  const response = await request.post(`/api/test/messaging/sectors/${sectorId}/receive`, {
    data: { externalMessageId: `E2E-${unique().id}`, ...message },
  })
  expect(response.ok()).toBeTruthy()
}

const card = (page: Page, title: string) => page.getByRole('region', { name: title })

test('nova mensagem aparece no painel sem recarregar e o atendente assume o chamado', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  await signIn(page, agent, userPassword)
  await expect(page.getByRole('heading', { name: 'Atendimento' })).toBeVisible()
  const queue = card(page, 'Fila do setor')
  await expect(queue.getByText('Nenhum chamado na fila.')).toBeVisible()

  // O supervisor acompanha o mesmo setor em outra janela.
  const otherContext = await browser.newContext()
  const other = await otherContext.newPage()
  await signIn(other, supervisor, userPassword)
  await expect(card(other, 'Fila do setor').getByText('Nenhum chamado na fila.')).toBeVisible()

  const { phone } = unique()
  await receive(request, sector.id, { phone, contactName: 'Maria Cliente', body: 'Bom dia' })
  const row = queue.getByRole('row', { name: /Maria Cliente/ })
  await expect(row).toContainText('Bom dia')
  await expect(row).toContainText('Não cadastrado')
  await expect(row).toContainText(/\d{4}-\d{6}/)

  // Nova mensagem no mesmo chamado atualiza a prévia, sem criar outro chamado.
  await receive(request, sector.id, {
    phone,
    contactName: 'Maria Cliente',
    body: 'Preciso de ajuda',
  })
  await expect(row).toContainText('Preciso de ajuda')
  await expect(queue.getByRole('row', { name: /Maria Cliente/ })).toHaveCount(1)
  await expect(
    card(other, 'Fila do setor').getByRole('row', { name: /Maria Cliente/ }),
  ).toContainText('Preciso de ajuda')

  await row.getByRole('button', { name: 'Assumir chamado de Maria Cliente' }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  await expect(queue.getByText('Nenhum chamado na fila.')).toBeVisible()
  const mine = card(page, 'Em atendimento').getByRole('row', { name: /Maria Cliente/ })
  await expect(mine).toContainText('Você')
  const workload = card(page, 'Chamados por atendente')
  await expect(workload.getByRole('row', { name: /^agent / })).toContainText('1')

  // A outra janela vê o responsável e a contagem sem recarregar.
  await expect(card(other, 'Fila do setor').getByText('Nenhum chamado na fila.')).toBeVisible()
  await expect(
    card(other, 'Em atendimento').getByRole('row', { name: /Maria Cliente/ }),
  ).toContainText(/agent \d+/)
  await expect(
    card(other, 'Chamados por atendente').getByRole('row', { name: /^agent / }),
  ).toContainText('1')
  await otherContext.close()
})

test('atendente de outro setor não vê a fila', async ({ page, request, baseURL }) => {
  const first = await seedSector(baseURL!)
  const second = await seedSector(baseURL!)
  await signIn(page, second.agent, userPassword)
  const queue = card(page, 'Fila do setor')
  await expect(queue.getByText('Nenhum chamado na fila.')).toBeVisible()

  await receive(request, first.sector.id, {
    phone: unique().phone,
    contactName: 'Contato de outro setor',
    body: 'Olá',
  })
  // Uma mensagem no próprio setor chega; a do outro setor não.
  await receive(request, second.sector.id, {
    phone: unique().phone,
    contactName: 'Contato do setor',
    body: 'Olá',
  })
  await expect(queue.getByRole('row', { name: /Contato do setor/ })).toBeVisible()
  await expect(page.getByText('Contato de outro setor')).toHaveCount(0)
})
