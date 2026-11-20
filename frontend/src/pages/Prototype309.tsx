// PROTÓTIPO #309 — descartável, não vai para a main.
// Plano: uma proposta (versão A) do botão "ir para a última mensagem" com contador,
// na tela Chamados. Parâmetros de URL para as capturas:
//   ?prototype=309&estado=fim|rolado|contador&tema=claro|escuro|contraste&captura=1
// Dados fictícios. A barra inferior simula mensagens novas, envio e tema.
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Bell, Paperclip, SendHorizontal } from 'lucide-react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Entry =
  | { kind: 'message'; at: string; direction: 'inbound' | 'outbound'; body: string; status?: string }
  | { kind: 'log'; at: string; text: string }

const baseEntries: Entry[] = [
  { kind: 'log', at: '09:38', text: 'Ana Prado assumiu o chamado' },
  {
    kind: 'message',
    at: '09:39',
    direction: 'inbound',
    body: 'Bom dia! Preciso de ajuda com a certidão negativa do município.',
  },
  {
    kind: 'message',
    at: '09:40',
    direction: 'outbound',
    body: 'Bom dia, Maria! Já estou verificando o seu cadastro. Um instante, por favor.',
    status: 'Lida',
  },
  {
    kind: 'message',
    at: '09:41',
    direction: 'inbound',
    body: 'A certidão aparece como indisponível no portal desde ontem.',
  },
  {
    kind: 'message',
    at: '09:44',
    direction: 'outbound',
    body: 'Encontrei o convênio do órgão ativo aqui. Pode tentar gerar novamente e me dizer o que aparece?',
    status: 'Lida',
  },
  { kind: 'message', at: '09:47', direction: 'inbound', body: 'Tentei agora, continua igual.' },
  {
    kind: 'message',
    at: '09:48',
    direction: 'inbound',
    body: 'A tela mostra apenas "serviço temporariamente indisponível".',
  },
  {
    kind: 'message',
    at: '09:52',
    direction: 'outbound',
    body: 'Obrigada pelo retorno. Vou pedir a conferência do serviço ao setor de tributos.',
    status: 'Entregue',
  },
  { kind: 'log', at: '09:53', text: 'Ana Prado transferiu o chamado para Tributos Municipais' },
  { kind: 'log', at: '09:53', text: 'Ana Prado assumiu o chamado' },
  {
    kind: 'message',
    at: '09:56',
    direction: 'inbound',
    body: 'Certo. Enquanto isso, consigo usar o número do protocolo antigo?',
  },
  {
    kind: 'message',
    at: '09:58',
    direction: 'outbound',
    body: 'Sim. O protocolo 2026-000098 continua valendo até a nova via ser emitida.',
    status: 'Lida',
  },
  { kind: 'message', at: '10:01', direction: 'inbound', body: 'Perfeito, obrigada.' },
  {
    kind: 'message',
    at: '10:04',
    direction: 'outbound',
    body: 'O setor confirmou o ajuste no serviço. Pode gerar a certidão novamente?',
    status: 'Entregue',
  },
  { kind: 'message', at: '10:07', direction: 'inbound', body: 'Gerou! Apareceu a certidão.' },
  {
    kind: 'message',
    at: '10:08',
    direction: 'inbound',
    body: 'Mas o PDF está vindo sem o brasão do município.',
  },
  {
    kind: 'message',
    at: '10:11',
    direction: 'outbound',
    body: 'Vou registrar essa diferença do brasão e retorno com a resposta do setor.',
    status: 'Lida',
  },
  { kind: 'message', at: '10:12', direction: 'inbound', body: 'Combinado, fico no aguardo.' },
]

const incoming: string[] = [
  'Boa tarde! Alguma novidade sobre o brasão?',
  'Conseguiu falar com o setor?',
  'Preciso da certidão hoje para enviar ao pregão.',
  'Só confirmando se o chamado continua com você.',
  'Ainda estou aguardando o retorno.',
]

