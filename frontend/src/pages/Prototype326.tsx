// PROTÓTIPO #326 — descartável, não vai para a main.
// Plano: três versões da janela "Enviar contato" (menu do anexo com "Arquivo" e
// "Contato"), switcháveis por `?variant=`, na tela de Chamados com a conversa aberta.
// Parâmetros de URL para as capturas:
//   ?prototype=326&variant=A|B|C&estado=menu|busca|previa|enviado&tema=claro|escuro|contraste&captura=1
// Dados fictícios. A barra inferior troca versão, estado e tema; fora das capturas.
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { Bell, Check, Contact, Paperclip, SendHorizontal, Settings2, UserRound } from 'lucide-react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchBox } from '@/components/SearchBox'
import { formatPhone, organizationLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

// --- dados fictícios -------------------------------------------------------

type Contato = {
  id: number
  name: string
  phones: string[]
  organization: string | null
  municipality: string | null
  sector: string
}

const contatos: Contato[] = [
  {
    id: 1,
    name: 'João Pereira',
    phones: ['5519988881234'],
    organization: 'Secretaria de Educação',
    municipality: 'Campinas',
    sector: 'Suporte Sistemas',
  },
  {
    id: 2,
    name: 'Ana Beatriz Nunes',
    phones: ['5519997774321', '551933334444'],
    organization: 'Departamento de Compras',
    municipality: 'Campinas',
    sector: 'Suporte Sistemas',
  },
  {
    id: 3,
    name: 'Ana Paula Ribeiro',
    phones: ['5519991112233'],
    organization: 'Departamento de Compras',
    municipality: 'Campinas',
    sector: 'Suporte Sistemas',
  },
  {
    id: 4,
    name: 'Carlos Eduardo Lima',
    phones: ['5519996662211'],
    organization: 'Secretaria de Administração',
    municipality: 'Hortolândia',
    sector: 'Suporte Sistemas',
  },
  {
    id: 5,
    name: 'Patrícia Gomes',
    phones: ['5519992221100'],
    organization: 'Secretaria de Meio Ambiente',
    municipality: 'Campinas',
    sector: 'Suporte Sistemas',
  },
  {
    id: 6,
    name: 'Marcos Vinícius Amaral',
    phones: ['5519993338899'],
    organization: 'Secretaria de Saúde',
    municipality: 'Sumaré',
    sector: 'Licitações',
  },
  {
    id: 7,
    name: 'Roberto Almeida',
    phones: ['5519994441122'],
    organization: 'Ouvidoria Municipal',
    municipality: 'Valinhos',
    sector: 'Licitações',
  },
  {
    // Sem telefone e sem cadastro: não aparece na busca do cartão.
    id: 8,
    name: 'Fernanda Souza',
    phones: [],
    organization: null,
    municipality: null,
    sector: 'Suporte Sistemas',
  },
]

const meuSetor = 'Suporte Sistemas'

// --- conversa --------------------------------------------------------------

type Cartao = {
  name: string
  phones: string[]
  organization: string | null
  municipality: string | null
}

type Entry =
  | {
      kind: 'message'
      at: string
      direction: 'inbound' | 'outbound'
      type?: 'text' | 'contact'
      body?: string
      cards?: Cartao[]
      status?: 'Enviando' | 'Enviada'
    }
  | { kind: 'log'; at: string; text: string }

const conversa: Entry[] = [
  {
    kind: 'message',
    at: '09:39',
    direction: 'inbound',
    body: 'Bom dia! Preciso falar com quem cuida do transporte escolar, do outro órgão.',
  },
  { kind: 'log', at: '09:41', text: 'Chamado assumido por você' },
  {
    kind: 'message',
    at: '09:42',
    direction: 'outbound',
    body: 'Bom dia, Maria! Vou passar o contato do responsável lá.',
  },
  {
    kind: 'message',
    at: '09:45',
    direction: 'inbound',
    body: 'Obrigada!',
  },
]

// Lista de "Meus chamados", para a tela ficar como a real.
const meusChamados = [
  {
    id: 1,
    contact: 'Maria Oliveira',
    preview: '👤 João Pereira',
    at: '09:51',
    protocol: '2026-000123',
    mine: true,
  },
  {
    id: 2,
    contact: 'Fernando Alves',
    preview: '👤 Ana Beatriz Nunes',
    at: '09:38',
    protocol: '2026-000121',
  },
  {
    id: 3,
    contact: 'Carla Souza',
    preview: 'Você tem o número do protocolo anterior?',
    at: '09:22',
    protocol: '2026-000118',
  },
]

// --- cartão de contato (design aprovado em #325) ---------------------------

function ContactCard({ card, outbound }: { card: Cartao; outbound: boolean }) {
  const org = card.organization && organizationLabel(card.organization, card.municipality)
  return (
    <div
      role="group"
      aria-label={`Contato: ${card.name}, ${card.phones.map(formatPhone).join(', ')}`}
      className={cn(
        'flex w-72 max-w-full items-start gap-2.5 rounded-(--radius-8) border px-2.5 py-2',
        outbound ? 'border-line-soft bg-card text-foreground' : 'border-line-soft bg-muted',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          outbound
            ? 'bg-accent-soft text-accent-strong'
            : 'border border-line-soft bg-card text-accent-strong',
        )}
      >
        <Contact strokeWidth={1.7} className="size-[17px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="body-strong break-words">{card.name}</p>
        {org && <p className="caption break-words text-ink-soft">{org}</p>}
        <div className="flex flex-col">
          {card.phones.map((phone) => (
            <span key={phone} className={cn('mono-num', outbound ? 'text-ink-soft' : 'text-ink')}>
              {formatPhone(phone)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Bubble({ entry }: { entry: Entry }) {
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
  const contact = entry.type === 'contact'
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
          'flex min-w-0 flex-col gap-1 rounded-(--radius-12) border',
          contact ? 'p-2' : 'px-3 py-2',
          outbound
            ? 'rounded-br-(--radius-6) border-primary bg-primary text-primary-foreground'
            : 'rounded-bl-(--radius-6) border-line bg-card',
        )}
      >
        {contact ? (
          <div className="flex flex-col gap-1.5">
            {entry.cards?.map((card) => (
              <ContactCard key={card.name} card={card} outbound={outbound} />
            ))}
          </div>
        ) : (
          entry.body && <p className="whitespace-pre-wrap break-words">{entry.body}</p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={cn(
              'mono-num caption',
              outbound ? 'text-primary-foreground' : 'text-ink-soft',
            )}
          >
            {entry.at}
          </span>
          {entry.status && (
            <span className="caption font-medium text-primary-foreground">· {entry.status}</span>
          )}
        </div>
      </div>
    </li>
  )
}

// --- busca no cadastro -----------------------------------------------------

type Filtros = { setor: string; municipio: string; orgao: string }

function normaliza(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

// Só contatos cadastrados com telefone, como a ação de envio aceita.
function buscar(query: string, filtros: Filtros) {
  const termo = normaliza(query.trim())
  return contatos
    .filter((contato) => contato.phones.length > 0)
    .filter((contato) => {
      if (filtros.setor === 'todos') return true
      return contato.sector === meuSetor
    })
    .filter((contato) => !filtros.municipio || contato.municipality === filtros.municipio)
    .filter((contato) => !filtros.orgao || contato.organization === filtros.orgao)
    .filter((contato) => {
      if (termo === '') return true
      return [
        contato.name,
        ...contato.phones,
        formatPhone(contato.phones[0]),
        contato.organization ?? '',
        contato.municipality ?? '',
      ].some((value) => normaliza(value).includes(termo))
    })
}

function FiltrosDeContato({
  filtros,
  onChange,
}: {
  filtros: Filtros
  onChange: (filtros: Filtros) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select
        items={[
          { value: 'meu-setor', label: 'Meu setor' },
          { value: 'todos', label: 'Todos os setores' },
        ]}
        value={filtros.setor}
        onValueChange={(value) => value && onChange({ ...filtros, setor: value })}
      >
        <SelectTrigger aria-label="Filtrar por setor" className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="meu-setor">Meu setor</SelectItem>
          <SelectItem value="todos">Todos os setores</SelectItem>
        </SelectContent>
      </Select>
      <Select
        items={[
          { value: 'todos', label: 'Todos os municípios' },
          { value: 'Campinas', label: 'Campinas' },
          { value: 'Hortolândia', label: 'Hortolândia' },
          { value: 'Sumaré', label: 'Sumaré' },
          { value: 'Valinhos', label: 'Valinhos' },
        ]}
        value={filtros.municipio || 'todos'}
        onValueChange={(value) =>
          value && onChange({ ...filtros, municipio: value === 'todos' ? '' : value })
        }
      >
        <SelectTrigger aria-label="Filtrar por município" className="w-[200px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os municípios</SelectItem>
          <SelectItem value="Campinas">Campinas</SelectItem>
          <SelectItem value="Hortolândia">Hortolândia</SelectItem>
          <SelectItem value="Sumaré">Sumaré</SelectItem>
          <SelectItem value="Valinhos">Valinhos</SelectItem>
        </SelectContent>
      </Select>
      <Select
        items={[
          { value: 'todos', label: 'Todos os órgãos' },
          { value: 'Secretaria de Educação', label: 'Secretaria de Educação' },
          { value: 'Departamento de Compras', label: 'Departamento de Compras' },
          { value: 'Secretaria de Administração', label: 'Secretaria de Administração' },
        ]}
        value={filtros.orgao || 'todos'}
        onValueChange={(value) =>
          value && onChange({ ...filtros, orgao: value === 'todos' ? '' : value })
        }
      >
        <SelectTrigger aria-label="Filtrar por órgão" className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os órgãos</SelectItem>
          <SelectItem value="Secretaria de Educação">Secretaria de Educação</SelectItem>
          <SelectItem value="Departamento de Compras">Departamento de Compras</SelectItem>
          <SelectItem value="Secretaria de Administração">Secretaria de Administração</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

// Uma linha da lista: nome, telefone e órgão com o município, para não confundir homônimos.
function LinhaContato({
  contato,
  selected,
  onChoose,
  marcador,
}: {
  contato: Contato
  selected: boolean
  onChoose: () => void
  marcador?: 'nenhum' | 'check' | 'none'
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-pressed={selected}
      className={cn(
        'flex w-full min-w-0 items-start gap-2 rounded-(--radius-7) px-2 py-2 text-left transition-colors',
        selected ? 'bg-accent-soft' : 'hover:bg-muted',
      )}
    >
      {marcador === 'check' && (
        <span
          aria-hidden
          className={cn(
            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
            selected ? 'border-primary bg-primary text-primary-foreground' : 'border-line',
          )}
        >
          {selected && <Check strokeWidth={1.7} className="size-3" />}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="body-strong truncate">{contato.name}</span>
        <span className="caption truncate text-ink-soft">
          <span className="mono-num">{formatPhone(contato.phones[0])}</span>
          {contato.phones.length > 1 && ` · +${contato.phones.length - 1}`}
          {' · '}
          {contato.organization
            ? organizationLabel(contato.organization, contato.municipality)
            : 'Não cadastrado'}
        </span>
      </span>
    </button>
  )
}

function ListaContatos({
  contatos: itens,
  selectedId,
  onChoose,
  marcador = 'nenhum',
}: {
  contatos: Contato[]
  selectedId: number | null
  onChoose: (contato: Contato) => void
  marcador?: 'nenhum' | 'check'
}) {
  if (itens.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <UserRound strokeWidth={1.7} aria-hidden />
        </EmptyMedia>
        <EmptyDescription>Nenhum contato encontrado.</EmptyDescription>
      </Empty>
    )
  }
  return (
    <ul aria-label="Contatos" className="flex flex-col divide-y divide-line-soft">
      {itens.map((contato) => (
        <li key={contato.id}>
          <LinhaContato
            contato={contato}
            selected={selectedId === contato.id}
            marcador={marcador}
            onChoose={() => onChoose(contato)}
          />
        </li>
      ))}
    </ul>
  )
}

// A prévia mostra o cartão como o cliente recebe.
function Previa({ contato }: { contato: Contato }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="label text-ink-soft">Como o cliente recebe</p>
        <ContactCard card={{ ...contato }} outbound />
      </div>
      <p className="caption text-ink-soft">
        O cartão sai pelo número do setor, sem legenda, como o áudio. O cliente toca para conversar
        ou salvar.
      </p>
    </div>
  )
}

// --- versões da janela -----------------------------------------------------

// A — duas etapas, uma coluna: a prévia toma o lugar da busca na mesma janela.
function VarianteA({
  etapa,
  contato,
  onEtapa,
  onContato,
  onClose,
  onEnviar,
  enviando,
}: {
  etapa: 'busca' | 'previa'
  contato: Contato | null
  onEtapa: (etapa: 'busca' | 'previa') => void
  onContato: (contato: Contato) => void
  onClose: () => void
  onEnviar: () => void
  enviando: boolean
}) {
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Enviar contato</DialogTitle>
          <DialogDescription>
            {etapa === 'busca'
              ? 'Busque no cadastro de Órgãos e contatos. O cartão sai pelo número do setor.'
              : 'Confira o cartão antes de enviar.'}
          </DialogDescription>
        </DialogHeader>
        <div data-slot="dialog-body" className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">
          {etapa === 'busca' ? (
            <Busca onContato={onContato} />
          ) : (
            contato && <Previa contato={contato} />
          )}
        </div>
        <DialogFooter>
          {etapa === 'previa' && (
            <Button variant="ghost" onClick={() => onEtapa('busca')}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {etapa === 'previa' && (
            <Button disabled={enviando} onClick={onEnviar}>
              Enviar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// A busca: termo e filtros em cima, resultados embaixo.
function Busca({ onContato }: { onContato: (contato: Contato) => void }) {
  const [query, setQuery] = useState('')
  const [filtros, setFiltros] = useState<Filtros>({ setor: 'meu-setor', municipio: '', orgao: '' })
  const itens = buscar(query, filtros)
  return (
    <div className="flex flex-col gap-3">
      <SearchBox
        value={query}
        onChange={setQuery}
        label="Buscar contato"
        placeholder="Nome, telefone ou órgão"
      />
      <FiltrosDeContato filtros={filtros} onChange={setFiltros} />
      <ListaContatos contatos={itens} selectedId={null} onChoose={onContato} />
    </div>
  )
}

// B — janela larga, duas colunas: a lista continua à vista e a prévia acompanha a escolha.
function VarianteB({
  contato,
  onContato,
  onClose,
  onEnviar,
  enviando,
}: {
  contato: Contato | null
  onContato: (contato: Contato) => void
  onClose: () => void
  onEnviar: () => void
  enviando: boolean
}) {
  const [query, setQuery] = useState('')
  const [filtros, setFiltros] = useState<Filtros>({ setor: 'meu-setor', municipio: '', orgao: '' })
  const itens = buscar(query, filtros)
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[900px]">
        <DialogHeader>
          <DialogTitle>Enviar contato</DialogTitle>
          <DialogDescription>
            Escolha o contato à esquerda e confira o cartão à direita. O cartão sai pelo número do
            setor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]">
          <div
            data-slot="dialog-body"
            className="flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-line-soft px-5 py-[18px]"
          >
            <SearchBox
              value={query}
              onChange={setQuery}
              label="Buscar contato"
              placeholder="Nome, telefone ou órgão"
            />
            <FiltrosDeContato filtros={filtros} onChange={setFiltros} />
            <ListaContatos
              contatos={itens}
              selectedId={contato?.id ?? null}
              onChoose={onContato}
              marcador="check"
            />
          </div>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 py-[18px]">
            <p className="overline text-ink-faint">Prévia</p>
            {contato ? (
              <>
                <p className="label text-ink-soft">Como o cliente recebe</p>
                <ContactCard card={{ ...contato }} outbound />
                <p className="caption text-ink-soft">
                  Sem legenda, como o áudio. O cliente toca para conversar ou salvar.
                </p>
              </>
            ) : (
              <p className="caption text-ink-soft">
                Escolha um contato na lista para ver como o cartão chega ao cliente.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!contato || enviando} onClick={onEnviar}>
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// C — um passo: a prévia abre dentro da própria linha, e a lista continua como contexto.
function VarianteC({
  contato,
  onContato,
  onClose,
  onEnviar,
  enviando,
}: {
  contato: Contato | null
  onContato: (contato: Contato | null) => void
  onClose: () => void
  onEnviar: () => void
  enviando: boolean
}) {
  const [query, setQuery] = useState('')
  const [filtros, setFiltros] = useState<Filtros>({ setor: 'meu-setor', municipio: '', orgao: '' })
  const itens = buscar(query, filtros)
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[520px]">
        <DialogHeader>
          <DialogTitle>Enviar contato</DialogTitle>
          <DialogDescription>
            Escolha o contato. A prévia abre na própria linha, para conferir e enviar.
          </DialogDescription>
        </DialogHeader>
        <div data-slot="dialog-body" className="min-h-0 flex-1 overflow-y-auto px-5 py-[18px]">
          <div className="flex flex-col gap-3">
            <SearchBox
              value={query}
              onChange={setQuery}
              label="Buscar contato"
              placeholder="Nome, telefone ou órgão"
            />
            <FiltrosDeContato filtros={filtros} onChange={setFiltros} />
            {itens.length === 0 ? (
              <ListaContatos contatos={itens} selectedId={null} onChoose={() => {}} />
            ) : (
              <ul aria-label="Contatos" className="flex flex-col divide-y divide-line-soft">
                {itens.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 py-1">
                    <LinhaContato
                      contato={item}
                      selected={contato?.id === item.id}
                      marcador="none"
                      onChoose={() => onContato(contato?.id === item.id ? null : item)}
                    />
                    {contato?.id === item.id && (
                      <div className="flex flex-col gap-2 rounded-(--radius-8) border border-line-soft bg-muted/60 px-3 py-3">
                        <p className="label text-ink-soft">Como o cliente recebe</p>
                        <ContactCard card={{ ...item }} outbound />
                        <p className="caption text-ink-soft">
                          Sem legenda, como o áudio. O cliente toca para conversar ou salvar.
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => onContato(null)}>
                            Voltar
                          </Button>
                          <Button size="sm" disabled={enviando} onClick={onEnviar}>
                            Enviar
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- tela ------------------------------------------------------------------

type Variant = 'A' | 'B' | 'C'
type Estado = 'menu' | 'busca' | 'previa' | 'enviado'
type Tema = 'claro' | 'escuro' | 'contraste'

const params = new URLSearchParams(window.location.search)
const variantParam = (params.get('variant') ?? 'A') as Variant
const estadoParam = (params.get('estado') ?? 'busca') as Estado
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

const titulos: Record<Variant, string> = {
  A: 'Duas etapas, uma coluna',
  B: 'Duas colunas, prévia ao lado',
  C: 'Prévia na própria linha',
}

export default function Prototype326() {
  const [variant, setVariant] = useState<Variant>(variantParam)
  const [estado, setEstado] = useState<Estado>(estadoParam)
  const [tema, setTema] = useState<Tema>(temaParam)
  const [contato, setContato] = useState<Contato | null>(
    estadoParam === 'previa' ? contatos[1] : null,
  )
  const [entradas, setEntradas] = useState<Entry[]>(
    estadoParam === 'enviado'
      ? [
          ...conversa,
          {
            kind: 'message',
            at: '09:47',
            direction: 'outbound',
            type: 'contact',
            cards: [contatos[1]],
            status: 'Enviada',
          },
        ]
      : conversa,
  )
  const [enviando, setEnviando] = useState(false)
  const [menuAberto, setMenuAberto] = useState(estadoParam === 'menu')
  const lista = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  const janelaAtendimentos = false

  const aberta = estado === 'busca' || estado === 'previa'

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight })
  }, [entradas])

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  useEffect(() => {
    if (estado === 'enviado') {
      campo.current?.focus()
    }
  }, [estado])

  const abrir = (inicial: Estado) => {
    setContato(inicial === 'previa' ? contatos[1] : null)
    setEstado(inicial)
  }

  const fechar = () => {
    setEstado('menu')
    setMenuAberto(false)
    // O foco volta ao campo de mensagem ao fechar a janela.
    requestAnimationFrame(() => campo.current?.focus())
  }

  const enviar = () => {
    if (!contato) return
    setEnviando(true)
    const novo: Entry = {
      kind: 'message',
      at: '09:47',
      direction: 'outbound',
      type: 'contact',
      cards: [contato],
      status: 'Enviando',
    }
    setEntradas((atual) => [...atual, novo])
    setEstado('enviado')
    setEnviando(false)
    requestAnimationFrame(() => campo.current?.focus())
    window.setTimeout(() => {
      setEntradas((atual) =>
        atual.map((entry) =>
          entry.kind === 'message' && entry.status === 'Enviando'
            ? { ...entry, status: 'Enviada' }
            : entry,
        ),
      )
    }, 900)
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
                <p className="caption text-ink-faint">
                  {janelaAtendimentos
                    ? 'Suporte Sistemas · 2026-000123'
                    : 'Chamados · Suporte Sistemas · 2026-000123'}
                </p>
                <h1 className="title-page truncate">Maria Oliveira</h1>
                <p className="caption text-ink-soft">(19) 99999-0001</p>
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
                <CardHeader>
                  <CardTitle id="meus">Meus chamados ({meusChamados.length})</CardTitle>
                </CardHeader>
                <nav aria-label="Meus chamados" className="flex-1 overflow-y-auto">
                  <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                    {meusChamados.map((ticket) => (
                      <li key={ticket.id}>
                        <div
                          className={cn(
                            'flex flex-col gap-1 border-l-3 px-4 py-2.5',
                            ticket.mine ? 'border-primary bg-accent-soft' : 'border-transparent',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className="body-strong min-w-0 flex-1 truncate">
                              {ticket.contact}
                            </span>
                            <span className="mono-num caption text-ink-soft">{ticket.at}</span>
                          </span>
                          <span className="caption truncate text-ink-soft">{ticket.preview}</span>
                          <span className="mono-num caption text-ink-faint">{ticket.protocol}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </nav>
              </Card>

              <Card role="region" aria-label="Conversa" className="relative min-h-0">
                <div
                  ref={lista}
                  className="flex-1 overflow-y-auto border-y border-line-soft bg-background px-4 py-4"
                >
                  <ol className="flex flex-col gap-2">
                    {entradas.map((entry, i) => (
                      <Bubble key={`${entry.kind}-${i}-${entry.at}`} entry={entry} />
                    ))}
                  </ol>
                </div>
                <div className="shrink-0 border-t border-line-soft p-4">
                  <div className="flex items-end gap-2">
                    <input type="file" className="hidden" aria-label="Arquivo para enviar" />
                    <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Anexar arquivo"
                            aria-haspopup="menu"
                          />
                        }
                      >
                        <Paperclip strokeWidth={1.7} aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="top" align="start" className="min-w-44">
                        <DropdownMenuItem onClick={() => setMenuAberto(false)}>
                          <Paperclip strokeWidth={1.7} aria-hidden />
                          Arquivo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setMenuAberto(false)
                            abrir('busca')
                          }}
                        >
                          <Contact strokeWidth={1.7} aria-hidden />
                          Contato
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <textarea
                      ref={campo}
                      aria-label="Mensagem"
                      placeholder="Escreva a mensagem"
                      rows={1}
                      className="max-h-40 min-h-9 flex-1 resize-none rounded-(--radius-7) border border-input bg-card px-3 py-2 text-[calc(14px*var(--text-scale))] outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
                    />
                    <Button aria-label="Enviar mensagem" size="icon">
                      <SendHorizontal strokeWidth={1.7} aria-hidden />
                    </Button>
                  </div>
                </div>
              </Card>

              <Card role="region" aria-labelledby="fila" className="min-h-0">
                <CardHeader>
                  <CardTitle id="fila">Fila</CardTitle>
                </CardHeader>
                <nav aria-label="Fila" className="flex-1 overflow-y-auto">
                  <ul className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
                    {[
                      {
                        id: 5,
                        contact: 'Fernanda Lima',
                        preview: '👤 Carlos Eduardo Lima',
                        at: 'há 12 min',
                        protocol: '2026-000126',
                      },
                      {
                        id: 6,
                        contact: 'Paulo Henrique',
                        preview: 'Bom dia, preciso de ajuda com o alvará.',
                        at: 'há 25 min',
                        protocol: '2026-000124',
                      },
                    ].map((ticket) => (
                      <li key={ticket.id} className="relative flex flex-col gap-1 px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="body-strong min-w-0 flex-1 truncate">
                            {ticket.contact}
                          </span>
                          <span className="mono-num caption text-ink-soft">{ticket.at}</span>
                        </span>
                        <span className="caption truncate text-ink-soft">{ticket.preview}</span>
                        <span className="mono-num caption text-ink-faint">{ticket.protocol}</span>
                        <div className="pt-1">
                          <Button variant="outline" size="sm">
                            Assumir
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </nav>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {aberta && variant === 'A' && (
        <VarianteA
          etapa={estado === 'previa' ? 'previa' : 'busca'}
          contato={contato}
          onEtapa={(etapa) => setEstado(etapa)}
          onContato={(chosen) => {
            setContato(chosen)
            setEstado('previa')
          }}
          onClose={fechar}
          onEnviar={enviar}
          enviando={enviando}
        />
      )}
      {aberta && variant === 'B' && (
        <VarianteB
          contato={contato}
          onContato={setContato}
          onClose={fechar}
          onEnviar={enviar}
          enviando={enviando}
        />
      )}
      {aberta && variant === 'C' && (
        <VarianteC
          contato={contato}
          onContato={setContato}
          onClose={fechar}
          onEnviar={enviar}
          enviando={enviando}
        />
      )}

      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #326</strong>
          <span className="text-ink-soft">{titulos[variant]}</span>
          <span className="flex items-center gap-1">
            Versão
            <select
              aria-label="Versão"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={variant}
              onChange={(e) => {
                setVariant(e.target.value as Variant)
                setContato(e.target.value === 'A' ? null : contatos[1])
                setEstado('busca')
              }}
            >
              <option value="A">A — duas etapas</option>
              <option value="B">B — duas colunas</option>
              <option value="C">C — prévia na linha</option>
            </select>
          </span>
          <span className="flex items-center gap-1">
            Estado
            <select
              aria-label="Estado"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={estado}
              onChange={(e) => {
                const next = e.target.value as Estado
                setMenuAberto(next === 'menu')
                if (next === 'busca') abrir('busca')
                else if (next === 'previa') abrir('previa')
                else setEstado(next)
              }}
            >
              <option value="menu">Menu do anexo</option>
              <option value="busca">Busca</option>
              <option value="previa">Prévia</option>
              <option value="enviado">Enviado</option>
            </select>
          </span>
          <label className="flex items-center gap-1">
            Tema
            <select
              aria-label="Tema"
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
