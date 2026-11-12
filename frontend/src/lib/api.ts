import { fakeApi } from '@/prototype/fakeApi'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Chama a API do backend; erros chegam como { error: "mensagem" } em português.
// Um FormData (envio de arquivo) vai como multipart; o resto, como JSON.
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  // PROTÓTIPO #145: API falsa em memória, só em desenvolvimento.
  if (import.meta.env.DEV) {
    const fake = fakeApi(path, init)
    if (fake) return fake.data as T
  }
  const json = init?.body !== undefined && !(init.body instanceof FormData)
  const response = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: json ? { 'Content-Type': 'application/json' } : undefined,
    body: json ? JSON.stringify(init.body) : (init?.body as FormData | undefined),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(response.status, data?.error ?? 'Erro inesperado. Tente novamente.')
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}
