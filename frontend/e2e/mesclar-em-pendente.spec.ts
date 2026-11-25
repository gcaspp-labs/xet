import { expect, test, type Page } from '@playwright/test'
import {
  clearSession,
  seedClosedTicket,
  seedMergedTicket,
  seedTicketToMergeIntoPending,
  seedTransferredTicket,
  signIn,
  unique,
  userPassword,
} from './fixtures'

// Nome de exibição criado por seedSector: agent.<id>@e2e.test → "agent <id>".
const agentNameOf = (email: string) => {
  const match = /^(agent2?)\.(\d+)@/.exec(email)
  return match ? `${match[1]} ${match[2]}` : email
}

async function protocolOf(page: Page, ticketId: number) {
  const ticket = (await (await page.request.get(`/api/tickets/${ticketId}`)).json()) as {
    protocol: string
  }
  return ticket.protocol
}

const conversation = (page: Page) => page.getByRole('region', { name: 'Conversa', exact: true })
const mergeNotices = (page: Page, protocol: string) =>
  conversation(page)
    .getByRole('listitem', { name: 'Registro do chamado' })
    .filter({ hasText: `mesclou o atendimento ${protocol} neste chamado` })

type Seed = Awaited<ReturnType<typeof seedTicketToMergeIntoPending>>
type SectorTicket = { id: number; protocol: string; status: string; contact: { name: string } }

// O cliente volta a escrever: abre um chamado na fila (o pendente não recebe mensagem nova), e o
// atendente assume.
async function openTicketAsContact(page: Page, seed: Seed, body: string) {
  const received = await page.request.post(
    `/api/test/messaging/sectors/${seed.sector.id}/receive`,
    {
      data: {
        externalMessageId: `E2E-${unique().id}`,
        phone: seed.phone,
        contactName: seed.contact,
        body,
      },
    },
  )
  expect(received.ok()).toBeTruthy()
  const tickets = (await (
    await page.request.get(`/api/sectors/${seed.sector.id}/tickets`)
  ).json()) as SectorTicket[]
  const found = tickets.find(
    (ticket) => ticket.status === 'queued' && ticket.contact.name === seed.contact,
  )
  expect(found).toBeTruthy()
  const assigned = await page.request.post(`/api/tickets/${found!.id}/assign`)
  expect(assigned.ok()).toBeTruthy()
  return found!
}

// Deixa um chamado do contato aguardando: é o segundo pendente da corrida.
async function markPending(page: Page, seed: Seed, reason: string) {
  const ticket = await openTicketAsContact(page, seed, `Voltei: ${reason}`)
  const response = await page.request.post(`/api/tickets/${ticket.id}/pending`, {
    data: { reason },
  })
  expect(response.ok()).toBeTruthy()
  return ticket
}

// Alguém retoma o pendente antes da mesclagem (Atendimentos, Retomar chamado). Sem `from`, o
// cliente escreve de novo, o atendente assume o chamado novo e traz o pendente para ele; com
// `from`, o pendente é retomado a partir de um atendimento que já está em andamento.
async function resumeElsewhere(page: Page, seed: Seed, pendingId: number, from?: number) {
  const ticket = from ? { id: from } : await openTicketAsContact(page, seed, 'Voltando ao pendente')
  const response = await page.request.post(`/api/tickets/${ticket.id}/resume-pending`, {
    data: { pendingTicketId: pendingId },
  })
  expect(response.ok()).toBeTruthy()
}

