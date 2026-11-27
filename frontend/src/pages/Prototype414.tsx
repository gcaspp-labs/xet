// PROTÓTIPO #414 — descartável, não vai para a main.
// Plano: uma proposta dos três campos do de-para do robô do legado nos cadastros:
// "Código no legado" no órgão, "Setor no legado" no setor e "Sistema no legado" no
// módulo (este só para o administrador). Telas: ?prototype=414&tela=orgaos|setores|modulos,
// com &papel=admin|supervisor para a tela de módulos. A janela aberta vem em &form=...
// Dados fictícios (o repositório é público).
import { Bell, Plus } from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-simbolo-escuro.svg'
import { FormDialog } from '@/components/FormDialog'
import { PageContent, Topbar } from '@/components/Topbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

// --- dados fictícios -------------------------------------------------------

type Orgao = {
  id: number
  nome: string
  municipio: string
  cnpj: string
  legado: string | null
}

const orgaos: Orgao[] = [
  {
    id: 1,
    nome: 'Prefeitura de Hortolândia',
    municipio: 'Hortolândia',
    cnpj: '51.856.103/0001-70',
    legado: '1024',
  },
  {
    id: 2,
    nome: 'Câmara Municipal de Sumaré',
    municipio: 'Sumaré',
    cnpj: '01.813.181/0001-70',
    legado: '2048',
  },
  {
    id: 3,
    nome: 'Prefeitura de Monte Mor',
    municipio: 'Monte Mor',
    cnpj: '45.735.003/0001-77',
    legado: null,
  },
  {
    id: 4,
    nome: 'Prefeitura de Campinas',
    municipio: 'Campinas',
    cnpj: '51.885.122/0001-03',
    legado: '3100',
  },
  {
    id: 5,
    nome: 'Prefeitura de Paulínia',
    municipio: 'Paulínia',
    cnpj: '44.977.597/0001-10',
    legado: '1500',
  },
]

type Setor = {
  id: number
  nome: string
  email: string
  legado: string | null
}

const setores: Setor[] = [
  { id: 1, nome: 'Suporte Sistemas', email: 'suporte@prefeitura.sp.gov.br', legado: 'Suporte' },
  { id: 2, nome: 'Cadastro', email: 'cadastro@prefeitura.sp.gov.br', legado: 'Cadastro' },
  { id: 3, nome: 'Financeiro', email: 'financeiro@prefeitura.sp.gov.br', legado: null },
  { id: 4, nome: 'Atendimento', email: 'atendimento@prefeitura.sp.gov.br', legado: 'Recepção' },
]

type Modulo = {
  id: number
  nome: string
  ativo: boolean
  legado: string | null
}

const modulos: Modulo[] = [
  { id: 1, nome: 'Protocolo', ativo: true, legado: 'Protocolo' },
  { id: 2, nome: 'Licitações', ativo: true, legado: 'Licitações' },
  { id: 3, nome: 'Certidões', ativo: true, legado: null },
  { id: 4, nome: 'Tributos', ativo: false, legado: 'Tributos' },
]

// --- textos de ajuda -------------------------------------------------------

const ajudaOrgao = 'Opcional. Código do órgão no legado; o robô preenche o campo Cliente.'
const ajudaSetor = 'Opcional. Setor correspondente no legado; o robô preenche o campo Setor.'
const ajudaModulo = 'Opcional. Item da lista Sistema do legado; o robô preenche o campo Sistema.'

// --- partes comuns ---------------------------------------------------------

// Linha secundária da listagem: o valor do de-para aparece embaixo do nome, e só
// quando existe (sem "—" para não poluir a lista).
function LinhaLegado({ valor, mono }: { valor: string | null; mono?: boolean }) {
  if (!valor) {
    return null
  }
  return <p className={cn('caption text-ink-soft', mono && 'mono-num')}>No legado: {valor}</p>
}

// --- telas -----------------------------------------------------------------

