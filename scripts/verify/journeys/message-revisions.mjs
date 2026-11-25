// Edições e exclusões feitas fora do XET: ver features/message-revisions.md.
import { conversationOf, expect, journey, panelOf } from "../scripts/journey-lib.mjs";

await journey("message-revisions", async (t) => {
  const sector = await t.step("Preparar setor conectado com um atendente", () =>
    t.seedSector({ agents: 1 }),
  );
  const [agent] = sector.agents;
  const phone = t.phone(sector.id);
  const maria = t.customer("Maria Cliente");

  const original = await t.step("Mensagem do cliente chega à fila", () =>
    phone.receive(maria, "Preciso do balancete de setembro"),
  );
  const page = await t.signIn(agent);
  const queue = panelOf(page);
  const conversation = conversationOf(page);
  const received = conversation.getByRole("listitem", {
    name: "Mensagem recebida",
  });

  await t.step("Atendente assume e vê a mensagem original", async () => {
    await queue
      .getByRole("button", { name: "Assumir chamado de Maria Cliente" })
      .click();
    await expect(page).toHaveURL(/\/chamados\/\d+$/);
    await expect(received).toHaveCount(1);
    await expect(received).toContainText("Preciso do balancete de setembro");
    await t.shot(page, "mensagem-original");
  });

  await t.step(
    "Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar",
    async () => {
      await phone.edit(maria, original, "Preciso do balancete de outubro", {
        externalEventId: `EDIT-${original}`,
      });
      await expect(received).toContainText("Preciso do balancete de outubro");
      await expect(received).toHaveCount(1);
      await t.shot(page, "mensagem-editada");
    },
  );

  await t.step(
    "Reentrega e edição atrasada não mudam a versão atual",
    async () => {
      await phone.edit(maria, original, "Preciso do balancete de outubro", {
        externalEventId: `EDIT-${original}`,
      });
      await phone.edit(maria, original, "versão antiga atrasada", {
        externalEventId: `LATE-${original}`,
        at: "2000-01-01T00:00:00Z",
      });
      await page.reload();
      await expect(received).toContainText("Preciso do balancete de outubro");
      await expect(received).not.toContainText("versão antiga atrasada");
      await expect(received).toHaveCount(1);
    },
  );

  await t.step(
    "Cliente apaga para todos: o conteúdo conhecido continua na conversa",
    async () => {
      await phone.revoke(maria, original, {
        externalEventId: `REVOKE-${original}`,
      });
      await page.reload();
      await expect(received).toContainText("Preciso do balancete de outubro");
      await expect(received).toHaveCount(1);
      await t.shot(page, "mensagem-apagada-pelo-cliente");
    },
  );

  await t.step("Estado final no banco", async () => {
    const message = t.sql(
      `select id, body, edited_at is not null as edited, deletion_scope, deletion_origin
       from messages where external_message_id = '${original}' and sector_id = ${sector.id}`,
    );
    expect(message).toHaveLength(1);
    expect(message[0]).toMatchObject({
      body: "Preciso do balancete de outubro",
      edited: true,
      deletion_scope: "everyone",
      deletion_origin: "customer",
    });
    const changes = t.sql(
      `select kind, origin, body from message_changes where message_id = ${message[0].id} order by occurred_at, id`,
    );
    expect(changes.map((c) => `${c.kind}:${c.body ?? ""}`)).toEqual([
      "edit:versão antiga atrasada",
      "original:Preciso do balancete de setembro",
      "edit:Preciso do balancete de outubro",
      "deletion:",
    ]);
    t.observe("Mensagem", message[0]);
    t.observe("Versões e exclusão (message_changes)", changes);
    t.observe(
      "Chamados do setor",
      t.sql(`select status from tickets where sector_id = ${sector.id}`),
    );
  });
});
