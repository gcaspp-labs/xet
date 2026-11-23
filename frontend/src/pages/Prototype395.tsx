// PROTÓTIPO #395 — descartável, não vai para a main.
// Plano: o X de cancelar direto no item da fila, em três versões trocáveis por
// ?variante=A|B|C (A sempre visível e cancela na hora; B só no hover/focus e
// cancela na hora; C sempre visível e pede confirmação no próprio item), nas duas
// listas que mostram a fila — a aba Fila de /chamados (tela=chamados) e a lista
// Fila do Dashboard (tela=dashboard) — mais a janela "Cancelar chamado" com o
// motivo opcional e o registro do cancelamento na conversa (tela=registro).
// Dados fictícios.
// Parâmetros: ?prototype=395&tela=chamados|dashboard|registro&variante=A|B|C
//             &estado=normal|confirmar|janela|janela-preenchida|cancelado|com-motivo
//             &tema=claro|escuro|contraste&captura=1
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import {
  Ban,
  Bell,
  CircleCheck,
  Inbox,
  Lock,
  MessagesSquare,
  MoreHorizontal,
  Paperclip,
  SendHorizontal,
  Settings2,
  UserCheck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { FormDialog } from '@/components/FormDialog'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

// --- dados fictícios -------------------------------------------------------

type Chamado = {
  id: number
  contato: string
  protocolo: string
  orgao: string
  preview: string
  at: string
  tempo: string
  setor: string
}

const fila: Chamado[] = [
  {
    id: 1,
    contato: 'Maria Oliveira',
    protocolo: '2026-000131',
    orgao: 'Prefeitura de Hortolândia — Hortolândia',
    preview: 'Bom dia, o sistema não abre desde ontem',
    at: '09:02',
    tempo: '12 min',
    setor: 'Suporte Sistemas',
  },
  {
    id: 2,
    contato: 'José Carlos Souza',
    protocolo: '2026-000130',
    orgao: 'Câmara Municipal de Sumaré — Sumaré',
    preview: 'Preciso da segunda via do acesso',
    at: '08:47',
    tempo: '27 min',
    setor: 'Suporte Sistemas',
  },
  {
    id: 3,
    contato: 'Fernanda Lima',
    protocolo: '2026-000128',
    orgao: 'Prefeitura de Monte Mor — Monte Mor',
    preview: 'A certidão não emite, dá erro 500',
    at: '08:31',
    tempo: '43 min',
    setor: 'Suporte Sistemas',
  },
]

const meus = [
  {
    id: 9,
    contato: 'Carlos Pereira',
    protocolo: '2026-000127',
    preview: 'Segue o print do erro',
    at: '08:58',
  },
  {
    id: 10,
    contato: 'Patrícia Alves',
    protocolo: '2026-000124',
    preview: 'Obrigada, funcionou!',
    at: '08:12',
  },
]

type Entrada =
  | { kind: 'in' | 'out'; texto: string; at: string }
  | { kind: 'aviso'; texto: string; at: string; motivo?: string }

const conversa: Entrada[] = [
  {
    kind: 'in',
    texto: 'Bom dia! O sistema não abre desde ontem, aparece uma tela branca.',
    at: '08:41',
  },
  {
    kind: 'out',
    texto: 'Bom dia, Carlos. Já estou verificando o acesso. Pode tentar entrar de novo?',
    at: '08:44',
  },
  { kind: 'in', texto: 'Segue o print do erro.', at: '08:58' },
]

const conversaCancelada: Entrada[] = [
  { kind: 'in', texto: 'Bom dia, era engano meu. Já consegui aqui, obrigado!', at: '08:52' },
  {
    kind: 'aviso',
    texto: 'Ana Martins cancelou o chamado',
    at: '09:05',
  },
]

const conversaCanceladaComMotivo: Entrada[] = [
  { kind: 'in', texto: 'Bom dia, era engano meu. Já consegui aqui, obrigado!', at: '08:52' },
  {
    kind: 'aviso',
    texto: 'Ana Martins cancelou o chamado',
    at: '09:05',
    motivo: 'O contato abriu por engano e pediu para desconsiderar.',
  },
]

// --- parâmetros ------------------------------------------------------------

const params = new URLSearchParams(window.location.search)
const telaParam = (params.get('tela') ?? 'chamados') as 'chamados' | 'dashboard' | 'registro'
const varianteParam = (params.get('variante') ?? 'A') as 'A' | 'B' | 'C'
const estadoParam = params.get('estado') ?? 'normal'
const temaParam = (params.get('tema') ?? 'claro') as 'claro' | 'escuro' | 'contraste'
const captura = params.get('captura') === '1'

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

// O X. É a ação destrutiva: ícone sem borda, cinza em repouso e vermelho no hover,
// longe do Assumir (à direita do item) e acima da área clicável da linha no Dashboard.
function BotaoX({
  contato,
  visivel,
  aoClicar,
}: {
  contato: string
  // false na versão B: só aparece no hover ou no foco dentro do item.
  visivel: boolean
  aoClicar: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Cancelar chamado de ${contato}`}
      title="Cancelar chamado"
      className={cn(
        'relative z-10 text-ink-soft hover:bg-danger-soft hover:text-destructive',
        !visivel && 'opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100',
      )}
      onClick={aoClicar}
    >
      <X strokeWidth={1.7} aria-hidden />
    </Button>
  )
}

// A confirmação no próprio item (versão C): sem janela, o item troca as ações por
// esta faixa. Voltar é o primeiro foco, e o Cancelar chamado é texto em danger.
function ConfirmarNoItem({
  contato,
  aoVoltar,
  aoCancelar,
}: {
  contato: string
  aoVoltar: () => void
  aoCancelar: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-7) bg-danger-soft px-3 py-2 whitespace-normal">
      <p className="caption flex items-start gap-1.5 text-ink">
        <Ban strokeWidth={1.7} aria-hidden className="mt-px size-[15px] shrink-0 text-danger" />
        <span>
          Cancelar o chamado de <strong className="font-semibold">{contato}</strong>? Ele não é
          reaberto.
        </span>
      </p>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" autoFocus onClick={aoVoltar}>
          Voltar
        </Button>
        <Button variant="destructive" size="sm" onClick={aoCancelar}>
          Cancelar chamado
        </Button>
      </div>
    </div>
  )
}

function Conversa({
  entradas,
  cancelada,
  className,
}: {
  entradas: Entrada[]
  cancelada: boolean
  className?: string
}) {
  const [texto, setTexto] = useState('')
  return (
    <Card role="region" aria-label="Conversa" className={cn('relative h-full min-h-0', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="truncate">Carlos Pereira</CardTitle>
          <p className="caption text-ink-soft">
            <span className="mono-num">(19) 99888-1122</span> · Suporte Sistemas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={cancelada ? 'danger' : 'success'}>
            {cancelada ? 'Cancelado' : 'Em atendimento'}
          </Badge>
          <Button variant="outline" size="icon" aria-label="Mais ações" title="Mais ações">
            <MoreHorizontal strokeWidth={1.7} aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <div className="flex-1 overflow-y-auto border-y border-line-soft bg-background px-4 py-4">
        <ol className="flex flex-col gap-2">
          {entradas.map((entrada, i) =>
            entrada.kind === 'aviso' ? (
              <li
                key={`aviso-${i}`}
                aria-label="Registro do chamado"
                className="caption flex max-w-full items-start gap-1.5 self-center rounded-(--radius-7) border border-dashed border-line px-2.5 py-1 text-ink-soft"
              >
                <Ban strokeWidth={1.7} aria-hidden className="size-[15px] shrink-0" />
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
      {cancelada ? (
        <div className="caption flex shrink-0 items-center gap-2 border-t border-line-soft px-4 py-3 text-ink-soft">
          <Lock strokeWidth={1.7} aria-hidden className="size-[15px] shrink-0" />
          Chamado cancelado. Ele fica no histórico e não é reaberto.
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

// --- a fila na aba Fila de /chamados ---------------------------------------

function LinhaDaFila({
  chamado,
  variante,
  confirmando,
  aoPedirConfirmacao,
  aoVoltar,
  aoCancelar,
}: {
  chamado: Chamado
  variante: 'A' | 'B' | 'C'
  confirmando: boolean
  aoPedirConfirmacao: () => void
  aoVoltar: () => void
  aoCancelar: () => void
}) {
  return (
    <li className="group/item flex flex-col gap-2 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="body-strong min-w-0 flex-1 truncate">{chamado.contato}</span>
          <span className="mono-num caption text-ink-soft">{chamado.at}</span>
        </span>
        <span className="caption truncate text-ink-soft">{chamado.preview}</span>
        <span className="mono-num caption text-ink-faint">{chamado.protocolo}</span>
        <span className="caption truncate text-ink-faint">{chamado.orgao}</span>
      </div>
      {confirmando ? (
        <ConfirmarNoItem contato={chamado.contato} aoVoltar={aoVoltar} aoCancelar={aoCancelar} />
      ) : (
        <div className="flex items-center gap-2">
          <Button aria-label={`Assumir chamado de ${chamado.contato}`}>
            <UserCheck strokeWidth={1.7} aria-hidden />
            Assumir
          </Button>
          <span className="flex-1" />
          <BotaoX
            contato={chamado.contato}
            visivel={variante !== 'B'}
            aoClicar={variante === 'C' ? aoPedirConfirmacao : aoCancelar}
          />
        </div>
      )}
    </li>
  )
}

// --- a fila do Dashboard ---------------------------------------------------

function LinhaDoDashboard({
  chamado,
  variante,
  confirmando,
  aoPedirConfirmacao,
  aoVoltar,
  aoCancelar,
  setor,
  acoes,
}: {
  chamado: Chamado
  variante: 'A' | 'B' | 'C'
  confirmando: boolean
  aoPedirConfirmacao: () => void
  aoVoltar: () => void
  aoCancelar: () => void
  setor: boolean
  acoes: boolean
}) {
  if (confirmando) {
    return (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={acoes ? 3 : 2} className="py-2">
          <ConfirmarNoItem contato={chamado.contato} aoVoltar={aoVoltar} aoCancelar={aoCancelar} />
        </TableCell>
      </TableRow>
    )
  }
  return (
    <TableRow className="group/item relative">
      <TableCell className="w-full max-w-0 whitespace-normal">
        <span className="body-strong underline-offset-2 after:absolute after:inset-0 hover:text-accent-strong hover:underline">
          {chamado.contato}
        </span>
        <p className="caption truncate text-ink-faint">
          <span className="mono-num">{chamado.protocolo}</span>
          {' · '}
          {chamado.orgao}
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">
        <p className="mono-num">{chamado.tempo}</p>
        {setor && <p className="caption text-ink-faint">{chamado.setor}</p>}
      </TableCell>
      {acoes && (
        <TableCell className="w-0">
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              className="relative z-10"
              aria-label={`Assumir chamado de ${chamado.contato}`}
            >
              <UserCheck strokeWidth={1.7} aria-hidden />
              Assumir
            </Button>
            <BotaoX
              contato={chamado.contato}
              visivel={variante !== 'B'}
              aoClicar={variante === 'C' ? aoPedirConfirmacao : aoCancelar}
            />
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}

function LinhaVazia({ acoes }: { acoes: boolean }) {
  return (
    <TableRow aria-hidden className="border-b border-transparent hover:bg-transparent">
      <TableCell className="w-full max-w-0 whitespace-normal">
        <span className="body-strong">&nbsp;</span>
        <p className="caption truncate text-ink-faint">
          <span className="mono-num">&nbsp;</span>
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right">
        <p className="mono-num">&nbsp;</p>
        <p className="caption text-ink-faint">&nbsp;</p>
      </TableCell>
      {acoes && <TableCell className="w-0" />}
    </TableRow>
  )
}

function ListaDoDashboard({
  titulo,
  id,
  lista,
  variante,
  confirmando,
  aoPedirConfirmacao,
  aoVoltar,
  aoCancelar,
  setor,
  acoes,
  vazia,
}: {
  titulo: string
  id: string
  lista: Chamado[]
  variante: 'A' | 'B' | 'C'
  confirmando: number | null
  aoPedirConfirmacao: (id: number) => void
  aoVoltar: () => void
  aoCancelar: (id: number) => void
  setor: boolean
  acoes: boolean
  vazia: ReactNode
}) {
  return (
    <Card role="region" aria-labelledby={id}>
      <CardHeader className="bg-muted">
        <CardTitle id={id}>
          {titulo}{' '}
          <span className="mono-num font-semibold text-accent-strong">({lista.length})</span>
        </CardTitle>
      </CardHeader>
      {lista.length > 0 ? (
        <>
          <Table>
            <TableBody>
              {lista.map((chamado) => (
                <LinhaDoDashboard
                  key={chamado.id}
                  chamado={chamado}
                  variante={variante}
                  confirmando={confirmando === chamado.id}
                  aoPedirConfirmacao={() => aoPedirConfirmacao(chamado.id)}
                  aoVoltar={aoVoltar}
                  aoCancelar={() => aoCancelar(chamado.id)}
                  setor={setor}
                  acoes={acoes}
                />
              ))}
              {Array.from({ length: Math.max(0, 5 - lista.length) }, (_, index) => (
                <LinhaVazia key={`vazia-${index}`} acoes={acoes} />
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={1}
            pageSize={5}
            total={lista.length}
            noun={['chamado', 'chamados']}
            onPage={() => {}}
          />
        </>
      ) : (
        vazia
      )}
    </Card>
  )
}

// --- a janela "Cancelar chamado" -------------------------------------------

function JanelaCancelar({
  aberta,
  preenchida,
  aoFechar,
  aoCancelar,
}: {
  aberta: boolean
  preenchida: boolean
  aoFechar: () => void
  aoCancelar: () => void
}) {
  const [motivo, setMotivo] = useState(preenchida ? 'O contato abriu por engano.' : '')
  return (
    <FormDialog
      locked
      open={aberta}
      onOpenChange={(next) => !next && aoFechar()}
      title="Cancelar chamado"
      description="Para spam, golpes e engano. O chamado fica no histórico sem lançar o atendimento e não é corrigido nem reaberto."
      submitLabel="Cancelar chamado"
      cancelLabel="Voltar"
      pending={false}
      onSubmit={(event) => {
        event.preventDefault()
        aoCancelar()
      }}
    >
      <Field>
        <FieldLabel htmlFor="prototype-cancel-reason">Motivo (opcional)</FieldLabel>
        <Textarea
          id="prototype-cancel-reason"
          maxLength={2000}
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
        />
        <FieldDescription>
          Sem o motivo, a conversa mostra só quem cancelou e quando.
        </FieldDescription>
      </Field>
    </FormDialog>
  )
}

// --- telas -----------------------------------------------------------------

function Shell({
  ativo,
  children,
  tema,
}: {
  ativo: 'chamados' | 'dashboard' | 'atendimentos'
  children: ReactNode
  tema: 'claro' | 'escuro' | 'contraste'
}) {
  const item = (nome: string) => (
    <p
      className={cn(
        'rounded-(--radius-7) px-2 py-2',
        ativo === nome.toLowerCase() ? 'bg-accent-soft font-medium text-accent-strong' : undefined,
      )}
    >
      {nome}
    </p>
  )
  return (
    <div
      className="flex h-dvh flex-col bg-background text-foreground"
      style={{ '--header-height': '3.5rem' } as CSSProperties}
    >
      <header className="flex h-(--header-height) shrink-0 items-center justify-between border-b border-line bg-card px-4 md:px-6">
        <div className="flex items-center gap-2.5">
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
          {item('Atendimentos')}
          {item('Chamados')}
          {item('Dashboard')}
          {item('Contatos')}
          {item('Conexão')}
          <p className="overline px-2 pt-6 pb-1 text-ink-faint">Cadastro</p>
          {item('Órgãos')}
          {item('Módulos')}
          {item('Assuntos')}
          {item('Setores')}
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  )
}

function TelaChamados({
  variante,
  cancelados,
  aoCancelar,
  confirmando,
  setConfirmando,
  janela,
  janelaPreenchida,
  setJanela,
}: {
  variante: 'A' | 'B' | 'C'
  cancelados: number[]
  aoCancelar: (id: number) => void
  confirmando: number | null
  setConfirmando: (id: number | null) => void
  janela: boolean
  janelaPreenchida: boolean
  setJanela: (aberta: boolean) => void
}) {
  const lista = fila.filter((chamado) => !cancelados.includes(chamado.id))
  return (
    <>
      <header className="shrink-0 border-b border-line-soft bg-background">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
          <div className="min-w-0 flex-1">
            <p className="caption truncate text-ink-faint">Helpdesk</p>
            <h1 className="title-page truncate">Chamados</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button>
              <CircleCheck strokeWidth={1.7} aria-hidden />
              Encerrar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Mais ações"
                    title="Mais ações"
                  />
                }
              >
                <MoreHorizontal strokeWidth={1.7} aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem>
                  <UserCheck strokeWidth={1.7} aria-hidden />
                  Devolver à fila
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setJanela(true)}>
                  <Ban strokeWidth={1.7} aria-hidden />
                  Cancelar chamado
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 md:px-[30px] md:py-[30px]">
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
          <Card role="region" aria-labelledby="meus-chamados" className="min-h-0">
            <CardHeader>
              <CardTitle id="meus-chamados">Meus chamados ({meus.length})</CardTitle>
            </CardHeader>
            <nav aria-label="Meus chamados" className="flex-1 overflow-y-auto">
              <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                {meus.map((chamado, index) => (
                  <li
                    key={chamado.id}
                    className={cn(
                      'flex flex-col gap-1 border-l-3 px-4 py-2.5',
                      index === 0 ? 'border-primary bg-accent-soft' : 'border-transparent',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span className="body-strong min-w-0 flex-1 truncate">{chamado.contato}</span>
                      <span className="mono-num caption text-ink-soft">{chamado.at}</span>
                    </span>
                    <span className="caption truncate text-ink-soft">{chamado.preview}</span>
                    <span className="mono-num caption text-ink-faint">{chamado.protocolo}</span>
                  </li>
                ))}
              </ul>
            </nav>
          </Card>

          <Conversa entradas={conversa} cancelada={false} />

          <Card role="region" aria-label="Fila e assuntos" className="min-h-0">
            <Tabs defaultValue="fila" className="min-h-0 flex-1 p-5">
              <TabsList>
                <TabsTrigger value="fila" aria-label={`Fila, ${lista.length} a assumir`}>
                  Fila
                  <Contagem n={lista.length} />
                </TabsTrigger>
                <TabsTrigger value="assuntos">Assuntos</TabsTrigger>
              </TabsList>
              <TabsContent value="fila" className="min-h-0 overflow-y-auto">
                {lista.length === 0 ? (
                  <Empty>
                    <EmptyMedia>
                      <Inbox strokeWidth={1.7} aria-hidden />
                    </EmptyMedia>
                    <EmptyDescription>Nenhum chamado esperando.</EmptyDescription>
                  </Empty>
                ) : (
                  <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                    {lista.map((chamado) => (
                      <LinhaDaFila
                        key={chamado.id}
                        chamado={chamado}
                        variante={variante}
                        confirmando={confirmando === chamado.id}
                        aoPedirConfirmacao={() => setConfirmando(chamado.id)}
                        aoVoltar={() => setConfirmando(null)}
                        aoCancelar={() => {
                          setConfirmando(null)
                          aoCancelar(chamado.id)
                        }}
                      />
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="assuntos">
                <Empty>
                  <EmptyMedia>
                    <MessagesSquare strokeWidth={1.7} aria-hidden />
                  </EmptyMedia>
                  <EmptyDescription>Assuntos do chamado selecionado.</EmptyDescription>
                </Empty>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
      <JanelaCancelar
        aberta={janela}
        preenchida={janelaPreenchida}
        aoFechar={() => setJanela(false)}
        aoCancelar={() => {
          setJanela(false)
          toast.success('Chamado cancelado')
        }}
      />
    </>
  )
}

function TelaDashboard({
  variante,
  cancelados,
  aoCancelar,
  confirmando,
  setConfirmando,
}: {
  variante: 'A' | 'B' | 'C'
  cancelados: number[]
  aoCancelar: (id: number) => void
  confirmando: number | null
  setConfirmando: (id: number | null) => void
}) {
  const lista = fila.filter((chamado) => !cancelados.includes(chamado.id))
  const emAtendimento = [
    { ...meus[0], tempo: '18 min', setor: 'Suporte Sistemas' },
    { ...meus[1], tempo: '1 h 04 min', setor: 'Suporte Sistemas' },
  ] as Chamado[]
  return (
    <>
      <header className="shrink-0 border-b border-line-soft bg-background">
        <div className="mx-auto flex w-full max-w-(--content-max) flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
          <div className="min-w-0 flex-1">
            <p className="caption truncate text-ink-faint">Todos os setores</p>
            <h1 className="title-page truncate">Dashboard</h1>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-(--content-max) flex-col gap-4 px-4 py-4 md:px-[30px] md:py-[30px]">
          <div className="flex flex-col gap-3">
            <ToggleGroup aria-label="Período" value={['today']}>
              <ToggleGroupItem value="today">Hoje</ToggleGroupItem>
              <ToggleGroupItem value="7d">7 dias</ToggleGroupItem>
              <ToggleGroupItem value="30d">30 dias</ToggleGroupItem>
              <ToggleGroupItem value="custom">Datas</ToggleGroupItem>
            </ToggleGroup>
            <div className="flex flex-wrap items-start gap-3">
              <Filtro id="dashboard-sector" label="Setor" valor="Todos os setores" />
              <Filtro id="dashboard-channel" label="Canal" valor="Todos os canais" />
              <Filtro id="dashboard-assignee" label="Atendente" valor="Todos os atendentes" />
              <Filtro id="dashboard-module" label="Módulo" valor="Todos os módulos" />
            </div>
          </div>
          <section aria-labelledby="agora" className="flex flex-col gap-2">
            <h2 id="agora" className="title-panel">
              Agora
            </h2>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <ListaDoDashboard
                id="board-queue-title"
                titulo="Fila"
                lista={lista}
                variante={variante}
                confirmando={confirmando}
                aoPedirConfirmacao={setConfirmando}
                aoVoltar={() => setConfirmando(null)}
                aoCancelar={(id) => {
                  setConfirmando(null)
                  aoCancelar(id)
                }}
                setor
                acoes
                vazia={
                  <Empty>
                    <EmptyMedia>
                      <Inbox strokeWidth={1.7} aria-hidden />
                    </EmptyMedia>
                    <EmptyDescription>Nenhum chamado na fila.</EmptyDescription>
                  </Empty>
                }
              />
              <ListaDoDashboard
                id="board-progress-title"
                titulo="Em atendimento"
                lista={emAtendimento}
                variante={variante}
                confirmando={null}
                aoPedirConfirmacao={() => {}}
                aoVoltar={() => {}}
                aoCancelar={() => {}}
                setor
                acoes={false}
                vazia={null}
              />
            </div>
            <p className="caption text-ink-faint">
              Ao vivo. Período e módulo não filtram as listas.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}

function Filtro({ id, label, valor }: { id: string; label: string; valor: string }) {
  const items = [{ value: 'all', label: valor }]
  return (
    <Field className="w-full sm:w-[calc(200px*var(--text-scale))]">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value="all">
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{valor}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )
}

function TelaRegistro({ comMotivo }: { comMotivo: boolean }) {
  return (
    <>
      <header className="shrink-0 border-b border-line-soft bg-background">
        <div className="mx-auto flex w-full max-w-(--content-max) flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
          <div className="min-w-0 flex-1">
            <p className="caption truncate text-ink-faint">
              Atendimentos · Suporte Sistemas · 2026-000132
            </p>
            <h1 className="title-page truncate">Carlos Pereira</h1>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[860px] px-4 py-4 md:px-[30px] md:py-[30px]">
          <Conversa
            entradas={comMotivo ? conversaCanceladaComMotivo : conversaCancelada}
            cancelada
            className="min-h-[520px]"
          />
        </div>
      </div>
    </>
  )
}

// --- montagem --------------------------------------------------------------

const titulos: Record<string, string> = {
  normal: 'Item da fila',
  confirmar: 'Confirmação no item (só a C)',
  janela: 'Janela Cancelar chamado, motivo vazio',
  'janela-preenchida': 'Janela com motivo',
  cancelado: 'Chamado cancelado pelo X',
  'com-motivo': 'Registro com motivo',
}

export default function Prototype395() {
  const [tela, setTela] = useState(telaParam)
  const [variante, setVariante] = useState(varianteParam)
  const [estado, setEstado] = useState(estadoParam)
  const [tema, setTema] = useState(temaParam)
  const [cancelados, setCancelados] = useState<number[]>([])
  const [confirmando, setConfirmando] = useState<number | null>(
    estadoParam === 'confirmar' ? fila[0].id : null,
  )
  const [janela, setJanela] = useState(
    estadoParam === 'janela' || estadoParam === 'janela-preenchida',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  // O X cancela na hora: o item sai da fila e o aviso confirma.
  const cancelar = (id: number) => {
    setCancelados((atuais) => [...atuais, id])
    toast.success('Chamado cancelado')
  }

  return (
    <>
      <Shell
        ativo={
          tela === 'dashboard' ? 'dashboard' : tela === 'registro' ? 'atendimentos' : 'chamados'
        }
        tema={tema}
      >
        {tela === 'dashboard' ? (
          <TelaDashboard
            variante={variante}
            cancelados={cancelados}
            aoCancelar={cancelar}
            confirmando={confirmando}
            setConfirmando={setConfirmando}
          />
        ) : tela === 'registro' ? (
          <TelaRegistro comMotivo={estado === 'com-motivo'} />
        ) : (
          <TelaChamados
            variante={variante}
            cancelados={cancelados}
            aoCancelar={cancelar}
            confirmando={confirmando}
            setConfirmando={setConfirmando}
            janela={janela}
            janelaPreenchida={estado === 'janela-preenchida'}
            setJanela={setJanela}
          />
        )}
      </Shell>

      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #395</strong>
          <label className="flex items-center gap-1">
            Tela
            <select
              aria-label="Tela"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tela}
              onChange={(event) => setTela(event.target.value as typeof tela)}
            >
              <option value="chamados">Chamados, aba Fila</option>
              <option value="dashboard">Dashboard, lista Fila</option>
              <option value="registro">Registro na conversa</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Versão
            <select
              aria-label="Versão"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={variante}
              onChange={(event) => setVariante(event.target.value as typeof variante)}
            >
              <option value="A">A (X sempre visível)</option>
              <option value="B">B (X no hover)</option>
              <option value="C">C (confirmação no item)</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Estado
            <select
              aria-label="Estado"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={estado}
              onChange={(event) => {
                const proximo = event.target.value
                setEstado(proximo)
                setConfirmando(proximo === 'confirmar' ? fila[0].id : null)
                setJanela(proximo === 'janela' || proximo === 'janela-preenchida')
                setCancelados(proximo === 'cancelado' ? [fila[0].id] : [])
              }}
            >
              {Object.entries(titulos).map(([valor, titulo]) => (
                <option key={valor} value={valor}>
                  {titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Tema
            <select
              aria-label="Tema"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tema}
              onChange={(event) => setTema(event.target.value as typeof tema)}
            >
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
              <option value="contraste">Alto contraste</option>
            </select>
          </label>
        </div>
      )}
    </>
  )
}
