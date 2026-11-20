// PROTÓTIPO #129: descartável, não vai para a main.
// API falsa em memória, só em desenvolvimento: dados fictícios para as capturas
// (o repositório é público). Nada é gravado; recarregar a página zera tudo.
// O administrador é o usuário logado; os setores e os assuntos são inventados.
// A paginação e a ordenação acontecem aqui, no "servidor", para o protótipo mostrar
// o contrato real: só os itens da página, o total filtrado e a página devolvida.

const params = () => new URLSearchParams(window.location.search)

const admin = {
  id: 1,
  name: 'Paula Admin',
  email: 'paula@exemplo.test',
  role: 'admin',
  sectorId: null,
}

const sectors = [
  { id: 1, name: 'Tributos Municipais' },
  { id: 2, name: 'Suporte Sistemas' },
]

const modules: Record<number, { id: number; sectorId: number; name: string; active: boolean }[]> = {
  1: [
    { id: 11, sectorId: 1, name: 'IPTU', active: true },
    { id: 12, sectorId: 1, name: 'ISS', active: true },
    { id: 13, sectorId: 1, name: 'ITBI', active: true },
    { id: 14, sectorId: 1, name: 'Taxas', active: true },
    { id: 15, sectorId: 1, name: 'Dívida ativa', active: false },
  ],
  2: [
    { id: 21, sectorId: 2, name: 'Acesso', active: true },
    { id: 22, sectorId: 2, name: 'Relatórios', active: true },
    { id: 23, sectorId: 2, name: 'Cadastro', active: true },
  ],
}

type Row = [name: string, moduleId: number | null, solutions: string[]]

