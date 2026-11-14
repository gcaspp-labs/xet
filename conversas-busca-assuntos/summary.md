# Jornada conversas-busca-assuntos: PASSOU

Commit `b37defb1c2c0007f30b1221fb07d19a1b4b690ac`, início 2026-11-13T23:38:04.539Z, duração 5 s.

### Passos

1. ok: Preparar setor, assuntos e dois chamados (590 ms)
2. ok: Assumir A e buscar "ferias" em Assuntos (492 ms): `01-a-busca-ferias.png`
3. ok: Assumir B: Fila abre e a busca de B começa vazia (454 ms): `02-b-fila-ao-trocar.png`, `03-b-busca-ponto.png`
4. ok: Voltar a A: Fila, depois Assuntos restaura "ferias" (362 ms): `04-a-volta-fila.png`, `05-a-busca-restaurada.png`
5. ok: Voltar a B: mantém "ponto" (296 ms): `06-b-busca-restaurada.png`
6. ok: Recarregar apaga as buscas (543 ms): `07-apos-recarregar.png`
7. ok: Sair e entrar apaga as buscas (880 ms): `08-apos-sair.png`
8. ok: Estado final no banco: nada de busca guardada, dois chamados em atendimento (118 ms)

### Estado final observado

Chamados do setor:

```json
[
  {
    "status": "in_progress"
  },
  {
    "status": "in_progress"
  }
]
```
