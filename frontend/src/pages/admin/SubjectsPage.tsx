import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Tags } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormDialog } from '@/components/FormDialog'
import { PageContent, Topbar } from '@/components/Topbar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
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
import {
  type Subject,
  useDeleteSubject,
  useSaveSubject,
  useSectors,
  useSubjects,
} from '@/lib/admin'
import { useCurrentUser } from '@/lib/auth'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do assunto.'),
})

type FormValues = z.infer<typeof schema>

function SubjectSheet({
  sectorId,
  subject,
  open,
  onOpenChange,
}: {
  sectorId: number
  subject: Subject | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveSubject(sectorId)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: subject?.name ?? '' },
  })

  const onSubmit = handleSubmit((values) => {
    if (save.isPending) {
      return
    }
    save.mutate(
      { id: subject?.id, name: values.name },
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

export default function SubjectsPage() {
  const { data: user } = useCurrentUser()
  const { data: sectors = [] } = useSectors()
  // O supervisor vê só o próprio setor; o administrador escolhe entre todos.
  const [chosen, setChosen] = useState<number | null>(null)
  const sectorId = user?.sectorId ?? chosen ?? sectors[0]?.id
  const sector = sectors.find((s) => s.id === sectorId)
  const { data: subjects, isPending } = useSubjects(sectorId)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<Subject | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Nova chave a cada abertura: o formulário começa sempre limpo.
  const [sheetKey, setSheetKey] = useState(0)
  const sectorItems = sectors.map((s) => ({ value: s.id.toString(), label: s.name }))

  const openSheet = (subject: Subject | null) => {
    setEditing(subject)
    setSheetKey((key) => key + 1)
    setOpen(true)
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
        <Card>
          {subjects && subjects.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="body-strong break-words whitespace-normal">
                      {subject.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
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
                          onClick={() => openDelete(subject)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
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
          open={open}
          onOpenChange={setOpen}
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
