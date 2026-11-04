import { useSyncExternalStore } from 'react'

export type TextSize = 'default' | 'large' | 'larger'

// As mesmas chaves são lidas pelo script de index.html, que aplica a escolha antes de pintar a tela.
const textSizeKey = 'text-size'
const contrastKey = 'contrast'
const listeners = new Set<() => void>()

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function readTextSize(): TextSize {
  const stored = read(textSizeKey)
  return stored === 'large' || stored === 'larger' ? stored : 'default'
}

function readHighContrast() {
  return read(contrastKey) === 'high'
}

let textSize = readTextSize()
let highContrast = readHighContrast()

function write(key: string, value: string | null) {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // Sem acesso ao armazenamento do navegador, a escolha vale até recarregar a página.
  }
}

function applyTextSize(size: TextSize) {
  textSize = size
  if (size === 'default') {
    delete document.documentElement.dataset.textSize
  } else {
    document.documentElement.dataset.textSize = size
  }
  listeners.forEach((listener) => listener())
}

function applyContrast(high: boolean) {
  highContrast = high
  if (high) {
    document.documentElement.dataset.contrast = 'high'
  } else {
    delete document.documentElement.dataset.contrast
  }
  listeners.forEach((listener) => listener())
}

function setTextSize(size: TextSize) {
  write(textSizeKey, size === 'default' ? null : size)
  applyTextSize(size)
}

function setHighContrast(high: boolean) {
  write(contrastKey, high ? 'high' : null)
  applyContrast(high)
}

// Mantém as outras abas do navegador na mesma escolha. A escuta vale a sessão inteira, porque o
// menu que usa estas escolhas só existe enquanto está aberto.
window.addEventListener('storage', (event) => {
  if (event.key === textSizeKey || event.key === null) {
    applyTextSize(readTextSize())
  }
  if (event.key === contrastKey || event.key === null) {
    applyContrast(readHighContrast())
  }
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTextSize() {
  const size = useSyncExternalStore(subscribe, () => textSize)
  return [size, setTextSize] as const
}

export function useContrast() {
  const high = useSyncExternalStore(subscribe, () => highContrast)
  return [high, setHighContrast] as const
}
