# Conexão do número

Cada setor tem um número de WhatsApp, ligado ao sistema pelo QR code. Supervisores e administradores conectam, acompanham e desvinculam o número.

## Regras

1. Cada setor tem o próprio número de WhatsApp, vinculado pelo QR code.
2. O telefone do setor não é digitado: vem do número lido no QR code ao conectar.
3. Número já ligado a outro setor é recusado: o aparelho é desvinculado e a tela de conexão mostra o motivo.
4. O telefone é apagado quando o número é desvinculado e continua na tela durante quedas temporárias da conexão.
5. Os supervisores do setor e os administradores desvinculam o número pela tela de conexão, com confirmação, além de poder desvincular pelo celular.
6. Com o número desvinculado, os chamados abertos continuam no sistema, e as respostas falham até um número ser conectado de novo.
7. Quando o número de um setor desconecta, o sistema avisa os supervisores e administradores no sino de notificações, sem enviar e-mail, e oferece a tela para reconectar por QR code (ver [notifications.md](notifications.md)).

## Fora do escopo / limites conhecidos

- A conexão pelo Whatsmeow é não oficial: o celular principal precisa se conectar periodicamente (cerca de 14 dias) para manter os dispositivos vinculados, e iniciar muitas conversas com números novos aumenta o risco de banimento.

## Relacionado

- Dados: `sectors` (colunas da conexão), tabelas `whatsmeow_*`. ADRs: 0001.

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Estrutura e implantação; Usuários e acesso › Administração).
