import { expect, request as apiRequest, test } from '@playwright/test'
import { admin, recordToasts, seedSector, signIn, unique, userPassword } from './fixtures'

test('chamado devolvido volta à fila, e outra pessoa assume', async ({
  page,
  browser,
  request,
  baseURL,
}) => {
  const { sector, agent, supervisor } = await seedSector(baseURL!)
  const agentName = agent.replace(/^agent\.(\d+)@.*$/, 'agent $1')
  const supName = supervisor.replace(/^supervisor\.(\d+)@.*$/, 'supervisor $1')

  const api = await apiRequest.newContext({ baseURL })
  await api.post('/api/auth/login', { data: { email: admin.email, password: admin.password } })
  expect((await api.post(`/api/sectors/${sector.id}/connection`)).ok()).toBeTruthy()
  expect((await api.post(`/api/test/messaging/sectors/${sector.id}/pair`)).ok()).toBeTruthy()
  const { id } = unique()
  const colleagueName = `Colega ${id}`
  const colleagueEmail = `colega.${id}@e2e.test`
  expect(
    (
      await api.post('/api/users', {
        data: {
          name: colleagueName,
          email: colleagueEmail,
          role: 'agent',
          sectorId: sector.id,
          password: userPassword,
        },
      })
    ).ok(),
  ).toBeTruthy()
  await api.dispose()

  const received = await request.post(`/api/test/messaging/sectors/${sector.id}/receive`, {
    data: {
      externalMessageId: `E2E-${unique().id}`,
      phone: unique().phone,
      contactName: 'Joana Devolvida',
      body: 'Preciso da segunda via da guia',
    },
  })
  expect(received.ok()).toBeTruthy()

  // Na fila, a ação não aparece: o chamado é assumido.
  const toasts = await recordToasts(page)
  await signIn(page, agent, userPassword)
  await page.getByRole('link', { name: 'Joana Devolvida' }).click()
  await page.getByRole('link', { name: 'Ver chamado' }).click()
  const url = page.url()
  await expect(page.getByRole('button', { name: 'Assumir', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Devolver à fila' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(page.getByText('Chamado assumido')).toBeVisible()
  const details = page.getByRole('region', { name: 'Chamado', exact: true })
  const assignedAtRow = details.locator('div', { hasText: /^Assumido em/ }).locator('dd')
  const assignedAt = await assignedAtRow.innerText()

  // Outro atendente acompanha sem poder devolver.
  const colleagueContext = await browser.newContext()
  const colleague = await colleagueContext.newPage()
  await signIn(colleague, colleagueEmail, userPassword)
  await colleague.goto(url)
  const colleagueConversation = colleague.getByRole('region', { name: 'Conversa', exact: true })
  await expect(colleagueConversation).toContainText('Peça a transferência')
  await expect(colleague.getByRole('button', { name: 'Devolver à fila' })).toHaveCount(0)

  // No celular, as ações continuam na tela, sem rolagem lateral.
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(page.getByRole('button', { name: 'Devolver à fila' })).toBeInViewport()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  await page.setViewportSize({ width: 1280, height: 720 })

  // O responsável devolve e volta a Conversas sem chamado aberto.
  await page.getByRole('button', { name: 'Devolver à fila' }).click()
  const sheet = page.getByRole('dialog', { name: 'Devolver à fila' })
  await sheet.getByRole('button', { name: 'Devolver à fila' }).click()
  await expect.poll(toasts).toContain('Chamado devolvido à fila')
  await expect(page).toHaveURL(/\/conversas$/)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toHaveCount(0)

  // O colega vê a devolução sem recarregar e assume.
  const returnedText = `${agentName} devolveu o chamado à fila`
  await expect(
    colleagueConversation
      .getByRole('listitem', { name: 'Registro do chamado' })
      .filter({ hasText: returnedText }),
  ).toBeVisible()
  await expect(colleagueConversation).toContainText('Chamado na fila. Assuma o chamado')
  await colleague.getByRole('button', { name: 'Assumir', exact: true }).click()
  await expect(colleague.getByText('Chamado assumido')).toBeVisible()
  await expect(colleagueConversation).toContainText(`${colleagueName} assumiu o chamado`)
  await expect(colleague.getByRole('textbox', { name: 'Mensagem' })).toBeVisible()

  // O momento em que foi assumido pela primeira vez não muda.
  await page.goto(url)
  await expect(assignedAtRow).toHaveText(assignedAt)
  await expect(page.getByRole('button', { name: 'Devolver à fila' })).toHaveCount(0)

  // O supervisor devolve o chamado de outro atendente.
  const supContext = await browser.newContext()
  const sup = await supContext.newPage()
  const supToasts = await recordToasts(sup)
  await signIn(sup, supervisor, userPassword)
  await sup.goto(url)
  await sup.getByRole('button', { name: 'Devolver à fila' }).click()
  const supSheet = sup.getByRole('dialog', { name: 'Devolver à fila' })
  await supSheet.getByRole('button', { name: 'Devolver à fila' }).click()
  await expect.poll(supToasts).toContain('Chamado devolvido à fila')
  await expect(sup).toHaveURL(/\/conversas$/)
  await expect(colleagueConversation).toContainText(
    `${supName} devolveu à fila o chamado de ${colleagueName}`,
  )
  await expect(colleague.getByRole('textbox', { name: 'Mensagem' })).toHaveCount(0)

  await colleagueContext.close()
  await supContext.close()
})
