# Jornada específica da revisão T86

Executada por `drive.sh`, no commit verificado, com credenciais efêmeras.

```javascript
const { expect, journey } = await import(process.env.VERIFY_APP_LIB)
const noScroll = async (p) => expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
async function position(p, field, side) {
  await expect(async () => {
    const f = await field.boundingBox(), l = await p.getByRole('listbox').boundingBox()
    expect(f).toBeTruthy(); expect(l).toBeTruthy()
    if (side === 'below') expect(l.y).toBeGreaterThanOrEqual(f.y + f.height)
    else { expect(l.y + l.height).toBeLessThanOrEqual(f.y); expect(l.y).toBeGreaterThanOrEqual(0) }
  }).toPass()
}
await journey('revisao-t86', async (t) => {
  const sector = await t.step('Preparar setor conectado, módulos e dois chamados fictícios', async () => {
    const s = await t.seedSector({agents: 1, modules: ['Folha', 'Patrimônio', 'Compras']})
    await t.phone(s.id).receive(t.customer('Cliente Revisão A'), 'Mensagem fictícia A')
    await t.phone(s.id).receive(t.customer('Cliente Revisão B'), 'Mensagem fictícia B')
    return s
  })
  const p = await t.signIn(sector.supervisor)
  const now = p.getByRole('region', {name:'Agora',exact:true})
  const period = p.getByRole('region', {name:'No período',exact:true})
  const kpi = (name) => p.getByRole('group',{name,exact:true})
  const field = p.getByRole('combobox',{name:'Módulo',exact:true})
  await t.step('Sem preferência, as duas seções começam abertas e os números carregam', async () => {
    await p.getByRole('link',{name:'Dashboard',exact:true}).click()
    await expect(now.getByRole('button',{name:'Recolher Agora'})).toHaveAttribute('aria-expanded','true')
    await expect(period.getByRole('button',{name:'Recolher No período'})).toHaveAttribute('aria-expanded','true')
    await expect(kpi('Na fila')).toContainText('2')
    await expect(kpi('Recebidos')).toContainText('2')
    await t.shot(p,'dashboard-inicial')
  })
  await t.step('Select com escolha abre abaixo em tela cheia; clique, teclado e Escape funcionam', async () => {
    await field.click(); await p.getByRole('option',{name:'Folha',exact:true}).click()
    await field.click(); await position(p,field,'below'); await t.shot(p,'select-tela-abaixo')
    await expect(p.getByRole('option',{name:'Folha',exact:true})).toBeFocused()
    await p.keyboard.press('ArrowDown')
    const text = await p.locator('[role="option"]:focus').innerText()
    await p.keyboard.press('Enter'); await expect(field).toContainText(text.trim())
    await field.click(); await p.keyboard.press('Escape'); await expect(p.getByRole('listbox')).toHaveCount(0)
  })
  await t.step('Select no fim da tela abre acima sem cobrir o campo', async () => {
    const f = await field.boundingBox()
    await p.setViewportSize({width:1280,height:Math.ceil(f.y+f.height+24)})
    await field.click(); await position(p,field,'above'); await t.shot(p,'select-tela-acima')
    await p.getByRole('option',{name:'Folha',exact:true}).click()
    await expect(field).toContainText('Folha')
    await p.setViewportSize({width:1280,height:800})
  })
  await t.step('Recolher preserva títulos, datas, filtros e tabela com dados', async () => {
    // Um chamado assumido faz a tabela ter uma linha real, em vez de comparar apenas o vazio.
    await p.getByRole('link',{name:'Atendimento',exact:true}).click()
    await p.getByRole('link',{name:'Cliente Revisão A',exact:true}).click()
    await p.getByRole('button',{name:'Assumir',exact:true}).click()
    await expect(p.getByRole('button',{name:'Encerrar',exact:true})).toBeVisible()
    await p.getByRole('link',{name:'Dashboard',exact:true}).click()
    await p.getByRole('button',{name:'7 dias',exact:true}).click()
    await expect(period.locator('p.caption.mono-num')).toContainText(' a ')
    const table = p.getByRole('region',{name:'Por atendente',exact:true})
    await expect(table).toContainText(sector.supervisor.name)
    const before = await table.innerText(), url = p.url(), dates = await period.locator('p.caption.mono-num').innerText()
    await now.getByRole('button',{name:'Recolher Agora'}).click()
    await expect(kpi('Na fila')).toHaveCount(0); await expect(kpi('Recebidos')).toBeVisible()
    await expect(now.getByRole('heading',{name:'Agora',exact:true})).toBeVisible()
    await period.getByRole('button',{name:'Recolher No período'}).focus(); await p.keyboard.press('Enter')
    await expect(period.getByRole('button',{name:'Abrir No período'})).toBeFocused()
    await expect(kpi('Recebidos')).toHaveCount(0)
    await expect(period.getByRole('heading',{name:'No período',exact:true})).toBeVisible()
    await expect(period.locator('p.caption.mono-num')).toHaveText(dates)
    expect(p.url()).toBe(url); expect(await table.innerText()).toBe(before)
    await expect(p.getByRole('button',{name:'7 dias',exact:true})).toHaveAttribute('aria-pressed','true')
    await t.shot(p,'duas-recolhidas-filtros-tabela')
    t.observe('Filtros e tabela preservados',{url,table:before,dates})
  })
  await t.step('Preferência sobrevive ao reload; reabrir por Espaço e clique mantém independência', async () => {
    await p.reload()
    await expect(now.getByRole('button',{name:'Abrir Agora'})).toBeVisible()
    await expect(period.getByRole('button',{name:'Abrir No período'})).toBeVisible()
    await now.getByRole('button',{name:'Abrir Agora'}).focus(); await p.keyboard.press('Space')
    await expect(kpi('Na fila')).toBeVisible(); await expect(kpi('Recebidos')).toHaveCount(0)
    await period.getByRole('button',{name:'Abrir No período'}).click()
    await expect(kpi('Recebidos')).toBeVisible()
    await p.reload(); await expect(kpi('Na fila')).toBeVisible(); await expect(kpi('Recebidos')).toBeVisible()
  })
  const a = await t.signIn({email:process.env.VERIFY_APP_ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})
  await t.step('Select em janela abre abaixo e escolhe por clique e teclado', async () => {
    await a.goto('/admin/usuarios'); await a.getByRole('button',{name:'Novo usuário'}).click()
    const dialog = a.getByRole('dialog',{name:'Novo usuário'}), role = dialog.getByRole('combobox',{name:'Papel'})
    await role.click(); await a.getByRole('option',{name:'Supervisor',exact:true}).click()
    await role.click(); await position(a,role,'below'); await t.shot(a,'select-janela-abaixo')
    await expect(a.getByRole('option',{name:'Supervisor',exact:true})).toBeFocused()
    await a.keyboard.press('ArrowUp'); await a.keyboard.press('Enter'); await expect(role).toContainText('Atendente')
    await role.click(); await a.keyboard.press('Escape'); await expect(dialog).toBeVisible()
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
  })
  await t.step('Select em janela curta abre acima e escolhe sem fechar a janela', async () => {
    await a.setViewportSize({width:1280,height:300})
    await a.getByRole('button',{name:'Novo usuário'}).click()
    const dialog = a.getByRole('dialog',{name:'Novo usuário'}), role = dialog.getByRole('combobox',{name:'Papel'})
    await role.evaluate(e=>e.scrollIntoView({block:'end'})); await role.click()
    await position(a,role,'above'); await t.shot(a,'select-janela-acima')
    await a.getByRole('option',{name:'Supervisor',exact:true}).click(); await expect(role).toContainText('Supervisor')
    await expect(dialog).toBeVisible(); await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
  })
  await t.closeSession(a)
  // Usa o menu em desktop para escolher preferências antes de reduzir a tela.
  for (const theme of ['Claro','Escuro']) for (const width of [1280,375]) {
    await t.step(`${theme}, ${width === 375 ? 'celular' : 'desktop'}, texto Maior: dashboard, lista e sino sem rolagem horizontal`, async () => {
      await p.setViewportSize({width:1280,height:800})
      for(const label of [theme,'Maior']) {
        await p.getByRole('button',{name:'Configurações',exact:true}).click()
        await p.getByRole('menuitemradio',{name:label,exact:true}).click(); await p.keyboard.press('Escape')
      }
      await p.setViewportSize({width,height:800})
      await expect(p.locator('html')).toHaveAttribute('data-text-size','larger')
      await expect(p.locator('html')).toHaveAttribute('data-theme',theme === 'Claro' ? 'light' : 'dark')
      await noScroll(p); await t.shot(p,`${theme}-${width}-dashboard`)
      await field.click(); await expect(p.getByRole('listbox')).toBeVisible(); await noScroll(p)
      const box = await p.getByRole('listbox').boundingBox()
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(width)
      await t.shot(p,`${theme}-${width}-lista`); await p.keyboard.press('Escape')
      const bell = p.getByRole('banner').getByRole('button',{name:/^Notificações/})
      await expect(bell).toHaveCSS('border-top-style','solid'); await expect(bell).toHaveCSS('border-top-width','1px')
      const count = p.getByTestId('notification-count'); await expect(count).toHaveText('1')
      expect(await count.evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return e === hit || e.contains(hit)})).toBe(true)
      await bell.click(); await expect(p.getByRole('dialog',{name:'Notificações'})).toContainText('Cliente Revisão B')
      await noScroll(p); await t.shot(p,`${theme}-${width}-sino`); await p.keyboard.press('Escape')
    })
  }
  await t.closeSession(p)
  await t.step('Armazenamento bloqueado: recolher funciona, persiste na navegação e reinicia aberto no reload', async () => {
    const b = await t.signIn(sector.supervisor)
    await b.addInitScript(()=>{const fail=()=>{throw new DOMException('Bloqueado','SecurityError')};Storage.prototype.getItem=fail;Storage.prototype.setItem=fail;Storage.prototype.removeItem=fail})
    await b.goto('/dashboard'); await b.getByRole('button',{name:'Recolher Agora'}).click()
    await expect(b.getByRole('group',{name:'Na fila',exact:true})).toHaveCount(0)
    await b.getByRole('link',{name:'Atendimento',exact:true}).click(); await b.getByRole('link',{name:'Dashboard',exact:true}).click()
    await expect(b.getByRole('button',{name:'Abrir Agora'})).toBeVisible()
    await b.reload(); await expect(b.getByRole('button',{name:'Recolher Agora'})).toBeVisible()
    await expect(b.getByRole('button',{name:'Recolher No período'})).toBeVisible()
    await t.closeSession(b)
  })
  await t.step('Estado final do banco: somente a ação de assumir alterou os chamados', async () => {
    const rows = t.sql(`select status, assignee_id from tickets where sector_id = ${sector.id} order by id`)
    expect(rows).toEqual([{status:'in_progress',assignee_id:sector.supervisor.id},{status:'queued',assignee_id:null}])
    t.observe('Chamados fictícios no banco',rows)
    const audit=t.sql(`select action from audit_logs where ticket_id in (select id from tickets where sector_id=${sector.id}) order by id`)
    expect(audit.map(x=>x.action)).toEqual(['ticket_assigned']); t.observe('Auditoria',audit)
  })
})

```
