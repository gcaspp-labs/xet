// PROTÓTIPO #338 — descartável, não vai para a main. Sai do protótipo da #337.
// Plano: uma versão (ajuste de tela existente) do chamado novo B em atendimento
// com o aviso "Este contato tem N chamado(s) pendente(s)" e o Retomar chamado no
// aviso e no menu ⋯, com a janela que lista os pendentes do contato.
// Estados: com 1 e com 2 pendentes, sem pendente, B na fila, quem não é o
// responsável, a janela aberta e o menu aberto.
// Parâmetros de URL para as capturas:
//   ?prototype=338&estado=...&tema=claro|escuro|contraste&captura=1
// Dados fictícios. A barra inferior troca estado e tema; fora das capturas.
import { type CSSProperties, useEffect, useState } from 'react'
import {
  ArrowRightLeft,
  Bell,
  CirclePause,
  CirclePlay,
  Copy,
  Lock,
  Menu as MenuIcon,
  MessagesSquare,
  MoreHorizontal,
  Paperclip,
  Plus,
  SendHorizontal,
  Settings2,
  Undo2,
  UserCheck,
  UserRoundCog,
  Ban,
} from 'lucide-react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { SearchBox } from '@/components/SearchBox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// --- dados fictícios -------------------------------------------------------

type Pendente = {
  id: number
  contato: string
  orgao: string
  protocolo: string
  motivo: string
  por: string
  desde: string
  tempo: string
  setor: string
}

const pendentes: Pendente[] = [
  {
    id: 1,
    contato: 'Maria Oliveira',
    orgao: 'Secretaria de Educação — Campinas',
    protocolo: '2026-000118',
    motivo: 'Aguardando retorno do desenvolvimento sobre o erro no envio de anexos',
    por: 'Ana Martins',
    desde: '17/11/2026 16:20',
    tempo: 'há 3 dias',
    setor: 'Suporte Sistemas',
  },
  {
    id: 2,
    contato: 'Maria Oliveira',
    orgao: 'Secretaria de Educação — Campinas',
    protocolo: '2026-000120',
    motivo: 'Cliente vai confirmar com o órgão o número do protocolo antigo',
    por: 'Bruno Lima',
    desde: '18/11/2026 10:05',
    tempo: 'há 2 dias',
    setor: 'Suporte Sistemas',
  },
  {
    id: 3,
    contato: 'Pedro Alves',
    orgao: 'Não cadastrado',
    protocolo: '2026-000121',
    motivo: 'Depende da liberação de acesso ao sistema pelo órgão',
    por: 'Ana Martins',
    desde: '20/11/2026 11:40',
    tempo: 'há 9 h',
    setor: 'Suporte Sistemas',
  },
  {
    id: 4,
    contato: 'Fernando Dias',
    orgao: 'Prefeitura de Hortolândia — Hortolândia',
    protocolo: '2026-000124',
    motivo: 'Aguardando a nota fiscal do serviço para responder',
    por: 'Ana Martins',
    desde: '20/11/2026 18:05',
    tempo: 'há 3 h',
    setor: 'Suporte Sistemas',
  },
]

const pendenteOutroSetor: Pendente = {
  id: 5,
  contato: 'Lúcia Ramos',
  orgao: 'Secretaria de Obras — Sumaré',
  protocolo: '2026-000119',
  motivo: 'Aguardando laudo do setor de Infraestrutura',
  por: 'Diego Matos',
  desde: '19/11/2026 08:30',
  tempo: 'há 1 dia',
  setor: 'Infraestrutura',
}

const meusChamados = [
  {
    id: 9,
    contato: 'Maria Oliveira',
    protocolo: '2026-000127',
    preview: 'Oi, o problema do anexo continua hoje.',
    at: '20:47',
  },
  {
    id: 10,
    contato: 'Paulo Henrique',
    protocolo: '2026-000126',
    preview: 'Preciso do comprovante do protocolo de ontem.',
    at: '20:31',
  },
  {
    id: 11,
    contato: 'Fernanda Lima',
    protocolo: '2026-000125',
    preview: '👤 Carlos Eduardo Lima',
    at: '19:04',
  },
]

