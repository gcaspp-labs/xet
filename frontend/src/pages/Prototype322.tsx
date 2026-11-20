// PROTÓTIPO #322 — descartável, não vai para a main.
// Plano: três versões da janela "Registrar atendimento por telefone" na tela
// Atendimentos, trocáveis por ?variant. Dados fictícios.
//   ?prototype=322&variant=A|B|C&etapa=contato|atendimento
//   &estado=salvo|erro&tema=claro|escuro|contraste&captura=1
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Phone,
  Plus,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/glab-simbolo-escuro.svg'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
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
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

type Tema = 'claro' | 'escuro' | 'contraste'
type Variante = 'A' | 'B' | 'C'

const params = new URLSearchParams(window.location.search)
const temaParam = (params.get('tema') ?? 'claro') as Tema
const captura = params.get('captura') === '1'

// ------------------------------------------------------------------ dados

type Contato = {
  id: number
  nome: string
  telefone: string
  orgao: string
  modulo: number
}

const contatos: Contato[] = [
  {
    id: 1,
    nome: 'Maria Oliveira',
    telefone: '(11) 98888-1234',
    orgao: 'Prefeitura Municipal de Serra Azul · Serra Azul',
    modulo: 2,
  },
  {
    id: 2,
    nome: 'João da Silva',
    telefone: '(11) 97777-4321',
    orgao: 'Câmara Municipal de Vila Nova · Vila Nova',
    modulo: 1,
  },
  {
    id: 3,
    nome: 'Fernanda Lima',
    telefone: '(11) 96666-2210',
    orgao: 'Secretaria de Educação de Serra Azul · Serra Azul',
    modulo: 3,
  },
  {
    id: 4,
    nome: 'Carlos Pereira',
    telefone: '(11) 95555-8899',
    orgao: 'Não cadastrado',
    modulo: 2,
  },
]

const modulos = [
  { id: 1, nome: 'Portal do Cidadão' },
  { id: 2, nome: 'Tributos' },
  { id: 3, nome: 'Protocolo' },
]

const assuntos = [
  {
    nome: 'Certidão negativa',
    modulo: 'Tributos',
    solucoes: [
      'Certidão emitida depois do ajuste do convênio do órgão.',
      'Orientado a gerar novamente em 10 minutos e confirmar por telefone.',
    ],
  },
  {
    nome: 'Senha de acesso',
    modulo: 'Portal do Cidadão',
    solucoes: ['Senha redefinida e enviada no e-mail do cadastro.'],
  },
  {
    nome: 'Boleto não gerado',
    modulo: 'Tributos',
    solucoes: ['Segunda via emitida e enviada por e-mail.'],
  },
]

const setores = ['Suporte Sistemas', 'Tributos Municipais', 'Protocolo Geral']

type Linha = {
  protocolo: string
  data: string
  contato: string
  telefone: string
  orgao: string
  responsavel: string
  assunto: string
  modulo: string
  situacao: 'Encerrado' | 'Transferido' | 'Cancelado'
  canal?: 'Telefone'
}

const linhasIniciais: Linha[] = [
  {
    protocolo: '2026-000131',
    data: '20/11/2026 15:41',
    contato: 'Roberto Nunes',
    telefone: '(11) 95555-0101',
    orgao: 'Prefeitura Municipal de Serra Azul',
    responsavel: 'Ana Prado',
    assunto: 'Boleto não gerado',
    modulo: 'Tributos',
    situacao: 'Encerrado',
  },
  {
    protocolo: '2026-000130',
    data: '20/11/2026 14:02',
    contato: 'Fernanda Lima',
    telefone: '(11) 96666-2210',
    orgao: 'Secretaria de Educação de Serra Azul',
    responsavel: 'Bruno Salles',
    assunto: 'Senha de acesso',
    modulo: 'Portal do Cidadão',
    situacao: 'Encerrado',
  },
  {
    protocolo: '2026-000129',
    data: '20/11/2026 11:37',
    contato: 'Sandra Ribeiro',
    telefone: '(11) 94444-7788',
    orgao: 'Câmara Municipal de Vila Nova',
    responsavel: 'Ana Prado',
    assunto: 'Certidão negativa',
    modulo: 'Tributos',
    situacao: 'Encerrado',
  },
  {
    protocolo: '2026-000128',
    data: '20/11/2026 10:15',
    contato: 'Paulo Mendes',
    telefone: '(11) 93333-4412',
    orgao: 'Prefeitura Municipal de Serra Azul',
    responsavel: 'Carla Dias',
    assunto: 'Protocolo não encontrado',
    modulo: 'Protocolo',
    situacao: 'Encerrado',
  },
  {
    protocolo: '2026-000127',
    data: '19/11/2026 17:08',
    contato: 'João da Silva',
    telefone: '(11) 97777-4321',
    orgao: 'Câmara Municipal de Vila Nova',
    responsavel: 'Bruno Salles',
    assunto: 'Senha de acesso',
    modulo: 'Portal do Cidadão',
    situacao: 'Encerrado',
  },
]

