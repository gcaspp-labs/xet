# Documentos de domínio

Como as skills usam a documentação de domínio do xet ao explorar o código. O xet é um **contexto só**.

## Antes de explorar, leia

- **`GLOSSARY.md`** na raiz: os termos do domínio (chamado, setor, atendente, supervisor, contato, órgão…).
- **`docs/adr/`**: as ADRs da área em que você vai mexer.
- **Regras das funcionalidades: hoje, `spec.md` na raiz.** Ele ainda é a fonte atual das regras, por seções (Usuários e acesso, Órgãos e contatos, Recebimento e distribuição, Conversa, Transferências, Encerramento…). A migração para `docs/features/<funcionalidade>.md` está decidida e será feita pela `to-docs` no modo de migração. Depois dela:
  - **`docs/features/<funcionalidade>.md`** traz as regras atuais de cada funcionalidade que a mudança toca. É a referência do que o sistema faz hoje.
  - **`spec.md`** fica só com o que é global (objetivo, estrutura e implantação, arquitetura técnica, critérios de validação do piloto, referências) e aponta para os arquivos de `docs/features/`. Uma regra global vale para todas as funcionalidades; em conflito, a regra da funcionalidade é a específica e prevalece só no que ela diz.
- **`modelo-dados.md`** na raiz, quando a mudança mexe em dados: domínios, entidades, ligações, restrições e permissões. Ocupa o lugar de `docs/data-model.md`. Mudanças no modelo são registradas nele antes da migração do banco.
- **`arquitetura.md`** na raiz: decisões técnicas e as bibliotecas permitidas. Biblioteca nova exige justificativa registrada lá antes do uso.

Se algum desses arquivos não existir, **siga em silêncio**. Não aponte a ausência nem sugira criá-los antes da hora: a `domain-modeling` cria o glossário e as ADRs quando um termo ou decisão é resolvido, e a `to-docs` cria as regras das funcionalidades.

Não leia nem use `evolucao-modular.md`: é um plano em construção, parado até ordem da pessoa.

## Estrutura

```
/
├── GLOSSARY.md
├── spec.md              ← regras globais (e, até a migração, todas as regras)
├── modelo-dados.md
├── arquitetura.md
├── docs/
│   ├── adr/
│   ├── features/
│   └── research/
├── backend/
└── frontend/
```

## Use o vocabulário do glossário

Quando o que você escreve nomeia um conceito do domínio (título de issue, proposta de refatoração, hipótese, nome de teste), use o termo como definido em `GLOSSARY.md` e em `spec.md`. Textos de interface e documentação são em português; código, banco e rotas em inglês.

Se o conceito ainda não está no glossário, é um sinal: ou você está inventando uma linguagem que o projeto não usa (reconsidere), ou há uma lacuna de verdade (anote para a `domain-modeling`).

## Aponte conflitos

Se o que você produz contradiz uma ADR, uma regra de `docs/features/` ou de `spec.md`, diga isso abertamente, sem sobrescrever em silêncio:

> _Contradiz a ADR-0007, mas vale reabrir porque…_
>
> _Muda a regra 3 de `docs/features/encerramento.md`: a spec pede outra coisa._

Uma regra de funcionalidade que muda é uma decisão da spec: registre entre as decisões de implementação, para a `to-docs` atualizar o arquivo depois.

## Pesquisa

A `research` salva em `docs/research/<assunto>.md`. A spec cita a pesquisa pelo caminho.
