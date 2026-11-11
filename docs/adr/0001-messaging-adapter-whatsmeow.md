# Mensageria atrás de um adaptador, com Whatsmeow no piloto

O piloto conecta o WhatsApp pelo Whatsmeow, que usa o protocolo do WhatsApp Web, e não pela API oficial da Meta (Cloud API). A conexão é não oficial: a operação aceita o custo de manter a integração e as possíveis desconexões (`spec.md`, Estrutura e implantação). Como a troca pela API oficial é prevista, toda a mensageria passa por um contrato com tipos neutros (`internal/helpdesk/messaging`), e nada fora do subpacote do provedor importa o Whatsmeow. Os identificadores no banco são neutros (`external_*`), e cada setor registra o seu provedor, para migrar um setor por vez.

## Consequências

- O que é só do Whatsmeow (QR code, agenda do número) fica em interfaces opcionais (`QRPairing`, `ContactBook`), fora do contrato comum.
- A API oficial muda regras visíveis: fora da janela de 24 horas só é possível enviar modelos aprovados, o que afeta iniciar conversa e transferir entre setores. As diferenças estão em `docs/architecture.md`, "Diferenças da API oficial a considerar na migração".
- É a única interface do backend, junto com o armazenamento de arquivos, porque são os dois pontos com segunda implementação prevista.
