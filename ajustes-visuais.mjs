const { expect, journey } = await import(process.env.VERIFY_APP_LIB)

const noSideScroll = (page) =>
  expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(0)

const expectBelow = async (page, trigger) => {
  await expect(async () => {
    const [list, field] = [
      await page.getByRole('listbox').boundingBox(),
      await trigger.boundingBox(),
    ]
    expect(list.y).toBeGreaterThanOrEqual(field.y + field.height)
  }).toPass()
}

await journey('ajustes-visuais', async (t) => {
  const sector = await t.step('Preparar setor com módulos, dois atendentes e dois chamados', async () => {
    const seeded = await t.seedSector({ agents: 2, modules: ['Folha', 'Patrimônio'] })
    const phone = t.phone(seeded.id)
    await phone.receive(t.customer('Carla Cliente'), 'Preciso do contracheque')
    await phone.receive(t.customer('Davi Cliente'), 'Bom dia')
    return seeded
  })
  const supervisor = sector.supervisor

  const page0 = await t.signIn(supervisor)
  const ticketId = await t.step('Supervisor assume o chamado de Carla', async () => {
    await page0.getByRole('link', { name: 'Carla Cliente' }).first().click()
    await page0.getByRole('button', { name: 'Assumir', exact: true }).click()
    await expect(page0.getByText('Chamado assumido')).toBeVisible()
    return Number(page0.url().split('/').pop())
  })
  await t.closeSession(page0)

  for (const [device, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['celular', { width: 375, height: 700 }],
  ]) {
    for (const [theme, themeName] of [
      ['light', 'claro'],
      ['dark', 'escuro'],
    ]) {
      const tag = `${device}-${themeName}`
      const page = await t.signIn(supervisor, { viewport })
      await page.evaluate((chosen) => {
        localStorage.setItem('theme', chosen)
        localStorage.setItem('text-size', 'larger')
      }, theme)

      await t.step(`${tag}: dashboard com texto Maior, seções abertas e sino com borda`, async () => {
        await page.goto('/dashboard')
        await expect(page.locator('html')).toHaveAttribute('data-text-size', 'larger')
        await expect(page.getByRole('group', { name: 'Na fila', exact: true })).toBeVisible()
        await expect(page.getByRole('group', { name: 'Recebidos', exact: true })).toBeVisible()
        await expect(page.getByTestId('notification-count')).toHaveText('1')
        const bell = page.getByRole('banner').getByRole('button', { name: /^Notificações/ })
        const width = await bell.evaluate((element) => getComputedStyle(element).borderTopWidth)
        expect(parseFloat(width)).toBeGreaterThan(0)
        await noSideScroll(page)
        await t.shot(page, `${tag}-dashboard`)
      })

      await t.step(`${tag}: com item escolhido, a lista abre abaixo do campo`, async () => {
        const trigger = page.getByRole('combobox', { name: 'Módulo' })
        await trigger.click()
        await page.getByRole('option', { name: 'Folha' }).click()
        await expect(trigger).toHaveText(/Folha/)
        await trigger.click()
        await expectBelow(page, trigger)
        await t.shot(page, `${tag}-lista-abaixo`)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('listbox')).toHaveCount(0)
        await noSideScroll(page)
      })

      await t.step(`${tag}: as duas seções recolhidas mantêm títulos e datas`, async () => {
        await page.goto('/dashboard')
        await page.getByRole('button', { name: 'Recolher Agora' }).click()
        await page.getByRole('button', { name: 'Recolher No período' }).click()
        await expect(page.getByRole('group', { name: 'Na fila', exact: true })).toHaveCount(0)
        await expect(page.getByRole('group', { name: 'Recebidos', exact: true })).toHaveCount(0)
        await expect(page.getByRole('heading', { name: 'No período' })).toBeVisible()
        await expect(
          page.getByRole('region', { name: 'No período', exact: true }).locator('p.caption.mono-num'),
        ).toBeVisible()
        await noSideScroll(page)
        await t.shot(page, `${tag}-secoes-recolhidas`)
        await page.reload()
        await expect(page.getByRole('button', { name: 'Abrir Agora' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Abrir No período' })).toBeVisible()
      })

      await t.step(`${tag}: dentro de janela, a lista abre abaixo do campo`, async () => {
        await page.goto(`/chamados/${ticketId}`)
        await page.getByRole('button', { name: 'Transferir', exact: true }).click()
        const dialog = page.getByRole('dialog')
        const trigger = dialog.getByRole('combobox')
        await trigger.click()
        await page.getByRole('option').first().click()
        await trigger.click()
        await expectBelow(page, trigger)
        await noSideScroll(page)
        await t.shot(page, `${tag}-lista-em-janela`)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('listbox')).toHaveCount(0)
      })
      await t.closeSession(page)
    }
  }

  await t.step('Estado final no banco: a tela não alterou os chamados', async () => {
    const tickets = t.sql(
      `select status, count(*) from tickets where sector_id = ${sector.id} group by status order by status`,
    )
    t.observe('Chamados do setor', tickets)
    expect(JSON.stringify(tickets)).toContain('queued')
    expect(JSON.stringify(tickets)).toContain('in_progress')
  })
})
