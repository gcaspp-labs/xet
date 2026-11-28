# Instalar o sistema como app

O sistema pode ser instalado pelo próprio navegador: "Instalar app" no Chrome e no Edge do computador, "Adicionar à tela inicial" no celular. Instalado, abre em janela própria com o nome e o ícone do sistema; na aba, quem não instala continua igual.

## Sub-features

- [jornada] A página liga `/manifest.json` com `crossorigin="use-credentials"` (o cookie do Cloudflare Access) e `/apple-touch-icon.png`, e não tem botão "Instalar" próprio.
- [jornada] O manifest responde como JSON com o nome "Central de Atendimento", o nome curto "Atendimento", `start_url` e `scope` em `/`, `display: standalone` e as cores do design system, e os ícones 192, 512 e 512 maskable abrem.
- [jornada] O service worker registra, ativa e passa a controlar a página; recarregar mostra o sistema de novo, e nada fica guardado no aparelho.
- [não coberto] Instalar de verdade no Chrome e no Edge, pelo Cloudflare Access, e adicionar à tela inicial de um celular Android e de um iPhone: só na conferência manual, em `docs/pilot-validation.md`.
- [não coberto] A janela própria do app, o nome e o ícone na barra de tarefas: só na conferência manual.

## How to get to it

1. Entre como atendente (ou veja a tela de login).
2. A página já traz o link do manifest e o service worker registra sozinho; não há tela nova nem botão.
3. No navegador, o menu "Instalar app" aparece quando o manifest e o service worker estão válidos.

## Driving it

```bash
scripts/verify/scripts/drive.sh instalar-como-app
```

- `<head>`: `link[rel="manifest"]` com `href="/manifest.json"` e `crossorigin="use-credentials"`, e `link[rel="apple-touch-icon"]`.
- Manifest e ícones: `fetch` dentro da página, conferindo status, tipo e campos.
- Service worker: `navigator.serviceWorker.ready` e `navigator.serviceWorker.controller`; depois, `page.reload()` e a tela Chamados de novo.

## Gotchas

- A instalação em si é decisão do navegador e não tem tela: o Chromium da verificação é headless, então só a conferência manual prova a janela própria e o ícone.
- `page.reload()` com o service worker ativo é o ponto que pegaria um cache: se o sistema guardasse tela, a versão velha apareceria aqui.
- `caches.keys()` vazio é o esperado; o service worker não guarda nada, nem a API.

## Estado final observável

- **Tela:** depois de recarregar, a fila do atendente continua visível em `/chamados`.
- **Aparelho:** uma inscrição de service worker em `/sw.js` e nenhum espaço de cache.
- **`tickets`:** instalar não mexe em chamado; o setor preparado continua sem chamado.
