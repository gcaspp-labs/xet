import { useEffect, useState } from 'react'

// Diz se a aba está visível. Compartilhado porque a tela de chamados só marca como lido com a aba
// visível (spec #310) e a #315 precisa do mesmo estado para som, notificação e título.
export function useDocumentVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}
