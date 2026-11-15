# Endereços finais de Chamados e Atendimentos

Os endereços antigos do atendimento deixaram de existir; só valem `/chamados`, `/chamados/<id>`, `/atendimentos` e `/atendimentos/<id>`.

## Sub-features

- [jornada] `/conversas`, `/conversas/<id>` e `/atendimento` mostram "Não encontrado" com Voltar, sem redirecionar.
- [jornada] Um endereço desconhecido qualquer, logado, mostra a mesma tela "Não encontrado", com Voltar.
- [jornada] `/chamados/<id>` de um chamado inexistente (ou de id que não é número) mostra "Não encontrado", com Voltar.
- [jornada] `/chamados/<id>` de um chamado encerrado leva a `/atendimentos/<id>`, a ficha só leitura.
- [não coberto] `/atendimentos/<id>` de chamado ativo, sem acesso (403), e o item do menu ativo em cada caso (`rotas.spec.ts`).
- [não coberto] Endereços desconhecidos sem sessão, que vão para o login (`rotas.spec.ts`).

## How to get to it

1. Entre como atendente.
2. Digite um dos endereços antigos, ou qualquer outro que não exista, na barra do navegador.
3. A tela "Não encontrado" tem o texto "Esta página não existe..." e o botão Voltar. Aberto direto, Voltar leva ao início do atendente, a tela Chamados.

## Driving it

```bash
scripts/verify/scripts/drive.sh final-routes
```

- Tela: `getByRole('heading', { name: 'Não encontrado' })`, `getByRole('alert')` e `getByRole('button', { name: 'Voltar' })`.
- O chamado encerrado vem de uma sessão de API do atendente (`t.apiAs`), com contato cadastrado e órgão, como o encerramento exige.

## Gotchas

- Os endereços são abertos com `goto`, sem página anterior no app: por isso Voltar vai a `/chamados`, e não à tela de antes.
- Um chamado inexistente responde 404 na hora; se a tela demorar a aparecer, a causa não é a rota.
- O chamado encerrado precisa existir antes do `goto`; um id inventado cairia em "Não encontrado", e não no redirecionamento.

## Estado final observável

- **Tela:** "Não encontrado" nos endereços antigos, no desconhecido e no chamado inexistente; a ficha "Só leitura" para o encerrado.
- **`tickets`:** o chamado encerrado continua `closed` (`resolved`) e o outro continua na fila: navegar pelos endereços não muda chamado nenhum.
