// Consulta de assuntos durante o atendimento: ver features/consult-subjects.md.
import { expect, journey } from "../scripts/journey-lib.mjs";

await journey("consult-subjects", async (t) => {
  const sector = await t.step(
    "Preparar setor, assuntos e dois chamados",
    async () => {
      const seeded = await t.seedSector({ agents: 1 });
      const response = await t.apiOk(
        t.admin.post(`/api/sectors/${seeded.id}/subjects`, {
          data: { name: "Férias" },
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
  const card = page.getByRole("region", { name: "Chamado", exact: true });
  const conversation = page.getByRole("region", {
    name: "Conversa",
    exact: true,
  });
  const first = await t.step(
    "Assumir chamado e consultar soluções ao lado do chat",
    async () => {
      await page.getByRole("link", { name: "Cecília Consulta" }).click();
      await page.getByRole("button", { name: "Assumir", exact: true }).click();
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
    "Outro chamado começa em Detalhes e o anterior mantém a busca",
    async () => {
      await page.getByRole("link", { name: "Outro Cliente" }).click();
      await expect(card.getByRole("tab", { name: "Detalhes" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await page.getByRole("link", { name: "Cecília Consulta" }).click();
      await expect(card.getByRole("tab", { name: "Assuntos" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
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
