import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Plus } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { FormSheet } from '@/components/FormSheet'
import { PageContent, Topbar } from '@/components/Topbar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type Sector, useSaveSector, useSectors } from '@/lib/admin'
import { connectionLabels, formatPhone, normalizePhone } from '@/lib/format'

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do setor.'),
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((value) => /^\d{10,15}$/.test(value), 'Informe o número com DDI e DDD.'),
})

type FormValues = z.input<typeof schema>

function SectorSheet({
  sector,
  open,
  onOpenChange,
}: {
  sector: Sector | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveSector()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: sector?.name ?? '', phone: sector?.phone ?? '' },
  })

  const onSubmit = handleSubmit((values) =>
    save.mutate(
      { id: sector?.id, ...values },
      {
        onSuccess: () => {
          toast.success('Setor salvo')
          onOpenChange(false)
        },
      },
    ),
  )

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={sector ? 'Editar setor' : 'Novo setor'}
      submitLabel={sector ? 'Salvar' : 'Cadastrar setor'}
      pending={save.isPending}
      error={save.error?.message}
      onSubmit={onSubmit}
    >
      <Field data-invalid={!!errors.name}>
        <FieldLabel htmlFor="sector-name">Nome</FieldLabel>
        <Input id="sector-name" aria-invalid={!!errors.name} {...register('name')} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={!!errors.phone}>
        <FieldLabel htmlFor="sector-phone">Número do WhatsApp</FieldLabel>
        <Input
          id="sector-phone"
          inputMode="tel"
          className="mono-num"
          aria-invalid={!!errors.phone}
          {...register('phone')}
        />
        <FieldDescription>Com DDI e DDD, por exemplo 55 11 99999-0000.</FieldDescription>
        <FieldError errors={[errors.phone]} />
      </Field>
    </FormSheet>
  )
}

export default function SectorsPage() {
  const { data: sectors, isPending } = useSectors()
  const [editing, setEditing] = useState<Sector | null>(null)
  const [open, setOpen] = useState(false)
  // Nova chave a cada abertura: o formulário começa sempre limpo.
  const [sheetKey, setSheetKey] = useState(0)

  const openSheet = (sector: Sector | null) => {
    setEditing(sector)
    setSheetKey((key) => key + 1)
    setOpen(true)
  }

  return (
    <>
      <Topbar
        breadcrumb="Administração"
        title="Setores"
        action={
          <Button onClick={() => openSheet(null)}>
            <Plus strokeWidth={1.7} aria-hidden />
            Novo setor
          </Button>
        }
      />
      <PageContent>
        <Card>
          {sectors && sectors.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setor</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Conexão</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectors.map((sector) => {
                  const connection = connectionLabels[sector.connectionStatus]
                  return (
                    <TableRow key={sector.id}>
                      <TableCell className="body-strong">{sector.name}</TableCell>
                      <TableCell className="mono-num">{formatPhone(sector.phone)}</TableCell>
                      <TableCell>
                        <Badge tone={connection.tone}>{connection.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Editar ${sector.name}`}
                          onClick={() => openSheet(sector)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            !isPending && (
              <Empty>
                <EmptyMedia>
                  <Building2 strokeWidth={1.7} aria-hidden />
                </EmptyMedia>
                <EmptyDescription>Nenhum setor cadastrado.</EmptyDescription>
              </Empty>
            )
          )}
        </Card>
      </PageContent>
      <SectorSheet key={sheetKey} sector={editing} open={open} onOpenChange={setOpen} />
    </>
  )
}
