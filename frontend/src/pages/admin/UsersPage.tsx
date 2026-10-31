import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Users } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
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
  FieldGroup,
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
import {
  type AdminUser,
  type Sector,
  useCreateUser,
  useResetPassword,
  useSectors,
  useUpdateUser,
  useUsers,
} from '@/lib/admin'
import { type Role, passwordSchema, useCurrentUser } from '@/lib/auth'
import { roleLabels } from '@/lib/format'

const roleItems = (Object.keys(roleLabels) as Role[]).map((value) => ({
  value,
  label: roleLabels[value],
}))

const baseSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.'),
  email: z.email('Informe um e-mail válido.'),
  role: z.enum(['agent', 'supervisor', 'admin']),
  sectorId: z.string(),
  active: z.boolean(),
  password: z.string(),
})

// Atendentes e supervisores pertencem a um setor; o administrador não tem setor.
function schemaFor(creating: boolean) {
  return baseSchema.superRefine((values, ctx) => {
    if (values.role !== 'admin' && values.sectorId === '') {
      ctx.addIssue({ code: 'custom', path: ['sectorId'], message: 'Selecione o setor.' })
    }
    if (creating) {
      const result = passwordSchema.safeParse(values.password)
      if (!result.success) {
        ctx.addIssue({
          code: 'custom',
          path: ['password'],
          message: result.error.issues[0].message,
        })
      }
    }
  })
}

type FormValues = z.infer<typeof baseSchema>

function ResetPasswordForm({ user }: { user: AdminUser }) {
  const reset = useResetPassword()
  const {
    register,
    handleSubmit,
    reset: clear,
    formState: { errors },
  } = useForm<{ password: string }>({
    resolver: zodResolver(z.object({ password: passwordSchema })),
    defaultValues: { password: '' },
  })

  const onSubmit = handleSubmit(({ password }) =>
    reset.mutate(
      { id: user.id, password },
      {
        onSuccess: () => {
          toast.success('Senha redefinida')
          clear()
        },
      },
    ),
  )

  return (
    <form onSubmit={onSubmit} noValidate className="border-t border-line-soft px-5 py-[18px]">
      <FieldGroup className="gap-[15px]">
        <h3 className="title-panel">Redefinir senha</h3>
        <Field data-invalid={!!errors.password || !!reset.error}>
          <FieldLabel htmlFor="reset-password">Nova senha</FieldLabel>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          <FieldDescription>
            Repasse a nova senha ao usuário. As sessões abertas dele são encerradas.
          </FieldDescription>
          <FieldError
            errors={[errors.password, reset.error ? { message: reset.error.message } : undefined]}
          />
        </Field>
        <Button type="submit" variant="outline" className="self-start" disabled={reset.isPending}>
          Redefinir senha
        </Button>
      </FieldGroup>
    </form>
  )
}

