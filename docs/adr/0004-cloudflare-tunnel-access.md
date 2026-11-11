# Publicação por Cloudflare Tunnel e Access, sem porta aberta

O sistema é publicado em `https://atendimento.gcaspp.com.br` por um túnel da Cloudflare (`cloudflared`, conexão só de saída), sem porta aberta no servidor, e o Cloudflare Access controla quem chega à tela de login: o IP do escritório entra direto, e os demais recebem um código por e-mail, só para os e-mails da equipe. O HTTPS termina na Cloudflare, e o Caddy fala HTTP dentro do Compose.

## Consequências

- O DNS do domínio inteiro passou para a Cloudflare, que o plano gratuito exige.
- O IP real vem do `CF-Connecting-IP`: o Caddy o grava em `X-Forwarded-For`, e o backend só confia nele com `TRUST_PROXY=true`. Sem isso, as tentativas de login de todos contariam como um IP só, e 30 erros de qualquer pessoa bloqueariam o login de todos.
- O túnel mantém o `Host` original, porque o WebSocket confere a origem.
- O roteiro está em `docs/pilot-validation.md`.
