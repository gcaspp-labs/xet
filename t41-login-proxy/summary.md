# Jornada t41-login-proxy: PASSOU

Commit `fc61612a99a438ce614bf4d91145f3b98ff2a21e`, início 2026-11-04T16:00:30.362Z, duração 4 s.

### Passos

1. ok: Compose isolado: quatro serviços sem porta publicada e WhatsApp falso (7 ms)
2. ok: Login errado pela tela: 203.0.113.10 (tentativa 1) (584 ms): `01-login-1-recusado.png`
3. ok: Login errado pela tela: 203.0.113.10 (tentativa 2) (428 ms): `02-login-2-recusado.png`
4. ok: Login errado pela tela: 198.51.100.20 (tentativa 3) (472 ms): `03-login-3-recusado.png`
5. ok: Login errado pela tela: 192.0.2.30 (tentativa 4) (480 ms): `04-login-4-recusado.png`
6. ok: Login errado pela tela: 2001:db8::7 (tentativa 5) (478 ms): `05-login-5-recusado.png`
7. ok: Login errado pela tela: sem CF-Connecting-IP (tentativa 6) (464 ms): `06-login-6-recusado.png`
8. ok: Estado final no banco do Compose: IPs separados, IPv6, XFF ignorado e fallback do Caddy (415 ms)

### Estado final observado

Serviços e portas no host:

```json
[
  {
    "service": "cloudflared",
    "ports": {}
  },
  {
    "service": "web",
    "ports": {}
  },
  {
    "service": "backend",
    "ports": {}
  },
  {
    "service": "postgres",
    "ports": {}
  }
]
```

Token ausente e vazio:

```json
"Os dois comandos Compose equivalentes ao make up falharam antes de criar contêineres; logs compose-absent.log e compose-empty.log. Sem alteração de deploy/.env."
```

login_attempts (IPs):

```json
[
  {
    "scope": "ip",
    "subject": "172.20.0.4",
    "failures": 1
  },
  {
    "scope": "ip",
    "subject": "192.0.2.30",
    "failures": 1
  },
  {
    "scope": "ip",
    "subject": "198.51.100.20",
    "failures": 1
  },
  {
    "scope": "ip",
    "subject": "2001:db8::7",
    "failures": 1
  },
  {
    "scope": "ip",
    "subject": "203.0.113.10",
    "failures": 2
  }
]
```

Sessões criadas pelos logins inválidos:

```json
0
```

Limite desta prova:

```json
"Navegador chega ao Caddy pela rede Docker local; cabeçalhos simulam o cloudflared. Token falso. Túnel, HTTPS e Access reais dependem da T34. Sem CF-Connecting-IP, o contador usa o IP do Caddy."
```
