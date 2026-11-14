# Acesso a Chamados pelo menu

O atendente abre Chamados pelo menu, assume um chamado e responde nos temas disponíveis.

## Sub-features

- [jornada] Acesso pelo menu Helpdesk e estado sem atendimentos.
- [jornada] Chamado recebido aparece na Fila e pode ser assumido.
- [jornada] Mensagem enviada aparece no chamado, com capturas nos temas claro, escuro e alto contraste.
- [não coberto] Filtrar e ordenar atendimentos, trocar de chamado e acessar Assuntos (`conversas.spec.ts`).
- [manual] Receber e responder pelo WhatsApp real.

## How to get to it

1. Entre como atendente e escolha "Chamados" no menu Helpdesk.
2. Sem atendimentos, confira "Sem atendimentos disponíveis" e a aba Fila.
3. Uma mensagem chega ao setor; clique em "Assumir" no chamado da aba Fila.
4. Escreva uma resposta e envie com Enter. Em Configurações, altere o tema para conferir o chamado.

## Driving it

```bash
scripts/verify/scripts/drive.sh conversas-menu
```

- O setor e o atendente são criados por `t.seedSector()`; a mensagem chega pelo adaptador falso `t.phone(setor.id).receive(contato, texto)`.
- Menu: `getByRole('link', { name: 'Chamados', exact: true })`. Fila: `getByRole('tab', { name: 'Fila' })`; botão: `getByRole('button', { name: 'Assumir chamado de Cliente de teste' })`.
- Resposta: `getByRole('textbox', { name: 'Mensagem' })` e `getByRole('listitem', { name: 'Mensagem enviada' })`.
- Temas: botão "Configurações", opções "Escuro", "Claro" e "Alto contraste".

## Gotchas

- A jornada cria um setor isolado com dados fictícios; a mensagem recebida não prova a conexão com o WhatsApp real.
- A aba Fila é selecionada ao entrar. O nome acessível do botão inclui o nome do contato.
- A verificação final conta chamados em atendimento no setor; a presença da mensagem enviada é conferida na tela.

## Estado final observável

- **Tela:** chamado aberto com a mensagem enviada, capturada nos três temas.
- **`tickets`:** um chamado com `status = 'in_progress'` no setor criado.
