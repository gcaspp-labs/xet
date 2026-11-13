// PROTÓTIPO #164 — descartável, não vai para a main.
// API falsa em memória, só em desenvolvimento: entrega o mínimo para o layout abrir
// (usuário e setores). A lista Atendimento usa os dados de `atendimentoData.ts`.
// Perfil por `?perfil=admin` (padrão: supervisor). Dados fictícios (repositório público).

import { sectors } from './atendimentoData'

function role() {
  return new URLSearchParams(window.location.search).get('perfil') === 'admin'
    ? 'admin'
    : 'supervisor'
}

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown } | null {
  const method = init?.method ?? 'GET'
  if (path === '/auth/me')
    return {
      data:
        role() === 'admin'
          ? { id: 9, name: 'Paulo Teste', email: 'paulo@exemplo.test', role: 'admin', sectorId: null }
          : {
              id: 1,
              name: 'Marina Teste',
              email: 'marina@exemplo.test',
              role: 'supervisor',
              sectorId: 1,
            },
    }
  if (path === '/sectors')
    return {
      data: sectors.map((s) => ({
        ...s,
        email: null,
        phone: '+55 00 3000-0000',
        provider: 'fake',
        connectionStatus: 'connected',
        lastConnectedAt: new Date().toISOString(),
        active: true,
      })),
    }
  return { data: method === 'GET' ? [] : undefined }
}