function UserSheet({
  user,
  sectors,
  open,
  onOpenChange,
}: {
  user: AdminUser | null
  sectors: Sector[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: me } = useCurrentUser()
  const create = useCreateUser()
  const update = useUpdateUser()
  const mutation = user ? update : create
  const self = user !== null && user.id === me?.id
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schemaFor(user === null)),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'agent',
      sectorId: user?.sectorId?.toString() ?? '',
      active: user?.active ?? true,
      password: '',
    },
  })
  const role = useWatch({ control, name: 'role' })
  const sectorItems = sectors.map((s) => ({ value: s.id.toString(), label: s.name }))

  const onSubmit = handleSubmit((values) => {
    const input = {
      name: values.name,
      email: values.email,
      role: values.role,
      sectorId: values.role === 'admin' ? null : Number(values.sectorId),
    }
    const onSuccess = () => {
      toast.success('Usuário salvo')
      onOpenChange(false)
    }
    if (user) {
      update.mutate({ id: user.id, active: values.active, ...input }, { onSuccess })
    } else {
      create.mutate({ password: values.password, ...input }, { onSuccess })
    }
  })

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={user ? 'Editar usuário' : 'Novo usuário'}
      submitLabel={user ? 'Salvar' : 'Cadastrar usuário'}
      pending={mutation.isPending}
      error={mutation.error?.message}
      onSubmit={onSubmit}
      extra={user && <ResetPasswordForm user={user} />}
    >
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="user-name">Nome</FieldLabel>
        <Input id="user-name" aria-invalid={!!errors.name} {...register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="user-email">E-mail</FieldLabel>
        <Input id="user-email" type="email" aria-invalid={!!errors.email} {...register('email')} />
        <FieldError errors={[errors.email]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="user-role">Papel</FieldLabel>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select
              items={roleItems}
              value={field.value}
              onValueChange={(value) => value && field.onChange(value)}
              disabled={self}
            >
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {self && <FieldDescription>Você não pode alterar o próprio papel.</FieldDescription>}
      </Field>
      {role !== 'admin' && (
        <Field data-invalid={!!errors.sectorId}>
          <FieldLabel htmlFor="user-sector">Setor</FieldLabel>
          <Controller
            control={control}
            name="sectorId"
            render={({ field }) => (
              <Select
                items={sectorItems}
                value={field.value === '' ? null : field.value}
                onValueChange={(value) => field.onChange(value ?? '')}
              >
                <SelectTrigger id="user-sector" aria-invalid={!!errors.sectorId}>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectorItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.sectorId]} />
        </Field>
      )}
      {user ? (
        <Field orientation="horizontal">
          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <Switch
                id="user-active"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={self}
              />
            )}
          />
          <FieldContent>
            <FieldLabel htmlFor="user-active">Ativo</FieldLabel>
            <FieldDescription>
              {self
                ? 'Você não pode desativar a própria conta.'
                : 'Usuário inativo não entra no sistema; as sessões abertas são encerradas.'}
            </FieldDescription>
          </FieldContent>
        </Field>
      ) : (
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="user-password">Senha inicial</FieldLabel>
          <Input
            id="user-password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          <FieldDescription>
            Mínimo de 8 caracteres, com letra maiúscula, letra minúscula, número e caractere
            especial. Repasse a senha ao usuário.
          </FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>
      )}
    </FormSheet>
  )
}

export default function UsersPage() {
  const { data: users, isPending } = useUsers()
  const { data: sectors = [] } = useSectors()
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [open, setOpen] = useState(false)
  // Nova chave a cada abertura: o formulário começa sempre limpo.
  const [sheetKey, setSheetKey] = useState(0)
  const sectorNames = new Map(sectors.map((s) => [s.id, s.name]))

  const openSheet = (user: AdminUser | null) => {
    setEditing(user)
    setSheetKey((key) => key + 1)
    setOpen(true)
  }

  return (
    <>
      <Topbar
        breadcrumb="Administração"
        title="Usuários"
        action={
          <Button onClick={() => openSheet(null)}>
            <Plus strokeWidth={1.7} aria-hidden />
            Novo usuário
          </Button>
        }
      />
      <PageContent>
        <Card>
          {users && users.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <p className="body-strong">{user.name}</p>
                      <p className="caption text-ink-faint">{user.email}</p>
                    </TableCell>
                    <TableCell>{roleLabels[user.role]}</TableCell>
                    <TableCell>
                      {user.sectorId === null ? 'Todos' : sectorNames.get(user.sectorId)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={user.active ? 'success' : 'neutral'}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Editar ${user.name}`}
                        onClick={() => openSheet(user)}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            !isPending && (
              <Empty>
                <EmptyMedia>
                  <Users strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>Nenhum usuário cadastrado.</EmptyDescription>
              </Empty>
            )
          )}
        </Card>
      </PageContent>
      <UserSheet
        key={sheetKey}
        user={editing}
        sectors={sectors}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