// A ficha do atendimento encerrado mostra a ação, a janela lista o pendente do contato e a
// mesclagem abre o pendente com as mensagens dos dois, o aviso da mesclagem e o encerrado do B
// (spec #332, #343).
test('quem encerrou mescla o atendimento num pendente e o pendente abre com as mensagens dos dois', async ({
  page,
  baseURL,
}) => {
  const seed = await seedTicketToMergeIntoPending(baseURL!)
  await signIn(page, seed.agent, userPassword)
  const pendingProtocol = await protocolOf(page, seed.pendingId)
  const closedProtocol = await protocolOf(page, seed.ticketId)
  const agentName = agentNameOf(seed.agent)

  await page.goto(`/atendimentos/${seed.ticketId}`)
  const details = page.getByRole('region', { name: 'Atendimento', exact: true })
  await expect(details).toContainText('Encerrado')
  await expect(page.getByRole('button', { name: 'Corrigir' })).toBeVisible()
  await page.getByRole('button', { name: 'Mesclar em pendente' }).click()

  // A janela explica a troca e lista o pendente do contato, com protocolo, motivo e quem marcou.
  const dialog = page.getByRole('dialog', { name: 'Mesclar em pendente' })
  await expect(dialog).toContainText(
    'As mensagens deste atendimento passam para o pendente escolhido, que fica com a situação e os dados deste encerramento. Este atendimento fica registrado como Mesclado.',
  )
  await expect(dialog.getByRole('radio')).toHaveCount(1)
  await expect(dialog).toContainText(pendingProtocol)
  await expect(dialog).toContainText(seed.reason)
  await expect(dialog).toContainText(`por ${agentName}`)

  await dialog.getByRole('button', { name: 'Mesclar em pendente' }).click()
  await expect(page.getByText('Atendimento mesclado')).toBeVisible()

  // O pendente abre no lugar do encerrado, com o assunto, a resolução e o encerramento do B.
  await expect(page).toHaveURL(new RegExp(`/atendimentos/${seed.pendingId}$`))
  await expect(details).toContainText('Encerrado')
  await expect(details).toContainText('Segunda via')
  await expect(details).toContainText('Enviada por e-mail.')
  await expect(details).toContainText(agentName)

  // As mensagens do A e do B ficam na ordem do tempo, com o aviso da mesclagem entre elas.
  await expect(conversation(page).getByText('Preciso da segunda via do contracheque')).toBeVisible()
  await expect(conversation(page).getByText('Voltei, o comprovante veio errado')).toBeVisible()
  const first = await conversation(page)
    .getByText('Preciso da segunda via do contracheque')
    .boundingBox()
  const last = await conversation(page).getByText('Voltei, o comprovante veio errado').boundingBox()
  expect(first!.y).toBeLessThan(last!.y)
  const notice = mergeNotices(page, closedProtocol)
  await expect(notice).toBeVisible()
  await expect(notice).toContainText(`${agentName} mesclou o atendimento`)
  // O B era encerrado, não cancelado: o aviso não traz o motivo.
  await expect(notice).not.toContainText('Motivo:')

  // O B sai de Atendimentos como Mesclado, e não como Encerrado.
  await page.goto('/atendimentos')
  await page.getByRole('searchbox', { name: 'Buscar chamados' }).fill(closedProtocol)
  const rows = page.getByRole('table').locator('tbody').getByRole('row')
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText('Mesclado')
  await expect(rows.first()).not.toContainText('Encerrado')
})

