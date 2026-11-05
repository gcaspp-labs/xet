# Jornada pr71-dialogs: PASSOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:17:09.146Z, duração 31 s.

### Passos

1. ok: Preparar setor, módulo, órgão e contato fictícios (700 ms)
2. ok: Assumir chamado pela tela (517 ms)
3. ok: Encerrar chamado: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (3171 ms): `01-encerrar-chamado.png`
4. ok: Transferir para outro setor: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (722 ms): `02-transferir-para-outro-setor.png`
5. ok: Cancelar chamado: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (585 ms): `03-cancelar-chamado.png`
6. ok: Devolver à fila: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (560 ms): `04-devolver-à-fila.png`
7. ok: Transferir preserva a escolha do seletor (817 ms): `05-transferir-chamado.png`
8. ok: Cadastro pelo atendimento tem bloqueio e preserva nome (410 ms): `06-cadastrar-contato.png`
9. ok: Cadastro aninhado: Cancelar devolve assunto e resolução; Esc não fecha a origem (835 ms): `07-cadastro-aninhado-bloqueado.png`
10. ok: Combobox seleciona órgão e Esc fecha só a lista (959 ms)
11. ok: Formulário longo em 480px: corpo rola; título e rodapé ficam (732 ms): `08-corpo-com-rolagem-rodape-fixo.png`
12. ok: Nova conversa e cadastro aninhado preservam a busca ao cancelar (1092 ms): `09-novo-contato.png`
13. ok: Contatos e importação fecham por X, Esc e clique fora (2295 ms)
14. ok: Módulos e desvincular número têm fechamento normal (2334 ms)
15. ok: Usuários, setores e órgãos têm fechamento normal (4100 ms)
16. ok: Curto, longo e aninhado; light; desktop; texto Maior sem rolagem horizontal (2013 ms): `10-curto-light-desktop-maior.png`, `11-longo-light-desktop-maior.png`, `12-aninhado-light-desktop-maior.png`
17. ok: Curto, longo e aninhado; light; celular; texto Maior sem rolagem horizontal (1765 ms): `13-curto-light-celular-maior.png`, `14-longo-light-celular-maior.png`, `15-aninhado-light-celular-maior.png`
18. ok: Curto, longo e aninhado; dark; desktop; texto Maior sem rolagem horizontal (1796 ms): `16-curto-dark-desktop-maior.png`, `17-longo-dark-desktop-maior.png`, `18-aninhado-dark-desktop-maior.png`
19. ok: Curto, longo e aninhado; dark; celular; texto Maior sem rolagem horizontal (1554 ms): `19-curto-dark-celular-maior.png`, `20-longo-dark-celular-maior.png`, `21-aninhado-dark-celular-maior.png`
20. ok: Menu móvel continua gaveta; Esc fecha (856 ms): `22-menu-gaveta-celular.png`
21. ok: Estado final no banco: formulários cancelados não alteraram chamado nem contato (162 ms)

### Estado final observado

Estado final:

```json
{
  "status": "in_progress",
  "registered": false,
  "subject": null,
  "resolution": null
}
```
