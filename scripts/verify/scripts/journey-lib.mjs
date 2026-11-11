// Base das jornadas: navegador, dados de teste, celular simulado, banco só de leitura e evidências.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

function env(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} não definido: rode a jornada por scripts/drive.sh.`)
  }
  return value
}

const root = env('VERIFY_APP_ROOT')
const baseURL = env('VERIFY_APP_BASE_URL')
const evidenceRoot = env('VERIFY_APP_EVIDENCE_DIR')
const container = env('VERIFY_APP_CONTAINER')
const adminEmail = env('VERIFY_APP_ADMIN_EMAIL')
const adminPassword = env('ADMIN_PASSWORD')
const userPassword = env('USER_PASSWORD')
const commit = env('VERIFY_APP_COMMIT')
const runId = env('VERIFY_APP_RUN_ID')
const recordVideo = process.env.VERIFY_APP_VIDEO === '1'

// O Playwright é dependência do frontend, e este arquivo fica fora dele.
const {
  chromium,
  expect: playwrightExpect,
  request,
} = createRequire(path.join(root, 'frontend', 'package.json'))('@playwright/test')

// Folga para as paradas de 5 a 6 s que esta máquina tem com a memória no limite.
const TIMEOUT = 20_000
export const expect = playwrightExpect.configure({ timeout: TIMEOUT })

let counter = Date.now() % 1_000_000

// Sufixo único: uma jornada pode ser repetida no mesmo banco.
export function uniqueId() {
  counter += 1
  return (
    String(counter).padStart(6, '0') +
    Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')
  )
}

class Journey {
  constructor(name) {
    this.name = name
    this.dir = path.join(evidenceRoot, name)
    rmSync(this.dir, { recursive: true, force: true })
    mkdirSync(this.dir, { recursive: true })
    this.startedAt = new Date()
    this.steps = []
    this.observations = []
    this.problems = []
    this.sessions = []
    this.shotCount = 0
    this.error = null
    this.currentStep = null
  }

  async open() {
    // A marca permite ao Cleanup achar o navegador: o Chromium apaga o ambiente que herda.
    this.browser = await chromium.launch({ args: [`--verify-app-run=${runId}`] })
    this.admin = await request.newContext({ baseURL })
    await this.apiOk(
      this.admin.post('/api/auth/login', { data: { email: adminEmail, password: adminPassword } }),
      'login do administrador',
    )
  }

  // Passo da jornada: a primeira falha encerra a jornada, porque os seguintes dependem dele.
  async step(title, body) {
    const step = { title, shots: [], ms: 0, ok: false }
    this.steps.push(step)
    this.currentStep = step
    const start = Date.now()
    try {
      const value = await body()
      step.ok = true
      return value
    } finally {
      step.ms = Date.now() - start
      console.log(`  ${step.ok ? 'ok' : 'FALHOU'}  ${title} (${step.ms} ms)`)
    }
  }

  // Captura o que a pessoa vê agora, com o nome ligado ao passo em andamento.
  async shot(page, label) {
    this.shotCount += 1
    const file = `${String(this.shotCount).padStart(2, '0')}-${label}.png`
    await page.screenshot({ path: path.join(this.dir, file), animations: 'disabled' })
    this.currentStep?.shots.push(file)
    return file
  }

  // Registra um estado final observado, que entra no resumo como prova.
  observe(label, value) {
    this.observations.push({ label, value })
    return value
  }

  // Entra pela tela de login, numa sessão isolada dentro do mesmo navegador.
  async signIn(user, { blockRealtime = false, viewport = { width: 1280, height: 800 } } = {}) {
    const context = await this.browser.newContext({
      baseURL,
      viewport,
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
      ...(recordVideo
        ? { recordVideo: { dir: path.join(this.dir, 'video-tmp'), size: viewport } }
        : {}),
    })
    const page = await context.newPage()
    page.setDefaultTimeout(TIMEOUT)
    page.on('pageerror', (error) =>
      this.problems.push(`Erro de JavaScript na tela: ${error.message}`),
    )
    page.on('response', (response) => {
      if (response.status() >= 500) {
        this.problems.push(
          `${response.status()} em ${response.request().method()} ${response.url()}`,
        )
      }
    })
    if (blockRealtime) {
      // Sem o WebSocket, a tela fica desatualizada: é como se chega a uma disputa perdida.
      await page.routeWebSocket(/\/api\/ws$/, () => {})
    }
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(user.email)
    await page.getByLabel('Senha').fill(user.password ?? userPassword)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).not.toHaveURL(/\/login$/)
    // Só depois do login: o rastro não guarda a senha.
    await context.tracing.start({ snapshots: true, screenshots: false })
    this.sessions.push({ user, context, page })
    return page
  }

  async closeSession(page) {
    const index = this.sessions.findIndex((session) => session.page === page)
    if (index >= 0) {
      const [session] = this.sessions.splice(index, 1)
      await this.endSession(session)
    }
  }

  async endSession({ user, context, page }) {
    await context.tracing.stop().catch(() => {})
    const video = recordVideo ? page.video() : null
    await context.close().catch(() => {})
    if (video) {
      const target = path.join(this.dir, `video-${user.key ?? 'sessao'}-${++this.shotCount}.webm`)
      renameSync(await video.path(), target)
    }
  }

  async apiOk(responsePromise, what) {
    const response = await responsePromise
    if (!response.ok()) {
      throw new Error(
        `Pré-condição não atendida (${what}): HTTP ${response.status()} ${await response.text()}`,
      )
    }
    return response
  }

  // Cria setor e pessoas pela API, como o administrador faria: é pré-condição, não o que se prova.
  async seedSector({ agents = 1, connected = true, modules = [] } = {}) {
    const id = uniqueId()
    const response = await this.apiOk(
      this.admin.post('/api/sectors', { data: { name: `Setor ${id}` } }),
      'criar setor',
    )
    const sector = await response.json()
    const createUser = async (key, role, name) => {
      const email = `${key}.${id}@verify.test`
      await this.apiOk(
        this.admin.post('/api/users', {
          data: { name, email, role, sectorId: sector.id, password: userPassword },
        }),
        `criar usuário ${key}`,
      )
      const created = await this.sql(`select id from users where email = '${email}'`)
      return { key, id: Number(created[0].id), name, email }
    }
    const supervisor = await createUser('supervisor', 'supervisor', `Supervisor ${id}`)
    const people = []
    for (let i = 1; i <= agents; i++) {
      people.push(await createUser(`atendente${i}`, 'agent', `Atendente${i} ${id}`))
    }
    if (connected) {
      await this.apiOk(this.admin.post(`/api/sectors/${sector.id}/connection`), 'conectar setor')
      await this.phone(sector.id).pair()
    }
    for (const name of modules) {
      await this.apiOk(
        this.admin.post(`/api/sectors/${sector.id}/modules`, { data: { name } }),
        `criar módulo ${name}`,
      )
    }
    return { id: sector.id, name: sector.name, supervisor, agents: people }
  }

  // Cadastra um órgão num município carregado pelas migrações.
  async seedOrganization(municipality = 'Itu') {
    const name = `Prefeitura ${uniqueId()}`
    const list = await (
      await this.apiOk(this.admin.get('/api/municipalities'), 'listar municípios')
    ).json()
    await this.apiOk(
      this.admin.post('/api/organizations', {
        data: { name, municipalityId: list.find((item) => item.name === municipality).id },
      }),
      'criar órgão',
    )
    return { name, municipality }
  }

  customer(name) {
    return { name, phone: `5511${uniqueId().slice(0, 9)}` }
  }

  // O celular do setor e do contato, simulados pelas rotas de teste do adaptador falso.
  phone(sectorId) {
    const call = (action, data) =>
      this.apiOk(
        this.admin.post(`/api/test/messaging/sectors/${sectorId}/${action}`, { data }),
        `celular simulado: ${action}`,
      )
    return {
      pair: (accountId) => call('pair', accountId ? { accountId } : {}),
      nextQR: () => call('qr'),
      drop: () => call('drop'),
      logOut: () => call('logout'),
      unreachable: () => call('unreachable'),
      status: (status, externalMessageIds) => call('status', { status, externalMessageIds }),
      // Devolve o identificador, para repetir a mesma entrega ao testar a idempotência.
      receive: async (customer, body, externalMessageId = `VERIFY-${uniqueId()}`) => {
        await call('receive', {
          externalMessageId,
          phone: customer.phone,
          contactName: customer.name,
          body,
        })
        return externalMessageId
      },
    }
  }

  // Consulta o banco em transação só de leitura, para provar o estado final.
  sql(query) {
    const output = execFileSync(
      'docker',
      [
        'exec',
        '-e',
        'PGOPTIONS=-c default_transaction_read_only=on',
        container,
        'psql',
        '-U',
        'xet',
        '-d',
        'xet',
        '-At',
        '-c',
        `select coalesce(json_agg(t), '[]') from (${query}) t`,
      ],
      { encoding: 'utf8' },
    )
    return JSON.parse(output)
  }

  // Na falha, guarda o que cada sessão via, o rastro e o estado da máquina.
  async captureFailure() {
    for (const [index, { user, page, context }] of this.sessions.entries()) {
      const label = user.key ?? `sessao-${index}`
      await page
        .screenshot({ path: path.join(this.dir, `falha-${label}.png`), animations: 'disabled' })
        .catch(() => {})
      const text = await page
        .locator('body')
        .innerText({ timeout: 2000 })
        .catch(() => '')
      writeFileSync(path.join(this.dir, `falha-${label}.txt`), `${page.url()}\n\n${text}\n`)
      await context.tracing
        .stop({ path: path.join(this.dir, `falha-${label}-trace.zip`) })
        .catch(() => {})
      await context.tracing.start({ snapshots: true, screenshots: false }).catch(() => {})
    }
    const memory = spawnSync('sh', ['-c', 'free -m; echo; vmstat 1 3'], { encoding: 'utf8' })
    this.memoryAtFailure = memory.stdout ?? ''
    writeFileSync(path.join(this.dir, 'falha-memoria.txt'), this.memoryAtFailure)
  }

  writeSummary() {
    const passed = !this.error && this.problems.length === 0
    const seconds = Math.round((Date.now() - this.startedAt.getTime()) / 1000)
    const lines = [
      `# Jornada ${this.name}: ${passed ? 'PASSOU' : 'FALHOU'}`,
      '',
      `Commit \`${commit}\`, início ${this.startedAt.toISOString()}, duração ${seconds} s.`,
      '',
      '### Passos',
      '',
    ]
    this.steps.forEach((step, index) => {
      const shots = step.shots.map((shot) => `\`${shot}\``).join(', ')
      const status = step.ok ? 'ok' : 'FALHOU'
      lines.push(
        `${index + 1}. ${status}: ${step.title} (${step.ms} ms)${shots ? `: ${shots}` : ''}`,
      )
    })
    if (this.error) {
      lines.push('', '### Falha', '', '```text', this.error, '```')
      if (this.memoryAtFailure) {
        lines.push(
          '',
          'Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:',
          '',
          '```text',
          this.memoryAtFailure.trimEnd(),
          '```',
        )
      }
    }
    if (this.problems.length > 0) {
      lines.push('', '### Problemas observados durante a jornada', '')
      this.problems.forEach((problem) => lines.push(`- ${problem}`))
    }
    if (this.observations.length > 0) {
      lines.push('', '### Estado final observado')
      for (const { label, value } of this.observations) {
        lines.push('', `${label}:`, '', '```json', JSON.stringify(value, null, 2), '```')
      }
    }
    writeFileSync(path.join(this.dir, 'summary.md'), `${lines.join('\n')}\n`)
    return passed
  }

  async close() {
    for (const session of this.sessions.splice(0)) {
      await this.endSession(session)
    }
    await this.admin?.dispose().catch(() => {})
    await this.browser?.close().catch(() => {})
    rmSync(path.join(this.dir, 'video-tmp'), { recursive: true, force: true })
  }
}

// Roda uma jornada, sempre fechando o navegador e escrevendo o resumo, mesmo na falha.
export async function journey(name, body) {
  const t = new Journey(name)
  try {
    await t.open()
    await body(t)
  } catch (error) {
    t.error = error instanceof Error ? (error.stack ?? error.message) : String(error)
    console.log(t.error)
    await t
      .captureFailure()
      .catch((failure) => console.log(`Evidência da falha incompleta: ${failure}`))
  }
  await t.close()
  const passed = t.writeSummary()
  for (const problem of t.problems) {
    console.log(`  problema: ${problem}`)
  }
  console.log(`  ${passed ? 'PASSOU' : 'FALHOU'}: ${path.join(t.dir, 'summary.md')}`)
  process.exitCode = passed ? 0 : 1
}
