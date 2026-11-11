# Documentos de domínio

Como as skills usam a documentação de domínio do xet ao explorar o código. O xet é um **contexto só**.

## Antes de explorar, leia

- **`GLOSSARY.md`** na raiz: os termos do domínio (chamado, setor, atendente, supervisor, contato, órgão…).
- **`docs/adr/`**: as ADRs da área em que você vai mexer.
- **`docs/features/<funcionalidade>.md`**: as regras atuais de cada funcionalidade que a mudança toca. É a referência do que o sistema faz hoje. O índice está em `spec.md`, "Funcionalidades".
- **`spec.md`** na raiz: só o que é global (objetivo, estrutura e implantação, armazenamento, critérios de validação do piloto, antes da expansão). Uma regra global vale para todas as funcionalidades; em conflito, a regra da funcionalidade é a específica e prevalece só no que ela diz. Comentários no código citam seções antigas do `spec.md`; a tabela "Onde foram as seções antigas" diz em que arquivo cada uma está.
- **`docs/data-model.md`**, quando a mudança mexe em dados: domínios, entidades, ligações, restrições e permissões. Mudanças no modelo são registradas nele antes da migração do banco. As migrações antigas o citam como `modelo-dados.md`.
- **`docs/architecture.md`**: o estado técnico atual e as bibliotecas permitidas. Biblioteca nova exige justificativa registrada lá antes do uso.
- **`docs/pilot-validation.md`**, quando a mudança mexe na implantação ou em algo que só o WhatsApp real prova: critérios do piloto e roteiros manuais.

Se algum desses arquivos não existir, **siga em silêncio**. Não aponte a ausência nem sugira criá-los antes da hora: a `domain-modeling` cria o glossário e as ADRs quando um termo ou decisão é resolvido, e a `to-docs` cria as regras das funcionalidades.

O plano de evolução modular (Contratos, bot e novos módulos) fica só na issue #121, fora do repositório e parado até ordem da pessoa. Não o use como referência.

## Estrutura

```
/
├── GLOSSARY.md
├── spec.md                  ← regras globais e índice das funcionalidades
├── design.md
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── pilot-validation.md
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
