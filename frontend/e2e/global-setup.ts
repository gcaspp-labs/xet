import { spawnSync } from 'node:child_process'
import { admin } from './fixtures'

// Cria o administrador de teste pelo mesmo comando usado na implantação.
export default function globalSetup() {
  const result = spawnSync(
    'go',
    ['run', './cmd/server', 'create-admin', '-name', admin.name, '-email', admin.email],
    {
      cwd: '../backend',
      input: `${admin.password}\n`,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? '' },
      encoding: 'utf8',
    },
  )
  if (result.status !== 0) {
    throw new Error(`create-admin falhou: ${result.stderr}`)
  }
}
