// PROTÓTIPO #258 (descartável). Plano: uma versão só (ajuste), o campo PasswordInput
// nos estados pedidos e nos 2 campos de Usuários, na rota /prototype/senha;
// o login real (/login) já usa o campo. Dados fictícios.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { PasswordInput } from './PasswordInput'

const longValue = 'Correto-Cavalo-Bateria-Grampo-2026!Xyz'

function State({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <p className="overline">{title}</p>
      {children}
      <p className="caption text-ink-faint">{note}</p>
    </div>
  )
}

export default function PasswordStatesPage() {
  return (
    <main className="min-h-svh bg-background px-8 py-8 text-foreground">
      <h1 className="title-page mb-1">Campo de senha: estados</h1>
      <p className="caption mb-6 text-ink-faint">Protótipo #258 · dados fictícios</p>
      <div className="grid grid-cols-[1fr_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Estados</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-5">
            <State title="Normal, vazio" note="Ícone Eye em ink-soft, botão 28×28 a 3px da borda direita.">
              <PasswordInput id="s1" />
            </State>
            <State title="Preenchida, escondida" note="Começa assim. Leitor de tela: “Mostrar senha”.">
              <PasswordInput id="s2" defaultValue="Segredo#123" />
            </State>
            <State title="Hover no botão" note="Fundo muted, ícone em ink.">
              <PasswordInput id="s3" defaultValue="Segredo#123" protoState="hover" />
            </State>
            <State title="Visível" note="Ícone EyeOff. Leitor de tela: “Ocultar senha”, aria-pressed.">
              <PasswordInput id="s4" defaultValue="Segredo#123" protoVisible />
            </State>
            <State title="Foco do teclado no botão" note="Tab sai do campo para o botão; outline 2px em focus, por dentro do botão (-2px) para não encostar na borda do campo.">
              <PasswordInput id="s5" defaultValue="Segredo#123" protoState="focus" />
            </State>
            <State title="Foco no campo" note="Igual ao Input: borda em primary.">
              <PasswordInput id="s6" defaultValue="Segredo#123" className="border-primary" />
            </State>
            <Field data-invalid>
              <p className="overline">Com erro (aria-invalid)</p>
              <PasswordInput id="s7" aria-invalid />
              <FieldError errors={[{ message: 'Informe a senha.' }]} />
              <p className="caption text-ink-faint">Só a borda fica em danger; o ícone não muda.</p>
            </Field>
            <State title="Desabilitado" note="Campo e botão a 50%, sem clique.">
              <PasswordInput id="s8" defaultValue="Segredo#123" disabled />
            </State>
            <State title="Texto longo, escondido" note="O texto para 5px antes do botão (pr-9 = 36px).">
              <PasswordInput id="s9" defaultValue={longValue} />
            </State>
            <State title="Texto longo, visível" note="Rola dentro do campo; nunca passa por baixo do ícone.">
              <PasswordInput id="s10" defaultValue={longValue} protoVisible />
            </State>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Usuários · Novo usuário</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-[15px]">
                <Field>
                  <FieldLabel htmlFor="user-password">Senha inicial</FieldLabel>
                  <PasswordInput id="user-password" autoComplete="new-password" defaultValue="Inicial#2026" protoVisible />
                  <FieldDescription>
                    Mínimo de 8 caracteres, com letra maiúscula, letra minúscula, número e caractere
                    especial. Senhas comuns são recusadas. Repasse a senha ao usuário.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Usuários · Redefinir senha</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-[15px]">
                <Field>
                  <FieldLabel htmlFor="reset-password">Nova senha</FieldLabel>
                  <PasswordInput id="reset-password" autoComplete="new-password" defaultValue="Nova#Senha42" />
                  <FieldDescription>
                    Repasse a nova senha ao usuário. As sessões abertas dele são encerradas.
                  </FieldDescription>
                </Field>
                <Button type="button" variant="outline" className="self-start">
                  Redefinir senha
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
