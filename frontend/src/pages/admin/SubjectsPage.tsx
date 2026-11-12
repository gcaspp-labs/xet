import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, Plus, Tags } from 'lucide-react'
import { type FormEvent, Fragment, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormDialog } from '@/components/FormDialog'
import { SearchBox } from '@/components/SearchBox'
import { PageContent, Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
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
import {
  filterSubjects,
  type Module,
  type Solution,
  type Subject,
  useDeleteSolution,
  useDeleteSubject,
  useModules,
  useSaveSolution,
  useSaveSubject,
  useSectors,
  useSubjects,
} from '@/lib/admin'
import { useCurrentUser } from '@/lib/auth'

// PROTÓTIPO #150: o módulo vem antes do nome e é obrigatório.
const schema = z.object({
  moduleId: z.string({ error: 'Escolha o módulo.' }).min(1, 'Escolha o módulo.'),
  name: z.string().trim().min(1, 'Informe o nome do assunto.'),
})

type FormValues = z.infer<typeof schema>

function SubjectSheet({
  sectorId,
  subject,
  modules,
  open,
  onOpenChange,
}: {
  sectorId: number
  subject: Subject | null
  modules: Module[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveSubject(sectorId)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: subject?.name ?? '', moduleId: subject?.module?.id.toString() ?? '' },
  })
  // Só os módulos ativos; ao editar, o módulo atual continua mesmo desativado.
  const moduleItems = modules
    .filter((m) => m.active || m.id === subject?.module?.id)
    .map((m) => ({
      value: m.id.toString(),
      label: m.active ? m.name : `${m.name} (desativado)`,
    }))

  const onSubmit = handleSubmit((values) => {
    if (save.isPending) {
      return
    }
    save.mutate(
      { id: subject?.id, name: values.name, moduleId: Number(values.moduleId) },
      {
        onSuccess: () => {
          toast.success('Assunto salvo')
          onOpenChange(false)
        },
      },
    )
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={subject ? 'Editar assunto' : 'Novo assunto'}
      submitLabel={subject ? 'Salvar' : 'Cadastrar assunto'}
      pending={save.isPending}
      error={save.error?.message}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.moduleId}>
        <FieldLabel htmlFor="subject-module">Módulo</FieldLabel>
        <Controller
          control={control}
          name="moduleId"
          render={({ field }) => (
            <Select
              items={moduleItems}
              value={field.value || null}
              onValueChange={(value) => field.onChange(value ?? '')}
            >
              <SelectTrigger
                id="subject-module"
                className="w-full"
                aria-invalid={!!errors.moduleId}
              >
                <SelectValue placeholder="Escolha o módulo" />
              </SelectTrigger>
              <SelectContent>
                {moduleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldDescription>
          {subject?.module
            ? 'Trocar o módulo leva as soluções junto.'
            : subject
              ? 'Escolha o módulo para o assunto voltar a aparecer no atendimento.'
              : 'O assunto aparece no atendimento quando este módulo for marcado.'}
        </FieldDescription>
        <FieldError errors={[errors.moduleId]} />
      </Field>
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="subject-name">Nome</FieldLabel>
        <Input
          id="subject-name"
          maxLength={500}
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        <FieldError errors={[errors.name]} />
      </Field>
    </FormDialog>
  )
}

const solutionCount = (count: number) =>
  count === 0 ? 'Nenhuma solução' : count === 1 ? '1 solução' : `${count} soluções`

// Quantas soluções saem junto com o assunto, para a confirmação avisar.
const solutionsWarning = (count: number) =>
  count === 0
    ? ''
    : count === 1
      ? ' A solução dele também será apagada.'
      : ` As ${count} soluções dele também serão apagadas.`

// Confirmação da exclusão, como a de desvincular número: apaga de verdade e não
// pode ser desfeita, junto com as soluções do assunto; os chamados guardam o
// próprio texto (spec.md, Assuntos e soluções).
function DeleteSubjectSheet({
  sectorId,
  subject,
  open,
  onOpenChange,
}: {
  sectorId: number
  subject: Subject
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const remove = useDeleteSubject(sectorId)

  const changeOpen = (next: boolean) => {
    if (!next) {
      remove.reset()
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (remove.isPending) {
      return
    }
    remove.mutate(subject.id, {
      onSuccess: () => {
        toast.success('Assunto excluído')
        changeOpen(false)
      },
    })
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={changeOpen}
      title="Excluir assunto"
      description={`O assunto "${subject.name}" sai da lista do setor.${solutionsWarning(subject.solutions.length)} A exclusão não pode ser desfeita, e os chamados que usaram esse texto continuam como estão.`}
      submitLabel="Excluir assunto"
      pending={remove.isPending}
      error={remove.error?.message}
      onSubmit={submit}
    >
      {null}
    </FormDialog>
  )
}

const solutionSchema = z.object({
  body: z.string().trim().min(1, 'Informe a solução.'),
})

type SolutionValues = z.infer<typeof solutionSchema>

// Começo do texto da solução, para os botões dizerem de qual se trata sem
// repetir um texto de até 10.000 caracteres.
const preview = (body: string) => (body.length > 60 ? `${body.slice(0, 60)}…` : body)

function SolutionSheet({
  sectorId,
  subject,
  solution,
  open,
  onOpenChange,
}: {
  sectorId: number
  subject: Subject
  solution: Solution | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveSolution(sectorId)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SolutionValues>({
    resolver: zodResolver(solutionSchema),
    defaultValues: { body: solution?.body ?? '' },
  })

  const onSubmit = handleSubmit((values) => {
    if (save.isPending) {
      return
    }
    save.mutate(
      { subjectId: subject.id, id: solution?.id, body: values.body },
      {
        onSuccess: () => {
          toast.success('Solução salva')
          onOpenChange(false)
        },
      },
    )
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={solution ? 'Editar solução' : 'Nova solução'}
      description={`Assunto: ${subject.name}`}
      submitLabel={solution ? 'Salvar' : 'Cadastrar solução'}
      pending={save.isPending}
      error={save.error?.message}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.body}>
        <FieldLabel htmlFor="solution-body">Solução</FieldLabel>
        <Textarea
          id="solution-body"
          maxLength={10000}
          aria-invalid={!!errors.body}
          {...register('body')}
        />
        <FieldError errors={[errors.body]} />
      </Field>
    </FormDialog>
  )
}

// Confirmação da exclusão da solução: apaga de verdade, e os chamados guardam o
// próprio texto (spec.md, Assuntos e soluções).
function DeleteSolutionSheet({
  sectorId,
  subject,
  solution,
  open,
  onOpenChange,
}: {
  sectorId: number
  subject: Subject
  solution: Solution
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const remove = useDeleteSolution(sectorId)

  const changeOpen = (next: boolean) => {
    if (!next) {
      remove.reset()
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (remove.isPending) {
      return
    }
    remove.mutate(
      { subjectId: subject.id, id: solution.id },
      {
        onSuccess: () => {
          toast.success('Solução excluída')
          changeOpen(false)
        },
      },
    )
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={changeOpen}
      title="Excluir solução"
      description={`A solução sai da lista do assunto "${subject.name}". A exclusão não pode ser desfeita, e os chamados que usaram esse texto continuam como estão.`}
      submitLabel="Excluir solução"
      pending={remove.isPending}
      error={remove.error?.message}
      onSubmit={submit}
    >
      <p className="body-sm whitespace-pre-wrap text-ink-soft [overflow-wrap:anywhere]">
        {solution.body}
      </p>
    </FormDialog>
  )
}

export default function SubjectsPage() {
  const { data: user } = useCurrentUser()
  const { data: sectors = [] } = useSectors()
  // O supervisor vê só o próprio setor; o administrador escolhe entre todos.
  const [chosen, setChosen] = useState<number | null>(null)
  const sectorId = user?.sectorId ?? chosen ?? sectors[0]?.id
  const sector = sectors.find((s) => s.id === sectorId)
  const { data: all, isPending } = useSubjects(sectorId)
  const { data: modules = [] } = useModules(sectorId)
  const [query, setQuery] = useState('')
  // PROTÓTIPO #150: filtro por módulo; 'all', o id do módulo ou 'none'.
  const [moduleFilter, setModuleFilter] = useState('all')
  const subjects = all?.filter((s) =>
    moduleFilter === 'all'
      ? true
      : moduleFilter === 'none'
        ? s.module === null
        : s.module?.id === Number(moduleFilter),
  )
  const unclassified = all?.filter((s) => s.module === null).length ?? 0
  const filterItems = [
    { value: 'all', label: 'Todos os módulos' },
    ...modules.map((m) => ({
      value: m.id.toString(),
      label: m.active ? m.name : `${m.name} (desativado)`,
    })),
    { value: 'none', label: 'Sem módulo' },
  ]
  const shown = subjects && filterSubjects(subjects, query)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Subject | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Nova chave a cada abertura: o formulário começa sempre limpo.
  const [sheetKey, setSheetKey] = useState(0)
  // Solução aberta para criar, editar ou excluir, com o assunto dela.
  const [solutionTarget, setSolutionTarget] = useState<{
    subject: Subject
    solution: Solution | null
  } | null>(null)
  const [solutionOpen, setSolutionOpen] = useState(false)
  const [solutionDelete, setSolutionDelete] = useState<{
    subject: Subject
    solution: Solution
  } | null>(null)
  const [solutionDeleteOpen, setSolutionDeleteOpen] = useState(false)
  const sectorItems = sectors.map((s) => ({ value: s.id.toString(), label: s.name }))

  const openSheet = (subject: Subject | null) => {
    setEditing(subject)
    setSheetKey((key) => key + 1)
    setOpen(true)
  }

  const openSolution = (subject: Subject, solution: Solution | null) => {
    setSolutionTarget({ subject, solution })
    setSheetKey((key) => key + 1)
    setSolutionOpen(true)
  }

  const openSolutionDelete = (subject: Subject, solution: Solution) => {
    setSolutionDelete({ subject, solution })
    setSolutionDeleteOpen(true)
  }

  const openDelete = (subject: Subject) => {
    setDeleting(subject)
    setDeleteOpen(true)
  }

  return (
    <>
      <Topbar
        breadcrumb={sector ? `Cadastro · ${sector.name}` : 'Cadastro'}
        title="Assuntos"
        action={
          sectorId !== undefined && (
            <Button onClick={() => openSheet(null)}>
              <Plus strokeWidth={1.7} aria-hidden />
              Novo assunto
            </Button>
          )
        }
      />
      <PageContent>
        {user?.role === 'admin' && sectors.length > 0 && (
          <Field className="max-w-[260px]">
            <FieldLabel htmlFor="subjects-sector">Setor</FieldLabel>
            <Select
              items={sectorItems}
              value={sectorId?.toString() ?? null}
              onValueChange={(value) => value && setChosen(Number(value))}
            >
              <SelectTrigger id="subjects-sector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sectorItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {unclassified > 0 && moduleFilter !== 'none' && (
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {unclassified === 1
                  ? '1 assunto sem módulo não aparece no atendimento.'
                  : `${unclassified} assuntos sem módulo não aparecem no atendimento.`}{' '}
                Escolha o módulo de cada um em Editar.
              </span>
              <Button variant="outline" size="sm" onClick={() => setModuleFilter('none')}>
                Ver assuntos sem módulo
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {all && all.length > 0 && (
          <div className="flex flex-wrap items-end gap-3">
            <SearchBox
              value={query}
              onChange={setQuery}
              label="Buscar assuntos"
              placeholder="Assunto ou solução"
            />
            <Field className="w-[220px]">
              <FieldLabel htmlFor="subjects-module" className="sr-only">
                Módulo
              </FieldLabel>
              <Select
                items={filterItems}
                value={moduleFilter}
                onValueChange={(value) => value && setModuleFilter(value as string)}
              >
                <SelectTrigger
                  id="subjects-module"
                  className="w-full"
                  aria-label="Filtrar por módulo"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filterItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        )}
        <Card>
          {shown && shown.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto e soluções</TableHead>
                  <TableHead className="w-0">Módulo</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((subject) => (
                  <Fragment key={subject.id}>
                    <TableRow data-subject={subject.name}>
                      <TableCell className="w-full max-w-0 whitespace-normal">
                        <div className="body-strong [overflow-wrap:anywhere]">{subject.name}</div>
                        <div className="caption text-ink-soft">
                          {solutionCount(
                            subjects!.find((item) => item.id === subject.id)!.solutions.length,
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {subject.module ? (
                          <div className="flex flex-col items-start gap-0.5">
                            <Badge variant="tag">{subject.module.name}</Badge>
                            {!subject.module.active && (
                              <span className="caption text-ink-soft">Módulo desativado</span>
                            )}
                          </div>
                        ) : (
                          <Badge variant="status" tone="warning">
                            Sem módulo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-normal sm:whitespace-nowrap">
                        <div className="flex flex-wrap justify-end gap-1 sm:flex-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Nova solução para ${subject.name}`}
                            onClick={() => openSolution(subject, null)}
                          >
                            Nova solução
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Editar ${subject.name}`}
                            onClick={() => openSheet(subject)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Excluir ${subject.name}`}
                            onClick={() =>
                              openDelete(subjects!.find((item) => item.id === subject.id)!)
                            }
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {subject.solutions.map((solution) => (
                      <TableRow key={`solution-${solution.id}`} data-solution-of={subject.name}>
                        <TableCell className="w-full max-w-0 whitespace-normal">
                          {/* Texto longo fica em até 3 linhas; o inteiro aparece ao editar. */}
                          <p
                            className="line-clamp-3 border-l-2 border-line pl-3 text-ink-soft [overflow-wrap:anywhere]"
                            title={solution.body}
                          >
                            {solution.body}
                          </p>
                        </TableCell>
                        <TableCell />
                        <TableCell className="whitespace-normal sm:whitespace-nowrap">
                          <div className="flex flex-wrap justify-end gap-1 sm:flex-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Editar solução: ${preview(solution.body)}`}
                              onClick={() => openSolution(subject, solution)}
                            >
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Excluir solução: ${preview(solution.body)}`}
                              onClick={() => openSolutionDelete(subject, solution)}
                            >
                              Excluir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          ) : (
            (sectorId === undefined || !isPending) && (
              <Empty>
                <EmptyMedia>
                  <Tags strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>
                  {sectorId === undefined
                    ? 'Cadastre um setor para gerenciar assuntos.'
                    : all && all.length > 0
                      ? 'Nenhum assunto encontrado.'
                      : 'Nenhum assunto cadastrado.'}
                </EmptyDescription>
              </Empty>
            )
          )}
        </Card>
      </PageContent>
      {sectorId !== undefined && (
        <SubjectSheet
          key={sheetKey}
          sectorId={sectorId}
          subject={editing}
          modules={modules}
          open={open}
          onOpenChange={setOpen}
        />
      )}
      {sectorId !== undefined && solutionTarget && (
        <SolutionSheet
          key={`solution-${sheetKey}`}
          sectorId={sectorId}
          subject={solutionTarget.subject}
          solution={solutionTarget.solution}
          open={solutionOpen}
          onOpenChange={setSolutionOpen}
        />
      )}
      {sectorId !== undefined && solutionDelete && (
        <DeleteSolutionSheet
          key={`solution-delete-${solutionDelete.solution.id}`}
          sectorId={sectorId}
          subject={solutionDelete.subject}
          solution={solutionDelete.solution}
          open={solutionDeleteOpen}
          onOpenChange={setSolutionDeleteOpen}
        />
      )}
      {sectorId !== undefined && deleting && (
        <DeleteSubjectSheet
          key={deleting.id}
          sectorId={sectorId}
          subject={deleting}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </>
  )
}
