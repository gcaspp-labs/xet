// PROTÓTIPO #482 — descartável, não vai para a main.
// Plano: uma proposta de foto do contato conforme o WhatsApp nas quatro telas
// (listas de Meus chamados e Fila, cabeçalho do chamado em Chamados e em
// Atendimentos, tela Contatos e ficha do contato) e a janela da foto grande.
// Telas: ?prototype=482&tela=chamados|atendimentos|contatos|ficha
// Estados: &estado=misto|foto|iniciais|icone (quem tem foto, quem cai nas iniciais
// e quem mostra o ícone de pessoa) e &tema=claro|escuro|contraste&captura=1.
// Dados fictícios e fotos ilustradas geradas para o protótipo (o repositório é público).
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import {
  ArrowLeft,
  Bell,
  CircleCheck,
  Copy,
  MoreHorizontal,
  Paperclip,
  SendHorizontal,
  UserCheck,
  UserRound,
  X,
  ZoomIn,
} from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-simbolo-escuro.svg'
import { FormDialog } from '@/components/FormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose } from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// --- dados fictícios -------------------------------------------------------

type Contato = {
  id: number
  nome: string
  telefone: string
  foto?: string
  orgao: string | null
  setores: string[]
  modulo?: string
}

const fotos = [
  '/prototype/avatar-1.svg',
  '/prototype/avatar-2.svg',
  '/prototype/avatar-3.svg',
  '/prototype/avatar-4.svg',
]

const base: Contato[] = [
  {
    id: 1,
    nome: 'Maria Oliveira',
    telefone: '5519998124477',
    foto: fotos[0],
    orgao: 'Prefeitura de Hortolândia — Hortolândia',
    setores: ['Suporte Sistemas'],
    modulo: 'Protocolo',
  },
  {
    id: 2,
    nome: 'José Carlos Souza',
    telefone: '5519988772211',
    orgao: 'Câmara Municipal de Sumaré — Sumaré',
    setores: ['Suporte Sistemas'],
    modulo: 'Licitações',
  },
  {
    id: 3,
    nome: 'Fernanda Lima',
    telefone: '5511976543322',
    foto: fotos[1],
    orgao: 'Prefeitura de Monte Mor — Monte Mor',
    setores: ['Suporte Sistemas', 'Cadastro'],
    modulo: 'Certidões',
  },
  {
    id: 4,
    nome: 'Carlos Pereira',
    telefone: '5511991234567',
    foto: fotos[2],
    orgao: 'Prefeitura de Campinas — Campinas',
    setores: ['Cadastro'],
    modulo: 'Tributos',
  },
  {
    id: 5,
    nome: 'Patrícia Alves',
    telefone: '5511998765432',
    foto: fotos[3],
    orgao: 'Prefeitura de Paulínia — Paulínia',
    setores: ['Suporte Sistemas'],
    modulo: 'Portal',
  },
  {
    id: 6,
    nome: '+55 19 99123-8877',
    telefone: '5519991238877',
    orgao: null,
    setores: [],
  },
  {
    id: 7,
    nome: 'Roberto Nunes',
    telefone: '5519991112233',
    orgao: 'Prefeitura de Sumaré — Sumaré',
    setores: ['Gabinete'],
    modulo: 'Ofícios',
  },
  {
    id: 8,
    nome: '+55 11 97654-3322',
    telefone: '5511976543322',
    orgao: null,
    setores: [],
  },
]

const eTelefone = (nome: string) => /^[+\d][\d\s()-]*$/.test(nome.trim())

function fone(e164: string) {
  const digitos = e164.replace(/\D/g, '')
  const local = digitos.startsWith('55') ? digitos.slice(2) : digitos
  const ddd = local.slice(0, 2)
  const resto = local.slice(2)
  const corte = resto.length === 9 ? 5 : 4
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
}

const telefoneComPais = (e164: string) => {
  const digitos = e164.replace(/\D/g, '')
  const local = digitos.startsWith('55') ? digitos.slice(2) : digitos
  const ddd = local.slice(0, 2)
  const resto = local.slice(2)
  const corte = resto.length === 9 ? 5 : 4
  return `+55 ${ddd} ${resto.slice(0, corte)}-${resto.slice(corte)}`
}

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

