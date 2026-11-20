// PROTÓTIPO #314 — descartável, não vai para a main.
// Plano: uma proposta (versão A) do contador de mensagens não lidas nos itens de
// "Meus chamados", com contato e prévia em negrito. Parâmetros de URL para as capturas:
//   ?prototype=314&estado=nao-lidas|limpo|aberto&tema=claro|escuro|contraste&captura=1
// Dados fictícios. A barra inferior simula mensagem nova, leitura e tema.
import { type CSSProperties, useEffect, useState } from 'react'
import { Bell, MessagesSquare, Plus, UserCheck } from 'lucide-react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { cn } from '@/lib/utils'

type Chamado = {
  id: number
  nome: string
  hora: string
  previa: string
  protocolo: string
  naoLidas: number
}

const baseChamados: Chamado[] = [
  {
    id: 1,
    nome: 'Maria Oliveira',
    hora: '10:12',
    previa: 'Combinado, fico no aguardo.',
    protocolo: '2026-000123',
    naoLidas: 0,
  },
  {
    id: 2,
    nome: 'João da Silva',
    hora: '09:58',
    previa: 'Enviei os documentos ontem, chegaram?',
    protocolo: '2026-000124',
    naoLidas: 2,
  },
  {
    id: 3,
    nome: 'Fernanda Lima',
    hora: '09:41',
    previa: 'O contracheque de outubro não aparece.',
    protocolo: '2026-000119',
    naoLidas: 12,
  },
  {
    id: 4,
    nome: 'Carlos Pereira',
    hora: '09:20',
    previa: 'Bom dia, preciso do boleto atualizado.',
    protocolo: '2026-000117',
    naoLidas: 150,
  },
  {
    id: 5,
    nome: 'Ana Beatriz Souza',
    hora: '08:55',
    previa: 'Obrigada pelo retorno!',
    protocolo: '2026-000115',
    naoLidas: 1,
  },
  {
    id: 6,
    nome: 'Roberto Nunes',
    hora: '08:31',
    previa: 'Não consigo anexar a foto do documento.',
    protocolo: '2026-000111',
    naoLidas: 4,
  },
  {
    id: 7,
    nome: 'Patrícia Gomes',
    hora: '08:02',
    previa: 'Qual é o prazo para a vistoria?',
    protocolo: '2026-000108',
    naoLidas: 0,
  },
]

type Estado = 'nao-lidas' | 'limpo' | 'aberto'
type Tema = 'claro' | 'escuro' | 'contraste'

const params = new URLSearchParams(window.location.search)
const estadoParam = (params.get('estado') ?? 'nao-lidas') as Estado
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

function iniciais(): { chamados: Chamado[]; selecionado: number | null } {
  if (estadoParam === 'limpo') {
    return { chamados: baseChamados.map((c) => ({ ...c, naoLidas: 0 })), selecionado: null }
  }
  if (estadoParam === 'aberto') {
    return {
      chamados: baseChamados.map((c) => (c.id === 2 ? { ...c, naoLidas: 0 } : c)),
      selecionado: 2,
    }
  }
  return { chamados: baseChamados, selecionado: null }
}

// Contador junto do horário: pílula cheia em accent, número em mono, "99+" acima de 99.
// O nome acessível diz quantas mensagens não lidas são.
function Contador({ naoLidas }: { naoLidas: number }) {
  const visivel = naoLidas > 99 ? '99+' : String(naoLidas)
  return (
    <span
      className="mono-num flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[calc(10.5px*var(--text-scale))] leading-none font-medium text-primary-foreground"
      data-testid="nao-lidas"
    >
      <span aria-hidden>{visivel}</span>
      <span className="sr-only">
        {naoLidas} {naoLidas === 1 ? 'mensagem não lida' : 'mensagens não lidas'}
      </span>
    </span>
  )
}

function ChamadoLinha({
  chamado,
  selecionado,
  onAbrir,
}: {
  chamado: Chamado
  selecionado: boolean
  onAbrir: () => void
}) {
  const naoLidas = chamado.naoLidas > 0
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-current={selecionado ? 'page' : undefined}
      className={cn(
        'flex w-full flex-col gap-1 border-l-3 border-transparent px-4 py-2.5 text-left transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-accent-soft',
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'body-strong min-w-0 flex-1 truncate',
            naoLidas && 'font-semibold text-ink',
          )}
        >
          {chamado.nome}
        </span>
        {naoLidas && <Contador naoLidas={chamado.naoLidas} />}
        <span className="mono-num caption text-ink-soft">{chamado.hora}</span>
      </span>
      <span
        className={cn(
          'truncate',
          naoLidas ? 'caption font-semibold text-ink' : 'caption text-ink-soft',
        )}
      >
        {chamado.previa}
      </span>
      <span className="mono-num caption text-ink-faint">{chamado.protocolo}</span>
    </button>
  )
}

