## prototype — Dashboard #223

Branch: `prototype/223`.

Proposta: tabelas recolhíveis, quantidades destacadas nos títulos, botão Assumir primário e cabeçalhos com mais contraste. Em “No período”, o TOTAL reúne as métricas por atendente; a linha “Do setor” reúne as duas métricas que não pertencem a uma pessoa. Os valores são fictícios.

Capturas: [claro](https://github.com/gcaspp-labs/xet/blob/prototype/223/frontend/src/prototype/prototype-captures/dashboard-light.png) · [escuro](https://github.com/gcaspp-labs/xet/blob/prototype/223/frontend/src/prototype/prototype-captures/dashboard-dark.png).

Mapa dos números atuais:
- Na fila → quantidade no título Fila.
- Em atendimento → quantidade no título Em atendimento e coluna correspondente da tabela, incluindo TOTAL.
- Recebidos → linha Do setor.
- Iniciados, Encerrados, Transferidos e Cancelados → respectivas colunas da tabela e linha TOTAL.
- Tempo médio de espera → linha Do setor.
- Tempo médio de atendimento → coluna da tabela e linha TOTAL (média geral, não soma de médias).

A linha TOTAL e a linha Do setor usam os números gerais já calculados conforme os filtros; números aos quais o filtro não se aplica aparecem como “—”, com indicação. A média geral não é a soma das médias individuais. Os dados demonstrativos não validam a contagem do backend.

Para abrir, a partir da branch, execute `cd frontend`, depois `BACKEND_URL=http://127.0.0.1:59999 npm run dev -- --host 127.0.0.1 --port 5223` e acesse `http://localhost:5223/dashboard`. API simulada, sem dados reais.

Aprova esta proposta ou quer alguma mudança?