// O mesmo contato em cada estado: todos com foto, todos sem foto (iniciais) e
// todos sem nome (o nome é o telefone, então só o ícone ajuda).
function noEstado(estado: Estado): Contato[] {
  if (estado === 'foto') {
    return base.map((contato, i) => ({ ...contato, foto: fotos[i % fotos.length] }))
  }
  if (estado === 'iniciais') {
    return base.map((contato) => ({
      ...contato,
      foto: undefined,
      nome: eTelefone(contato.nome) ? 'Ana Paula Ferreira' : contato.nome,
    }))
  }
  if (estado === 'icone') {
    return base.map((contato) => ({
      ...contato,
      foto: undefined,
      nome: telefoneComPais(contato.telefone),
    }))
  }
  return base
}

// --- peças -----------------------------------------------------------------

type Estado = 'misto' | 'foto' | 'iniciais' | 'icone'
type Tela = 'chamados' | 'atendimentos' | 'contatos' | 'ficha'
type Tema = 'claro' | 'escuro' | 'contraste'

// O círculo da foto: foto, iniciais do nome ou, quando o nome é só o telefone,
// o ícone de pessoa. Usado nas listas, no cabeçalho e na ficha.
function FotoContato({
  contato,
  tamanho = 32,
  aoAmpliar,
}: {
  contato: Contato
  tamanho?: number
  // Só no cabeçalho e na ficha: clique abre a foto grande.
  aoAmpliar?: () => void
}) {
  const [falhou, setFalhou] = useState(false)
  const px = `${tamanho}px`
  const usarFoto = contato.foto && !falhou
  const circulo = usarFoto ? (
    <img
      src={contato.foto}
      alt=""
      onError={() => setFalhou(true)}
      className="rounded-full border border-line-soft object-cover"
      style={{ width: px, height: px }}
    />
  ) : eTelefone(contato.nome) ? (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full border border-line-soft bg-muted text-ink-soft"
      style={{ width: px, height: px }}
    >
      <UserRound strokeWidth={1.7} style={{ width: tamanho * 0.55, height: tamanho * 0.55 }} />
    </span>
  ) : (
    <span
      aria-hidden
      className="flex items-center justify-center rounded-full border border-line-soft bg-accent-soft font-semibold text-accent-strong select-none"
      style={{ width: px, height: px, fontSize: tamanho * 0.36 }}
    >
      {iniciais(contato.nome)}
    </span>
  )
  if (!aoAmpliar) {
    return (
      <span className="shrink-0" aria-hidden>
        {circulo}
      </span>
    )
  }
  const selo = tamanho >= 56 ? 24 : 20
  return (
    <button
      type="button"
      aria-label={`Ver foto de ${contato.nome}`}
      title="Ver foto"
      onClick={aoAmpliar}
      className="group relative shrink-0 cursor-zoom-in rounded-full outline-2 outline-offset-2 outline-transparent hover:outline-focus focus-visible:outline-focus"
    >
      {circulo}
      <span
        aria-hidden
        className="absolute -right-1 -bottom-1 flex items-center justify-center rounded-full border border-line bg-card text-ink shadow-(--shadow)"
        style={{ width: selo, height: selo }}
      >
        <ZoomIn strokeWidth={1.7} style={{ width: selo * 0.62, height: selo * 0.62 }} />
      </span>
    </button>
  )
}

// A foto grande por cima da tela, como o visualizador das imagens da conversa:
// fundo do overlay, X no canto e Esc fecha. O nome e o telefone ficam abaixo.
function FotoGrande({
  contato,
  aberta,
  aoFechar,
}: {
  contato: Contato
  aberta: boolean
  aoFechar: () => void
}) {
  return (
    <Dialog open={aberta} onOpenChange={(proxima) => !proxima && aoFechar()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-(--overlay)" />
        <DialogPrimitive.Popup
          aria-label={`Foto de ${contato.nome}`}
          className="fixed inset-0 z-50 flex flex-col outline-none"
        >
          <div className="flex items-center justify-end p-3">
            <DialogClose
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Fechar"
                  className="border-line bg-card text-ink shadow-(--shadow) hover:bg-muted"
                />
              }
            >
              <X strokeWidth={1.7} />
            </DialogClose>
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden px-6 pb-10">
            <img
              src={contato.foto}
              alt={`Foto de ${contato.nome}`}
              className="max-h-[68vh] max-w-full rounded-(--radius-12) object-contain"
            />
            <div className="text-center text-on-overlay">
              <p className="body-strong">{contato.nome}</p>
              <p className="mono-num caption opacity-80">{fone(contato.telefone)}</p>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </Dialog>
  )
}