// O atendimento cancelado também mescla, e o motivo do cancelamento do B aparece na conversa do A
// logo abaixo do aviso da mesclagem.
test('o atendimento cancelado mescla e a conversa mostra o motivo do cancelamento', async ({
  page,
  baseURL,
}) => {
  const seed = await seedTicketToMergeIntoPending(baseURL!, { cancelled: true })
  await signIn(page, seed.agent, userPassword)
  const closedProtocol = await protocolOf(page, seed.ticketId)

  await page.goto(`/atendimentos/${seed.ticketId}`)
  const details = page.getByRole('region', { name: 'Atendimento', exact: true })
  await expect(details).toContainText('Cancelado')
  // O cancelado não tem correção, só a mesclagem.
  await expect(page.getByRole('button', { name: 'Corrigir' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Mesclar em pendente' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mesclar em pendente' })
  await expect(dialog.getByRole('radio')).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Mesclar em pendente' }).click()

  await expect(page).toHaveURL(new RegExp(`/atendimentos/${seed.pendingId}$`))
  const notice = mergeNotices(page, closedProtocol)
  await expect(notice).toBeVisible()
  await expect(notice).toContainText(`Motivo: ${seed.cancelReason}`)
  const noticeBox = (await notice.boundingBox())!
  const firstMessage = (await conversation(page)
    .getByText('Preciso da segunda via do contracheque')
    .boundingBox())!
  const lastMessage = (await conversation(page)
    .getByText('Voltei, o comprovante veio errado')
    .boundingBox())!
  expect(firstMessage.y).toBeLessThan(lastMessage.y)
  // O aviso fica no ponto da mesclagem, depois das mensagens que os dois trouxeram.
  expect(noticeBox.y).toBeGreaterThan(lastMessage.y)
})

// Cancelar a janela não muda nada: o B continua encerrado, o A continua pendente e a conversa do A
// não ganha aviso nenhum.
test('cancelar a janela da mesclagem não muda nada', async ({ page, baseURL }) => {
  const seed = await seedTicketToMergeIntoPending(baseURL!)
  await signIn(page, seed.agent, userPassword)
  const closedProtocol = await protocolOf(page, seed.ticketId)

  await page.goto(`/atendimentos/${seed.ticketId}`)
  const details = page.getByRole('region', { name: 'Atendimento', exact: true })
  await page.getByRole('button', { name: 'Mesclar em pendente' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mesclar em pendente' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(dialog).toBeHidden()

  await expect(page).toHaveURL(new RegExp(`/atendimentos/${seed.ticketId}$`))
  await expect(details).toContainText('Encerrado')
  const closed = await page.request.get(`/api/tickets/${seed.ticketId}`)
  expect(await closed.json()).toMatchObject({ status: 'closed' })
  const pending = await page.request.get(`/api/tickets/${seed.pendingId}`)
  expect(await pending.json()).toMatchObject({ status: 'pending' })

  await page.goto(`/atendimentos/${seed.pendingId}`)
  await expect(mergeNotices(page, closedProtocol)).toHaveCount(0)
})

// A corrida: alguém retoma o pendente escolhido antes de a mesclagem chegar ao servidor. A janela
// mostra o erro, recarrega a lista e a escolha cai no primeiro pendente que sobrou; retomado o
// último, a janela avisa que o contato não tem mais pendente e o atendimento continua encerrado.
test('quando alguém retoma o pendente antes, a janela avisa, recarrega e cai no que sobrou', async ({
  page,
  baseURL,
}) => {
  const seed = await seedTicketToMergeIntoPending(baseURL!)
  await signIn(page, seed.agent, userPassword)

  // Dois pendentes do contato no setor: o da semente e um segundo, mais novo.
  const second = await markPending(page, seed, 'Aguardando o boleto do mês')
  const firstProtocol = await protocolOf(page, seed.pendingId)
  const secondProtocol = await protocolOf(page, second.id)

  await page.goto(`/atendimentos/${seed.ticketId}`)
  await page.getByRole('button', { name: 'Mesclar em pendente' }).click()
  const dialog = page.getByRole('dialog', { name: 'Mesclar em pendente' })
  await expect(dialog.getByRole('radio')).toHaveCount(2)
  await expect(dialog).toContainText(firstProtocol)
  await expect(dialog).toContainText(secondProtocol)

  // A pessoa escolhe o segundo pendente, e outra pessoa o retoma nesse meio-tempo.
  await dialog.getByRole('radio').nth(1).check()
  await expect(dialog.getByRole('radio').nth(1)).toBeChecked()
  await resumeElsewhere(page, seed, second.id)

  await dialog.getByRole('button', { name: 'Mesclar em pendente' }).click()
  await expect(dialog).toContainText(
    'Este chamado pendente não está mais pendente. Atualize a lista e tente novamente.',
  )
  // A lista recarrega sem o pendente retomado, e a escolha cai no primeiro que sobrou.
  await expect(dialog.getByRole('radio')).toHaveCount(1)
  await expect(dialog.getByRole('radio')).toBeChecked()
  await expect(dialog).toContainText(firstProtocol)
  await expect(dialog).not.toContainText(secondProtocol)

  // Retomado também o último pendente, a janela fica sem escolhas e diz que não há mais pendente.
  await resumeElsewhere(page, seed, seed.pendingId, second.id)
  await dialog.getByRole('button', { name: 'Mesclar em pendente' }).click()
  await expect(dialog.getByRole('radio')).toHaveCount(0)
  await expect(dialog).toContainText('Este contato não tem mais chamado pendente.')

  // Nada foi mesclado: o atendimento continua encerrado e o último pendente voltou para a pessoa.
  const closed = (await (await page.request.get(`/api/tickets/${seed.ticketId}`)).json()) as {
    status: string
  }
  expect(closed.status).toBe('closed')
  const resumed = (await (await page.request.get(`/api/tickets/${seed.pendingId}`)).json()) as {
    status: string
  }
  expect(resumed.status).toBe('in_progress')
})

// A ação só aparece para quem pode mesclar e quando há pendente do contato no setor.
test('a ação não aparece para quem não pode corrigir, no transferido, no mesclado nem sem pendente', async ({
  page,
  baseURL,
}) => {
  const seed = await seedTicketToMergeIntoPending(baseURL!)

  // Outro atendente do setor não encerrou o atendimento: vê a ficha, sem as duas ações.
  await signIn(page, seed.otherAgent, userPassword)
  await page.goto(`/atendimentos/${seed.ticketId}`)
  await expect(page.getByRole('region', { name: 'Atendimento', exact: true })).toContainText(
    'Encerrado',
  )
  await expect(page.getByRole('button', { name: 'Corrigir' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mesclar em pendente' })).toHaveCount(0)
  // E a API recusa a mesclagem.
  const refused = await page.request.post(`/api/tickets/${seed.ticketId}/merge-into-pending`, {
    data: { pendingTicketId: seed.pendingId },
  })
  expect(refused.status()).toBe(403)
  await clearSession(page)

  // O atendimento transferido para outro setor não tem correção nem mesclagem.
  const transferred = await seedTransferredTicket(baseURL!)
  await signIn(page, transferred.origin.agent, userPassword)
  await page.goto(`/atendimentos/${transferred.ticketId}`)
  await expect(page.getByRole('region', { name: 'Atendimento', exact: true })).toContainText(
    'Encerrado',
  )
  await expect(page.getByRole('button', { name: 'Corrigir' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mesclar em pendente' })).toHaveCount(0)
  await clearSession(page)

  // O mesclado só avisa a mesclagem, e as duas ações somem.
  const merged = await seedMergedTicket(baseURL!)
  await signIn(page, merged.agent, userPassword)
  await page.goto(`/atendimentos/${merged.merged.id}`)
  await expect(page.getByRole('region', { name: 'Conversa', exact: true })).toContainText(
    'Chamado mesclado',
  )
  await expect(page.getByRole('button', { name: 'Corrigir' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mesclar em pendente' })).toHaveCount(0)
  await clearSession(page)

  // Sem pendente do contato no setor, a ficha encerrada mantém o Corrigir e não oferece a mesclagem.
  const closed = await seedClosedTicket(baseURL!)
  await signIn(page, closed.agent, userPassword)
  await page.goto(`/atendimentos/${closed.ticketId}`)
  await expect(page.getByRole('button', { name: 'Corrigir' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mesclar em pendente' })).toHaveCount(0)
})
