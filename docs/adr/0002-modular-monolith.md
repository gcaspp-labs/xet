# Um binário com módulos separados por pasta, garantidos pelo lint

O backend é um serviço Go só, com um banco só, organizado por funcionalidade: `internal/core` (o que serve a todos) e um pacote por módulo (hoje, `internal/helpdesk`). O `core` não importa módulos, e um módulo não importa outro; as duas regras são do `depguard` (`backend/.golangci.yml`), e o `make lint` falha se forem quebradas. A separação é só de organização, sem venda a terceiros nem isolamento físico, então microsserviços, banco por módulo, plugins e barramento de eventos ficaram de fora: os módulos conversam por chamada de função, na mesma transação, o que mantém as garantias ACID.

## Consequências

- Alguns acoplamentos ficaram, porque separá-los exigiria mudar o banco ou uma regra: `core/users` consulta os chamados em andamento, `sectors` guarda as colunas do WhatsApp e `audit_logs` tem chave para `tickets`. Estão listados em `docs/architecture.md`.
- Um deploy reinicia o processo inteiro, inclusive as conexões do WhatsApp.
