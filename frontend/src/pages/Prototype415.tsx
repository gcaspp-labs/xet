// PROTÓTIPO #415 — descartável, não vai para a main.
// Plano: uma proposta do campo "Usuário no legado" no cadastro de usuário (tela só
// do administrador), no fim do formulário de criar e de editar, e a linha
// "No legado: ..." sob o nome na lista, só quando preenchida.
// Telas: /admin/usuarios?prototype=415&form=novo|editar&tema=escuro
// Dados fictícios (o repositório é público).
import { Bell, Plus } from 'lucide-react'
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'
import symbol from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-simbolo.svg'
import symbolDark from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-simbolo-escuro.svg'
import { FormDialog } from '@/components/FormDialog'
import { SearchBox } from '@/components/SearchBox'
import { PageContent, Topbar } from '@/components/Topbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'
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

type Papel = 'agent' | 'supervisor' | 'admin'

type Usuario = {
  id: number
  nome: string
  apelido: string
  email: string
  papel: Papel
  setor: string | null
  ativo: boolean
  legado: string | null
}

const usuarios: Usuario[] = [
  {
    id: 1,
    nome: 'Maria Souza',
    apelido: 'Maria Souza',
    email: 'maria.souza@prefeitura.sp.gov.br',
    papel: 'agent',
    setor: 'Suporte Sistemas',
    ativo: true,
    legado: 'maria.souza',
  },
  {
    id: 2,
    nome: 'João Pereira',
    apelido: 'João Pereira',
    email: 'joao.pereira@prefeitura.sp.gov.br',
    papel: 'agent',
    setor: 'Atendimento',
    ativo: true,
    legado: 'atendimento2',
  },
  {
    id: 3,
    nome: 'Luciana Alves',
    apelido: 'Luciana Alves',
    email: 'luciana.alves@prefeitura.sp.gov.br',
    papel: 'supervisor',
    setor: 'Suporte Sistemas',
    ativo: true,
    legado: null,
  },
  {
    id: 4,
    nome: 'Pedro Lima',
    apelido: 'Pedro Lima',
    email: 'pedro.lima@prefeitura.sp.gov.br',
    papel: 'agent',
    setor: 'Cadastro',
    ativo: true,
    legado: 'pedro.lima',
  },
  {
    id: 5,
    nome: 'Fernanda Rocha',
    apelido: 'Fernanda Rocha',
    email: 'fernanda.rocha@prefeitura.sp.gov.br',
    papel: 'agent',
    setor: 'Financeiro',
    ativo: false,
    legado: null,
  },
  {
    id: 6,
    nome: 'Ricardo Mendes',
    apelido: 'Ricardo Mendes',
    email: 'ricardo.mendes@prefeitura.sp.gov.br',
    papel: 'admin',
    setor: null,
    ativo: true,
    legado: null,
  },
]

const papeis: Record<Papel, string> = {
  agent: 'Atendente',
  supervisor: 'Supervisor',
  admin: 'Administrador',
}

const setores = ['Suporte Sistemas', 'Atendimento', 'Cadastro', 'Financeiro']

const ajudaUsuario =
  'Opcional. Nome deste usuário na lista Usuário do legado; o robô lança no nome de quem encerrou.'

// --- partes comuns ---------------------------------------------------------

// Linha secundária da listagem: o valor do de-para aparece embaixo do nome, e só
// quando existe (sem "—" para não poluir a lista).
function LinhaLegado({ valor }: { valor: string | null }) {
  if (!valor) {
    return null
  }
  return <p className="caption text-ink-soft">No legado: {valor}</p>
}

function CampoLegado({ valor }: { valor: string | null }) {
  return (
    <Field>
      <FieldLabel htmlFor="user-legacy">Usuário no legado</FieldLabel>
      <Input id="user-legacy" className="max-w-[260px]" defaultValue={valor ?? ''} />
      <FieldDescription>{ajudaUsuario}</FieldDescription>
    </Field>
  )
}

// --- telas -----------------------------------------------------------------

