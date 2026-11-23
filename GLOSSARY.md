# Central de atendimento via WhatsApp

O xet é a central de atendimento da GCASPP LAB, onde cada setor atende pelo seu número de WhatsApp. Este glossário liga o nome que aparece na interface ao nome usado no código e no banco.

## Linguagem

### Chamados

**Chamado** (`ticket`):
O pedido de atendimento de um contato com um setor, da primeira mensagem até o encerramento. Chamados são os que estão na fila, em atendimento ou pendentes.
_Evite_: conversa, atendimento, ticket

**Atendimentos** (`ticket` com `status = 'closed'`, rota `/atendimentos`):
A tela e o conjunto dos chamados já encerrados — encerrados normalmente, transferidos para outro setor e cancelados —, para consulta.
_Evite_: histórico de conversas, atendimentos do dia

**Canal** (`tickets.channel`):
Por onde o atendimento aconteceu: **WhatsApp** (`whatsapp`, todos os chamados que nascem de uma mensagem ou do Novo chamado) ou **Telefone** (`phone`). Um registro por telefone é um chamado encerrado com canal Telefone, sem conversa; não é um conceito separado.
_Evite_: origem, meio, tipo de chamado

**Fila** (`ticket_status = 'queued'`):
Os chamados do setor que ainda não têm responsável, à espera de alguém assumir.
_Evite_: abertos

**Pendente** (`ticket_status = 'pending'`):
O chamado que o responsável deixou parado, com um motivo, porque depende de outra coisa para ser concluído. Fica sem responsável, na lista Pendentes do setor, não recebe mensagens novas e libera o contato para um chamado novo na fila; qualquer integrante do setor pode retomá-lo.
_Evite_: em espera, aguardando, pausado

**Mesclado** (`closure_type = 'merged'`):
O chamado cujas mensagens passaram para um pendente do mesmo contato e setor, que foi retomado a partir dele (`merged_into_ticket_id`). Fica em Atendimentos com o link para o chamado de destino e não conta como encerrado.
_Evite_: unido, juntado, duplicado

**Responsável** (`assignee_id`):
O atendente que conduz o chamado naquele momento; só ele responde e encerra. Cada chamado tem um responsável por vez.
_Evite_: dono, atendente do chamado

**Protocolo** (`protocol`):
O identificador do chamado, no formato ano e sequência (`2026-000123`), visível só para a equipe.
_Evite_: número do chamado, código

**Módulo** (`module`, `ticket_modules`):
Um dos sistemas atendidos pelo setor, marcado no encerramento para dizer do que o chamado tratou.
_Evite_: sistema, produto

**Assunto** (`tickets.subject`, `subjects`):
O tema do atendimento, escolhido na lista do módulo ou digitado no formulário de encerramento.
_Evite_: categoria, título

**Solução** (`subject_solutions`):
Um texto pronto, guardado na lista de um assunto, que sugere a resolução do chamado.
_Evite_: resposta pronta, modelo

**Resolução** (`tickets.resolution`):
O texto que registra como o chamado foi resolvido, vindo de uma solução ou digitado no formulário.
_Evite_: solução, resposta

### Pessoas e acesso

**Atendente** (`user_role = 'agent'`):
O usuário que atende os chamados do próprio setor.
_Evite_: agente, operador

**Supervisor** (`user_role = 'supervisor'`):
O usuário que administra o próprio setor: chamados, listas, número de WhatsApp e senhas da equipe.
_Evite_: gerente, coordenador

**Administrador** (`user_role = 'admin'`):
O supervisor global: atende em todos os setores e cadastra setores e usuários. Não pertence a um setor.
_Evite_: admin, superusuário

**`accessible`**:
A permissão de agir sobre um chamado: ver, assumir, responder e encerrar. Depende do acesso ao setor do chamado.
_Evite_: visível, permitido

**`viewable`**:
A permissão de apenas ler um chamado: vale também para quem tem acesso a um setor posterior na corrente de transferências entre setores. Não permite agir.
_Evite_: acessível, editável

### Cadastro de clientes

**Setor** (`sector`):
A área da empresa que atende, com o próprio número de WhatsApp, fila, usuários, módulos e listas.
_Evite_: departamento, equipe

**Órgão** (`organization`):
A entidade pública cliente, de um município, que o contato representa.
_Evite_: cliente, empresa, unidade

**Contato** (`contact`):
A pessoa que conversa pelo WhatsApp com o setor; pode estar vinculada a um órgão.
_Evite_: cliente, usuário, lead

**Município** (`municipality`):
O município paulista do órgão, identificado pelo código AUDESP e pelo código do IBGE.
_Evite_: cidade, prefeitura
