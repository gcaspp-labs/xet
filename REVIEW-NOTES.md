# Notas da revisão do PR 96 (T87)

Commit verificado: `1a4bdbbeb3114e717a645800f6ecbb0c7de0f2e4`.

As jornadas `revisao-t87`, `receive-and-assign` e `connection` passaram: 32 passos, 25 capturas, dados falsos, sem interceptar nem filtrar as respostas da API de setores. A jornada nova troca entre dois setores no painel do administrador e assume pela fila. No banco, confirma o responsável, a auditoria única, as filas restantes e a conexão dos dois setores. O menu foi conferido visualmente.

Som e notificações foram medidos por instrumentação de OscillatorNode.start e do construtor nativo Notification, no Chromium completo com permissão concedida. A visibilidade de segundo plano foi simulada, como nos testes ponta a ponta do projeto. Foram observados zero som/notificação/toast para o administrador com preferências antigas ligadas, e um som e uma notificação para cada supervisor e atendente em contextos distintos. Isso não comprova áudio audível nem a apresentação pelo sistema operacional em navegador físico.

## Tentativa anterior e causa confirmada

A primeira execução (`run-20261105-131732`, mesmo commit, Cleanup concluído) parou depois dos passos da regra principal ao esperar um QR code depois de uma queda temporária (`Drop`). A captura da falha mostrou a conta já conectada.

O código em `backend/internal/helpdesk/messaging/fake/fake.go` esclarece a causa: `Drop` preserva a conta; `Connect` reconecta imediatamente uma conta conhecida; `LogOut` desvincula a conta. Também está documentado no fluxo de conexão da skill.

A nova execução conserva as verificações originais e acrescenta a pré-condição de desvincular pelo celular simulado, conferindo `logged_out` e `external_account_id = null` no banco antes de exigir o novo QR code. Não houve mudança no produto nem na jornada permanente. A falha anterior era uma pré-condição incorreta da jornada temporária.

## Limites

Nada foi testado no WhatsApp real. Nenhum teste humano é exigido na T87, que tem verificação automática. A reprodução física de som/notificação pode ser conferida manualmente como complemento.