const fila = [
  {
    id: 20,
    contato: 'Camila Souza',
    protocolo: '2026-000123',
    preview: 'Bom dia, preciso de ajuda com o alvará.',
    orgao: 'Prefeitura de Campinas — Campinas',
    at: 'há 12 min',
  },
  {
    id: 21,
    contato: 'Rafael Nunes',
    protocolo: '2026-000122',
    preview: 'O sistema não abre a tela de módulos.',
    orgao: 'Secretaria de Saúde — Hortolândia',
    at: 'há 25 min',
  },
]

type Entrada =
  | { kind: 'in'; at: string; texto: string }
  | { kind: 'out'; at: string; texto: string }
  | { kind: 'aviso'; at: string; texto: string; motivo?: string }

const conversaPendente: Entrada[] = [
  { kind: 'in', at: '09:02', texto: 'Bom dia! O anexo do ofício não sobe no sistema desde ontem.' },
  {
    kind: 'out',
    at: '09:15',
    texto:
      'Bom dia, Maria. Vou verificar com o desenvolvimento e retorno assim que tiver uma posição.',
  },
  { kind: 'in', at: '15:48', texto: 'Certo, fico no aguardo.' },
  {
    kind: 'aviso',
    at: '16:20',
    texto: 'Ana Martins colocou o chamado como pendente',
    motivo: 'Aguardando retorno do desenvolvimento sobre o erro no envio de anexos',
  },
]

const conversaNova: Entrada[] = [
  { kind: 'in', at: '20:42', texto: 'Oi, o problema do anexo continua hoje. Consegue ver?' },
  {
    kind: 'out',
    at: '20:47',
    texto:
      'Oi, Maria. Esse assunto está com o time de desenvolvimento. Vou retomar o chamado anterior para continuar daqui.',
  },
]

const assuntos = [
  {
    nome: 'Erro ao anexar documento',
    modulo: 'Protocolo',
    texto:
      'Se o anexo passar de 16 MB, o envio falha. Peça o arquivo menor ou envie pelo e-mail do setor até a correção.',
  },
  {
    nome: 'Segunda via de boleto',
    modulo: 'Financeiro',
    texto: 'A segunda via é gerada na tela do órgão, em Financeiro › Boletos, com o CNPJ do órgão.',
  },
]

// --- peças -----------------------------------------------------------------

function Contagem({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="mono-num ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[calc(10px*var(--text-scale))] leading-none font-medium text-primary-foreground"
    >
      {n}
    </span>
  )
}

function LinhaMeus({ chamado, ativo }: { chamado: (typeof meusChamados)[number]; ativo: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 border-l-3 px-4 py-2.5',
        ativo ? 'border-primary bg-accent-soft' : 'border-transparent',
      )}
    >
      <span className="flex items-center gap-2">
        <span className="body-strong min-w-0 flex-1 truncate">{chamado.contato}</span>
        <span className="mono-num caption text-ink-soft">{chamado.at}</span>
      </span>
      <span className="caption truncate text-ink-soft">{chamado.preview}</span>
      <span className="mono-num caption text-ink-faint">{chamado.protocolo}</span>
    </div>
  )
}

function LinhaPendente({
  pendente,
  admin,
  aoAbrir,
}: {
  pendente: Pendente
  admin: boolean
  aoAbrir: () => void
}) {
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={aoAbrir}
            title={`Abrir ${pendente.protocolo}`}
            className="body-strong min-w-0 flex-1 truncate text-left hover:underline"
          >
            {pendente.contato}
          </button>
          <span className="mono-num caption text-ink-soft">{pendente.tempo}</span>
        </span>
        <span className="caption min-w-0 truncate text-ink-soft">{pendente.orgao}</span>
        <span className="flex min-w-0 items-center gap-2">
          <span className="mono-num caption text-ink-faint">{pendente.protocolo}</span>
          {admin && (
            <Badge variant="tag" className="ml-auto max-w-[130px] truncate" title={pendente.setor}>
              {pendente.setor}
            </Badge>
          )}
        </span>
      </div>
      <div className="flex items-start gap-1.5 rounded-(--radius-7) bg-muted px-2.5 py-1.5">
        <CirclePause
          strokeWidth={1.7}
          aria-hidden
          className="mt-px size-[15px] shrink-0 text-ink-soft"
        />
        <p className="caption line-clamp-2 text-ink">{pendente.motivo}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="caption min-w-0 flex-1 truncate text-ink-faint">por {pendente.por}</span>
        <Button variant="outline" size="sm" aria-label={`Retomar chamado de ${pendente.contato}`}>
          <CirclePlay strokeWidth={1.7} aria-hidden />
          Retomar
        </Button>
      </div>
    </li>
  )
}

