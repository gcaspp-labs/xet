import { useSyncExternalStore } from 'react'

// Alertas para quem está fora da tela (spec.md › Notificações): notificação do navegador e som.
// A escolha fica no navegador, como o tema, e vale para todas as abas.
const browserKey = 'alerts.browser'
const soundKey = 'alerts.sound'
const claimsKey = 'alerts.claims'

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

function reserve(ticketId: number) {
  try {
    const now = Date.now()
    const stored = JSON.parse(localStorage.getItem(claimsKey) ?? '{}') as Record<string, number>
    if (now - (stored[ticketId] ?? 0) < claimDuration) {
      return false
    }
    const claims = Object.fromEntries(
      Object.entries(stored).filter(([, at]) => now - at < claimDuration),
    )
    localStorage.setItem(claimsKey, JSON.stringify({ ...claims, [ticketId]: now }))
    return true
  } catch {
    // Sem armazenamento, a etiqueta da notificação ainda evita repeti-la.
    return true
  }
}

// Só uma aba alerta cada chamado. A trava existe em HTTPS e localhost, os mesmos endereços em
// que há notificação; sem ela, só o som pode repetir, se duas abas reservarem ao mesmo tempo.
function claim(ticketId: number): Promise<boolean> {
  if (!('locks' in navigator)) {
    return Promise.resolve(reserve(ticketId))
  }
  return navigator.locks.request(claimsKey, () => reserve(ticketId))
}

function notify(ticketId: number, contactName: string, onOpen: () => void) {
  try {
    // Só o nome do contato: o texto da mensagem não sai da tela do sistema.
    const notification = new Notification('Chamado recebido', {
      body: contactName,
      tag: `ticket-${ticketId}`,
    })
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
  if (!browserEnabled() && !soundWanted) {
    return
  }
  const isHidden = () => document.visibilityState !== 'visible'
  const hiddenOnArrival = isHidden()
  const run = async () => {
    if (!(await claim(ticketId))) {
      return
    }
    // Só notifica quem não viu o aviso na tela: a aba estava fora ao chegar e continua fora agora.
    // A pessoa pode ter voltado à aba durante a espera.
    if (hiddenOnArrival && isHidden() && browserEnabled()) {
      notify(ticketId, contactName, onOpen)
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
