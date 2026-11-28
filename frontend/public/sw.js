// Service worker mínimo: só faz o navegador aceitar instalar o sistema como app (#512).
// Não guarda tela nem resposta da API; sem internet vale a mensagem do navegador.

self.addEventListener('install', () => {
  // Um deploy novo vale sem esperar as abas antigas fecharem.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Passa a controlar as abas abertas na hora.
  event.waitUntil(self.clients.claim())
})

// Sem respondWith: a rede segue direto e nada fica guardado.
self.addEventListener('fetch', () => {})