// Linha da lista (Meus chamados e Fila): a foto à esquerda do bloco de três linhas.
// Nas listas o clique na foto não abre nada: quem manda é a linha inteira, como hoje.
function LinhaChamado({
  contato,
  protocolo,
  previa,
  hora,
  naoLidas,
}: {
  contato: Contato
  protocolo: string
  previa: string
  hora: string
  naoLidas?: number
}) {
  const negrito = !!naoLidas
  return (
    <span className="flex items-center gap-2.5">
      <FotoContato contato={contato} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className={cn('body-strong min-w-0 flex-1 truncate', negrito && 'font-semibold')}>
            {contato.nome}
          </span>
          {naoLidas ? (
            <span className="mono-num flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[calc(10.5px*var(--text-scale))] leading-none font-medium text-primary-foreground">
              {naoLidas}
            </span>
          ) : null}
          <span className="mono-num caption shrink-0 text-ink-soft">{hora}</span>
        </span>
        <span
          className={cn('caption truncate', negrito ? 'font-semibold text-ink' : 'text-ink-soft')}
        >
          {previa}
        </span>
        <span className="mono-num caption text-ink-faint">{protocolo}</span>
      </span>
    </span>
  )
}

type Mensagem = { tipo: 'entrada' | 'saida'; texto: string; hora: string }

