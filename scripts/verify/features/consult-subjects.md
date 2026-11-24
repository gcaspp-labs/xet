# Consultar assuntos durante o atendimento

O responsável consulta e copia soluções do setor sem sair da conversa.

## Sub-features

- [jornada] Aba Assuntos com soluções do setor e conversa utilizável.
- [jornada] Busca sem acentos e maiúsculas por assunto ou solução.
- [jornada] Copiar o texto exato sem preencher o chat.
- [jornada] Ao trocar de chamado, a aba volta à Fila e a busca de cada chamado é lembrada.
- [não coberto] Permissão, setor vazio, ausência de resultados e tela estreita (`subjects.spec.ts`).

## How to get to it

Na tela Chamados, assuma um chamado pela Fila, abra a aba Assuntos do cartão "Fila, assuntos e pendentes" e busque uma solução. Use Copiar para adaptar o texto no chat.

## Driving it

`scripts/verify/scripts/drive.sh consult-subjects`

## Gotchas

- A cópia exige acesso à área de transferência no navegador. Os dados são fictícios e o número usa o adaptador falso.
- A aba Assuntos só aparece para o responsável. Para trocar de chamado, assuma os dois: só os assumidos aparecem em "Meus chamados".
- A aba volta à Fila a cada troca de chamado (não há mais tela Ver chamado nem aba Detalhes aqui); só a busca é lembrada, por chamado, e a jornada confere isso abrindo Assuntos de novo.

## Estado final observável

A mensagem enviada aparece na conversa e no banco. A lista de assuntos permanece inalterada.