// Assunto pelo nome → todas as soluções; assunto achado só pela solução → só as que batem.
const rows: Record<number, Row[]> = {
  1: [
    [
      '2ª via de guia do IPTU',
      11,
      [
        'Acesse o portal do contribuinte, escolha IPTU, o ano e clique em Emitir 2ª via.',
        'Sem acesso ao portal, informe o número do imóvel e o CPF do titular ao atendente.',
        'A guia sai no nome do titular atual; titularidade antiga exige atualização antes.',
      ],
    ],
    [
      'Alteração de titularidade do IPTU',
      11,
      [
        'Envie a escritura, a matrícula atualizada e o documento do novo titular.',
        'A alteração entra no exercício seguinte ao lançamento do imposto.',
      ],
    ],
    [
      'Cadastro de imóvel novo',
      11,
      ['Informe a inscrição imobiliária; sem ela, o endereço completo do imóvel.'],
    ],
    [
      'Isenção de IPTU para aposentado',
      11,
      [
        'A isenção vale para imóvel único com renda de até três salários mínimos.',
        'O pedido é feito uma vez e vale até a renda mudar; traga o comprovante anual.',
      ],
    ],
    ['Revisão de valor venal', 11, ['Abra o pedido de revisão com a planta e o laudo do imóvel.']],
    [
      'Parcelamento do IPTU',
      11,
      [
        'Até 10 parcelas por exercício, sem juros e sem correção.',
        'Atraso de três parcelas cancela o parcelamento e volta a cobrança integral.',
      ],
    ],
    [
      'Guia de ISS para autônomo',
      12,
      [
        'Emita pelo portal, escolha ISS, o mês de competência e o código de serviço.',
        'O código errado deixa a guia sem validade para a prefeitura.',
      ],
    ],
    [
      'Retenção de ISS na nota',
      12,
      [
        'O tomador retém quando o serviço é prestado no município e o prestador não tem cadastro local.',
      ],
    ],
    [
      'Declaração mensal de ISS',
      12,
      [
        'Envie até o dia 10 do mês seguinte, mesmo sem movimento.',
        'Depois do prazo a declaração entra com multa de 2% sobre o imposto declarado.',
      ],
    ],
    [
      'Cadastro de prestador de serviço',
      12,
      ['Informe CNPJ, CNAE e a inscrição municipal; o cadastro sai na hora.'],
    ],
    [
      'Simples Nacional no município',
      12,
      ['O recolhimento é único; confira a nota de retenção antes de pagar.'],
    ],
    [
      'Nota fiscal de serviço',
      12,
      [
        'A nota é emitida pelo sistema municipal; sem internet, use o talão autorizado.',
        'Nota cancelada precisa do motivo e do aceite do tomador.',
      ],
    ],
    [
      'Certidão negativa de ISS',
      12,
      ['Emita pelo portal; com débito em aberto a certidão sai positiva com efeito de negativa.'],
    ],
    [
      'ITBI de compra e venda',
      13,
      [
        'O ITBI é recolhido antes do registro e calculado sobre o maior valor entre o da venda e o venal.',
        'Basta a primeira via autenticada do comprovante na escritura.',
      ],
    ],
    ['ITBI de doação', 13, ['A doação com usufruto exige o cálculo sobre o valor do usufruto.']],
    [
      'Avaliação de imóvel para ITBI',
      13,
      [
        'Abra o processo com a escritura e o laudo; a avaliação do município pode divergir do valor pago.',
      ],
    ],
    [
      'Segunda via de ITBI',
      13,
      ['Consultar pelo CPF do comprador; a guia vence em 90 dias corridos.'],
    ],
    [
      'Taxa de fiscalização de estabelecimento',
      14,
      ['A taxa vence com o licenciamento; a segunda via sai no portal de taxas.'],
    ],
    ['Taxa de coleta de lixo', 14, ['Cobrada na guia do IPTU, conforme a área construída.']],
    ['Taxa de alvará provisório', 14, ['Vale 90 dias; pode ser renovada uma vez, com vistoria.']],
    [
      'Emissão de alvará de funcionamento',
      14,
      ['Informe o CNPJ e o CNAE; atividade de risco alto pede vistoria do bombeiro.'],
    ],
    [
      'Cancelamento de taxa',
      14,
      ['A taxa é cancelada quando o serviço não pode ser prestado no endereço.'],
    ],
    [
      'Dívida ativa: certidão de débitos',
      15,
      ['A certidão sai com todos os exercícios em aberto, em uma única via.'],
    ],
    [
      'Dívida ativa: negociação',
      15,
      [
        'A dívida inscrita aceita acordo em até 60 meses, com até 60% de desconto em juros e multa.',
      ],
    ],
    [
      'Dívida ativa: impugnação',
      15,
      ['O prazo é de 30 dias do recebimento da notificação de lançamento.'],
    ],
    [
      'Dívida ativa: suspensão de cobrança',
      15,
      ['A cobrança é suspensa com o parcelamento em dia.'],
    ],
    [
      'Débito em aberto no nome do imóvel',
      11,
      [
        'O débito acompanha o imóvel; a matrícula nova já traz o valor devido.',
        'Pagando na escritura, a certidão sai na hora, na tela do atendente.',
      ],
    ],
    [
      'Mudança de endereço de cobrança',
      11,
      ['Atualize pelo portal; a guia do próximo exercício já vai no endereço novo.'],
    ],
    [
      'Reemissão de boleto vencido',
      11,
      ['Boleto vencido só reabre com atualização de juros e multa na tela de lançamentos.'],
    ],
    [
      'Certidão de pagamento de IPTU',
      11,
      ['Sai por exercício, com a data e o valor de cada pagamento.'],
    ],
    [
      'Desmembramento de imóvel',
      13,
      ['Informe a matrícula e a área de cada parte; o cadastro novo vem do georreferenciamento.'],
    ],
    [
      'Unificação de matrículas',
      13,
      ['A unificação exige as duas inscrições e a escritura atualizada.'],
    ],
    [
      'Área construída não averbada',
      13,
      ['Traga o projeto aprovado; a área averbada muda o cálculo do valor venal.'],
    ],
    [
      'Imunidade de templo',
      11,
      ['A imunidade vale só para a área de culto; o estacionamento paga IPTU.'],
    ],
    [
      'IPTU progressivo',
      11,
      ['O imóvel sem uso e sem conservação entra na alíquota progressiva depois de dois anos.'],
    ],
    [
      'Restituição de IPTU pago a mais',
      11,
      ['O pedido aceita só o comprovante do pagamento e o cálculo do valor correto.'],
    ],
    [
      'Compensação de crédito de ISS',
      12,
      ['Compensação só com processo aberto e o crédito confirmado na contabilidade.'],
    ],
    [
      'Cadastro de responsável técnico',
      14,
      ['Informe o CREA ou o CAU e o vínculo com o estabelecimento.'],
    ],
    ['Vistoria de estabelecimento', 14, ['A vistoria é agendada depois do pagamento da taxa.']],
    [
      'Nota fiscal avulsa',
      12,
      ['O talão autorizado vale por 12 meses; a nota precisa do CPF do tomador.'],
    ],
    [
      'Alvará de evento',
      14,
      ['O pedido precisa do local, da data e do horário, com até 15 dias de antecedência.'],
    ],
    [
      'Taxa de mudança de ponto',
      14,
      ['A mudança de ponto recolhe antes da vistoria do novo endereço.'],
    ],
    [
      'Certidão de quitação municipal',
      15,
      ['Sai com a ficha limpa de IPTU, ISS e taxas do mesmo CNPJ.'],
    ],
  ],
  2: [
    [
      'Acesso ao sistema fora do escritório',
      21,
      [
        'Fora do escritório o acesso passa pelo Cloudflare Access, com o e-mail corporativo.',
        'A sessão dura sete dias; depois disso o pedido de acesso se repete.',
      ],
    ],
    [
      'Bloqueio de usuário por tentativas erradas',
      21,
      ['Cinco tentativas erradas bloqueiam a conta por 15 minutos.'],
    ],
    ['Senha expirada', 21, ['A senha vale por 90 dias; a troca é feita no menu Configurações.']],
    [
      'Erro ao importar planilha de contatos',
      22,
      ['A planilha precisa das colunas nome, telefone e órgão, nesta ordem.'],
    ],
    [
      'Relatório de atendimentos não abre',
      22,
      ['O relatório depende do setor selecionado no topo da tela.'],
    ],
    [
      'Dashboard sem números',
      22,
      ['Os números do dashboard são do dia; setor sem chamado aparece zerado.'],
    ],
    [
      'Cadastro de órgão duplicado',
      23,
      ['Procure pelo CNPJ antes de cadastrar; o sistema bloqueia a duplicidade pelo número.'],
    ],
    [
      'Contato sem telefone válido',
      23,
      ['O telefone entra com DDD; número fixo não recebe mensagem.'],
    ],
    [
      'Usuário sem setor',
      23,
      ['Atendente e supervisor precisam de setor; sem ele a fila não abre.'],
    ],
    [
      'Módulos do setor desativados',
      23,
      ['Módulo desativado não aparece no formulário, mas os chamados antigos continuam.'],
    ],
  ],
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const allSubjects = Object.entries(rows).flatMap(([sectorId, list]) =>
  list.map(([name, moduleId, solutions], index) => ({
    id: Number(sectorId) * 1000 + index + 1,
    sectorId: Number(sectorId),
    name,
    moduleId,
    solutions: solutions.map((body, i) => ({
      id: Number(sectorId) * 10000 + index * 10 + i + 1,
      subjectId: Number(sectorId) * 1000 + index + 1,
      body,
    })),
  })),
)

// Paginação da lista: mesmo contrato dos Contatos — itens da página, total filtrado,
// página devolvida (a última, se a pedida passou dela) e 20 por página.
function subjectPage(sectorId: number, query: URLSearchParams) {
  const q = normalize(query.get('busca')?.trim() ?? '')
  const module = query.get('modulo') ?? 'all'
  // Nomes que a API recebe do frontend (pageParams): page, sort, direction.
  const sort = query.get('sort') ?? 'name'
  const direction = query.get('direction') === 'desc' ? 'desc' : 'asc'
  const pageSize = 20

  const filtered = allSubjects
    .filter((subject) => subject.sectorId === sectorId)
    .filter(
      (subject) =>
        module === 'all' ||
        (module === 'none' ? subject.moduleId === null : subject.moduleId === Number(module)),
    )
    .flatMap((subject) => {
      if (!q) return [subject]
      if (normalize(subject.name).includes(q)) return [subject]
      const solutions = subject.solutions.filter((solution) => normalize(solution.body).includes(q))
      return solutions.length > 0 ? [{ ...subject, solutions }] : []
    })

  const moduleName = (id: number | null) =>
    id === null ? '' : normalize(modules[sectorId]?.find((m) => m.id === id)?.name ?? '')
  const sign = direction === 'asc' ? 1 : -1
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'module') {
      // Sem módulo fica por último na ordem crescente.
      if (a.moduleId === null && b.moduleId !== null) return 1
      if (b.moduleId === null && a.moduleId !== null) return -1
      const byModule = moduleName(a.moduleId).localeCompare(moduleName(b.moduleId))
      if (byModule !== 0) return byModule * sign
    } else {
      const byName = normalize(a.name).localeCompare(normalize(b.name))
      if (byName !== 0) return byName * sign
    }
    return (a.id - b.id) * sign
  })

  const total = sorted.length
  const last = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, Number(query.get('page')) || 1), last)
  return {
    items: sorted.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize,
  }
}

export function fakeApi(
  path: string,
  init?: { method?: string; body?: unknown },
): { data: unknown } | null {
  const method = init?.method ?? 'GET'
  const [route, search] = path.split('?')
  let m: RegExpMatchArray | null
  if (route === '/auth/me') return { data: admin }
  if (route === '/sectors') return { data: sectors }
  if ((m = route.match(/^\/sectors\/(\d+)\/subjects$/)) && method === 'GET') {
    // PROTÓTIPO: ?vazio=1 zera a lista do setor, para a captura do estado vazio.
    if (params().get('vazio') === '1') {
      return { data: { items: [], total: 0, page: 1, pageSize: 20 } }
    }
    return { data: subjectPage(Number(m[1]), new URLSearchParams(search ?? '')) }
  }
  if ((m = route.match(/^\/sectors\/(\d+)\/modules$/))) {
    return { data: modules[Number(m[1])] ?? [] }
  }
  return { data: method === 'GET' ? [] : undefined }
}