type Estado = 'fim' | 'rolado' | 'contador'
type Tema = 'claro' | 'escuro' | 'contraste'

const params = new URLSearchParams(window.location.search)
const estadoParam = (params.get('estado') ?? 'fim') as Estado
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

const entriesIniciais = (estado: Estado) => {
  if (estado === 'contador') {
    return [
      ...baseEntries,
      { kind: 'message' as const, at: '10:15', direction: 'inbound' as const, body: incoming[0] },
      { kind: 'message' as const, at: '10:16', direction: 'inbound' as const, body: incoming[1] },
      { kind: 'message' as const, at: '10:17', direction: 'inbound' as const, body: incoming[2] },
    ]
  }
  return baseEntries
}

function EntryLine({ entry }: { entry: Entry }) {
  if (entry.kind === 'log') {
    return (
      <li
        aria-label="Registro do chamado"
        className="caption flex items-start gap-1.5 self-center rounded-(--radius-7) border border-dashed border-line px-2.5 py-1 text-ink-soft"
      >
        <span className="min-w-0">
          {entry.text} · <span className="mono-num">{entry.at}</span>
        </span>
      </li>
    )
  }
  const outbound = entry.direction === 'outbound'
  return (
    <li
      aria-label={outbound ? 'Mensagem enviada' : 'Mensagem recebida'}
      className={cn(
        'flex max-w-[78%] flex-col gap-1',
        outbound ? 'items-end self-end' : 'items-start self-start',
      )}
    >
      <div
        className={cn(
          'flex min-w-0 flex-col gap-1 rounded-(--radius-12) border px-3 py-2',
          outbound
            ? 'rounded-br-(--radius-6) border-primary bg-primary text-primary-foreground'
            : 'rounded-bl-(--radius-6) border-line bg-card',
        )}
      >
        <p className="whitespace-pre-wrap break-words text-[calc(14px*var(--text-scale))]">
          {entry.body}
        </p>
        <p
          className={cn(
            'caption text-right',
            outbound ? 'text-primary-foreground' : 'text-ink-soft',
          )}
        >
          {entry.at}
          {entry.status && ` · ${entry.status}`}
        </p>
      </div>
    </li>
  )
}

