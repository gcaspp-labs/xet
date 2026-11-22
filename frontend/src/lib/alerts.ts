import { useSyncExternalStore } from 'react'

// Alertas para quem está fora da tela (spec.md › Notificações): notificação do navegador e som.
// A escolha fica no navegador, como o tema, e vale para todas as abas.
const browserKey = 'alerts.browser'
const soundKey = 'alerts.sound'
const claimsKey = 'alerts.claims'
const visibleTabKey = 'alerts.visible-tab'

// Tempo em que o chamado fica reservado pela aba que alertou primeiro. Cobre as abas que recarregam
// a fila pelo mesmo evento; depois dele, o chamado devolvido à fila pode alertar de novo.
const claimDuration = 10_000
// A aba em segundo plano espera um pouco para a aba visível, se houver, reservar antes.
const hiddenTabDelay = 500
// Som bloqueado até a primeira interação: passado esse tempo, não toca mais aquele alerta.
const soundMaxWait = 1_000

export type NotificationBlock = 'unsupported' | 'insecure' | 'denied'

const listeners = new Set<() => void>()

function readFlag(key: string) {
  try {
    return localStorage.getItem(key) === 'on'
  } catch {
    return false
  }
}

let browserWanted = readFlag(browserKey)
let soundWanted = readFlag(soundKey)

function emit() {
  listeners.forEach((listener) => listener())
}

