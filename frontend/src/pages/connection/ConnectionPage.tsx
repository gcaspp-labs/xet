import { CircleAlert, QrCode, RefreshCw, Unlink } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { FormSheet } from '@/components/FormSheet'
import { PageContent, Topbar } from '@/components/Topbar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type Sector, useSectors } from '@/lib/admin'
import { useCurrentUser } from '@/lib/auth'
import { qrCodeUrl, useConnect, useConnection, useDisconnect } from '@/lib/connection'
import { connectionLabels, formatDateTime, formatPhone } from '@/lib/format'

// Drawer de confirmação para desvincular o número (spec.md, Administração).
function DisconnectSheet({
  sector,
  phone,
  open,
  onOpenChange,
  onDone,
}: {
  sector: Sector
  phone: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: (warning?: string) => void
}) {
  const disconnect = useDisconnect(sector.id)

  const changeOpen = (next: boolean) => {
    if (!next) {
      disconnect.reset()
    }
    onOpenChange(next)
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (disconnect.isPending) {
      return
    }
    disconnect.mutate(undefined, {
      onSuccess: ({ warning }) => {
        toast.success('Número desvinculado')
        onDone(warning)
        changeOpen(false)
      },
    })
  }

  const number = phone ? `O número ${formatPhone(phone)}` : 'O número'
  return (
    <FormSheet
      open={open}
      onOpenChange={changeOpen}
      title="Desvincular número"
      description={`${number} deixa de atender o setor ${sector.name}. Os chamados abertos continuam no sistema, e as respostas falham até um número ser conectado de novo.`}
      submitLabel="Desvincular número"
      pending={disconnect.isPending}
      error={disconnect.error?.message}
      onSubmit={submit}
    >
      {null}
    </FormSheet>
  )
}

function ConnectionPanel({ sector }: { sector: Sector }) {
  const { data: connection, dataUpdatedAt, refetch, isFetching } = useConnection(sector.id)
  const connect = useConnect(sector.id)
  const [confirming, setConfirming] = useState(false)
  const [warning, setWarning] = useState<string>()
  if (!connection) {
    return null
  }
  const label = connectionLabels[connection.status]
  const canConnect = connection.status !== 'connected' && !connection.pairing

  return (
    <Card>
      <CardHeader>
        <CardTitle>{sector.name}</CardTitle>
        <CardDescription className={connection.phone ? 'mono-num' : undefined}>
          {connection.phone ? formatPhone(connection.phone) : 'Não conectado'}
        </CardDescription>
        <CardAction>
          <Badge tone={label.tone}>{label.label}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="caption text-muted-foreground">
          {connection.lastConnectedAt
            ? `Última conexão em ${formatDateTime(connection.lastConnectedAt)}.`
            : 'O número ainda não foi conectado.'}
        </p>

        {connection.status === 'logged_out' && (
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>
              {connection.connectionError ??
                'O número foi desvinculado. Conecte de novo pelo QR code.'}
            </AlertDescription>
          </Alert>
        )}
        {warning && connection.status === 'logged_out' && (
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        )}
        {connect.error && (
          <Alert variant="warning">
            <CircleAlert strokeWidth={1.7} aria-hidden />
            <AlertDescription>{connect.error.message}</AlertDescription>
          </Alert>
        )}

        {connection.pairing && (
          <div className="flex flex-col items-start gap-3">
            <img
              src={qrCodeUrl(sector.id, dataUpdatedAt)}
              alt="QR code para conectar o número"
              className="size-64 rounded-(--radius-8) border border-border bg-card"
            />
            <p className="body">
              No celular do setor, abra o WhatsApp em Dispositivos conectados, toque em Conectar
              dispositivo e leia o QR code.
            </p>
            <p className="caption text-muted-foreground">
              O QR code muda a cada 20 segundos e a tela mostra o novo código sozinha. Se ele
              expirar, conecte de novo.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {canConnect && (
            <Button disabled={connect.isPending} onClick={() => connect.mutate()}>
              <QrCode strokeWidth={1.7} aria-hidden />
              {connection.lastConnectedAt ? 'Reconectar' : 'Conectar'}
            </Button>
          )}
          <Button variant="outline" disabled={isFetching} onClick={() => void refetch()}>
            <RefreshCw strokeWidth={1.7} aria-hidden />
            Atualizar
          </Button>
          {connection.linked && (
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              <Unlink strokeWidth={1.7} aria-hidden />
              Desvincular número
            </Button>
          )}
        </div>
      </CardContent>
      <DisconnectSheet
        sector={sector}
        phone={connection.phone}
        open={confirming}
        onOpenChange={setConfirming}
        onDone={setWarning}
      />
    </Card>
  )
}

export default function ConnectionPage() {
  const { data: user } = useCurrentUser()
  const { data: sectors = [], isPending } = useSectors()
  const [params] = useSearchParams()
  // O supervisor vê só o próprio setor; o administrador escolhe entre todos.
  const [chosen, setChosen] = useState<number | null>(null)
  const sectorId = user?.sectorId ?? chosen ?? (Number(params.get('setor')) || sectors[0]?.id)
  const sector = sectors.find((s) => s.id === sectorId)
  const sectorItems = sectors.map((s) => ({ value: s.id.toString(), label: s.name }))

  return (
    <>
      <Topbar
        breadcrumb={sector ? `Helpdesk · ${sector.name}` : 'Helpdesk'}
        title="Conexão do WhatsApp"
      />
      <PageContent>
        {user?.role === 'admin' && sectors.length > 0 && (
          <Field className="max-w-[260px]">
            <FieldLabel htmlFor="connection-sector">Setor</FieldLabel>
            <Select
              items={sectorItems}
              value={sectorId?.toString() ?? null}
              onValueChange={(value) => value && setChosen(Number(value))}
            >
              <SelectTrigger id="connection-sector">
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
        {sector ? (
          <ConnectionPanel key={sector.id} sector={sector} />
        ) : (
          !isPending && (
            <Card>
              <Empty>
                <EmptyMedia>
                  <QrCode strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>Cadastre um setor para conectar o número.</EmptyDescription>
              </Empty>
            </Card>
          )
        )}
      </PageContent>
    </>
  )
}
