# Jornada pr71-link-and-keyboard: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:52:55.879Z, duração 9 s.

### Passos

1. ok: Preparar três chamados fictícios (335 ms)
2. ok: Assumir o chamado atual e aguardar o aviso anterior terminar (3028 ms)
3. ok: Link oculto sobre Encerrar deixa o clique passar e preserva o chamado e o rascunho (712 ms): `01-link-oculto-aviso-sobre-encerrar.png`
4. ok: Aviso termina mesmo com o cursor parado sobre o botão (2641 ms): `02-mesmo-chamado-mesmo-assunto.png`
5. ok: Com outro aviso ativo, Tab e Shift+Tab ficam na janela e nunca no link oculto (663 ms)
6. ok: Cancelar restaura o link ainda ativo, que abre o destino correto (449 ms): `03-link-restaurado-destino-correto.png`
7. ok: Estado final no banco: três em atendimento, sem encerramento ou troca de responsável (65 ms)

### Estado final observado

Clique sob o local do link:

```json
{
  "position": {
    "x": 17,
    "y": 22.781631469726562
  },
  "forcado": false,
  "esperaParaSumir": false
}
```

16 movimentos de teclado:

```json
[
  {
    "inDialog": true,
    "toast": false,
    "tag": "TEXTAREA"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "SPAN"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  },
  {
    "inDialog": true,
    "toast": false,
    "tag": "INPUT"
  }
]
```

Chamados fictícios:

```json
[
  {
    "id": 1,
    "status": "in_progress",
    "assignee_id": 3,
    "subject": null,
    "name": "Atual T49"
  },
  {
    "id": 2,
    "status": "in_progress",
    "assignee_id": 3,
    "subject": null,
    "name": "Destino Mouse T49"
  },
  {
    "id": 3,
    "status": "in_progress",
    "assignee_id": 3,
    "subject": null,
    "name": "Destino Teclado T49"
  }
]
```
