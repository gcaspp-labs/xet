# Conexão do número

O supervisor liga o número do setor por QR code e é avisado quando a ligação cai. O celular aqui é sempre simulado.

## Sub-features

- [jornada] Número nunca conectado: o painel avisa e leva à tela de conexão.
- [jornada] "Conectar" mostra o QR code, que troca sozinho quando o provedor manda outro.
- [jornada] Quando o celular lê o QR code, a tela mostra o número conectado sem recarregar.
- [jornada] Na queda da conexão, o aviso aparece no painel sem recarregar.
- [jornada] Desvinculado pelo celular, a tela pede um novo QR code.
- [jornada] Desvincular pela tela pede confirmação, e cancelar não muda nada.
- [jornada] Número já ligado a outro setor é recusado, com o motivo na tela.
- [jornada] O atendente não vê a tela nem o aviso, e recebe 403 pela API.
- [não coberto] Aparelho que não pôde ser avisado ao desvincular (`connection.spec.ts`).
- [não coberto] Volta da conexão ao reiniciar o serviço (`TestConnectionSurvivesRestart`, só integração).
- [manual] Ler o QR code real com o celular do setor.
- [manual] O QR code real trocando sozinho a cada 20 segundos.
- [manual] O celular mostrando "Central de Atendimento" em vez de "Outro dispositivo".
- [manual] Reiniciar o serviço e ver o número voltar sem novo QR code.
- [manual] Desvincular pelo celular e pela tela, com o aparelho sumindo do celular.

## How to get to it

1. O supervisor entra e, se o número estiver desconectado, vê o aviso no painel, com o link "Reconecte pelo QR code." O menu "Conexão" leva à mesma tela, `/conexao`.
2. Na tela "Conexão do WhatsApp", clica em "Conectar" ou "Reconectar". O QR code aparece, com a situação "Conectando".
3. No celular do setor, abre o WhatsApp, vai a "Dispositivos conectados" e lê o QR code. A tela passa a "Conectado", com o telefone e a última conexão.
4. Para desligar, clica em "Desvincular número" e confirma.

## Driving it

```bash
.claude/skills/verify-app/scripts/drive.sh connection
```

| Ação do celular | Chamada | Rota |
| --- | --- | --- |
| Ler o QR code | `t.phone(setor).pair(conta?)` | `POST .../pair` |
| Trocar o QR code | `t.phone(setor).nextQR()` | `POST .../qr` |
| Queda de conexão | `t.phone(setor).drop()` | `POST .../drop` |
| Desvincular pelo celular | `t.phone(setor).logOut()` | `POST .../logout` |
| Aparelho inalcançável | `t.phone(setor).unreachable()` | `POST .../unreachable` |

- QR code: `getByRole('img', { name: 'QR code para conectar o número' })`.
- Aviso do painel: `getByRole('alert').filter({ hasText: 'Número do setor Nome desconectado.' })`.
- Situação na tela: `getByText('Conectado', { exact: true })`, e o mesmo para "Conectando", "Desconectado" e "Requer QR code".

## Gotchas

- **Nunca aponte esta jornada para o WhatsApp real.** O Doctor confere `MESSAGING_PROVIDER=fake`. O QR code mostrado não vale para nenhum celular de verdade.
- `pair` só funciona com o pareamento em andamento; fora dele, responde 409. Espere o QR code aparecer na tela antes de chamar. Essa corrida já derrubou os testes ponta a ponta no PR 55.
- A conta padrão de `pair()` é `<5511900000000 + id do setor>@s.whatsapp.net`. Para simular o mesmo número em dois setores, passe a mesma conta nos dois, com o primeiro já conectado.
- O estado do adaptador falso fica na memória do backend. Reiniciar o backend no meio de uma jornada perde a sessão simulada; por isso, a volta ao reiniciar não é percorrida aqui.
- Depois de `logOut`, a conta fica marcada como desvinculada no adaptador falso. Reconectar exige um novo `pair`.
- "Conectado" está contido em "Desconectado" e "Não conectado": sem `exact: true`, o localizador acha os dois.

## Estado final observável

- **Tela:** "Requer QR code", com o motivo da recusa, depois da tentativa com o número de outro setor; o atendente de volta ao painel, sem o item "Conexão".
- **`sectors`:** `connection_status = 'logged_out'` e `external_account_id` vazio.
- **`audit_logs`:** `sector_connected` e `sector_disconnected` duas vezes cada, em ordem, com o supervisor como autor do último, porque desvinculou pela tela.
- **API:** o atendente recebe 403 ao tentar conectar.
