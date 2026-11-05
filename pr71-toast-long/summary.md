# Jornada pr71-toast-long: PASSOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:18:47.053Z, duração 9 s.

### Passos

1. ok: Preparar chamado fictício com módulo e órgão (721 ms)
2. ok: Assumir e preencher o encerramento pela tela (3197 ms)
3. ok: Cadastrar o contato dentro do encerramento e voltar ao formulário preenchido (708 ms)
4. ok: Estado no banco antes de encerrar: contato cadastrado e chamado em atendimento (152 ms)
5. ok: Botão Encerrar continua utilizável depois de salvar o contato (2961 ms): `01-antes-de-clicar-encerrar.png`

### Estado final observado

Estado antes da ação:

```json
{
  "status": "in_progress",
  "registered": true
}
```

Estado final:

```json
[
  {
    "status": "closed"
  }
]
```