// ------------------------------------------------------------- peças da tela

function LinhaTabela({ linha }: { linha: Linha }) {
  return (
    <TableRow>
      <TableCell className="mono-num caption whitespace-nowrap">
        <span className="body-strong">{linha.protocolo}</span>
        {linha.canal === 'Telefone' && (
          <span className="mt-1 flex items-center gap-1 text-ink-soft">
            <Phone strokeWidth={1.7} aria-hidden className="size-3" />
            Telefone
          </span>
        )}
      </TableCell>
      <TableCell className="mono-num caption whitespace-nowrap">{linha.data}</TableCell>
      <TableCell className="max-w-[120px]">
        <p className="truncate">{linha.contato}</p>
        <p className="mono-num caption text-ink-faint">{linha.telefone}</p>
      </TableCell>
      <TableCell className="max-w-[110px] truncate">{linha.orgao}</TableCell>
      <TableCell className="max-w-[100px] truncate">{linha.responsavel}</TableCell>
      <TableCell className="max-w-[110px] truncate">{linha.assunto}</TableCell>
      <TableCell>
        <Badge variant="tag" className="block max-w-[105px] truncate">
          {linha.modulo}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge tone="neutral">{linha.situacao}</Badge>
      </TableCell>
    </TableRow>
  )
}

