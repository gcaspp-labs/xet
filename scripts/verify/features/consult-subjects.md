# Consultar assuntos durante o atendimento

O responsável consulta e copia soluções do setor sem sair da conversa.

## Sub-features

- [jornada] Aba Assuntos com soluções do setor e conversa utilizável.
- [jornada] Busca sem acentos e maiúsculas por assunto ou solução.
- [jornada] Copiar o texto exato sem preencher o chat.
- [jornada] Aba e busca preservadas por chamado durante a navegação.
- [não coberto] Permissão, setor vazio, ausência de resultados e tela estreita (`subjects.spec.ts`).

## How to get to it

Assuma um chamado, abra Assuntos no cartão Chamado e busque uma solução. Use Copiar para adaptar o texto no chat.

## Driving it

`scripts/verify/scripts/drive.sh consult-subjects`

## Gotchas

A cópia exige acesso à área de transferência no navegador. Os dados são fictícios e o número usa o adaptador falso.

## Estado final observável

A mensagem enviada aparece na conversa e no banco. A lista de assuntos permanece inalterada.
