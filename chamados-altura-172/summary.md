# Jornada chamados-altura-172: PASSOU

Commit `fb5292b720f9c5f65613930404e19128f6cb4dd9`, início 2026-11-14T21:13:37.303Z, duração 6 s.

### Passos

1. ok: Preparar setor, atendente e chamados (382 ms)
2. ok: Desktop 1440×900: sem conversa, a página não rola e Meus chamados rola sozinha (425 ms): `01-desktop-sem-conversa.png`
3. ok: Desktop 1440×900: conversa aberta, cabeçalho em várias linhas, campo na tela (386 ms): `02-desktop-conversa-aberta.png`
4. ok: Desktop 1280×720 (xl): três colunas, página não rola (150 ms): `03-xl-1280x720.png`
5. ok: 1024×768: Conversa por padrão, campo na tela; Fila em seguida (344 ms): `04-1024-conversa.png`, `05-1024-fila.png`
6. ok: Celular: Conversa (campo na tela), Meus, Fila; página nunca rola (637 ms): `06-celular-conversa.png`, `07-celular-meus.png`, `08-celular-fila.png`
7. ok: Celular: assumir da Fila e abrir de Meus levam para Conversa (459 ms): `09-celular-apos-assumir.png`, `10-celular-apos-abrir.png`
8. ok: Celular: menu lateral aberto, página não rola e a conversa segue utilizável (230 ms): `11-celular-menu-aberto.png`
9. ok: Celular: sem chamado, Meus por padrão e estado vazio sem "esquerda/direita" (211 ms): `12-celular-vazio-conversa.png`
10. ok: Estado final: chamados em atendimento no banco (108 ms)

### Estado final observado

1440 sem conversa: página rola?:

```json
false
```

1440 altura do cabeçalho da página (px):

```json
188
```

chamados in_progress no setor:

```json
31
```
