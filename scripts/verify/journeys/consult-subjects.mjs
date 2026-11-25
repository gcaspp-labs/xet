// Consulta de assuntos durante o atendimento: ver features/consult-subjects.md.
import { conversationOf, expect, journey, mineOf, panelOf } from "../scripts/journey-lib.mjs";

await journey("consult-subjects", async (t) => {
  const sector = await t.step(
    "Preparar setor, assuntos e dois chamados",
    async () => {
      const seeded = await t.seedSector({ agents: 1, modules: ["Folha"] });
      const modules = await t.admin.get(`/api/sectors/${seeded.id}/modules`);
      const [module] = await modules.json();
      const response = await t.apiOk(
        t.admin.post(`/api/sectors/${seeded.id}/subjects`, {
          data: { name: "Férias", moduleId: module.id },
        }),
        "criar assunto",
      );
      const subject = await response.json();
      for (const body of ["Agendadas pelo portal.", "Período confirmado."]) {
        await t.apiOk(
          t.admin.post(
            `/api/sectors/${seeded.id}/subjects/${subject.id}/solutions`,
            { data: { body } },
          ),
          "criar solução",
        );
      }
      await t
        .phone(seeded.id)
        .receive(t.customer("Cecília Consulta"), "Preciso de ajuda");
      await t
        .phone(seeded.id)
        .receive(t.customer("Outro Cliente"), "Outra dúvida");
      return seeded;
    },
  );
  const page = await t.signIn(sector.agents[0]);
  // Na tela Chamados, as abas Fila e Assuntos ficam no mesmo cartão, à direita da conversa.
  const card = panelOf(page);
  const mine = mineOf(page);
  const conversation = conversationOf(page);
  const first = await t.step(
    "Assumir chamado e consultar soluções ao lado do chat",
    async () => {
      await expect(page).toHaveURL(/\/chamados$/);
      await card
        .getByRole("button", { name: "Assumir chamado de Cecília Consulta" })
        .click();
      await expect(page).toHaveURL(/\/chamados\/\d+$/);
      await card.getByRole("tab", { name: "Assuntos" }).click();
      await expect(card).toContainText("Agendadas pelo portal.");
      await expect(card).toContainText("Período confirmado.");
      await expect(conversation).toBeVisible();
      await t.shot(page, "assuntos-e-chat");
      return Number(page.url().split("/").pop());
    },
  );
  await t.step(
    "Enviar mensagem e buscar sem acentos ou maiúsculas",
    async () => {
      const composer = page.getByRole("textbox", { name: "Mensagem" });
      await composer.fill("Vou conferir as orientações.");
      await composer.press("Enter");
      await expect(conversation).toContainText("Vou conferir as orientações.");
      const search = card.getByRole("searchbox", {
        name: "Buscar assuntos e soluções",
      });
      await search.fill("FERIAS");
      await expect(card).toContainText("Agendadas pelo portal.");
      await expect(card).toContainText("Período confirmado.");
      await search.fill("periodo");
      await expect(card).toContainText("Período confirmado.");
      await expect(card).not.toContainText("Agendadas pelo portal.");
      await t.shot(page, "busca-por-solucao");
    },
  );
  await t.step("Copiar a solução e manter o texto fora do chat", async () => {
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await card.getByRole("button", { name: "Copiar" }).click();
    await expect(page.getByText("Solução copiada")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Período confirmado.",
    );
    await expect(page.getByRole("textbox", { name: "Mensagem" })).toHaveValue(
      "",
    );
    await t.shot(page, "solucao-copiada");
  });
  await t.step(
    "Outro chamado volta à Fila e o anterior lembra a busca",
    async () => {
      // A aba volta à Fila a cada troca de chamado; só a busca de cada chamado é lembrada.
      await card.getByRole("tab", { name: "Fila" }).click();
      await card
        .getByRole("button", { name: "Assumir chamado de Outro Cliente" })
        .click();
      await expect(page).toHaveURL(/\/chamados\/\d+$/);
      await expect(page.getByRole("heading", { name: "Outro Cliente" })).toBeVisible();
      await expect(card.getByRole("tab", { name: "Fila" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await card.getByRole("tab", { name: "Assuntos" }).click();
      await expect(
        card.getByRole("searchbox", { name: "Buscar assuntos e soluções" }),
      ).toHaveValue("");
      await mine.getByRole("link", { name: /Cecília Consulta/ }).click();
      await expect(
        page.getByRole("heading", { name: "Cecília Consulta" }),
      ).toBeVisible();
      await expect(card.getByRole("tab", { name: "Fila" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await card.getByRole("tab", { name: "Assuntos" }).click();
      await expect(
        card.getByRole("searchbox", { name: "Buscar assuntos e soluções" }),
      ).toHaveValue("periodo");
      await t.shot(page, "busca-restaurada");
    },
  );
  await t.step("Estado final da conversa e da lista", async () => {
    const messages = t.sql(
      `select body from messages where ticket_id = ${first} and direction = 'outbound'`,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].body).toContain("Vou conferir as orientações.");
    const counts = t.sql(
      `select count(*) as n from subjects where sector_id = ${sector.id}`,
    );
    expect(Number(counts[0].n)).toBe(1);
    t.observe("Mensagem enviada e assunto preservado", {
      messages,
      assuntos: Number(counts[0].n),
    });
  });
});
