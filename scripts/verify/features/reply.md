# Responder

O responsável pelo chamado conversa com o contato pela tela da conversa, e ninguém mais responde.

## Sub-features

- [jornada] Sem assumir, a caixa de resposta não aparece, e a tela diz para assumir.
- [jornada] Quem não é o responsável acompanha, sem caixa de resposta.
- [jornada] A resposta sai com Enter e fica "Enviada"; a caixa é limpa.
- [jornada] Quem acompanha em outra janela vê a resposta sem recarregar.
- [jornada] Confirmações do celular do contato levam a "Entregue" e "Lida".
- [jornada] Repetir o envio com o mesmo `clientRequestId` devolve a mesma mensagem, sem duplicar.
- [jornada] Pela API, quem não é o responsável recebe 403, e nada muda.
- [jornada] Arquivo com legenda é enviado e pode ser baixado pela conversa.
- [jornada] Com o número caído, a mensagem fica "Falhou", com o motivo e sem reenvio automático.
- [jornada] O responsável reenvia depois de reconectar, sem duplicar.
- [não coberto] Notas internas, "Falou com" e histórico do contato (`conversation.spec.ts`).
- [não coberto] Áudio gravado, imagens, vídeos e mídias recebidas (`media.spec.ts`).
- [não coberto] Mensagens `pending` marcadas como `failed` ao reiniciar o serviço (só testes de integração).
- [manual] Texto, imagem e PDF chegando ao celular do contato.
- [manual] "Entregue" e "Lida" pelos recibos reais do WhatsApp.
- [manual] Reenvio depois de falha sem duplicar no celular.
- [manual] Áudio gravado chegando como mensagem de voz, com a duração certa.

## How to get to it

1. O atendente abre o chamado pela fila e clica em "Assumir".
2. Em `/chamados/<id>`, escreve em "Escreva a mensagem" e aperta Enter. A mensagem aparece à direita, primeiro como "Enviando" e depois como "Enviada".
3. Para mandar um arquivo, clica no clipe, escolhe o arquivo, escreve a legenda e clica em enviar.
4. Se a mensagem falhar, aparece "Falhou" com o motivo e o botão "Reenviar".

## Driving it

```bash
scripts/verify/scripts/drive.sh reply
```

- Área da conversa: `getByRole('region', { name: 'Conversa', exact: true })`.
- Caixa de resposta: `getByRole('textbox', { name: 'Mensagem' })`.
- Mensagem enviada: `getByRole('listitem', { name: 'Mensagem enviada' }).filter({ hasText: '...' })`.
- Arquivo: `getByLabel('Arquivo para enviar')` com `setInputFiles`, e `getByRole('textbox', { name: 'Legenda do arquivo' })`.
- Recibos: `t.phone(setor).status('delivered' | 'read', ['fake-msg-<clientRequestId>'])`. O `clientRequestId` vem da requisição capturada com `page.waitForRequest`.
- Queda e volta do número: `t.phone(setor).drop()` e `POST /api/sectors/{id}/connection` como administrador.

## Gotchas

- "Enviada" aqui quer dizer que o adaptador falso aceitou a mensagem. Não prova que ela chegou a um celular, e por isso a entrega real é `[manual]`.
- O adaptador falso reconecta na hora, sem QR code, quando já conhece a conta. O WhatsApp real pode demorar ou pedir o QR de novo.
- O identificador externo do adaptador falso é sempre `fake-msg-<clientRequestId>`. Sem `clientRequestId` na requisição, o recibo não acha a mensagem.
- A situação "Enviando" passa rápido demais para uma captura confiável; a jornada não a confere.
- Pelo adaptador, a falha só acontece com o número caído. Outros erros do provedor não têm rota de simulação.
- Pré-condição: número conectado. Com `seedSector({ connected: false })`, a primeira resposta falha, e a jornada precisa falhar junto.

## Estado final observável

- **Tela:** as mensagens com "Lida" e "Enviada"; o arquivo com link para `/api/media/<id>`; a mensagem reenviada sem "Falhou"; o supervisor sem caixa de resposta.
- **`messages`:** uma `inbound` e três `outbound`, com situações `read`, `sent` e `sent` e `external_message_id` preenchido, ou seja, aceitas pelo provedor. Uma só linha para cada `client_request_id`.
- **API:** o envio repetido devolve o mesmo `id`, e a resposta indevida recebe 403.