function TelaUsuarios({ aoAbrir }: { aoAbrir: (usuario: Usuario | null) => void }) {
  const [busca, setBusca] = useState('')
  return (
    <>
      <Topbar
        breadcrumb="Configurações"
        title="Usuários"
        action={
          <Button onClick={() => aoAbrir(null)}>
            <Plus strokeWidth={1.7} aria-hidden />
            Novo usuário
          </Button>
        }
      />
      <PageContent>
        <SearchBox
          value={busca}
          onChange={setBusca}
          label="Buscar usuários"
          placeholder="Nome, apelido ou e-mail"
        />
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead className="hidden sm:table-cell">Papel</TableHead>
                <TableHead className="hidden sm:table-cell">Setor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((usuario) => (
                <TableRow key={usuario.id}>
                  <TableCell className="w-full max-w-0 whitespace-normal wrap-anywhere sm:w-auto sm:max-w-none">
                    <p className="body-strong">{usuario.nome}</p>
                    <p className="caption text-ink-faint">{usuario.email}</p>
                    {/* Campo novo: a linha só aparece quando o valor está preenchido. */}
                    <LinhaLegado valor={usuario.legado} />
                    <p className="caption text-ink-soft sm:hidden">
                      {papeis[usuario.papel]} · {usuario.setor ?? 'Todos'}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{papeis[usuario.papel]}</TableCell>
                  <TableCell className="hidden sm:table-cell">{usuario.setor ?? 'Todos'}</TableCell>
                  <TableCell>
                    <Badge tone={usuario.ativo ? 'success' : 'neutral'}>
                      {usuario.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Editar ${usuario.nome}`}
                      onClick={() => aoAbrir(usuario)}
                    >
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

// Bloco "Redefinir senha" que só existe na edição, como na tela real.
function BlocoRedefinirSenha() {
  return (
    <div className="border-t border-line-soft px-5 py-[18px]">
      <div className="flex flex-col gap-[15px]">
        <h3 className="title-panel">Redefinir senha</h3>
        <Field>
          <FieldLabel htmlFor="reset-password">Nova senha</FieldLabel>
          <Input id="reset-password" type="password" autoComplete="new-password" />
          <FieldDescription>
            Repasse a nova senha ao usuário. As sessões abertas dele são encerradas.
          </FieldDescription>
        </Field>
        <Button type="button" variant="outline" className="self-start">
          Redefinir senha
        </Button>
      </div>
    </div>
  )
}

function JanelaUsuario({ usuario, aoFechar }: { usuario: Usuario | null; aoFechar: () => void }) {
  return (
    <FormDialog
      open
      onOpenChange={(aberta) => !aberta && aoFechar()}
      title={usuario ? 'Editar usuário' : 'Novo usuário'}
      submitLabel={usuario ? 'Salvar' : 'Cadastrar usuário'}
      pending={false}
      onSubmit={(event) => {
        event.preventDefault()
        aoFechar()
      }}
      extra={usuario ? <BlocoRedefinirSenha /> : undefined}
    >
      <Field>
        <FieldLabel htmlFor="user-name">Nome</FieldLabel>
        <Input id="user-name" defaultValue={usuario?.nome ?? ''} />
      </Field>
      <Field>
        <FieldLabel htmlFor="user-nickname">Apelido</FieldLabel>
        <Input id="user-nickname" defaultValue={usuario?.apelido ?? ''} />
        <FieldDescription>
          O cliente vê este nome nas mensagens. Em branco, usa o primeiro e o último nome.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="user-email">E-mail</FieldLabel>
        <Input id="user-email" type="email" defaultValue={usuario?.email ?? ''} />
      </Field>
      <Field>
        <FieldLabel htmlFor="user-role">Papel</FieldLabel>
        <Select
          items={(Object.keys(papeis) as Papel[]).map((valor) => ({
            value: valor,
            label: papeis[valor],
          }))}
          value={usuario?.papel ?? 'agent'}
        >
          <SelectTrigger id="user-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(papeis) as Papel[]).map((valor) => (
              <SelectItem key={valor} value={valor}>
                {papeis[valor]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {usuario?.papel !== 'admin' && (
        <Field>
          <FieldLabel htmlFor="user-sector">Setor</FieldLabel>
          <Select
            items={setores.map((nome) => ({ value: nome, label: nome }))}
            value={usuario?.setor ?? null}
          >
            <SelectTrigger id="user-sector">
              <SelectValue placeholder="Selecione o setor" />
            </SelectTrigger>
            <SelectContent>
              {setores.map((nome) => (
                <SelectItem key={nome} value={nome}>
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      {usuario ? (
        <Field orientation="horizontal">
          <Switch id="user-active" checked={usuario.ativo} />
          <FieldContent>
            <FieldLabel htmlFor="user-active">Ativo</FieldLabel>
            <FieldDescription>
              Usuário inativo não entra no sistema; as sessões abertas são encerradas.
            </FieldDescription>
          </FieldContent>
        </Field>
      ) : (
        <Field>
          <FieldLabel htmlFor="user-password">Senha inicial</FieldLabel>
          <Input
            id="user-password"
            type="password"
            autoComplete="new-password"
            defaultValue=""
          />
          <FieldDescription>
            Mínimo de 8 caracteres, com letra maiúscula, letra minúscula, número e caractere
            especial. Senhas comuns são recusadas. Repasse a senha ao usuário.
          </FieldDescription>
        </Field>
      )}
      {/* Campo novo: último do formulário principal, porque é o de-para que pode
          ser preenchido depois. Na edição, fica acima do bloco "Redefinir senha". */}
      <CampoLegado valor={usuario?.legado ?? null} />
    </FormDialog>
  )
}

// --- página ----------------------------------------------------------------

type Formulario = 'novo' | 'editar' | null

const params = new URLSearchParams(window.location.search)
const formParam = (params.get('form') ?? null) as Formulario
const temaParam = params.get('tema') === 'escuro' ? 'escuro' : 'claro'
const captura = params.get('captura') === '1'

const titulosForm: Record<Exclude<Formulario, null>, string> = {
  novo: 'Novo usuário',
  editar: 'Editar usuário',
}

export default function Prototype415() {
  const [form, setForm] = useState<Formulario>(formParam)

  useEffect(() => {
    document.documentElement.dataset.theme = temaParam === 'escuro' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = 'normal'
  }, [])

  return (
    <>
      <Shell tema={temaParam}>
        <TelaUsuarios aoAbrir={(usuario) => setForm(usuario ? 'editar' : 'novo')} />
      </Shell>
      {form === 'novo' && <JanelaUsuario usuario={null} aoFechar={() => setForm(null)} />}
      {form === 'editar' && (
        <JanelaUsuario usuario={usuarios[0]} aoFechar={() => setForm(null)} />
      )}

      {!captura && (
        <div className="fixed bottom-3 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
          <strong>Protótipo #415</strong>
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

function Shell({ tema, children }: { tema: 'claro' | 'escuro'; children: ReactNode }) {
  const item = (nome: string, ativo = false) => (
    <p
      className={cn(
        'rounded-(--radius-7) px-2 py-2',
        ativo ? 'bg-accent-soft font-medium text-accent-strong' : undefined,
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
          <p className="overline px-2 pt-6 pb-1 text-ink-faint">Configurações</p>
          {item('Usuários', true)}
        </aside>
        <main
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
          // A Topbar gruda no topo da área que rola; o cabeçalho do app fica fora dela.
          style={{ '--header-height': '0rem' } as CSSProperties}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