function writeFlag(key: string, on: boolean) {
  try {
    if (on) {
      localStorage.setItem(key, 'on')
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // Sem acesso ao armazenamento do navegador, a escolha vale até recarregar a página.
  }
}

function permission(): NotificationPermission | 'unsupported' {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

// Por que o navegador não entrega notificações aqui. O navegador só libera em HTTPS ou localhost.
function notificationBlock(): NotificationBlock | undefined {
  const state = permission()
  if (state === 'unsupported') {
    return 'unsupported'
  }
  if (!window.isSecureContext) {
    return 'insecure'
  }
  return state === 'denied' ? 'denied' : undefined
}

function browserEnabled() {
  return browserWanted && permission() === 'granted' && window.isSecureContext
}

// A permissão só é pedida aqui, ao ativar, nunca ao abrir a página.
async function setBrowserAlerts(on: boolean) {
  if (on && permission() === 'default' && window.isSecureContext) {
    await Notification.requestPermission()
  }
  browserWanted = on && permission() === 'granted'
  writeFlag(browserKey, browserWanted)
  emit()
}

function setSoundAlerts(on: boolean) {
  soundWanted = on
  writeFlag(soundKey, on)
  emit()
}

// Mantém as outras abas do navegador na mesma escolha. A escuta vale a sessão inteira, porque os
// alertas usam a escolha mesmo com o menu fechado.
window.addEventListener('storage', (event) => {
  if (event.key === browserKey || event.key === soundKey || event.key === null) {
    browserWanted = readFlag(browserKey)
    soundWanted = readFlag(soundKey)
    emit()
  }
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAlertSettings() {
  const browser = useSyncExternalStore(subscribe, browserEnabled)
  const sound = useSyncExternalStore(subscribe, () => soundWanted)
  const block = useSyncExternalStore(subscribe, notificationBlock)
  return { browser, sound, block, setBrowserAlerts, setSoundAlerts }
}

// Cada chamado tem a própria chave: duas abas que reservam chamados diferentes ao mesmo tempo
// não apagam a reserva uma da outra.
const queueClaimKey = (ticketId: number) => `${claimsKey}.${ticketId}`

// Cada mensagem nova no mesmo chamado tem a própria chave, com a quantidade de não lidas (spec
// #310): duas mensagens seguidas alertam duas vezes, e um alerta do mesmo chamado não bloqueia o
// seguinte. O prefixo separa estas reservas das da fila.
const messageClaimKey = (ticketId: number, unread: number) =>
  `${claimsKey}.message.${ticketId}.${unread}`

function reserve(key: string) {
  try {
    const now = Date.now()
    if (now - Number(localStorage.getItem(key) ?? 0) < claimDuration) {
      return false
    }
    localStorage.setItem(key, String(now))
    return true
  } catch {
    // Sem armazenamento, a etiqueta da notificação ainda evita repeti-la.
    return true
  }
}

// Apaga as reservas vencidas, para não acumular uma chave por chamado. Com trava, cada chave só
// sai com a trava do próprio chamado: ninguém está gravando nela, e a leitura está em dia.
function dropExpiredClaims() {
  try {
    const now = Date.now()
    const expired = Object.keys(localStorage).filter(
      (key) =>
        key.startsWith(`${claimsKey}.`) &&
        now - Number(localStorage.getItem(key) ?? 0) >= claimDuration,
    )
    // Formato antigo, um objeto só com todas as reservas.
    localStorage.removeItem(claimsKey)
    for (const key of expired) {
      if (!('locks' in navigator)) {
        localStorage.removeItem(key)
        continue
      }
      void navigator.locks.request(key, { ifAvailable: true }, (lock) => {
        if (lock && Date.now() - Number(localStorage.getItem(key) ?? 0) >= claimDuration) {
          localStorage.removeItem(key)
        }
      })
    }
  } catch {
    // Sem armazenamento, não há o que apagar.
  }
}

// Só uma aba alerta cada chamado. A trava existe em HTTPS e localhost, os mesmos endereços em
// que há notificação; sem ela, só o som pode repetir, se duas abas reservarem ao mesmo tempo.
// A aba que ganha segura a trava da chave durante a reserva: o navegador garante que só uma
// aba a tem, e a gravação no localStorage, que chega às outras com atraso, já chegou quando a
// trava for solta. A gravação guarda a reserva se a aba que alertou fechar antes do fim.
function claim(key: string): Promise<boolean> {
  if (!('locks' in navigator)) {
    return Promise.resolve(reserve(key))
  }
  return new Promise((resolve) => {
    void navigator.locks.request(key, { ifAvailable: true }, (lock) => {
      const won = lock !== null && reserve(key)
      resolve(won)
      return won ? new Promise((release) => setTimeout(release, claimDuration)) : undefined
    })
  })
}

let releaseVisibleTab: (() => void) | undefined

// A aba visível segura uma trava compartilhada, que o navegador solta sozinho se ela fechar ou
// travar. É assim que uma aba em segundo plano sabe que a pessoa está em outra aba do sistema.
function syncVisibleTab() {
  if (!('locks' in navigator)) {
    return
  }
  if (document.visibilityState !== 'visible') {
    releaseVisibleTab?.()
    releaseVisibleTab = undefined
  } else if (!releaseVisibleTab) {
    const held = new Promise<void>((resolve) => {
      releaseVisibleTab = resolve
    })
    void navigator.locks.request(visibleTabKey, { mode: 'shared' }, () => held)
  }
}

syncVisibleTab()
document.addEventListener('visibilitychange', syncVisibleTab)

async function someTabVisible() {
  if (!('locks' in navigator)) {
    return false
  }
  const { held } = await navigator.locks.query()
  return held?.some((lock) => lock.name === visibleTabKey) ?? false
}

function notify(title: string, tag: string, contactName: string, onOpen: () => void) {
  try {
    // Só o nome do contato: o texto da mensagem não sai da tela do sistema.
    const notification = new Notification(title, { body: contactName, tag })
    notification.onclick = () => {
      window.focus()
      notification.close()
      onOpen()
    }
  } catch {
    // Navegadores de celular só criam notificação por service worker, fora do escopo.
  }
}

let audioContext: AudioContext | undefined

function beep(context: AudioContext) {
  const start = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, start)
  oscillator.frequency.setValueAtTime(1175, start + 0.12)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + 0.3)
}

// Sem interação prévia com a página, o navegador deixa o resume pendente: nada toca e nada quebra.
function playSound() {
  try {
    const context = (audioContext ??= new AudioContext())
    const requestedAt = Date.now()
    context
      .resume()
      .then(() => {
        // Liberado só agora, por um clique bem depois do alerta: o som já não diz nada.
        if (Date.now() - requestedAt < soundMaxWait) {
          beep(context)
        }
      })
      .catch(() => {})
  } catch {
    // Navegador sem Web Audio: fica só o contador.
  }
}

// Alerta a entrada de um chamado na fila. Quem decide o que entrou é a comparação do sino, que
// já ignora a primeira carga e a reconexão.
export function alertQueueEntry(ticketId: number, contactName: string, onOpen: () => void) {
  raiseAlert('Chamado recebido', queueClaimKey(ticketId), `ticket-${ticketId}`, contactName, onOpen)
}

// Alerta a mensagem nova do cliente num chamado de que a pessoa é responsável (spec #310). Quem
// compara as não lidas é o sino, que já ignora a primeira carga, a reconexão e o chamado aberto
// com a aba visível. `unread` entra na chave da reserva: cada mensagem alerta uma vez.
export function alertNewMessage(
  ticketId: number,
  unread: number,
  contactName: string,
  onOpen: () => void,
) {
  raiseAlert(
    'Mensagem nova',
    messageClaimKey(ticketId, unread),
    `message-${ticketId}-${unread}`,
    contactName,
    onOpen,
  )
}

function raiseAlert(
  title: string,
  key: string,
  tag: string,
  contactName: string,
  onOpen: () => void,
) {
  if (!browserEnabled() && !soundWanted) {
    return
  }
  const isHidden = () => document.visibilityState !== 'visible'
  const hiddenOnArrival = isHidden()
  const run = async () => {
    if (!(await claim(key))) {
      return
    }
    dropExpiredClaims()
    // Só notifica quem não viu o aviso na tela: a aba estava fora ao chegar e continua fora agora,
    // e nenhuma outra aba do sistema está à vista. A pessoa pode ter voltado durante a espera.
    if (hiddenOnArrival && isHidden() && browserEnabled() && !(await someTabVisible())) {
      notify(title, tag, contactName, onOpen)
    }
    if (soundWanted) {
      playSound()
    }
  }
  if (hiddenOnArrival) {
    setTimeout(() => void run(), hiddenTabDelay)
  } else {
    void run()
  }
}
