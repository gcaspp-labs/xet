# Importar contatos do WhatsApp

Traz para o cadastro os contatos salvos na agenda do número do setor. É sempre uma ação manual, feita por qualquer papel.

## Regras

1. Todos os papéis importam, pelo número conectado do próprio setor; o administrador escolhe o setor.
2. A importação é sempre uma ação manual, nunca automática ao conectar.
3. A lista mostra só quem tem nome salvo na agenda do número e telefone. A pessoa marca os contatos ou usa "selecionar todos".
4. A lista indica quem já existe no cadastro, com ou sem o nono dígito. Quem já existe pode ser marcado, para ganhar o vínculo com o setor.
5. A busca da lista filtra por nome ou telefone, sem diferenciar maiúsculas nem acentos. "Selecionar todos" vale para os contatos mostrados, e os já marcados continuam marcados ao mudar a busca.
6. O órgão é opcional e vale para o lote. Com órgão, o contato fica cadastrado; sem órgão, fica não cadastrado e é completado antes do encerramento.
7. Os contatos importados entram no setor do número.
8. Telefone que já existe, com ou sem o nono dígito, não é sobrescrito: só ganha o vínculo com o setor. Importar de novo não duplica.

## Fora do escopo / limites conhecidos

- Sem a agenda do número (por exemplo, com a API oficial), a importação fica indisponível para o setor.

## Relacionado

- Dados: `contacts`, `contact_sectors`, `audit_logs` (`contacts_imported`). ADRs: 0001.

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Órgãos e contatos › Importar contatos do WhatsApp).