function Bolha({ mensagem }: { mensagem: Mensagem }) {
  const saida = mensagem.tipo === 'saida'
  return (
    <div className={cn('flex', saida ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[78%]">
        <div
          className={cn(
            'rounded-(--radius-12) border px-3 py-2 text-sm',
            saida
              ? 'rounded-br-(--radius-6) border-primary bg-primary text-primary-foreground'
              : 'rounded-bl-(--radius-6) border-line bg-card text-ink',
          )}
        >
          {mensagem.texto}
        </div>
        <p className={cn('mono-num caption mt-1 text-ink-faint', saida ? 'text-right' : undefined)}>
          {mensagem.hora}
        </p>
      </div>
    </div>
  )
}

function Conversa({
  mensagens,
  aviso,
  className,
}: {
  mensagens: Mensagem[]
  aviso?: string
  className?: string
}) {
  return (
    <Card role="region" aria-label="Conversa" className={cn('min-h-0', className)}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {mensagens.map((mensagem, i) => (
          <Bolha key={i} mensagem={mensagem} />
        ))}
      </div>
      <div className="shrink-0 border-t border-line-soft px-3 py-2.5">
        {aviso ? (
          <p className="caption flex items-center gap-1.5 text-ink-soft">
            <CircleCheck strokeWidth={1.7} aria-hidden className="size-[15px]" />
            {aviso}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Anexar">
              <Paperclip strokeWidth={1.7} aria-hidden />
            </Button>
            <span className="caption flex-1 text-ink-faint">Escreva uma mensagem</span>
            <Button variant="ghost" size="icon" aria-label="Enviar mensagem">
              <SendHorizontal strokeWidth={1.7} aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

// --- telas -----------------------------------------------------------------

function CabecalhoChamado({
  contato,
  protocolo,
  comVoltar,
  aoAmpliar,
  acao,
}: {
  contato: Contato
  protocolo: string
  comVoltar?: boolean
  aoAmpliar: () => void
  acao: ReactNode
}) {
  return (
    <header className="shrink-0 border-b border-line-soft bg-background">
      <div className="mx-auto flex max-w-(--content-max) flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
        {comVoltar && (
          <Button variant="ghost" size="icon" aria-label="Voltar ao histórico">
            <ArrowLeft strokeWidth={1.7} aria-hidden />
          </Button>
        )}
        <FotoContato contato={contato} tamanho={40} aoAmpliar={aoAmpliar} />
        <div className="min-w-0 flex-1 basis-48">
          <p className="caption truncate text-ink-faint">{protocolo}</p>
          <h1 className="title-page truncate">{contato.nome}</h1>
          <p className="mono-num caption flex items-center gap-1 text-ink-soft">
            {fone(contato.telefone)}
            <Button variant="ghost" size="icon" aria-label="Copiar telefone" className="size-5">
              <Copy strokeWidth={1.7} aria-hidden className="size-[13px]" />
            </Button>
          </p>
        </div>
        {acao}
      </div>
    </header>
  )
}

const conversaAberta: Mensagem[] = [
  {
    tipo: 'entrada',
    texto:
      'Bom dia! O sistema não abre desde ontem e preciso emitir uma certidão para um munícipe.',
    hora: '09:12',
  },
  {
    tipo: 'saida',
    texto: 'Bom dia, Maria. Já estou verificando por aqui. Pode me confirmar o módulo?',
    hora: '09:14',
  },
  { tipo: 'entrada', texto: 'É o de Certidões, o mesmo que uso sempre.', hora: '09:15' },
  { tipo: 'saida', texto: 'Obrigado. Vou reiniciar o serviço e já te aviso.', hora: '09:16' },
]

function TelaChamados({
  contatos,
  aoAmpliar,
}: {
  contatos: Contato[]
  aoAmpliar: (contato: Contato) => void
}) {
  const porId = (id: number) => contatos.find((contato) => contato.id === id) ?? contatos[0]
  const aberto = porId(1)
  const meus = [porId(1), porId(5), porId(7)]
  const fila = [porId(3), porId(2), porId(6)]
  // Abaixo de xl só um bloco aparece por vez, como na tela real.
  const [painel, setPainel] = useState<'meus' | 'conversa' | 'fila'>('meus')
  const mostrar = (qual: 'meus' | 'conversa' | 'fila') =>
    painel === qual ? undefined : 'max-xl:hidden'
  return (
    <>
      <CabecalhoChamado
        contato={aberto}
        protocolo="Chamados · Suporte Sistemas · 2026-000132"
        aoAmpliar={() => aoAmpliar(aberto)}
        acao={
          <div className="flex items-center gap-2">
            <Button>
              <CircleCheck strokeWidth={1.7} aria-hidden />
              Encerrar
            </Button>
            <Button variant="outline" size="icon" aria-label="Mais ações" title="Mais ações">
              <MoreHorizontal strokeWidth={1.7} aria-hidden />
            </Button>
          </div>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3 md:px-[30px] md:py-[30px]">
        <Tabs
          value={painel}
          onValueChange={(valor) => setPainel(valor as typeof painel)}
          className="shrink-0 xl:hidden"
        >
          <TabsList aria-label="Mostrar" className="w-full">
            <TabsTrigger value="meus" className="flex-1">
              Meus <span className="mono-num ml-1">({meus.length})</span>
            </TabsTrigger>
            <TabsTrigger value="conversa" className="flex-1">
              Conversa
            </TabsTrigger>
            <TabsTrigger value="fila" className="flex-1">
              Fila <span className="mono-num ml-1">({fila.length})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <Card
            role="region"
            aria-labelledby="meus-chamados"
            className={cn('min-h-0', mostrar('meus'))}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle id="meus-chamados">Meus chamados ({meus.length})</CardTitle>
            </CardHeader>
            <nav aria-label="Meus chamados" className="min-h-0 flex-1 overflow-y-auto">
              <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                {meus.map((contato, i) => (
                  <li key={contato.id}>
                    <span
                      onClick={() => setPainel('conversa')}
                      className={cn(
                        'flex cursor-pointer flex-col border-l-3 px-4 py-2.5',
                        i === 0 ? 'border-primary bg-accent-soft' : 'border-transparent',
                      )}
                    >
                      <LinhaChamado
                        contato={contato}
                        protocolo={['2026-000132', '2026-000124', '2026-000121'][i]}
                        previa={
                          [
                            'Obrigado. Vou reiniciar o serviço e já te aviso.',
                            'Obrigada, funcionou!',
                            'Segue o print do erro',
                          ][i]
                        }
                        hora={['09:16', '08:12', 'Ontem'][i]}
                        naoLidas={i === 0 ? 0 : [0, 2, 0][i]}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </nav>
          </Card>
          <Conversa mensagens={conversaAberta} className={mostrar('conversa')} />
          <Card
            role="region"
            aria-label="Fila, assuntos e pendentes"
            className={cn('min-h-0', mostrar('fila'))}
          >
            <Tabs value="queue" className="min-h-0 flex-1 p-5">
              <TabsList>
                <TabsTrigger value="queue">
                  Fila
                  <span className="mono-num ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[calc(10px*var(--text-scale))] leading-none font-medium text-primary-foreground">
                    3
                  </span>
                </TabsTrigger>
                <TabsTrigger value="pending">Pendentes</TabsTrigger>
              </TabsList>
              <TabsContent value="queue" className="min-h-0 overflow-y-auto">
                <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                  {fila.map((contato) => (
                    <li key={contato.id} className="flex flex-col gap-2 py-3">
                      <LinhaChamado
                        contato={contato}
                        protocolo={`2026-0001${30 + contato.id}`}
                        previa={
                          contato.id === 3
                            ? 'A certidão não emite, dá erro 500'
                            : contato.id === 2
                              ? 'Preciso da segunda via do acesso'
                              : 'Bom dia, preciso de ajuda'
                        }
                        hora={['08:47', '08:31', '08:20'][fila.indexOf(contato)]}
                      />
                      <div className="flex items-center gap-2 pl-[42px]">
                        <Button size="sm">
                          <UserCheck strokeWidth={1.7} aria-hidden />
                          Assumir
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </>
  )
}

function TelaAtendimentos({
  contatos,
  aoAmpliar,
}: {
  contatos: Contato[]
  aoAmpliar: (contato: Contato) => void
}) {
  const encerrado = contatos.find((contato) => contato.id === 1) ?? contatos[0]
  return (
    <>
      <CabecalhoChamado
        contato={encerrado}
        protocolo="Suporte Sistemas · 2026-000118"
        comVoltar
        aoAmpliar={() => aoAmpliar(encerrado)}
        acao={
          <Button>
            <CircleCheck strokeWidth={1.7} aria-hidden />
            Corrigir
          </Button>
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 md:px-[30px] md:py-[30px] lg:grid-cols-[minmax(0,1fr)_380px]">
        <Conversa
          mensagens={[
            {
              tipo: 'entrada',
              texto: 'Bom dia! Preciso de ajuda com a emissão da certidão de débitos.',
              hora: '08:02',
            },
            {
              tipo: 'saida',
              texto: 'Bom dia, Maria. Pode enviar o número do cadastro?',
              hora: '08:05',
            },
            { tipo: 'entrada', texto: 'É o 2026-004512.', hora: '08:07' },
            {
              tipo: 'saida',
              texto:
                'Ajustei o cadastro e a certidão já está emitindo. Qualquer coisa, estou por aqui.',
              hora: '08:21',
            },
          ]}
          aviso="Chamado encerrado em 25/11/2026 08:32."
          className="min-h-0"
        />
        <Card role="region" aria-label="Atendimento" className="min-h-0">
          <CardHeader>
            <CardTitle>Atendimento</CardTitle>
          </CardHeader>
          <Tabs value="details" className="min-h-0 flex-1 px-5 pb-5">
            <TabsList>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="min-h-0 overflow-y-auto">
              <dl className="flex flex-col gap-3 pt-1">
                {[
                  ['Contato', encerrado.nome],
                  ['Telefone', fone(encerrado.telefone)],
                  ['Órgão', encerrado.orgao ?? 'Não cadastrado'],
                  ['Assunto', 'Certidão de débitos'],
                  ['Setor', 'Suporte Sistemas'],
                  ['Encerrado em', '25/11/2026 08:32'],
                  ['Encerrado por', 'Ana Martins'],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo}>
                    <dt className="label text-ink-soft">{rotulo}</dt>
                    <dd className="body-strong">{valor}</dd>
                  </div>
                ))}
              </dl>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </>
  )
}

function TelaContatos({
  contatos,
  aoAmpliar,
  ficha,
  aoFecharFicha,
  fotoGrande,
}: {
  contatos: Contato[]
  aoAmpliar: (contato: Contato) => void
  ficha: boolean
  aoFecharFicha: () => void
  fotoGrande?: ReactNode
}) {
  const tabela = contatos.slice(0, 7)
  const [setor, setSetor] = useState('todos')
  const [modulo, setModulo] = useState('todos')
  const setores = [
    { value: 'todos', label: 'Todos os setores' },
    { value: '1', label: 'Suporte Sistemas' },
    { value: '2', label: 'Cadastro' },
  ]
  const modulos = [
    { value: 'todos', label: 'Todos os módulos' },
    { value: '1', label: 'Protocolo' },
    { value: '2', label: 'Certidões' },
  ]
  return (
    <>
      <header className="shrink-0 border-b border-line-soft bg-background">
        <div className="mx-auto flex max-w-(--content-max) flex-wrap items-center gap-3 px-4 py-3 md:px-[30px]">
          <div className="min-w-0 flex-1">
            <p className="caption text-ink-faint">Helpdesk</p>
            <h1 className="title-page">Contatos</h1>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline">Importar contatos</Button>
            <Button>Novo contato</Button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-(--content-max) flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-[30px] md:py-[30px]">
        <div className="relative max-w-[260px]">
          <Input placeholder="Nome, município, telefone ou CNPJ" aria-label="Buscar contatos" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select items={setores} value={setor} onValueChange={(valor) => valor && setSetor(valor)}>
            <SelectTrigger aria-label="Filtrar por setor" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setores.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={modulos}
            value={modulo}
            onValueChange={(valor) => valor && setModulo(valor)}
          >
            <SelectTrigger aria-label="Filtrar por módulo" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modulos.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Setores e módulos</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tabela.map((contato) => (
                <TableRow key={contato.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <FotoContato contato={contato} />
                      <div className="min-w-0">
                        <p className="body-strong truncate">{contato.nome}</p>
                        <p className="mono-num caption text-ink-faint">{fone(contato.telefone)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {contato.orgao ? (
                      <p>{contato.orgao}</p>
                    ) : (
                      <span className="text-ink-faint">Sem órgão</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contato.setores.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {contato.setores[0]}
                        {contato.modulo && <Badge variant="tag">{contato.modulo}</Badge>}
                      </span>
                    ) : (
                      <span className="text-ink-faint">Sem setor</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button variant="ghost" size="sm" aria-label={`Histórico de ${contato.nome}`}>
                      Histórico
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Editar ${contato.nome}`}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <p className="caption text-ink-faint">1–7 de 124 contatos</p>
      </div>
      {ficha && (
        <FichaContato
          contato={contatos[0]}
          aoAmpliar={aoAmpliar}
          aoFechar={aoFecharFicha}
          fotoGrande={fotoGrande}
        />
      )}
    </>
  )
}

// A ficha do contato é a janela de cadastro/edição (ContactSheet). A foto fica no
// topo, com o nome; clicar nela abre a foto grande.
function FichaContato({
  contato,
  aoAmpliar,
  aoFechar,
  fotoGrande,
}: {
  contato: Contato
  aoAmpliar: (contato: Contato) => void
  aoFechar: () => void
  fotoGrande?: ReactNode
}) {
  return (
    <FormDialog
      open
      onOpenChange={(aberta) => !aberta && aoFechar()}
      title="Editar contato"
      submitLabel="Salvar"
      pending={false}
      extra={fotoGrande}
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex items-center gap-3 border-b border-line-soft pb-4">
        <FotoContato contato={contato} tamanho={64} aoAmpliar={() => aoAmpliar(contato)} />
        <div className="min-w-0">
          <p className="body-strong truncate">{contato.nome}</p>
          <p className="caption text-ink-soft">Foto do perfil no WhatsApp</p>
          <p className="caption text-ink-faint">Clique na foto para ver maior.</p>
        </div>
      </div>
      <Field>
        <FieldLabel htmlFor="ficha-nome">Nome</FieldLabel>
        <Input id="ficha-nome" defaultValue={contato.nome} />
      </Field>
      <Field>
        <FieldLabel htmlFor="ficha-telefone">Telefone (WhatsApp)</FieldLabel>
        <Input id="ficha-telefone" className="mono-num" defaultValue={fone(contato.telefone)} />
      </Field>
      <Field>
        <FieldLabel htmlFor="ficha-orgao">Órgão</FieldLabel>
        <Input id="ficha-orgao" defaultValue={contato.orgao ?? ''} />
      </Field>
    </FormDialog>
  )
}

// --- montagem --------------------------------------------------------------

const titulos: Record<Estado, string> = {
  misto: 'Misto: foto, iniciais e ícone',
  foto: 'Todos com foto',
  iniciais: 'Todos com iniciais',
  icone: 'Nome é o telefone (ícone)',
}

const params = new URLSearchParams(window.location.search)
const telaParam = (params.get('tela') ?? 'chamados') as Tela
const estadoParam = (params.get('estado') ?? 'misto') as Estado
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

export default function Prototype482() {
  const [tela, setTela] = useState<Tela>(telaParam)
  const [estado, setEstado] = useState<Estado>(estadoParam)
  const [tema, setTema] = useState<Tema>(temaParam)
  const [ficha, setFicha] = useState(telaParam === 'ficha')
  const [ampliada, setAmpliada] = useState<Contato | null>(null)
  const contatos = noEstado(estado)

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  // A ficha sempre abre por cima da tela Contatos; o parâmetro tela=ficha é só um atalho.
  const telaVisivel: Tela = tela === 'ficha' ? 'contatos' : tela
  const fotoGrande = ampliada ? (
    <FotoGrande contato={ampliada} aberta aoFechar={() => setAmpliada(null)} />
  ) : null

  return (
    <>
      <Shell
        ativo={
          telaVisivel === 'atendimentos'
            ? 'Atendimentos'
            : telaVisivel === 'contatos'
              ? 'Contatos'
              : 'Chamados'
        }
        tema={tema}
      >
        {telaVisivel === 'atendimentos' ? (
          <TelaAtendimentos contatos={contatos} aoAmpliar={setAmpliada} />
        ) : telaVisivel === 'contatos' ? (
          <TelaContatos
            contatos={contatos}
            aoAmpliar={setAmpliada}
            ficha={tela === 'ficha' && ficha}
            aoFecharFicha={() => setFicha(false)}
            fotoGrande={fotoGrande}
          />
        ) : (
          <TelaChamados contatos={contatos} aoAmpliar={setAmpliada} />
        )}
      </Shell>

      {telaVisivel !== 'contatos' && fotoGrande}

      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #482</strong>
          <label className="flex items-center gap-1">
            Tela
            <select
              aria-label="Tela"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tela}
              onChange={(event) => {
                const proxima = event.target.value as Tela
                setTela(proxima)
                setFicha(proxima === 'ficha')
              }}
            >
              <option value="chamados">Chamados</option>
              <option value="atendimentos">Atendimentos</option>
              <option value="contatos">Contatos</option>
              <option value="ficha">Ficha do contato</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Estado
            <select
              aria-label="Estado"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={estado}
              onChange={(event) => setEstado(event.target.value as Estado)}
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
              onChange={(event) => setTema(event.target.value as Tema)}
            >
              <option value="claro">Claro</option>
              <option value="escuro">Escuro</option>
              <option value="contraste">Alto contraste</option>
            </select>
          </label>
          <span className="text-ink-faint">Uma proposta; nos estados, o mesmo contato.</span>
        </div>
      )}
    </>
  )
}

function Shell({
  ativo,
  tema,
  children,
}: {
  ativo: 'Chamados' | 'Atendimentos' | 'Contatos'
  tema: Tema
  children: ReactNode
}) {
  const item = (nome: string) => (
    <p
      className={cn(
        'rounded-(--radius-7) px-2 py-2',
        ativo === nome ? 'bg-accent-soft font-medium text-accent-strong' : undefined,
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
      <header className="flex h-(--header-height) shrink-0 items-center gap-2.5 border-b border-line bg-card px-2 md:px-4">
        <img src={tema === 'escuro' ? symbolDark : symbol} alt="" className="size-8 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="body-strong truncate">GCASPP</p>
          <p className="caption truncate text-ink-soft">Central de Atendimento</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Notificações">
          <Bell strokeWidth={1.7} aria-hidden />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-(--sidebar-width) shrink-0 flex-col gap-1 border-r border-line bg-card px-3 py-4 text-sm md:flex">
          {item('Dashboard')}
          <p className="overline px-2 pt-4 pb-1 text-ink-faint">Helpdesk</p>
          {item('Atendimentos')}
          {item('Chamados')}
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