export default function Prototype309() {
  const [entries, setEntries] = useState<Entry[]>(() => entriesIniciais(estadoParam))
  const [novas, setNovas] = useState(estadoParam === 'contador' ? 3 : 0)
  const [noFim, setNoFim] = useState(estadoParam === 'fim')
  const [tema, setTema] = useState<Tema>(temaParam)
  const [draft, setDraft] = useState('')
  const lista = useRef<HTMLDivElement>(null)
  const prox = useRef(estadoParam === 'contador' ? 3 : 0)
  const reduzir = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  ).current

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  // Abre no fim; nas capturas, a distância da rolagem para cima é fixa.
  useEffect(() => {
    const el = lista.current
    if (!el) return
    const subir = estadoParam === 'fim' ? 0 : 760
    el.scrollTop = el.scrollHeight - el.clientHeight - subir
    // Encosta a rolagem no começo de uma mensagem, para a captura não cortar o topo de um balão.
    if (subir > 0) {
      const itens = [...el.querySelectorAll('li')]
      let alvo = 0
      for (const item of itens) {
        if (item.offsetTop - 8 <= el.scrollTop) alvo = item.offsetTop - 8
      }
      el.scrollTop = alvo
    }
    setNoFim(el.scrollHeight - el.scrollTop - el.clientHeight <= 48)
  }, [])

  function irAoFim() {
    const el = lista.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: reduzir ? 'auto' : 'smooth' })
    setNovas(0)
  }

  // "No fim" com tolerância de 48 px, para o botão não piscar.
  function aoRolar() {
    const el = lista.current
    if (!el) return
    const fim = el.scrollHeight - el.scrollTop - el.clientHeight <= 48
    setNoFim(fim)
    if (fim) setNovas(0)
  }

  function receber() {
    const texto = incoming[prox.current % incoming.length]
    prox.current += 1
    const el = lista.current
    const estavaNoFim = el ? el.scrollHeight - el.scrollTop - el.clientHeight <= 48 : true
    setEntries((atual) => [
      ...atual,
      { kind: 'message', at: '10:20', direction: 'inbound', body: texto },
    ])
    if (estavaNoFim) {
      setNoFim(true)
      setTimeout(() => el?.scrollTo({ top: el.scrollHeight }), 0)
    } else {
      setNovas((n) => n + 1)
    }
  }

  function enviar() {
    const texto = draft.trim() || 'Certo, já encaminhei ao setor.'
    setDraft('')
    setEntries((atual) => [
      ...atual,
      { kind: 'message', at: '10:21', direction: 'outbound', body: texto, status: 'Enviando' },
    ])
    setNovas(0)
    setTimeout(() => {
      const el = lista.current
      el?.scrollTo({ top: el.scrollHeight, behavior: reduzir ? 'auto' : 'smooth' })
    }, 0)
  }

  const rotulo = useMemo(
    () =>
      novas === 0
        ? 'Ir para a última mensagem'
        : `Ir para a última mensagem, ${novas} ${novas === 1 ? 'nova' : 'novas'}`,
    [novas],
  )

  return (
    <div
      className="flex h-dvh flex-col bg-background text-foreground"
      style={{ '--header-height': '3.5rem' } as CSSProperties}
    >
      <header className="flex h-(--header-height) shrink-0 items-center justify-between border-b border-line bg-card px-6">
        <div className="flex items-center gap-2.5">
          <img src={tema === 'escuro' ? symbolDark : symbol} alt="" className="h-8 w-8" />
          <div>
            <p className="body-strong leading-tight">GCASPP LAB</p>
            <p className="caption text-ink-soft">Central de Atendimento</p>
          </div>
        </div>
        <Button variant="outline" size="icon" aria-label="Notificações">
          <Bell strokeWidth={1.7} aria-hidden />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-(--sidebar-width) shrink-0 flex-col gap-1 border-r border-line bg-card px-3 py-4 text-sm">
          <p className="overline px-2 pb-1 text-ink-faint">Helpdesk</p>
          <p className="rounded-(--radius-7) bg-accent-soft px-2 py-2 font-medium text-accent-strong">
            Chamados
          </p>
          <p className="px-2 py-2">Atendimentos</p>
          <p className="px-2 py-2">Dashboard</p>
          <p className="px-2 py-2">Contatos</p>
          <p className="px-2 py-2">Conexão</p>
          <p className="overline px-2 pt-6 pb-1 text-ink-faint">Cadastro</p>
          <p className="px-2 py-2">Órgãos</p>
          <p className="px-2 py-2">Módulos</p>
          <p className="px-2 py-2">Assuntos</p>
          <p className="px-2 py-2">Setores</p>
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-line-soft bg-background">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
              <div className="min-w-0 flex-1">
                <p className="caption text-ink-faint">Chamados · Suporte Sistemas · 2026-000123</p>
                <h1 className="title-page truncate">Maria Oliveira</h1>
                <p className="caption text-ink-soft">(11) 98888-1234</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost">Transferir</Button>
                <Button variant="outline">Encerrar</Button>
              </div>
            </div>
          </header>
          <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 py-3 md:px-[30px] md:py-[30px]">
            <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_320px] gap-4">
              <Card role="region" aria-labelledby="meus" className="min-h-0">
                <div className="border-b border-line-soft px-[15px] py-[15px]">
                  <p className="title-panel" id="meus">
                    Meus chamados (2)
                  </p>
                </div>
                <div className="border-t border-line-soft">
                  <div className="flex flex-col gap-1 border-l-3 border-primary bg-accent-soft px-4 py-2.5">
                    <p className="body-strong">Maria Oliveira</p>
                    <p className="caption truncate text-ink-soft">Combinado, fico no aguardo.</p>
                    <p className="caption text-ink-faint">
                      <span className="mono-num">2026-000123</span> · 10:12
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 border-l-3 border-transparent px-4 py-2.5">
                    <p className="body-strong">João da Silva Exemplo</p>
                    <p className="caption truncate text-ink-soft">Enviei os documentos ontem.</p>
                    <p className="caption text-ink-faint">
                      <span className="mono-num">2026-000124</span> · 09:58
                    </p>
                  </div>
                </div>
              </Card>

              <Card role="region" aria-label="Conversa" className="relative min-h-0">
                <div className="relative flex min-h-0 flex-1 flex-col">
                  <div
                    ref={lista}
                    onScroll={aoRolar}
                    className="flex-1 overflow-y-auto border-y border-line-soft bg-background px-4 py-4"
                  >
                    <ol className="flex flex-col gap-2">
                      {entries.map((entry, i) => (
                        <EntryLine key={`${entry.kind}-${i}`} entry={entry} />
                      ))}
                    </ol>
                  </div>
                  {!noFim && (
                    <div className="pointer-events-none absolute right-4 bottom-4 z-10">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={rotulo}
                        title={rotulo}
                        onClick={irAoFim}
                        className="pointer-events-auto size-9 rounded-full border-line bg-card shadow-[var(--shadow)] hover:border-ink-faint"
                      >
                        <ArrowDown strokeWidth={1.7} className="size-[17px]" aria-hidden />
                        {novas > 0 && (
                          <span
                            aria-hidden
                            className="mono-num absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-card bg-primary px-1 text-[calc(10px*var(--text-scale))] leading-none font-medium text-primary-foreground"
                          >
                            {novas > 99 ? '99+' : novas}
                          </span>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="shrink-0 border-t border-line-soft p-4">
                  <div className="flex items-end gap-2">
                    <Button variant="ghost" size="icon" aria-label="Anexar arquivo">
                      <Paperclip strokeWidth={1.7} aria-hidden />
                    </Button>
                    <textarea
                      aria-label="Mensagem"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Mensagem"
                      className="min-h-11 flex-1 resize-none rounded-(--radius-7) border border-input bg-card px-3 py-2.5 text-[calc(14px*var(--text-scale))] outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
                    />
                    <Button aria-label="Enviar mensagem" onClick={enviar}>
                      <SendHorizontal strokeWidth={1.7} aria-hidden />
                      Enviar
                    </Button>
                  </div>
                </div>
              </Card>

              <Card role="region" aria-label="Fila e assuntos" className="min-h-0">
                <div className="border-b border-line-soft px-[15px] py-[15px]">
                  <p className="title-panel">Fila</p>
                </div>
                <div className="flex flex-col gap-2 border-t border-line-soft px-4 py-3">
                  <div>
                    <p className="body-strong">Fernanda Lima Demo</p>
                    <p className="caption truncate text-ink-soft">
                      Olá, o contracheque de outubro não aparece.
                    </p>
                    <p className="caption text-ink-faint">Aguardando há 12 min</p>
                  </div>
                  <Button variant="outline" size="sm" className="self-start">
                    Assumir
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #309</strong>
          <span className="text-ink-soft">
            {noFim ? 'Conversa no fim' : `Rolado para cima${novas ? ` · ${novas} novas` : ''}`}
          </span>
          <Button variant="outline" size="sm" onClick={receber}>
            Receber mensagem
          </Button>
          <Button variant="outline" size="sm" onClick={() => lista.current?.scrollTo({ top: 0 })}>
            Rolar para cima
          </Button>
          <label className="flex items-center gap-1">
            Tema
            <select
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tema}
              onChange={(e) => setTema(e.target.value as Tema)}
            >
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
              <option value="contraste">Alto contraste</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
