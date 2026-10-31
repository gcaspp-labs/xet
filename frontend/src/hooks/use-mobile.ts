import * as React from 'react'

// Abaixo de 760px a barra lateral vira gaveta (design.md); igual a --breakpoint-md.
const MOBILE_BREAKPOINT = 760
const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(query)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
