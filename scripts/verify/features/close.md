# Encerrar

O responsável encerra o chamado com o formulário completo, ou cancela o que não é atendimento de verdade.

## Sub-features

- [jornada] Formulário vazio não encerra e diz o que falta.
- [jornada] Com o contato sem cadastro, o backend recusa o encerramento.
- [jornada] O contato pode ser cadastrado pelo próprio formulário.
- [jornada] Fim antes do início é recusado.
- [jornada] Ao encerrar, a tela volta a Chamados, e o atendimento aparece no histórico de Atendimentos.
- [jornada] O supervisor vê o atendimento no histórico, sem recarregar.
- [jornada] O chamado encerrado abre a ficha só leitura em `/atendimentos/<id>` (o endereço de Chamados leva até lá), com o registro, e não aceita resposta.
- [jornada] Nova mensagem do contato abre outro chamado, sem reabrir.
- [jornada] O cancelamento direto da fila exige motivo e dispensa o cadastro.
- [não coberto] Correção de chamado encerrado (`correction.spec.ts`).
- [não coberto] Cancelamento de chamado em atendimento e as permissões do cancelamento (`closing.spec.ts`).
- [não coberto] Trocar o órgão só para este chamado, no formulário (`closing.spec.ts`).

Encerrar não depende do WhatsApp real: a matriz de `docs/pilot-validation.md` marca esses critérios como "Não depende".

## How to get to it

**Encerrar:**

1. Com o chamado assumido, o responsável clica em "Encerrar".
2. Preenche assunto e resolução, marca os módulos e escolhe o órgão. Início e fim já vêm preenchidos e podem ser ajustados.
3. Se o contato não tiver cadastro, clica em "Cadastrar contato", escolhe o órgão e salva.
4. Clica em "Encerrar". O aviso "Chamado encerrado" aparece, e a tela volta a `/chamados`. Em Atendimentos, o chamado é uma linha do histórico, com a situação "Encerrado".

**Cancelar:**

1. No chamado, abre o menu "Mais ações", escolhe "Cancelar chamado", informa o motivo e confirma.
2. A tela volta a `/chamados`, e o histórico de Atendimentos tem a linha marcada "Cancelado".

## Driving it

```bash
scripts/verify/scripts/drive.sh close
```

- Formulário: `getByRole('dialog', { name: 'Encerrar chamado' })`, com `getByLabel('Assunto')`, `getByLabel('Resolução')`, `getByRole('checkbox', { name: 'Folha' })`, `getByLabel('Órgão')`, seguido de `getByRole('option', { name })`, `getByLabel('Início')` e `getByLabel('Fim')`.
- Cadastro do contato: `getByRole('dialog', { name: 'Editar contato' })`.
- Cancelamento: `getByRole('dialog', { name: 'Cancelar chamado' })`, com `getByLabel('Motivo')`.
- Fila: `getByRole('region', { name: 'Fila, assuntos e pendentes' })`, com `getByRole('button', { name: 'Assumir chamado de Nome' })`.
- Histórico: em Atendimentos, `getByRole('table').getByRole('row')` filtrada pelo nome do contato. Ações como "Cancelar chamado" ficam no menu `getByRole('button', { name: 'Mais ações' })`.
- Ficha: `getByRole('status', { name: 'Só leitura' })` e `getByRole('region', { name: 'Atendimento', exact: true })` para os detalhes.

## Gotchas

- Pré-condições: o setor precisa de módulos (`seedSector({ modules })`), e precisa existir um órgão (`seedOrganization()`). Sem módulo não há como encerrar, e isso é a regra, e não um defeito.
- `Início` e `Fim` são `datetime-local`, no fuso da página. As sessões das jornadas usam `America/Sao_Paulo`; a jornada calcula os horários com esse fuso.
- Observado em 2026-11-03: depois de salvar o contato, o aviso "Cadastre o contato e vincule-o a um órgão antes de encerrar." continua no alto do formulário até a nova tentativa de encerrar, embora o bloco "Contato não cadastrado" saia. Veja `03-formulario-completo.png`. A jornada não exige que o aviso saia; se o produto mudar isso, ela segue valendo.
- O texto da tela de encerrado é "Chamado encerrado." na conversa e "Chamado encerrado" no aviso; use `exact: true` para o aviso.
- A linha do histórico tem um link que cobre a célula, e clicar nela abre a ficha. Um chamado encerrado aberto em `/chamados/<id>` é levado a `/atendimentos/<id>`.
- Na ficha, o aviso "Chamado encerrado." virou "Só leitura. Encerrado em ... por ...".

## Estado final observável

- **Tela:** o histórico de Atendimentos com a linha "Encerrado", o nome do responsável e o assunto, para quem encerrou e para o supervisor; a ficha sem caixa de resposta, com assunto, resolução, módulos e órgão nos detalhes.
- **`tickets`, encerrado:** `status = 'closed'`, `closure_type = 'resolved'`, assunto, resolução, órgão, quem encerrou e `ended_at >= started_at`.
- **`ticket_modules`:** Folha e Patrimônio.
- **`audit_logs`:** `ticket_closed` no encerrado; `ticket_cancelled` com o motivo no cancelado.
- **`tickets`, cancelado:** `closure_type = 'cancelled'`, com o contato ainda sem cadastro.
- **`tickets`, novo:** o mesmo contato com um chamado `closed` e um `queued`.
