# Cancelamento

Finaliza um chamado sem lançar o atendimento, para spam, golpes e engano.

## Regras

1. Cancelar finaliza o chamado sem lançar o atendimento. Dispensa o formulário de encerramento, o cadastro do contato e o órgão.
   _Fonte: migrada do `spec.md` (Cancelamento) em 2026-11-11._
2. Na fila, qualquer pessoa do setor cancela, sem assumir. Em atendimento, cancelam o responsável, os supervisores do setor e os administradores.
   _Fonte: migrada do `spec.md` (Cancelamento) em 2026-11-11._
3. O motivo é um texto livre obrigatório. A conversa mostra quem cancelou, quando e o motivo.
   _Fonte: migrada do `spec.md` (Cancelamento) em 2026-11-11._
4. O chamado cancelado fica no histórico, identificado como cancelado, e não é corrigido nem reaberto. Notas internas continuam permitidas.
   _Fonte: migrada do `spec.md` (Cancelamento) em 2026-11-11._
5. Uma nova mensagem do mesmo número abre outro chamado, como após um encerramento.
   _Fonte: migrada do `spec.md` (Cancelamento) em 2026-11-11._

## Fora do escopo / limites conhecidos

- Nenhum registrado.

## Relacionado

- Dados: `tickets` (`closure_type = 'cancelled'`), `audit_logs` (`ticket_cancelled`).

## Histórico

- Nenhuma mudança desde a migração.
