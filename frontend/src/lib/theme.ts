import { useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark' | 'system'

// A mesma chave é lida pelo script de index.html, que aplica o tema antes de pintar a tela.
const storageKey = 'theme'
const listeners = new Set<() => void>()

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

let current = readTheme()

// Em "Sistema" não há data-theme: os tokens seguem o sistema operacional.
function applyTheme(theme: Theme) {
  current = theme
  if (theme === 'system') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = theme
  }
  listeners.forEach((listener) => listener())
}

function setTheme(theme: Theme) {
  try {
    if (theme === 'system') {
      localStorage.removeItem(storageKey)
    } else {
      localStorage.setItem(storageKey, theme)
    }
  } catch {
    // Sem acesso ao armazenamento do navegador, a escolha vale até recarregar a página.
  }
  applyTheme(theme)
}

// Mantém as outras abas do navegador na mesma escolha.
function onStorage(event: StorageEvent) {
  if (event.key === storageKey || event.key === null) {
    applyTheme(readTheme())
  }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener('storage', onStorage)
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage)
    }
  }
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current)
  return [theme, setTheme] as const
}
