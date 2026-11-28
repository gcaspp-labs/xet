// Registra o service worker que torna o sistema instalável como app (#512).
// Ele não guarda nada; sem ele o navegador não oferece "Instalar app".
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
    // Navegador sem suporte ou contexto inseguro: o sistema funciona como antes.
  })
}
