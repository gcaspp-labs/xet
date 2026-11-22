// Rascunho do campo de mensagem, por usuário e por chamado, no armazenamento do navegador.
// Como o tema e os alertas, sem acesso ao armazenamento nada quebra: só não há rascunho.
const prefix = 'message-draft'

function key(userId: number, ticketId: number) {
  return `${prefix}.${userId}.${ticketId}`
}

export function readDraft(userId: number, ticketId: number) {
  try {
    return localStorage.getItem(key(userId, ticketId)) ?? ''
  } catch {
    return ''
  }
}

// O texto vazio apaga o rascunho: enviar a mensagem ou apagar tudo limpa aquele chamado.
export function saveDraft(userId: number, ticketId: number, text: string) {
  try {
    if (text) {
      localStorage.setItem(key(userId, ticketId), text)
    } else {
      localStorage.removeItem(key(userId, ticketId))
    }
  } catch {
    // Sem acesso ao armazenamento (bloqueado ou cheio), o texto vale só enquanto o chamado estiver aberto.
  }
}

// Sair da conta apaga os rascunhos do usuário, para um computador compartilhado não guardar
// o que a pessoa estava escrevendo.
export function clearDraft(userId: number, ticketId: number) {
  saveDraft(userId, ticketId, '')
}

export function clearUserDrafts(userId: number) {
  try {
    const start = `${prefix}.${userId}.`
    for (const stored of Object.keys(localStorage)) {
      if (stored.startsWith(start)) {
        localStorage.removeItem(stored)
      }
    }
  } catch {
    // Sem acesso ao armazenamento, não há o que apagar.
  }
}
