# Tempo real por avisos, com os dados sempre pela API

O WebSocket (`GET /api/ws`) só avisa o que mudou (`{"type": "ticket", "sectorId": 1, "ticketId": 10}`), e a interface recarrega pela API, com TanStack Query. Assim, a API continua sendo a única fonte dos dados e das permissões: um evento perdido, uma reconexão ou uma conexão lenta derrubada se resolvem recarregando, sem reconciliar estado no navegador. Os eventos são publicados só depois do commit, e o servidor guarda em memória apenas as conexões abertas.

## Consequências

- Recursos novos de tempo real reaproveitam os avisos existentes: o dashboard, o sino e os alertas do navegador não têm evento nem tabela próprios. O sino compara a fila recarregada com a anterior.
- Cada aviso custa uma requisição por tela aberta.
