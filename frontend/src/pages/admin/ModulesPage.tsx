import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes, Plus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormSheet } from '@/components/FormSheet'
import { PageContent, Topbar } from '@/components/Topbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
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
import { type Module, useModules, useSaveModule, useSectors } from '@/lib/admin'
import { useCurrentUser } from '@/lib/auth'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do módulo.'),
  active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

function ModuleSheet({
  sectorId,
  module,
  open,
  onOpenChange,
}: {
  sectorId: number
  module: Module | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveModule(sectorId)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: module?.name ?? '', active: module?.active ?? true },
  })

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      { id: module?.id, ...values },
      {
        onSuccess: () => {
          toast.success('Módulo salvo')
          onOpenChange(false)
        },
      },
    ),
  )

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={module ? 'Editar módulo' : 'Novo módulo'}
      submitLabel={module ? 'Salvar' : 'Cadastrar módulo'}
      pending={save.isPending}
      error={save.error?.message}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="module-name">Nome</FieldLabel>
        <Input id="module-name" aria-invalid={!!errors.name} {...register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>
      {module && (
        <Field orientation="horizontal">
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Switch id="module-active" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <FieldContent>
            <FieldLabel htmlFor="module-active">Ativo</FieldLabel>
            <FieldDescription>
              Módulos inativos não aparecem em novos encerramentos; os antigos continuam com eles.
            </FieldDescription>
          </FieldContent>
        </Field>
      )}
    </FormSheet>
  )
}

export default function ModulesPage() {
  const { data: user } = useCurrentUser()
  const { data: sectors = [] } = useSectors()
  // O supervisor vê só o próprio setor; o administrador escolhe entre todos.
  const [chosen, setChosen] = useState<number | null>(null)
  const sectorId = user?.sectorId ?? chosen ?? sectors[0]?.id
  const sector = sectors.find((s) => s.id === sectorId)
  const { data: modules, isPending } = useModules(sectorId)
  const [editing, setEditing] = useState<Module | null>(null)
  const [open, setOpen] = useState(false)
  // Nova chave a cada abertura: o formulário começa sempre limpo.
  const [sheetKey, setSheetKey] = useState(0)
  const sectorItems = sectors.map((s) => ({ value: s.id.toString(), label: s.name }))

  const openSheet = (module: Module | null) => {
    setEditing(module)
    setSheetKey((key) => key + 1)
    setOpen(true)
  }

  return (
    <>
      <Topbar
        breadcrumb={sector ? `Administração · ${sector.name}` : 'Administração'}
        title="Módulos"
        action={
          sectorId !== undefined && (
            <Button onClick={() => openSheet(null)}>
              <Plus strokeWidth={1.7} aria-hidden />
              Novo módulo
            </Button>
          )
        }
      />
      <PageContent>
        {user?.role === 'admin' && sectors.length > 0 && (
          <Field className="max-w-[260px]">
            <FieldLabel htmlFor="modules-sector">Setor</FieldLabel>
            <Select
              items={sectorItems}
              value={sectorId?.toString() ?? null}
              onValueChange={(value) => value && setChosen(Number(value))}
            >
              <SelectTrigger id="modules-sector">
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
          {modules && modules.length > 0 ? (
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
                {modules.map((module) => (
                  <TableRow key={module.id}>
                    <TableCell className="body-strong">{module.name}</TableCell>
                    <TableCell>
                      <Badge tone={module.active ? 'success' : 'neutral'}>
                        {module.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${module.name}`}
                        onClick={() => openSheet(module)}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            (sectorId === undefined || !isPending) && (
              <Empty>
                <EmptyMedia>
                  <Boxes strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>
                  {sectorId === undefined
                    ? 'Cadastre um setor para gerenciar módulos.'
                    : 'Nenhum módulo cadastrado.'}
                </EmptyDescription>
              </Empty>
            )
          )}
        </Card>
      </PageContent>
      {sectorId !== undefined && (
        <ModuleSheet
          key={sheetKey}
          sectorId={sectorId}
          module={editing}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  )
}
