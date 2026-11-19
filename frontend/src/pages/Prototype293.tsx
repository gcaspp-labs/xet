// Uma proposta para edição e exclusão em Chamados, acessível por ?prototype=293&variant=A.
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function Prototype293() {
  const [draft, setDraft] = useState('Vou verificar e retorno em instantes.')
  const [saved, setSaved] = useState('')
  const [message, setMessage] = useState('Olá, Maria! Seu atendimento está em andamento.')
  const [editing, setEditing] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [edited, setEdited] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState(false)
  const [scenario, setScenario] = useState('disponivel')
  const [theme, setTheme] = useState('light')
  const composer = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light'
    document.documentElement.dataset.contrast = theme === 'contrast' ? 'high' : 'normal'
  }, [theme])
  function edit() {
    setSaved(draft)
    setDraft(message)
    setEditing(true)
    setFailure(false)
    setTimeout(() => composer.current?.focus(), 0)
  }
  function cancelEdit() {
    setDraft(saved)
    setEditing(false)
    setFailure(false)
    setTimeout(() => composer.current?.focus(), 0)
  }
  function save() {
    setPending(true)
    setTimeout(() => {
      setPending(false)
      if (scenario === 'falha') {
        setFailure(true)
        return
      }
      setMessage(draft)
      setEdited(true)
      setDraft(saved)
      setEditing(false)
      setFailure(false)
    }, 800)
  }
  function remove() {
    setPending(true)
    setTimeout(() => {
      setPending(false)
      if (scenario === 'falha') {
        setDialog(false)
        setFailure(true)
        return
      }
      setHidden(true)
      setDialog(false)
      setFailure(false)
    }, 800)
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-14 items-center justify-between border-b border-line bg-card px-6">
        <div>
          <strong>GCASPP LAB</strong>
          <div className="caption text-muted-foreground">Central de Atendimento</div>
        </div>
        <span className="caption">Notificações　●</span>
      </header>
      <div className="flex min-h-[calc(100vh-56px)]">
        <aside className="w-48 shrink-0 border-r border-line bg-card p-4 text-sm">
          <p className="caption mb-4 text-muted-foreground">HELPDESK</p>
          <p className="rounded bg-accent-soft p-2 font-medium text-accent-strong">Chamados</p>
          <p className="p-2">Atendimentos</p>
          <p className="p-2">Dashboard</p>
          <p className="p-2">Contatos</p>
          <p className="p-2">Conexão</p>
          <p className="caption mt-8 text-muted-foreground">CADASTRO</p>
          <p className="p-2">Órgãos</p>
          <p className="p-2">Setores</p>
        </aside>
        <main className="min-w-0 flex-1 p-6">
          <p className="caption text-muted-foreground">Helpdesk / Chamados</p>
          <h1 className="title-page mb-5">Chamados</h1>
          <div className="grid min-h-[650px] grid-cols-[240px_minmax(420px,1fr)_240px] gap-4">
            <section className="rounded-xl border border-line bg-card">
              <h2 className="title-panel border-b border-line p-4">Meus chamados</h2>
              <div className="m-3 rounded-lg border border-accent bg-accent-soft p-3">
                <strong>Maria Oliveira</strong>
                <p className="caption mt-2">Olá, Maria! Seu atendimento...</p>
                <p className="caption mt-2 text-muted-foreground">2026-000123　14:05</p>
              </div>
            </section>
            <section className="flex min-w-0 flex-col rounded-xl border border-line bg-card">
              <div className="flex items-center justify-between border-b border-line p-4">
                <div>
                  <h2 className="title-panel">Maria Oliveira</h2>
                  <p className="caption text-muted-foreground">2026-000123 · Em atendimento</p>
                </div>
                <Button variant="outline" size="sm">
                  Ver chamado
                </Button>
              </div>
              <div className="flex flex-1 flex-col gap-4 bg-background p-5">
                <p className="mx-auto caption text-muted-foreground">Hoje</p>
                <div className="max-w-[80%] self-start rounded-xl border border-line bg-card p-3 text-sm">
                  Bom dia! Gostaria de saber se o pedido foi recebido.
                  <p className="caption mt-2 text-right text-muted-foreground">14:01 · Editada</p>
                </div>
                <div className="max-w-[80%] self-start rounded-xl border border-line bg-card p-3 text-sm">
                  Enviei os documentos ontem.
                  <p className="caption mt-2 text-right text-muted-foreground">14:02 · Excluída</p>
                </div>
                <div className="max-w-[85%] self-end rounded-xl bg-primary p-3 text-sm text-primary-foreground">
                  {hidden ? (
                    <i>Mensagem excluída no XET</i>
                  ) : (
                    <>
                      <div className="flex items-start gap-5">
                        <div>
                          <strong>Ana:</strong> {message}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                className="rounded px-2 text-lg"
                                aria-label="Ações da mensagem"
                              />
                            }
                          >
                            ⋯
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Responder</DropdownMenuItem>
                            {scenario !== 'pendente' && (
                              <>
                                {scenario !== 'expirado' && (
                                  <DropdownMenuItem onClick={edit}>Editar</DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => setDialog(true)}>
                                  Excluir
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="caption mt-2 text-right">{edited && 'Editada · '}14:05 ✓✓</p>
                    </>
                  )}
                </div>
                {scenario === 'expirado' && (
                  <p className="caption self-end text-muted-foreground">
                    Prazo de edição encerrado. Ainda é possível excluir para mim.
                  </p>
                )}
                {scenario === 'pendente' && (
                  <p className="caption self-end text-muted-foreground">
                    Mensagem em envio. Edição e exclusão indisponíveis.
                  </p>
                )}
                {failure && !editing && (
                  <div
                    role="alert"
                    className="rounded border border-warning bg-warning-soft p-3 text-sm text-warning-ink"
                  >
                    Não foi possível excluir a mensagem. Tente novamente.
                  </div>
                )}
              </div>
              <div className="border-t border-line p-4">
                {editing && (
                  <div className="mb-2 flex items-center justify-between rounded border border-line bg-muted p-3 text-sm">
                    <div>
                      <strong>Editando</strong>
                      <p className="caption text-muted-foreground">Ana · {message}</p>
                      <p className="caption text-muted-foreground">
                        Seu rascunho será recuperado ao cancelar ou salvar.
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={pending}>
                      Cancelar
                    </Button>
                  </div>
                )}
                {failure && editing && (
                  <div
                    role="alert"
                    className="mb-2 rounded border border-warning bg-warning-soft p-3 text-sm text-warning-ink"
                  >
                    Não foi possível salvar a edição. Revise o texto e tente novamente.
                  </div>
                )}
                <div className="flex gap-2">
                  <textarea
                    ref={composer}
                    aria-label={editing ? 'Editar mensagem' : 'Mensagem'}
                    className="min-h-20 flex-1 rounded-md border border-input bg-card p-3 text-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <Button onClick={editing ? save : () => setDraft('')} disabled={pending}>
                    {pending ? 'Salvando…' : editing ? 'Salvar edição' : 'Enviar'}
                  </Button>
                </div>
              </div>
            </section>
            <section className="rounded-xl border border-line bg-card">
              <div className="border-b border-line p-4">
                <strong>Fila</strong>　　　 Assuntos
              </div>
              <p className="p-4 text-sm text-muted-foreground">Nenhum chamado na fila.</p>
            </section>
          </div>
        </main>
      </div>
      <Dialog
        open={dialog}
        onOpenChange={(v) => {
          if (!pending) setDialog(v)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir mensagem</DialogTitle>
            <DialogDescription>Escolha como deseja excluir esta mensagem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5 text-sm">
            <p>
              <strong>Para todos:</strong> solicita a exclusão da mensagem no WhatsApp.
            </p>
            <p>
              <strong>Para mim:</strong> oculta a mensagem para todo o setor no XET. O registro
              permanece em Atendimentos e pode continuar nos celulares e outros dispositivos.
            </p>
            {scenario === 'expirado' && (
              <p className="text-muted-foreground">O prazo para excluir para todos terminou.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="outline" onClick={remove} disabled={pending}>
              {pending ? 'Excluindo…' : 'Excluir para mim'}
            </Button>
            {scenario !== 'expirado' && (
              <Button variant="destructive" onClick={remove} disabled={pending}>
                Excluir para todos
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-card p-2 text-xs shadow-lg">
        <strong>Protótipo A</strong>
        <label>
          Estado{' '}
          <select
            className="border border-line bg-card p-1"
            value={scenario}
            onChange={(e) => {
              setScenario(e.target.value)
              setFailure(false)
            }}
          >
            <option value="disponivel">Disponível</option>
            <option value="expirado">Prazo expirado</option>
            <option value="pendente">Em envio</option>
            <option value="falha">Simular falha</option>
          </select>
        </label>
        <label>
          Tema{' '}
          <select
            className="border border-line bg-card p-1"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="light">Claro</option>
            <option value="dark">Escuro</option>
            <option value="contrast">Alto contraste</option>
          </select>
        </label>
      </div>
    </div>
  )
}