function AbaPendentes({
  lista,
  admin,
  aoAbrir,
}: {
  lista: Pendente[]
  admin: boolean
  aoAbrir: () => void
}) {
  if (lista.length === 0) {
    return (
      <Empty className="border-0">
        <EmptyMedia>
          <CirclePause strokeWidth={1.7} aria-hidden />
        </EmptyMedia>
        <EmptyDescription>
          <span className="body-strong block text-ink">Nenhum chamado pendente</span>
          Chamados que dependem de algo externo aparecem aqui, para qualquer um do setor retomar.
        </EmptyDescription>
      </Empty>
    )
  }
  return (
    <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
      {lista.map((pendente) => (
        <LinhaPendente key={pendente.id} pendente={pendente} admin={admin} aoAbrir={aoAbrir} />
      ))}
    </ul>
  )
}

function AbaFila() {
  return (
    <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
      {fila.map((chamado) => (
        <li key={chamado.id} className="flex flex-col gap-2 py-3">
          <span className="flex items-center gap-2">
            <span className="body-strong min-w-0 flex-1 truncate">{chamado.contato}</span>
            <span className="mono-num caption text-ink-soft">{chamado.at}</span>
          </span>
          <span className="caption truncate text-ink-soft">{chamado.preview}</span>
          <span className="mono-num caption text-ink-faint">{chamado.protocolo}</span>
          <span className="caption truncate text-ink-faint">{chamado.orgao}</span>
          <Button
            className="self-start"
            size="sm"
            aria-label={`Assumir chamado de ${chamado.contato}`}
          >
            <UserCheck strokeWidth={1.7} aria-hidden />
            Assumir
          </Button>
        </li>
      ))}
    </ul>
  )
}