export default function Prototype314() {
  const [{ chamados: iniciaisChamados, selecionado: inicialSelecionado }] = useState(iniciais)
  const [chamados, setChamados] = useState<Chamado[]>(iniciaisChamados)
  const [selecionado, setSelecionado] = useState<number | null>(inicialSelecionado)
  const [tema, setTema] = useState<Tema>(temaParam)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  function abrir(id: number) {
    setSelecionado(id)
    setChamados((atual) => atual.map((c) => (c.id === id ? { ...c, naoLidas: 0 } : c)))
    setAviso(`Chamado de ${chamados.find((c) => c.id === id)?.nome} aberto com a aba visível: contador zerado.`)
  }

  function receber() {
    setChamados((atual) => {
      const alvo = atual.find((c) => c.naoLidas > 0) ?? atual[0]
      const proximo = atual.map((c) =>
        c.id === alvo.id ? { ...c, naoLidas: Math.min(c.naoLidas + 1, 150) } : c,
      )
      setAviso(
        `Mensagem do cliente em ${alvo.nome}: ${alvo.naoLidas + 1} ${alvo.naoLidas === 0 ? 'não lida' : 'não lidas'} (o chamado não está aberto ou a aba está em segundo plano).`,
      )
      return proximo
    })
  }

  function limpar() {
    setChamados((atual) => atual.map((c) => ({ ...c, naoLidas: 0 })))
    setAviso('Todos os chamados sem não lidas: a lista volta a ficar limpa.')
  }

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
                <p className="caption text-ink-faint">Helpdesk</p>
                <h1 className="title-page truncate">Chamados</h1>
              </div>
            </div>
          </header>
          <div className="grid min-h-0 w-full flex-1 grid-cols-[260px_minmax(0,1fr)_320px] items-start gap-4 px-4 py-4 md:px-[30px] md:py-[30px]">
            <Card
              role="region"
              aria-labelledby="my-conversations-title"
              className="h-[calc(100dvh-150px-var(--header-height))] min-h-0"
            >
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle id="my-conversations-title">Meus chamados ({chamados.length})</CardTitle>
                <Button variant="ghost" size="icon" aria-label="Novo chamado" title="Novo chamado">
                  <Plus strokeWidth={1.7} aria-hidden />
                </Button>
              </CardHeader>
              <nav aria-label="Meus chamados" className="flex-1 overflow-y-auto">
                <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                  {chamados.map((chamado) => (
                    <li key={chamado.id}>
                      <ChamadoLinha
                        chamado={chamado}
                        selecionado={selecionado === chamado.id}
                        onAbrir={() => abrir(chamado.id)}
                      />
                    </li>
                  ))}
                </ul>
              </nav>
            </Card>
            <Card className="h-[calc(100dvh-150px-var(--header-height))] min-h-0 items-center justify-center">
              <Empty>
                <EmptyMedia>
                  <MessagesSquare strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>
                  <span className="body-strong block text-ink">Selecione um atendimento</span>
                  Escolha um chamado em Meus chamados para continuar.
                </EmptyDescription>
              </Empty>
            </Card>
            <Card
              role="region"
              aria-label="Fila"
              className="h-[calc(100dvh-150px-var(--header-height))] min-h-0"
            >
              <div className="flex items-center gap-2 border-b border-line-soft px-[15px] py-[15px]">
                <p className="title-panel">Fila</p>
                <span className="mono-num flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[calc(10px*var(--text-scale))] leading-none font-medium text-primary-foreground">
                  1
                </span>
              </div>
              <div className="flex flex-col gap-2 px-4 py-3">
                <div>
                  <p className="body-strong">Marcos Almeida</p>
                  <p className="caption truncate text-ink-soft">
                    Olá, o sistema não aceita o meu CPF.
                  </p>
                  <p className="caption text-ink-faint">Aguardando há 8 min</p>
                </div>
                <Button variant="outline" size="sm" className="self-start">
                  <UserCheck strokeWidth={1.7} aria-hidden />
                  Assumir
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>
      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex max-w-[min(880px,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #314</strong>
          <span className="text-ink-soft">A (contador junto do horário)</span>
          <Button variant="outline" size="sm" onClick={receber}>
            Receber mensagem
          </Button>
          <Button variant="outline" size="sm" onClick={limpar}>
            Marcar tudo como lido
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
          <span className="w-full text-ink-soft">{aviso || 'Clique num chamado para abrir e zerar o contador.'}</span>
        </div>
      )}
    </div>
  )
}
