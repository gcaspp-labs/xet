# Protocolo complementar da T41

Commit: fc61612a99a438ce614bf4d91145f3b98ff2a21e.
Projeto Compose: xet-revisor-t41-20261104-125658.

Usado deploy/compose.yml do PR com token falso e arquivos de ambiente descartáveis em state/. A única sobreposição foi MESSAGING_PROVIDER=fake no backend, para nunca usar WhatsApp real. COOKIE_SECURE=true e TRUST_PROXY=true preservados. Sem publicar portas, sem mudar produto, Makefile ou deploy/.env.

## Token obrigatório

Com variável CLOUDFLARE_TUNNEL_TOKEN ausente e vazia, executado o comando Compose de make up, com --env-file apontando para o arquivo descartável e -p para o projeto isolado. Não executei literalmente make up, pois ele exige escrever deploy/.env; a execução literal do autor consta no comentário anterior do PR. Ambos os casos independentes falharam na interpolação antes de criar contêineres.

Erro conferido nos dois casos: required variable CLOUDFLARE_TUNNEL_TOKEN is missing a value: defina CLOUDFLARE_TUNNEL_TOKEN no .env.

## Compose e navegador

Configuração resolvida: ports=[] em todos os quatro serviços. Inspeção dos quatro contêineres: PortBindings={}. cloudflared recusou token falso com Provided Tunnel token is not valid. Não é prova de conexão real.

As cinco jornadas padrão usaram a instância verify-app; a jornada t41-login-proxy abaixo usou o Caddy real do Compose, alcançado pelo IP interno da bridge Docker, sem porta publicada no host. Os cabeçalhos foram simulados no navegador. Todas as consultas ao banco foram de leitura.

## Limpeza

Após Evidence: docker compose down -v --rmi local somente no projeto acima. Conferido: 0 contêineres, 0 volumes e 0 redes desse projeto. Arquivos de ambiente e senhas temporárias removidos.

Cleanup da skill: saída 0; nenhum processo ou contêiner da execução restante; portas 25440, 28090, 28091 e 25173 livres. Evidence executado novamente após Cleanup.

Backend do Compose sem linhas ERROR. Backend verify-app: duas linhas context canceled, geradas quando o cliente cancela a requisição ao mudar/fechar a tela; nenhum erro JavaScript ou resposta 5xx detectado pelas jornadas.

## Fonte da jornada temporária

```javascript
import { execFileSync } from 'node:child_process'
const { expect, journey } = await import(process.env.VERIFY_APP_LIB)
const project = 'xet-revisor-t41-20261104-125658'
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim()
const ids = docker('ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`).split('\n')
const containers = JSON.parse(docker('inspect', ...ids))
const service = name => containers.find(c => c.Config.Labels['com.docker.compose.service'] === name)
const ip = name => Object.values(service(name).NetworkSettings.Networks)[0].IPAddress
const readSQL = query => JSON.parse(docker('exec', '-e', 'PGOPTIONS=-c default_transaction_read_only=on', service('postgres').Id, 'psql', '-U', 'xet', '-d', 'xet', '-At', '-c', `select coalesce(json_agg(t), '[]') from (${query}) t`))
await journey('t41-login-proxy', async t => {
  await t.step('Compose isolado: quatro serviços sem porta publicada e WhatsApp falso', async () => {
    expect(containers).toHaveLength(4)
    for (const c of containers) expect(Object.keys(c.HostConfig.PortBindings ?? {})).toHaveLength(0)
    expect(service('backend').Config.Env).toContain('MESSAGING_PROVIDER=fake')
    expect(service('backend').Config.Env).toContain('TRUST_PROXY=true')
    expect(service('backend').Config.Env).toContain('COOKIE_SECURE=true')
    t.observe('Serviços e portas no host', containers.map(c => ({ service: c.Config.Labels['com.docker.compose.service'], ports: c.HostConfig.PortBindings ?? {} })))
    t.observe('Token ausente e vazio', 'Os dois comandos Compose equivalentes ao make up falharam antes de criar contêineres; logs compose-absent.log e compose-empty.log. Sem alteração de deploy/.env.')
  })
  const cases = [
    ['203.0.113.10', 'a', {}],
    ['203.0.113.10', 'a', {}],
    ['198.51.100.20', 'b', {}],
    ['192.0.2.30', 'c', { 'X-Forwarded-For': '192.0.2.99' }],
    ['2001:db8::7', 'd', {}],
    [null, 'e', {}],
  ]
  for (const [index, [cf, emailKey, extra]] of cases.entries()) {
    await t.step(`Login errado pela tela: ${cf ?? 'sem CF-Connecting-IP'} (tentativa ${index + 1})`, async () => {
      const context = await t.browser.newContext({ baseURL: `http://${ip('web')}`, extraHTTPHeaders: { ...extra, ...(cf ? { 'CF-Connecting-IP': cf } : {}) }, locale: 'pt-BR', viewport: { width: 1280, height: 800 } })
      const page = await context.newPage()
      page.on('pageerror', err => t.problems.push(`JavaScript: ${err.message}`))
      page.on('response', res => { if (res.status() >= 500) t.problems.push(`HTTP ${res.status()}: ${res.url()}`) })
      t.sessions.push({ user: { key: `ip-${index}` }, context, page })
      await page.goto('/login')
      await page.getByLabel('E-mail').fill(`t41-${emailKey}@verify.test`)
      await page.getByLabel('Senha').fill('ErroControlado#47')
      const responsePromise = page.waitForResponse(res => res.url().endsWith('/api/auth/login') && res.request().method() === 'POST')
      await page.getByRole('button', { name: 'Entrar' }).click()
      expect((await responsePromise).status()).toBe(401)
      await expect(page.getByText('E-mail ou senha incorretos.', { exact: true })).toBeVisible()
      await t.shot(page, `login-${index + 1}-recusado`)
      await t.closeSession(page)
    })
  }
  await t.step('Estado final no banco do Compose: IPs separados, IPv6, XFF ignorado e fallback do Caddy', async () => {
    const rows = readSQL("select scope, subject, failures from login_attempts where scope = 'ip' order by subject")
    const expected = { '203.0.113.10': 2, '198.51.100.20': 1, '192.0.2.30': 1, '2001:db8::7': 1, [ip('web')]: 1 }
    expect(Object.fromEntries(rows.map(r => [r.subject, r.failures]))).toEqual(expected)
    expect(readSQL('select count(*)::int as total from sessions')[0].total).toBe(0)
    t.observe('login_attempts (IPs)', rows)
    t.observe('Sessões criadas pelos logins inválidos', 0)
    t.observe('Limite desta prova', 'Navegador chega ao Caddy pela rede Docker local; cabeçalhos simulam o cloudflared. Token falso. Túnel, HTTPS e Access reais dependem da T34. Sem CF-Connecting-IP, o contador usa o IP do Caddy.')
  })
})

```