function AbaAssuntos() {
  const [busca, setBusca] = useState('')
  return (
    <div className="flex flex-col gap-3">
      <p className="caption text-ink-soft">
        Soluções do setor para consulta. Copie e adapte no chat.
      </p>
      <SearchBox
        value={busca}
        onChange={setBusca}
        label="Buscar assuntos e soluções"
        placeholder="Buscar assunto ou solução"
      />
      <ul className="flex flex-col gap-2">
        {assuntos.map((assunto) => (
          <li key={assunto.nome} className="rounded-(--radius-8) border border-line p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Badge variant="tag" className="min-w-0 break-words">
                {assunto.nome} · {assunto.modulo}
              </Badge>
              <Button variant="outline" size="sm">
                <Copy strokeWidth={1.7} aria-hidden />
                Copiar
              </Button>
            </div>
            <p className="caption">{assunto.texto}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Conversa({
  entradas,
  somenteLeitura,
  aviso,
  podeRetomar = true,
  naFila = false,
  aoRetomar,
  className,
}: {
  entradas: Entrada[]
  somenteLeitura: boolean
  // Quantos pendentes do contato no setor; 0 esconde o aviso.
  aviso?: number
  podeRetomar?: boolean
  naFila?: boolean
  aoRetomar?: () => void
  className?: string
}) {
  const [texto, setTexto] = useState('')
  return (
    <Card role="region" aria-label="Conversa" className={cn('relative h-full min-h-0', className)}>
      {!!aviso && (
        <div className="border-b border-line-soft p-3">
          <Alert variant="warning">
            <CirclePause strokeWidth={1.7} aria-hidden />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Este contato tem {aviso} {aviso === 1 ? 'chamado pendente' : 'chamados pendentes'}.
                {naFila && ' Assuma o chamado para retomar o pendente.'}
                {!naFila && !podeRetomar && ' Só quem atende este chamado pode retomar o pendente.'}
              </span>
              {podeRetomar && (
                <Button variant="outline" size="sm" onClick={aoRetomar}>
                  <CirclePlay strokeWidth={1.7} aria-hidden />
                  Retomar chamado
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
      <div className="flex-1 overflow-y-auto border-y border-line-soft bg-background px-4 py-4">
        <ol className="flex flex-col gap-2">
          {entradas.map((entrada, i) =>
            entrada.kind === 'aviso' ? (
              <li
                key={`aviso-${i}`}
                aria-label="Registro do chamado"
                className="caption flex max-w-full items-start gap-1.5 self-center rounded-(--radius-7) border border-dashed border-line px-2.5 py-1 text-ink-soft"
              >
                <CirclePause strokeWidth={1.7} aria-hidden className="size-[15px] shrink-0" />
                <span className="min-w-0">
                  {entrada.texto} · <span className="mono-num whitespace-nowrap">{entrada.at}</span>
                  {entrada.motivo && (
                    <span className="block whitespace-pre-wrap break-words">
                      Motivo: {entrada.motivo}
                    </span>
                  )}
                </span>
              </li>
            ) : (
              <li
                key={`msg-${i}`}
                className={cn(
                  'flex max-w-[78%] flex-col gap-1',
                  entrada.kind === 'out' ? 'items-end self-end' : 'items-start self-start',
                )}
              >
                <div
                  className={cn(
                    'flex min-w-0 flex-col gap-1 rounded-(--radius-12) border px-3 py-2',
                    entrada.kind === 'out'
                      ? 'rounded-br-(--radius-6) border-primary bg-primary text-primary-foreground'
                      : 'rounded-bl-(--radius-6) border-line bg-card',
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{entrada.texto}</p>
                  <span
                    className={cn(
                      'mono-num caption self-end',
                      entrada.kind === 'out' ? 'text-primary-foreground' : 'text-ink-soft',
                    )}
                  >
                    {entrada.at}
                  </span>
                </div>
              </li>
            ),
          )}
        </ol>
      </div>
      {somenteLeitura ? (
        <div className="caption flex shrink-0 items-center gap-2 border-t border-line-soft px-4 py-3 text-ink-soft">
          <Lock strokeWidth={1.7} aria-hidden className="size-[15px] shrink-0" />
          {naFila
            ? 'Somente leitura. Assuma o chamado para responder ao contato.'
            : 'Somente leitura. Retome o chamado para responder ao contato.'}
        </div>
      ) : (
        <div className="shrink-0 border-t border-line-soft p-4">
          <div className="flex items-end gap-2">
            <Button variant="ghost" size="icon" aria-label="Anexar arquivo">
              <Paperclip strokeWidth={1.7} aria-hidden />
            </Button>
            <textarea
              aria-label="Mensagem"
              placeholder="Escreva a mensagem"
              rows={1}
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              className="max-h-40 min-h-9 flex-1 resize-none rounded-(--radius-7) border border-input bg-card px-3 py-2 text-[calc(14px*var(--text-scale))] outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
            />
            <Button aria-label="Enviar mensagem" size="icon">
              <SendHorizontal strokeWidth={1.7} aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

// Janela "Colocar como pendente": motivo obrigatório, avisado no próprio campo.
function JanelaMarcar({ erro, aoFechar }: { erro: boolean; aoFechar: () => void }) {
  const [motivo, setMotivo] = useState('')
  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(aberto, detalhes) => {
        if (aberto) return
        if (detalhes.reason === 'escape-key' || detalhes.reason === 'outside-press') {
          detalhes.cancel()
          return
        }
        aoFechar()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Colocar como pendente</DialogTitle>
          <DialogDescription>
            O chamado sai de Meus chamados e vai para Pendentes do setor. O contato fica livre para
            um chamado novo, e este não recebe mensagens até alguém retomar.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="motivo-pendente">Motivo</FieldLabel>
              <Textarea
                id="motivo-pendente"
                maxLength={2000}
                autoFocus
                aria-invalid={erro || undefined}
                aria-describedby={erro ? 'motivo-pendente-erro' : 'motivo-pendente-dica'}
                className={cn(erro && 'border-danger')}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Por que o chamado vai ficar pendente"
              />
              {erro ? (
                <FieldError id="motivo-pendente-erro">Informe o motivo do pendente.</FieldError>
              ) : (
                <FieldDescription id="motivo-pendente-dica">
                  O setor vê o motivo na aba Pendentes e na conversa.
                </FieldDescription>
              )}
            </Field>
          </FieldGroup>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
          <Button type="button">Colocar como pendente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Janela "Retomar chamado": lista os pendentes do mesmo contato e setor.
function JanelaRetomar({ aoFechar }: { aoFechar: () => void }) {
  const [escolhido, setEscolhido] = useState(1)
  const doContato = pendentes.filter((pendente) => pendente.contato === 'Maria Oliveira')
  return (
    <Dialog
      open
      disablePointerDismissal
      onOpenChange={(aberto, detalhes) => {
        if (aberto) return
        if (detalhes.reason === 'escape-key' || detalhes.reason === 'outside-press') {
          detalhes.cancel()
          return
        }
        aoFechar()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Retomar chamado</DialogTitle>
          <DialogDescription>
            As mensagens deste chamado passam para o pendente escolhido, que volta para o seu
            atendimento. Este chamado fica registrado como Mesclado.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">
          <fieldset className="flex flex-col gap-2">
            <legend className="label mb-1 text-ink-soft">Chamado pendente deste contato</legend>
            {doContato.map((pendente) => (
              <label
                key={pendente.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-(--radius-9) border border-line px-3 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-accent-soft"
              >
                <input
                  type="radio"
                  name="pendente-escolhido"
                  className="mt-1 size-4 shrink-0 accent-(--accent)"
                  checked={escolhido === pendente.id}
                  onChange={() => setEscolhido(pendente.id)}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2">
                    <span className="body-strong">{pendente.contato}</span>
                    <span className="mono-num caption text-ink-faint">{pendente.protocolo}</span>
                  </span>
                  <span className="caption text-ink">{pendente.motivo}</span>
                  <span className="caption text-ink-faint">
                    por {pendente.por} · {pendente.tempo}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
          <Button type="button">Retomar chamado</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- tela ------------------------------------------------------------------

type Estado =
  | 'inicio'
  | 'admin'
  | 'vazio'
  | 'pendente'
  | 'menu'
  | 'marcar'
  | 'marcar-erro'
  | 'retomar'
  | 'estreito'
  | 'aviso'
  | 'aviso1'
  | 'sem-aviso'
  | 'fila'
type Tema = 'claro' | 'escuro' | 'contraste'
type Painel = 'meus' | 'conversa' | 'fila' | 'pendentes'
type Aba = 'fila' | 'pendentes' | 'assuntos'

const params = new URLSearchParams(window.location.search)
const estadoParam = (params.get('estado') ?? 'aviso') as Estado
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

const titulos: Record<Estado, string> = {
  aviso: 'Aviso com 2 pendentes (responsável)',
  aviso1: 'Aviso com 1 pendente',
  'sem-aviso': 'Sem pendente (sem aviso)',
  fila: 'Chamado na fila: aviso sem a ação',
  inicio: 'Aba Pendentes',
  admin: 'Administrador, com o setor na linha',
  vazio: 'Aba Pendentes vazia',
  pendente: 'Pendente aberto, só leitura',
  menu: 'Menu Mais ações',
  marcar: 'Janela Colocar como pendente',
  'marcar-erro': 'Motivo vazio',
  retomar: 'Janela Retomar chamado',
  estreito: 'Abas estreitas',
}

// O estado da URL abre a tela já no ponto da captura: cada estado diz qual
// chamado está aberto, qual painel aparece e qual janela está por cima.
function derivar(estado: Estado) {
  const semChamado = ['inicio', 'admin', 'vazio'].includes(estado)
  return {
    admin: estado === 'admin',
    menu: estado === 'menu',
    dialogo: (estado === 'marcar' || estado === 'marcar-erro'
      ? 'marcar'
      : estado === 'retomar'
        ? 'retomar'
        : null) as 'marcar' | 'retomar' | null,
    selecionado: (estado === 'pendente' ? 'pendente' : semChamado ? null : 'novo') as
      'pendente' | 'novo' | null,
    painel: (estado === 'pendente'
      ? 'conversa'
      : estado === 'estreito'
        ? 'pendentes'
        : semChamado
          ? 'meus'
          : 'conversa') as Painel,
    aba: (semChamado || estado === 'estreito' ? 'pendentes' : 'fila') as Aba,
    // PROTÓTIPO #338: o aviso conta os pendentes do contato; a ação é de quem atende B.
    pendentesDoContato: estado === 'sem-aviso' ? 0 : estado === 'aviso1' ? 1 : 2,
    naFila: estado === 'fila',
    responsavel: estado !== 'fila',
  }
}

export default function Prototype337() {
  const inicial = derivar(estadoParam)
  const [estado, setEstado] = useState<Estado>(estadoParam)
  const [tema, setTema] = useState<Tema>(temaParam)
  const [admin, setAdmin] = useState(inicial.admin)
  const [selecionado, setSelecionado] = useState(inicial.selecionado)
  const [painel, setPainel] = useState<Painel>(inicial.painel)
  const [aba, setAba] = useState<Aba>(inicial.aba)
  const [menu, setMenu] = useState(inicial.menu)
  const [dialogo, setDialogo] = useState(inicial.dialogo)
  const [pendentesDoContato, setPendentesDoContato] = useState(inicial.pendentesDoContato)
  const [naFila, setNaFila] = useState(inicial.naFila)

  const aplicar = (proximo: Estado) => {
    const proximoEstado = derivar(proximo)
    setEstado(proximo)
    setAdmin(proximoEstado.admin)
    setMenu(proximoEstado.menu)
    setDialogo(proximoEstado.dialogo)
    setSelecionado(proximoEstado.selecionado)
    setPainel(proximoEstado.painel)
    setAba(proximoEstado.aba)
    setPendentesDoContato(proximoEstado.pendentesDoContato)
    setNaFila(proximoEstado.naFila)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  // Os mais antigos primeiro; o administrador vê também os outros setores.
  const listaPendentes =
    estado === 'vazio'
      ? []
      : admin
        ? [...pendentes.slice(0, 2), pendenteOutroSetor, ...pendentes.slice(2)]
        : pendentes
  const pendenteAberto = pendentes[0]
  const numeroPendentes = listaPendentes.length
  // PROTÓTIPO #338: na fila, o chamado ainda não é de ninguém, então sai de Meus chamados.
  const meusLista = naFila ? meusChamados.filter((chamado) => chamado.id !== 9) : meusChamados
  const podeAssuntos = selecionado === 'novo'
  const faixaPendente = selecionado === 'pendente' && pendenteAberto
  const mostrar = (qual: Painel) => (painel === qual ? undefined : 'max-xl:hidden')
  // A coluna da direita é uma só: Fila, Pendentes e Assuntos são abas dela.
  const mostrarLateral = painel === 'fila' || painel === 'pendentes' ? undefined : 'max-xl:hidden'

  const cabecalho = () => {
    if (selecionado === 'pendente' && pendenteAberto) {
      return {
        breadcrumb: `Chamados · Suporte Sistemas · ${pendenteAberto.protocolo}`,
        titulo: pendenteAberto.contato,
        telefone: '(19) 99999-0001',
      }
    }
    if (selecionado === 'novo') {
      return {
        breadcrumb: 'Chamados · Suporte Sistemas · 2026-000127',
        titulo: 'Maria Oliveira',
        telefone: '(19) 99999-0001',
      }
    }
    return { breadcrumb: 'Helpdesk', titulo: 'Chamados', telefone: null }
  }
  const topo = cabecalho()

  return (
    <div
      className="flex h-dvh flex-col bg-background text-foreground"
      style={{ '--header-height': '3.5rem' } as CSSProperties}
    >
      <header className="flex h-(--header-height) shrink-0 items-center justify-between border-b border-line bg-card px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir menu">
            <MenuIcon strokeWidth={1.7} aria-hidden />
          </Button>
          <img src={tema === 'escuro' ? symbolDark : symbol} alt="" className="h-8 w-8" />
          <div>
            <p className="body-strong leading-tight">GCASPP LAB</p>
            <p className="caption text-ink-soft">Central de Atendimento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Notificações">
            <Bell strokeWidth={1.7} aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Configurações">
            <Settings2 strokeWidth={1.7} aria-hidden />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-(--sidebar-width) shrink-0 flex-col gap-1 border-r border-line bg-card px-3 py-4 text-sm md:flex">
          <p className="overline px-2 pb-1 text-ink-faint">Helpdesk</p>
          <p className="rounded-(--radius-7) bg-accent-soft px-2 py-2 font-medium text-accent-strong">
            Chamados
          </p>
          <p className="px-2 py-2">Atendimentos</p>
          {admin && <p className="px-2 py-2">Dashboard</p>}
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
                <p className="caption truncate text-ink-faint">{topo.breadcrumb}</p>
                <h1 className="title-page truncate">{topo.titulo}</h1>
                {topo.telefone && <p className="caption text-ink-soft">{topo.telefone}</p>}
              </div>
              {selecionado === 'pendente' ? (
                <Button>
                  <CirclePlay strokeWidth={1.7} aria-hidden />
                  Retomar
                </Button>
              ) : selecionado === 'novo' ? (
                <div className="flex items-center gap-2">
                  {naFila ? (
                    <Button>
                      <UserCheck strokeWidth={1.7} aria-hidden />
                      Assumir
                    </Button>
                  ) : (
                    <Button>Encerrar</Button>
                  )}
                  {/* PROTÓTIPO #338: na fila, as ações do chamado em atendimento não se aplicam. */}
                  {!naFila && (
                    <DropdownMenu open={menu} onOpenChange={setMenu}>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Mais ações"
                            title="Mais ações"
                            aria-haspopup="menu"
                          />
                        }
                      >
                        <MoreHorizontal strokeWidth={1.7} aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-52">
                        {!naFila && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setMenu(false)
                                aplicar('retomar')
                              }}
                            >
                              <CirclePlay strokeWidth={1.7} aria-hidden />
                              Retomar chamado
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => setMenu(false)}>
                          <Undo2 strokeWidth={1.7} aria-hidden />
                          Devolver à fila
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setMenu(false)
                            aplicar('marcar')
                          }}
                        >
                          <CirclePause strokeWidth={1.7} aria-hidden />
                          Colocar como pendente
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMenu(false)}>
                          <UserRoundCog strokeWidth={1.7} aria-hidden />
                          Transferir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setMenu(false)}>
                          <ArrowRightLeft strokeWidth={1.7} aria-hidden />
                          Outro setor
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setMenu(false)}>
                          <Ban strokeWidth={1.7} aria-hidden />
                          Cancelar chamado
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ) : null}
            </div>
          </header>
          {faixaPendente && (
            <div className="flex shrink-0 items-start gap-2 border-b border-warning/40 bg-warning-soft px-4 py-2 text-warning-ink md:px-[30px]">
              <CirclePause strokeWidth={1.7} aria-hidden className="mt-0.5 size-[15px] shrink-0" />
              <p className="caption">
                <strong className="font-semibold">Pendente:</strong> {pendenteAberto.motivo}, por{' '}
                {pendenteAberto.por}, desde {pendenteAberto.desde}.
              </p>
            </div>
          )}
          <div className="flex min-h-0 w-full flex-1 flex-col gap-3 px-4 py-3 md:px-[30px] md:py-[30px]">
            <Tabs
              value={painel}
              onValueChange={(valor) => {
                const proximo = valor as Painel
                setPainel(proximo)
                if (proximo === 'fila' || proximo === 'pendentes') setAba(proximo)
              }}
              className="shrink-0 xl:hidden"
            >
              <TabsList aria-label="Mostrar" className="w-full gap-2">
                <TabsTrigger value="meus" className="flex-1">
                  Meus <Contagem n={meusLista.length} />
                </TabsTrigger>
                <TabsTrigger value="conversa" className="flex-1">
                  Conversa
                </TabsTrigger>
                <TabsTrigger value="fila" className="flex-1">
                  Fila <Contagem n={fila.length} />
                </TabsTrigger>
                <TabsTrigger value="pendentes" className="flex-1">
                  Pendentes <Contagem n={numeroPendentes} />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
              <Card
                role="region"
                aria-labelledby="meus-chamados"
                className={cn('min-h-0', mostrar('meus'))}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle id="meus-chamados">Meus chamados ({meusLista.length})</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Novo chamado"
                    title="Novo chamado"
                  >
                    <Plus strokeWidth={1.7} aria-hidden />
                  </Button>
                </CardHeader>
                <nav aria-label="Meus chamados" className="flex-1 overflow-y-auto">
                  <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                    {meusLista.map((chamado) => (
                      <li key={chamado.id}>
                        <LinhaMeus
                          chamado={chamado}
                          ativo={chamado.id === 9 && selecionado === 'novo'}
                        />
                      </li>
                    ))}
                  </ul>
                </nav>
              </Card>

              {selecionado === 'pendente' ? (
                <Conversa
                  entradas={conversaPendente}
                  somenteLeitura
                  className={mostrar('conversa')}
                />
              ) : selecionado === 'novo' ? (
                <Conversa
                  key={estado}
                  entradas={conversaNova}
                  somenteLeitura={naFila}
                  aviso={pendentesDoContato}
                  podeRetomar={!naFila}
                  naFila={naFila}
                  aoRetomar={() => aplicar('retomar')}
                  className={mostrar('conversa')}
                />
              ) : (
                <Card className={cn('min-h-0 justify-center', mostrar('conversa'))}>
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
              )}

              <Card
                role="region"
                aria-label="Fila, pendentes e assuntos"
                className={cn('min-h-0', mostrarLateral)}
              >
                <Tabs
                  value={aba}
                  onValueChange={(valor) => setAba(valor as Aba)}
                  className="min-h-0 flex-1 p-5"
                >
                  <TabsList className="gap-3">
                    <TabsTrigger
                      value="fila"
                      aria-label={fila.length ? `Fila, ${fila.length} a assumir` : 'Fila'}
                    >
                      Fila
                      {aba !== 'fila' && fila.length > 0 && <Contagem n={fila.length} />}
                    </TabsTrigger>
                    <TabsTrigger
                      value="pendentes"
                      aria-label={
                        numeroPendentes ? `Pendentes, ${numeroPendentes} para retomar` : 'Pendentes'
                      }
                    >
                      Pendentes
                      {aba !== 'pendentes' && numeroPendentes > 0 && (
                        <Contagem n={numeroPendentes} />
                      )}
                    </TabsTrigger>
                    {podeAssuntos && <TabsTrigger value="assuntos">Assuntos</TabsTrigger>}
                  </TabsList>
                  <TabsContent value="fila" className="min-h-0 overflow-y-auto">
                    <AbaFila />
                  </TabsContent>
                  <TabsContent value="pendentes" className="min-h-0 overflow-y-auto">
                    <AbaPendentes
                      lista={listaPendentes}
                      admin={admin}
                      aoAbrir={() => aplicar('pendente')}
                    />
                  </TabsContent>
                  {podeAssuntos && (
                    <TabsContent value="assuntos" className="min-h-0 overflow-y-auto">
                      <AbaAssuntos />
                    </TabsContent>
                  )}
                </Tabs>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {dialogo === 'marcar' && (
        <JanelaMarcar
          erro={estado === 'marcar-erro'}
          aoFechar={() => {
            setDialogo(null)
            setSelecionado('novo')
            setMenu(false)
          }}
        />
      )}
      {dialogo === 'retomar' && (
        <JanelaRetomar
          aoFechar={() => {
            setDialogo(null)
            setSelecionado('novo')
            setMenu(false)
          }}
        />
      )}

      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #338</strong>
          <span className="text-ink-soft">{titulos[estado]}</span>
          <span className="flex items-center gap-1">
            Estado
            <select
              aria-label="Estado"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={estado}
              onChange={(event) => aplicar(event.target.value as Estado)}
            >
              <option value="aviso">Aviso com 2 pendentes</option>
              <option value="aviso1">Aviso com 1 pendente</option>
              <option value="sem-aviso">Sem pendente</option>
              <option value="fila">Chamado na fila</option>
              <option value="menu">Menu Mais ações</option>
              <option value="retomar">Janela Retomar chamado</option>
            </select>
          </span>
          <label className="flex items-center gap-1">
            Tema
            <select
              aria-label="Tema"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tema}
              onChange={(event) => setTema(event.target.value as Tema)}
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