function Filtros({
  busca,
  setBusca,
  filtroPeriodo,
  setFiltroPeriodo,
  onAbrir,
}: {
  busca: string
  setBusca: (valor: string) => void
  filtroPeriodo: string
  setFiltroPeriodo: (valor: string) => void
  onAbrir: () => void
}) {
  return (
    <div className="flex shrink-0 flex-col gap-(--space-12)">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-(--space-12)">
        <div className="relative w-full max-w-[260px]">
          <Search
            strokeWidth={1.7}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-[11px] size-[15px] -translate-y-1/2 text-ink-faint"
          />
          <Input
            type="search"
            aria-label="Buscar chamados"
            placeholder="Protocolo, contato, telefone ou órgão"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className="pl-[32px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-(--space-12)">
          <ToggleGroup
            aria-label="Período"
            value={[filtroPeriodo]}
            onValueChange={(values: string[]) => {
              const [value] = values
              if (value) setFiltroPeriodo(value)
            }}
          >
            {[
              { value: 'all', label: 'Todo o período' },
              { value: 'today', label: 'Hoje' },
              { value: '7d', label: '7 dias' },
              { value: '30d', label: '30 dias' },
              { value: 'custom', label: 'Datas' },
            ].map((escolha) => (
              <ToggleGroupItem key={escolha.value} value={escolha.value}>
                {escolha.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button onClick={onAbrir}>
            <Phone strokeWidth={1.7} aria-hidden />
            Registrar atendimento por telefone
          </Button>
        </div>
      </div>
      <div className="-m-1 flex min-h-0 flex-wrap items-end gap-(--space-12) overflow-y-auto p-1">
        {[
          { id: 'setor', label: 'Setor', value: 'Suporte Sistemas' },
          { id: 'responsavel', label: 'Responsável', value: 'Todos os responsáveis' },
          { id: 'modulo', label: 'Módulo', value: 'Todos os módulos' },
          { id: 'assunto', label: 'Assunto', value: 'Todos os assuntos' },
        ].map((filtro) => (
          <Field key={filtro.id} className="w-full sm:w-[calc(160px*var(--text-scale))]">
            <FieldLabel htmlFor={`atendimentos-${filtro.id}`}>{filtro.label}</FieldLabel>
            <Select items={[{ value: filtro.value, label: filtro.value }]} value={filtro.value}>
              <SelectTrigger id={`atendimentos-${filtro.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={filtro.value}>{filtro.value}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------- peças do formulário

type Formulario = {
  contato: Contato | null
  setor: string
  modulos: number[]
  assunto: string
  resolucao: string
  inicio: string
  fim: string
}

const inicioSugerido = '2026-11-20T15:52'
const fimSugerido = '2026-11-20T16:04'

function CampoSetor({
  valor,
  onChange,
  idPrefix,
}: {
  valor: string
  onChange: (valor: string) => void
  idPrefix: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={`${idPrefix}-setor`}>Setor</FieldLabel>
      <Select
        items={setores.map((setor) => ({ value: setor, label: setor }))}
        value={valor}
        onValueChange={(proximo) => proximo && onChange(proximo as string)}
      >
        <SelectTrigger id={`${idPrefix}-setor`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {setores.map((setor) => (
            <SelectItem key={setor} value={setor}>
              {setor}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription>
        Atendente e supervisor registram no próprio setor; só o administrador troca.
      </FieldDescription>
    </Field>
  )
}

function ResumoContato({ contato, onTrocar }: { contato: Contato; onTrocar: () => void }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-(--radius-7) border border-line bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="body-strong truncate">{contato.nome}</p>
        <p className="caption truncate text-ink-faint">
          <span className="mono-num">{contato.telefone}</span> · {contato.orgao}
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onTrocar}>
        Trocar
      </Button>
    </div>
  )
}

function ListaContatos({
  escolhido,
  onEscolher,
  className,
}: {
  escolhido: Contato | null
  onEscolher: (contato: Contato) => void
  className?: string
}) {
  const [busca, setBusca] = useState('')
  const termo = busca.trim().toLowerCase()
  const encontrados = contatos.filter(
    (contato) =>
      !termo ||
      contato.nome.toLowerCase().includes(termo) ||
      contato.telefone.replace(/\D/g, '').includes(termo.replace(/\D/g, '') || '@'),
  )
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative">
        <Search
          strokeWidth={1.7}
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-[11px] size-[15px] -translate-y-1/2 text-ink-faint"
        />
        <Input
          type="search"
          aria-label="Buscar contato"
          placeholder="Nome, município, telefone ou CNPJ"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="pl-[32px]"
        />
      </div>
      <Button type="button" variant="outline" size="sm" className="self-start">
        <Plus strokeWidth={1.7} aria-hidden />
        Novo contato
      </Button>
      <ul aria-label="Contatos" className="flex flex-col divide-y divide-line-soft">
        {encontrados.map((contato) => (
          <li key={contato.id}>
            <button
              type="button"
              onClick={() => onEscolher(contato)}
              aria-pressed={escolhido?.id === contato.id}
              className={cn(
                'w-full min-w-0 rounded-(--radius-7) px-2 py-2 text-left transition-colors hover:bg-muted',
                escolhido?.id === contato.id && 'bg-accent-soft',
              )}
            >
              <span className="body-strong block truncate">{contato.nome}</span>
              <span className="caption block truncate text-ink-faint">
                <span className="mono-num">{contato.telefone}</span> · {contato.orgao}
              </span>
            </button>
          </li>
        ))}
        {encontrados.length === 0 && (
          <li className="caption px-2 py-3 text-ink-faint">Nenhum contato encontrado.</li>
        )}
      </ul>
    </div>
  )
}

function CampoContato({
  formulario,
  setFormulario,
  erro,
  idPrefix,
}: {
  formulario: Formulario
  setFormulario: (mudanca: Partial<Formulario>) => void
  erro: boolean
  idPrefix: string
}) {
  const [buscando, setBuscando] = useState(!formulario.contato)
  return (
    <Field data-invalid={erro}>
      <FieldLabel htmlFor={`${idPrefix}-contato`}>Contato</FieldLabel>
      {formulario.contato && !buscando ? (
        <ResumoContato contato={formulario.contato} onTrocar={() => setBuscando(true)} />
      ) : (
        <ListaContatos
          escolhido={formulario.contato}
          onEscolher={(contato) => {
            setFormulario({
              contato,
              modulos: [contato.modulo],
            })
            setBuscando(false)
          }}
          className="rounded-(--radius-7) border border-line bg-surface-2 p-3"
        />
      )}
      {!erro && formulario.contato && (
        <FieldDescription>O órgão e o módulo do contato já vêm sugeridos.</FieldDescription>
      )}
      <FieldError errors={erro ? [{ message: 'Escolha o contato de quem ligou.' }] : []} />
    </Field>
  )
}

function CamposAtendimento({
  formulario,
  setFormulario,
  erros,
  idPrefix,
  colunas,
}: {
  formulario: Formulario
  setFormulario: (mudanca: Partial<Formulario>) => void
  erros: boolean
  idPrefix: string
  colunas: 1 | 2
}) {
  const assuntoEscolhido = assuntos.find(
    (assunto) => assunto.nome.toLowerCase() === formulario.assunto.trim().toLowerCase(),
  )
  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-orgao`}>Órgão</FieldLabel>
        <Input
          id={`${idPrefix}-orgao`}
          value={formulario.contato?.orgao ?? ''}
          onChange={() => undefined}
          placeholder="Busque por nome, município ou CNPJ"
        />
        <FieldDescription>Trocar o órgão vale só para este atendimento.</FieldDescription>
      </Field>

      <FieldSet data-invalid={erros && formulario.modulos.length === 0}>
        <FieldLegend variant="label">Módulos</FieldLegend>
        <div className={cn('flex flex-col gap-2', colunas === 2 && 'sm:flex-row sm:flex-wrap')}>
          {modulos.map((modulo) => (
            <label
              key={modulo.id}
              className={cn('flex items-center gap-2', colunas === 2 && 'sm:w-[calc(50%-4px)]')}
            >
              <Checkbox
                checked={formulario.modulos.includes(modulo.id)}
                onCheckedChange={(marcado) =>
                  setFormulario({
                    modulos: marcado
                      ? [...formulario.modulos, modulo.id]
                      : formulario.modulos.filter((id) => id !== modulo.id),
                  })
                }
              />
              {modulo.nome}
            </label>
          ))}
        </div>
        <FieldError
          errors={erros && formulario.modulos.length === 0 ? [{ message: 'Marque ao menos um módulo.' }] : []}
        />
      </FieldSet>

      <div className="flex flex-col gap-[15px]">
        <Field data-invalid={erros && !formulario.assunto.trim()}>
          <FieldLabel htmlFor={`${idPrefix}-assunto`}>Assunto</FieldLabel>
          <Input
            id={`${idPrefix}-assunto`}
            value={formulario.assunto}
            onChange={(event) => setFormulario({ assunto: event.target.value })}
            aria-invalid={erros && !formulario.assunto.trim()}
          />
          <FieldError
            errors={
              erros && !formulario.assunto.trim() ? [{ message: 'Informe o assunto.' }] : []
            }
          />
        </Field>
        {assuntoEscolhido && assuntoEscolhido.solucoes.length > 0 && (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-solucoes`}>Soluções sugeridas</FieldLabel>
            <Select
              items={assuntoEscolhido.solucoes.map((solucao) => ({
                value: solucao,
                label: solucao,
              }))}
              value={null}
              onValueChange={(solucao) => solucao && setFormulario({ resolucao: solucao as string })}
            >
              <SelectTrigger id={`${idPrefix}-solucoes`} className="w-full">
                <SelectValue placeholder="Escolha para preencher a resolução" />
              </SelectTrigger>
              <SelectContent>
                {assuntoEscolhido.solucoes.map((solucao) => (
                  <SelectItem key={solucao} value={solucao}>
                    <span className="line-clamp-3 min-w-0 flex-1 break-words whitespace-normal">
                      {solucao}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>

      <Field data-invalid={erros && !formulario.resolucao.trim()}>
        <FieldLabel htmlFor={`${idPrefix}-resolucao`}>Resolução</FieldLabel>
        <Textarea
          id={`${idPrefix}-resolucao`}
          value={formulario.resolucao}
          onChange={(event) => setFormulario({ resolucao: event.target.value })}
          aria-invalid={erros && !formulario.resolucao.trim()}
        />
        <FieldError
          errors={erros && !formulario.resolucao.trim() ? [{ message: 'Descreva a resolução.' }] : []}
        />
      </Field>

      <div className={cn('grid gap-[15px]', colunas === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2')}>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-inicio`}>Início</FieldLabel>
          <Input
            id={`${idPrefix}-inicio`}
            type="datetime-local"
            className="mono-num"
            value={formulario.inicio}
            onChange={(event) => setFormulario({ inicio: event.target.value })}
          />
        </Field>
        <Field data-invalid={erros}>
          <FieldLabel htmlFor={`${idPrefix}-fim`}>Fim</FieldLabel>
          <Input
            id={`${idPrefix}-fim`}
            type="datetime-local"
            className="mono-num"
            value={formulario.fim}
            onChange={(event) => setFormulario({ fim: event.target.value })}
            aria-invalid={erros}
          />
          <FieldError errors={erros ? [{ message: 'O fim não pode ser no futuro.' }] : []} />
        </Field>
      </div>
    </>
  )
}

function Divisao({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="overline text-ink-faint">{children}</span>
      <span className="h-px flex-1 bg-line-soft" />
    </div>
  )
}

// ------------------------------------------------------------ as versões

type Props = {
  formulario: Formulario
  setFormulario: (mudanca: Partial<Formulario>) => void
  erros: boolean
  aberta: boolean
  setAberta: (aberta: boolean) => void
  onRegistrar: () => void
  tema: Tema
}

function VersaoA({ formulario, setFormulario, erros, aberta, setAberta, onRegistrar }: Props) {
  return (
    <Dialog open={aberta} onOpenChange={(proxima) => setAberta(proxima)}>
      <DialogContent className="w-(--drawer-width)">
        <DialogHeader className="pr-12">
          <DialogTitle>Registrar atendimento por telefone</DialogTitle>
          <DialogDescription>
            O registro entra em Atendimentos já encerrado, com o protocolo para passar ao cliente.
          </DialogDescription>
        </DialogHeader>
        <div data-slot="dialog-body" className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-[15px] px-5 py-[18px]">
            {erros && (
              <div className="flex items-start gap-2 rounded-(--radius-7) bg-warning-soft px-3 py-2 text-[calc(13px*var(--text-scale))] text-warning-ink">
                <TriangleAlert strokeWidth={1.7} aria-hidden className="mt-px size-4 shrink-0" />
                Confira os campos marcados.
              </div>
            )}
            <CampoSetor
              idPrefix="a"
              valor={formulario.setor}
              onChange={(setor) => setFormulario({ setor })}
            />
            <CampoContato
              idPrefix="a"
              formulario={formulario}
              setFormulario={setFormulario}
              erro={erros && !formulario.contato}
            />
            <Divisao>Atendimento</Divisao>
            <CamposAtendimento
              idPrefix="a"
              formulario={formulario}
              setFormulario={setFormulario}
              erros={erros}
              colunas={1}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
          <Button onClick={onRegistrar}>Registrar atendimento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function VersaoB({
  formulario,
  setFormulario,
  erros,
  aberta,
  setAberta,
  onRegistrar,
  etapa,
  setEtapa,
}: Props & { etapa: 'contato' | 'atendimento'; setEtapa: (etapa: 'contato' | 'atendimento') => void }) {
  return (
    <Dialog open={aberta} onOpenChange={(proxima) => setAberta(proxima)}>
      <DialogContent className="w-(--drawer-width)">
        <DialogHeader className="pr-12">
          <DialogTitle>Registrar atendimento por telefone</DialogTitle>
          <DialogDescription>
            Etapa {etapa === 'contato' ? '1' : '2'} de 2 ·{' '}
            {etapa === 'contato' ? 'Quem ligou' : 'O atendimento'}
          </DialogDescription>
        </DialogHeader>
        {etapa === 'atendimento' && formulario.contato && (
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-line-soft bg-surface-2 px-5 py-3">
            <div className="min-w-0">
              <p className="body-strong truncate">{formulario.contato.nome}</p>
              <p className="caption truncate text-ink-faint">
                <span className="mono-num">{formulario.contato.telefone}</span> ·{' '}
                {formulario.setor}
              </p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEtapa('contato')}>
              Trocar
            </Button>
          </div>
        )}
        <div data-slot="dialog-body" className="min-h-0 flex-1 overflow-y-auto">
          {etapa === 'contato' ? (
            <div className="flex flex-col gap-[15px] px-5 py-[18px]">
              <CampoSetor
                idPrefix="b"
                valor={formulario.setor}
                onChange={(setor) => setFormulario({ setor })}
              />
              <Field>
                <FieldLabel htmlFor="b-contato">Contato</FieldLabel>
                <ListaContatos
                  escolhido={formulario.contato}
                  onEscolher={(contato) =>
                    setFormulario({ contato, modulos: [contato.modulo] })
                  }
                />
                <FieldDescription>
                  Precisa de um contato novo? Cadastre por aqui: ele já fica escolhido.
                </FieldDescription>
              </Field>
            </div>
          ) : (
            <div className="flex flex-col gap-[15px] px-5 py-[18px]">
              {erros && (
                <div className="flex items-start gap-2 rounded-(--radius-7) bg-warning-soft px-3 py-2 text-[calc(13px*var(--text-scale))] text-warning-ink">
                  <TriangleAlert strokeWidth={1.7} aria-hidden className="mt-px size-4 shrink-0" />
                  Confira os campos marcados.
                </div>
              )}
              <CamposAtendimento
                idPrefix="b"
                formulario={formulario}
                setFormulario={setFormulario}
                erros={erros}
                colunas={1}
              />
            </div>
          )}
        </div>
        {etapa === 'contato' ? (
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
            <Button disabled={!formulario.contato} onClick={() => setEtapa('atendimento')}>
              Continuar
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="justify-between">
            <Button variant="ghost" onClick={() => setEtapa('contato')}>
              Voltar
            </Button>
            <Button onClick={onRegistrar}>Registrar atendimento</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function VersaoC({ formulario, setFormulario, erros, aberta, setAberta, onRegistrar }: Props) {
  return (
    <Dialog open={aberta} onOpenChange={(proxima) => setAberta(proxima)}>
      <DialogContent className="w-[780px]">
        <DialogHeader className="pr-12">
          <DialogTitle>Registrar atendimento por telefone</DialogTitle>
          <DialogDescription>
            O registro entra em Atendimentos já encerrado, com o protocolo para passar ao cliente.
          </DialogDescription>
        </DialogHeader>
        <div
          data-slot="dialog-body"
          className="grid min-h-0 flex-1 grid-cols-[290px_minmax(0,1fr)] overflow-hidden"
        >
          <div className="flex min-h-0 flex-col gap-[15px] overflow-y-auto border-r border-line-soft px-5 py-[18px]">
            <CampoSetor
              idPrefix="c"
              valor={formulario.setor}
              onChange={(setor) => setFormulario({ setor })}
            />
            <Field data-invalid={erros && !formulario.contato}>
              <FieldLabel htmlFor="c-contato">Contato</FieldLabel>
              <ListaContatos
                escolhido={formulario.contato}
                onEscolher={(contato) => setFormulario({ contato, modulos: [contato.modulo] })}
              />
              <FieldError
                errors={erros && !formulario.contato ? [{ message: 'Escolha o contato de quem ligou.' }] : []}
              />
            </Field>
          </div>
          <div className="flex min-h-0 flex-col gap-[15px] overflow-y-auto px-5 py-[18px]">
            {erros && (
              <div className="flex items-start gap-2 rounded-(--radius-7) bg-warning-soft px-3 py-2 text-[calc(13px*var(--text-scale))] text-warning-ink">
                <TriangleAlert strokeWidth={1.7} aria-hidden className="mt-px size-4 shrink-0" />
                Confira os campos marcados.
              </div>
            )}
            <CamposAtendimento
              idPrefix="c"
              formulario={formulario}
              setFormulario={setFormulario}
              erros={erros}
              colunas={2}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
          <Button onClick={onRegistrar}>Registrar atendimento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const rotulos: Record<Variante, string> = {
  A: 'A (uma janela, contato no topo)',
  B: 'B (duas etapas na janela)',
  C: 'C (janela larga, duas colunas)',
}
const ordem: Variante[] = ['A', 'B', 'C']

// --------------------------------------------------------------- a página

export default function Prototype322() {
  const [variante, setVariante] = useState<Variante>(
    (['A', 'B', 'C'].includes(params.get('variant') ?? '')
      ? params.get('variant')
      : 'A') as Variante,
  )
  const [etapa, setEtapa] = useState<'contato' | 'atendimento'>(
    params.get('etapa') === 'atendimento' ? 'atendimento' : 'contato',
  )
  const [tema, setTema] = useState<Tema>(temaParam)
  const [aberta, setAberta] = useState(params.get('estado') !== 'salvo')
  const [erros, setErros] = useState(params.get('estado') === 'erro')
  const [salvo, setSalvo] = useState(params.get('estado') === 'salvo')
  const [busca, setBusca] = useState('')
  const [periodo, setPeriodo] = useState('all')
  const [formulario, setFormulario] = useState<Formulario>({
    contato: params.get('estado') === 'salvo' ? contatos[0] : null,
    setor: 'Suporte Sistemas',
    modulos: [],
    assunto: '',
    resolucao: '',
    inicio: inicioSugerido,
    fim: fimSugerido,
  })

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = tema === 'contraste' ? 'high' : 'normal'
  }, [tema])

  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('variant', variante)
    url.searchParams.set('etapa', etapa)
    window.history.replaceState(null, '', url)
  }, [variante, etapa])

  // Capturas: formulário com o que o atendente já preencheu na ligação.
  useEffect(() => {
    if (!captura || params.get('vazio') === '1') return
    setFormulario((atual) =>
      atual.contato
        ? atual
        : {
            ...atual,
            contato: contatos[0],
            modulos: [contatos[0].modulo],
            assunto: 'Certidão negativa',
            resolucao:
              'Cliente não conseguia emitir a certidão negativa pelo portal. Convênio do órgão estava desativado; reativado e orientado a gerar novamente.',
          },
    )
  }, [])

  // Capturas: rola o corpo da janela até o fim, para mostrar o rodapé do formulário.
  useEffect(() => {
    if (params.get('rolar') !== 'fim') return
    const alvo = window.setTimeout(() => {
      const corpo = document.querySelector('[data-slot="dialog-body"]')
      if (corpo) corpo.scrollTop = corpo.scrollHeight
    }, 400)
    return () => window.clearTimeout(alvo)
  }, [])

  const mudar = (mudanca: Partial<Formulario>) =>
    setFormulario((atual) => ({ ...atual, ...mudanca }))

  function registrar() {
    const faltando =
      !formulario.contato ||
      formulario.modulos.length === 0 ||
      !formulario.assunto.trim() ||
      !formulario.resolucao.trim()
    if (faltando) {
      setErros(true)
      return
    }
    setErros(false)
    setSalvo(true)
    setAberta(false)
    toast.success('Atendimento registrado · protocolo 2026-000132')
  }

  const linhas = useMemo(() => {
    if (!salvo) return linhasIniciais
    return [
      {
        protocolo: '2026-000132',
        data: '20/11/2026 16:09',
        contato: formulario.contato?.nome ?? 'Maria Oliveira',
        telefone: formulario.contato?.telefone ?? '(11) 98888-1234',
        orgao: 'Prefeitura Municipal de Serra Azul',
        responsavel: 'Ana Prado',
        assunto: formulario.assunto || 'Certidão negativa',
        modulo: 'Tributos',
        situacao: 'Encerrado' as const,
        canal: 'Telefone' as const,
      },
      ...linhasIniciais,
    ]
  }, [salvo, formulario])

  // Capturas: o aviso com o protocolo, como aparece depois de salvar.
  useEffect(() => {
    if (params.get('estado') !== 'salvo') return
    const alvo = window.setTimeout(
      () => toast.success('Atendimento registrado · protocolo 2026-000132'),
      300,
    )
    return () => window.clearTimeout(alvo)
  }, [])

  function ciclar(passo: 1 | -1) {
    const atual = ordem.indexOf(variante)
    setVariante(ordem[(atual + passo + ordem.length) % ordem.length])
  }

  // ← → trocam a versão, menos com o foco num campo de texto.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const alvo = evento.target as HTMLElement | null
      if (
        alvo &&
        (alvo.tagName === 'INPUT' ||
          alvo.tagName === 'TEXTAREA' ||
          alvo.isContentEditable ||
          alvo.closest('[role="dialog"]'))
      ) {
        return
      }
      if (evento.key === 'ArrowLeft') ciclar(-1)
      if (evento.key === 'ArrowRight') ciclar(1)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  const props: Props = {
    formulario,
    setFormulario: mudar,
    erros,
    aberta,
    setAberta,
    onRegistrar: registrar,
    tema,
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-background text-foreground"
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
          <p className="px-2 py-2">Chamados</p>
          <p className="rounded-(--radius-7) bg-accent-soft px-2 py-2 font-medium text-accent-strong">
            Atendimentos
          </p>
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
                <p className="caption text-ink-faint">Suporte Sistemas</p>
                <h1 className="title-page truncate">Atendimentos</h1>
              </div>
            </div>
          </header>
          <div className="mx-auto flex min-h-0 w-full max-w-(--content-max) flex-1 flex-col gap-4 overflow-hidden px-4 py-4 md:px-[30px] md:py-[30px]">
            <Filtros
              busca={busca}
              setBusca={setBusca}
              filtroPeriodo={periodo}
              setFiltroPeriodo={setPeriodo}
              onAbrir={() => setAberta(true)}
            />
            <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 in-data-[contrast=high]:bg-background">
                    <TableRow>
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Órgão</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Módulos</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((linha) => (
                      <LinhaTabela key={linha.protocolo} linha={linha} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </main>
      </div>

      {variante === 'A' && <VersaoA {...props} />}
      {variante === 'B' && <VersaoB {...props} etapa={etapa} setEtapa={setEtapa} />}
      {variante === 'C' && <VersaoC {...props} />}

      {!captura && (
        <div className="fixed bottom-2 left-1/2 z-[60] flex max-w-[96vw] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-lg border border-line bg-card px-2 py-1.5 text-xs shadow-lg">
          <strong className="mr-1">Protótipo #322</strong>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Versão anterior"
            onClick={() => ciclar(-1)}
          >
            <ChevronLeft strokeWidth={1.7} aria-hidden />
          </Button>
          <span className="min-w-[180px] text-center text-ink-soft">{rotulos[variante]}</span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            aria-label="Próxima versão"
            onClick={() => ciclar(1)}
          >
            <ChevronRight strokeWidth={1.7} aria-hidden />
          </Button>
          <span className="mx-1 h-5 w-px bg-line" />
          <Button variant="outline" size="sm" onClick={() => setAberta(!aberta)}>
            {aberta ? 'Fechar janela' : 'Abrir janela'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setErros(!erros)}>
            {erros ? 'Esconder erros' : 'Salvar vazio'}
          </Button>
          <label className="flex items-center gap-1">
            Tema
            <select
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tema}
              onChange={(evento) => setTema(evento.target.value as Tema)}
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
