# Design

Como as skills tratam a interface do xet.

## Design system

- **Fonte:** `design.md` na raiz: o design system da GCASPP LAB aplicado com shadcn/ui (`frontend/components.json`), com tokens, tema claro e escuro, tipografia, componentes, ícones, marca e tom dos textos.
- As telas usam só os tokens e componentes do design system. Cor, espaçamento e tipografia vêm dos tokens, nunca de valores fixos nem da paleta padrão do Tailwind.
- Os componentes do shadcn são adaptados ao design system, não usados no visual padrão.
- Os textos de interface são em português e seguem o tom do brand book descrito em `design.md`.

## Protótipos

O Designer usa a branch de interface da `prototype` para entregar o **resultado esperado** de um ticket com tela nova ou mudança de layout.

- **Onde:** na branch `prototype/<número da issue>`, a partir da main. Ela guarda só a decisão validada.
- **Capturas:** salvas na própria branch, em `prototype-captures/`, e linkadas no ticket. Tamanho: **só desktop**.
- **Aprovação:** a pessoa aprova a tela antes de o ticket virar `ready-for-agent`.
- **Mudanças depois:** volte à mesma branch, edite e tire novas capturas.
- **Dados:** só dados fictícios. O repositório é público, e as capturas abrem para qualquer pessoa.

O comando que sobe o protótipo está em `commands.md`.
