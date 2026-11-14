// PROTÓTIPO #164 — descartável, não vai para a main.
// API falsa em memória, só em desenvolvimento: entrega o mínimo para o layout abrir
// (usuário e setores) e a ficha só leitura (#177) do chamado clicado na lista, com mensagens
// vazias. A lista usa os dados de `atendimentoData.ts`.
// Perfil por `?perfil=admin` (padrão: supervisor). Dados fictícios (repositório público).

import { modules, people, sectors, tickets } from './atendimentoData'

function role() {
  return new URLSearchParams(window.location.search).get('perfil') === 'admin'
    ? 'admin'
    : 'supervisor'
}

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown; status?: number } | null {
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
  const [route] = path.split('?')
  let m: RegExpMatchArray | null
  if ((m = route.match(/^\/tickets\/(\d+)$/))) {
    const t = tickets.find((x) => x.id === Number(m![1]))
    if (!t) return { data: null, status: 404 }
    const person = (name: string | null) => {
      const p = people.find((x) => x.name === name)
      return p ? { id: p.id, name: p.name } : null
    }
    const closer = person(t.assignee) ?? { id: 1, name: 'Marina Teste' }
    return {
      data: {
        id: t.id,
        protocol: t.protocol,
        status: 'closed',
        sector: { id: t.sectorId, name: t.sectorName },
        arrivedAt: t.arrivedAt.toISOString(),
        assignedAt: t.situation === 'cancelled' ? null : t.arrivedAt.toISOString(),
        startedAt: t.arrivedAt.toISOString(),
        endedAt: t.situation === 'cancelled' ? null : t.closedAt!.toISOString(),
        closedAt: t.closedAt!.toISOString(),
        subject: t.subject,
        resolution: t.situation === 'cancelled' ? null : 'Orientação registrada no encerramento (texto fictício).',
        contact: { id: t.id, name: t.contact.name, phone: '5500900000000', registered: true },
        organization: t.organization
          ? { id: 1, name: t.organization, municipality: { id: 1, name: 'Vila Fictícia' } }
          : null,
        assignee: t.situation === 'cancelled' ? null : person(t.assignee),
        closedBy: closer,
        closureType: t.situation,
        previous: null,
        next: t.transferredTo ? { protocol: `${t.protocol}9`, sectorName: t.transferredTo } : null,
      },
    }
  }
  if ((m = route.match(/^\/tickets\/(\d+)\/modules$/))) {
    const t = tickets.find((x) => x.id === Number(m![1]))
    return { data: modules.filter((x) => t?.modules.includes(x.name)).map(({ id, name }) => ({ id, name })) }
  }
  if (route.match(/^\/(contacts|organizations)\/(\d+)\/tickets$/)) return { data: { items: [], total: 0 } }
  return { data: method === 'GET' ? [] : undefined }
}
