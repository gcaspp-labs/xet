import { zodResolver } from '@hookform/resolvers/zod'
import logo from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-lab-horizontal.svg'
import logoDark from '@gcaspp-labs/glab-design-system/assets/logos/gcaspp-lab-horizontal-escuro.svg'
import { TriangleAlert } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useCurrentUser, useLogin } from '@/lib/auth'

const schema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { data: user } = useCurrentUser()
  const login = useLogin()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (user) {
    return <Navigate to="/" replace />
  }

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, { onSuccess: () => navigate('/', { replace: true }) }),
  )

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-[380px]">
        <CardHeader className="justify-items-center gap-3 py-6">
          <img src={logo} alt="GCASPP LAB" className="h-10 dark:hidden" />
          <img src={logoDark} alt="GCASPP LAB" className="hidden h-10 dark:block" />
          <CardTitle>
            <h1>Central de Atendimento</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup className="gap-[15px]">
              {login.error && (
                <Alert variant="warning">
                  <TriangleAlert strokeWidth={1.7} aria-hidden />
                  <AlertDescription>{login.error.message}</AlertDescription>
                </Alert>
              )}
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field data-invalid={!!errors.password}>
                <FieldLabel htmlFor="password">Senha</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                <FieldError errors={[errors.password]} />
              </Field>
              <Button type="submit" className="w-full" disabled={login.isPending}>
                Entrar
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