function TelaOrgaos({ aoAbrir }: { aoAbrir: (orgao: Orgao | null) => void }) {
  return (
    <>
      <Topbar
        breadcrumb="Cadastro"
        title="Órgãos"
        action={
          <Button onClick={() => aoAbrir(null)}>
            <Plus strokeWidth={1.7} aria-hidden />
            Novo órgão
          </Button>
        }
      />
      <PageContent>
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Órgão</TableHead>
                <TableHead>Município</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgaos.map((orgao) => (
                <TableRow key={orgao.id}>
                  <TableCell>
                    <p className="body-strong">{orgao.nome}</p>
                    <LinhaLegado valor={orgao.legado} mono />
                  </TableCell>
                  <TableCell>{orgao.municipio}</TableCell>
                  <TableCell className="mono-num">{orgao.cnpj}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button variant="ghost" size="sm">
                      Histórico
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => aoAbrir(orgao)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </PageContent>
    </>
  )
}

function TelaSetores({ aoAbrir }: { aoAbrir: (setor: Setor | null) => void }) {
  return (
    <>
      <Topbar
        breadcrumb="Cadastro"
        title="Setores"
        action={
          <Button onClick={() => aoAbrir(null)}>
            <Plus strokeWidth={1.7} aria-hidden />
            Novo setor
          </Button>
        }
      />
      <PageContent>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Conexão</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {setores.map((setor, indice) => (
                <TableRow key={setor.id}>
                  <TableCell>
                    <p className="body-strong">{setor.nome}</p>
                    <LinhaLegado valor={setor.legado} />
                  </TableCell>
                  <TableCell className="min-w-40 whitespace-normal wrap-anywhere">
                    {setor.email}
                  </TableCell>
                  <TableCell className={indice === 0 ? 'mono-num' : 'text-muted-foreground'}>
                    {indice === 0 ? '(19) 3877-1000' : 'Não conectado'}
                  </TableCell>
                  <TableCell>
                    <Badge tone={indice === 0 ? 'success' : 'neutral'}>
                      {indice === 0 ? 'Conectado' : 'Desconectado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => aoAbrir(setor)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </PageContent>
    </>
  )
}

function TelaModulos({
  papel,
  aoAbrir,
}: {
  papel: Papel
  aoAbrir: (modulo: Modulo | null) => void
}) {
  const admin = papel === 'admin'
  return (
    <>
      <Topbar
        breadcrumb="Cadastro · Suporte Sistemas"
        title="Módulos"
        action={
          <Button onClick={() => aoAbrir(null)}>
            <Plus strokeWidth={1.7} aria-hidden />
            Novo módulo
          </Button>
        }
      />
      <PageContent>
        {admin && (
          <Field className="max-w-[260px]">
            <FieldLabel htmlFor="modules-sector">Setor</FieldLabel>
            <Select
              items={setores.map((s) => ({ value: s.id.toString(), label: s.nome }))}
              value="1"
            >
              <SelectTrigger id="modules-sector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {setores.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modulos.map((modulo) => (
                <TableRow key={modulo.id}>
                  <TableCell>
                    <p className="body-strong">{modulo.nome}</p>
                    {/* O valor do legado é só do administrador: o supervisor não vê. */}
                    {admin && <LinhaLegado valor={modulo.legado} />}
                  </TableCell>
                  <TableCell>
                    <Badge tone={modulo.ativo ? 'success' : 'neutral'}>
                      {modulo.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => aoAbrir(modulo)}>
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </PageContent>
    </>
  )
}

// --- janelas ---------------------------------------------------------------

function JanelaOrgao({ orgao, aoFechar }: { orgao: Orgao | null; aoFechar: () => void }) {
  return (
    <FormDialog
      open
      onOpenChange={(aberta) => !aberta && aoFechar()}
      title={orgao ? 'Editar órgão' : 'Novo órgão'}
      submitLabel={orgao ? 'Salvar' : 'Cadastrar órgão'}
      pending={false}
      onSubmit={(event) => {
        event.preventDefault()
        aoFechar()
      }}
    >
      <Field>
        <FieldLabel htmlFor="organization-cnpj">CNPJ</FieldLabel>
        <div className="flex gap-2">
          <Input
            id="organization-cnpj"
            className="mono-num uppercase"
            defaultValue={orgao?.cnpj ?? ''}
          />
          <Button type="button" variant="outline">
            Consultar
          </Button>
        </div>
        <FieldDescription>Opcional. Aceita o CNPJ numérico e o alfanumérico.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="organization-name">Nome</FieldLabel>
        <Input id="organization-name" defaultValue={orgao?.nome ?? ''} />
      </Field>
      <Field>
        <FieldLabel htmlFor="organization-municipality">Município</FieldLabel>
        <Input id="organization-municipality" defaultValue={orgao?.municipio ?? ''} />
      </Field>
      {/* Campo novo: último do formulário, porque é um detalhe do de-para que pode
          ser preenchido depois. */}
      <Field>
        <FieldLabel htmlFor="organization-legacy">Código no legado</FieldLabel>
        <Input
          id="organization-legacy"
          className="mono-num max-w-[220px]"
          defaultValue={orgao?.legado ?? ''}
        />
        <FieldDescription>{ajudaOrgao}</FieldDescription>
      </Field>
    </FormDialog>
  )
}

function JanelaSetor({ setor, aoFechar }: { setor: Setor | null; aoFechar: () => void }) {
  return (
    <FormDialog
      open
      onOpenChange={(aberta) => !aberta && aoFechar()}
      title={setor ? 'Editar setor' : 'Novo setor'}
      submitLabel={setor ? 'Salvar' : 'Cadastrar setor'}
      pending={false}
      onSubmit={(event) => {
        event.preventDefault()
        aoFechar()
      }}
    >
      <Field>
        <FieldLabel htmlFor="sector-name">Nome</FieldLabel>
        <Input id="sector-name" defaultValue={setor?.nome ?? ''} />
      </Field>
      <Field>
        <FieldLabel htmlFor="sector-email">E-mail</FieldLabel>
        <Input id="sector-email" type="email" defaultValue={setor?.email ?? ''} />
        <FieldDescription>Opcional. E-mail universal do setor.</FieldDescription>
      </Field>
      {/* Campo novo: depois do e-mail, com o mesmo peso dos outros opcionais. */}
      <Field>
        <FieldLabel htmlFor="sector-legacy">Setor no legado</FieldLabel>
        <Input id="sector-legacy" className="max-w-[260px]" defaultValue={setor?.legado ?? ''} />
        <FieldDescription>{ajudaSetor}</FieldDescription>
      </Field>
    </FormDialog>
  )
}

function JanelaModulo({
  modulo,
  papel,
  aoFechar,
}: {
  modulo: Modulo | null
  papel: Papel
  aoFechar: () => void
}) {
  const admin = papel === 'admin'
  return (
    <FormDialog
      open
      onOpenChange={(aberta) => !aberta && aoFechar()}
      title={modulo ? 'Editar módulo' : 'Novo módulo'}
      submitLabel={modulo ? 'Salvar' : 'Cadastrar módulo'}
      pending={false}
      onSubmit={(event) => {
        event.preventDefault()
        aoFechar()
      }}
    >
      <Field>
        <FieldLabel htmlFor="module-name">Nome</FieldLabel>
        <Input id="module-name" defaultValue={modulo?.nome ?? ''} />
      </Field>
      {/* Campo novo, só do administrador: o supervisor não vê nem edita. */}
      {admin && (
        <Field>
          <FieldLabel htmlFor="module-legacy">Sistema no legado</FieldLabel>
          <Input id="module-legacy" className="max-w-[260px]" defaultValue={modulo?.legado ?? ''} />
          <FieldDescription>{ajudaModulo}</FieldDescription>
        </Field>
      )}
      {modulo && (
        <Field orientation="horizontal">
          <Switch id="module-active" checked={modulo.ativo} />
          <FieldContent>
            <FieldLabel htmlFor="module-active">Ativo</FieldLabel>
            <FieldDescription>
              Módulos inativos não aparecem em novos encerramentos; os antigos continuam com eles.
            </FieldDescription>
          </FieldContent>
        </Field>
      )}
    </FormDialog>
  )
}

// --- página ----------------------------------------------------------------

type Tela = 'orgaos' | 'setores' | 'modulos'
type Papel = 'admin' | 'supervisor'
type Formulario = 'orgao' | 'orgao-novo' | 'setor' | 'modulo' | 'modulo-novo' | null

const params = new URLSearchParams(window.location.search)
const telaParam = (params.get('tela') ?? 'orgaos') as Tela
const papelParam = (params.get('papel') ?? 'admin') as Papel
const formParam = (params.get('form') ?? null) as Formulario
const temaParam = params.get('tema') === 'escuro' ? 'escuro' : 'claro'
const captura = params.get('captura') === '1'

const titulosTela: Record<Tela, string> = {
  orgaos: 'Órgãos',
  setores: 'Setores',
  modulos: 'Módulos',
}

const titulosForm: Record<Exclude<Formulario, null>, string> = {
  orgao: 'Editar órgão',
  'orgao-novo': 'Novo órgão',
  setor: 'Editar setor',
  modulo: 'Editar módulo',
  'modulo-novo': 'Novo módulo',
}

export default function Prototype414() {
  const [tela, setTela] = useState<Tela>(telaParam)
  const [papel, setPapel] = useState<Papel>(papelParam)
  const [form, setForm] = useState<Formulario>(formParam)

  useEffect(() => {
    document.documentElement.dataset.theme = temaParam === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = 'normal'
  }, [])

  const abrirOrgao = (orgao: Orgao | null) => setForm(orgao ? 'orgao' : 'orgao-novo')
  const abrirSetor = (setor: Setor | null) => setForm(setor ? 'setor' : null)
  const abrirModulo = (modulo: Modulo | null) => setForm(modulo ? 'modulo' : 'modulo-novo')
  const fechar = () => setForm(null)

  const janela =
    form === 'orgao' || form === 'orgao-novo' ? (
      <JanelaOrgao orgao={form === 'orgao' ? orgaos[0] : null} aoFechar={fechar} />
    ) : form === 'setor' ? (
      <JanelaSetor setor={setores[0]} aoFechar={fechar} />
    ) : form === 'modulo' || form === 'modulo-novo' ? (
      <JanelaModulo
        modulo={form === 'modulo' ? modulos[0] : null}
        papel={papel}
        aoFechar={fechar}
      />
    ) : null

  return (
    <>
      <Shell
        ativo={tela === 'orgaos' ? 'Órgãos' : tela === 'setores' ? 'Setores' : 'Módulos'}
        tema={temaParam}
      >
        {tela === 'orgaos' ? (
          <TelaOrgaos aoAbrir={abrirOrgao} />
        ) : tela === 'setores' ? (
          <TelaSetores aoAbrir={abrirSetor} />
        ) : (
          <TelaModulos papel={papel} aoAbrir={abrirModulo} />
        )}
      </Shell>
      {janela}

      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #414</strong>
          <label className="flex items-center gap-1">
            Tela
            <select
              aria-label="Tela"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={tela}
              onChange={(event) => {
                setTela(event.target.value as Tela)
                setForm(null)
              }}
            >
              {Object.entries(titulosTela).map(([valor, titulo]) => (
                <option key={valor} value={valor}>
                  {titulo}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            Papel
            <select
              aria-label="Papel"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={papel}
              onChange={(event) => setPapel(event.target.value as Papel)}
            >
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            Janela
            <select
              aria-label="Janela"
              className="rounded-(--radius-7) border border-line bg-card px-1.5 py-1"
              value={form ?? ''}
              onChange={(event) => setForm((event.target.value || null) as Formulario)}
            >
              <option value="">fechada</option>
              {Object.entries(titulosForm).map(([valor, titulo]) => (
                <option key={valor} value={valor}>
                  {titulo}
                </option>
              ))}
            </select>
          </label>
          <span className="basis-full text-center text-ink-faint">
            Uma proposta. A linha “No legado” só aparece quando o valor está preenchido.
          </span>
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
  ativo: 'Órgãos' | 'Setores' | 'Módulos'
  tema: 'claro' | 'escuro'
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
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
