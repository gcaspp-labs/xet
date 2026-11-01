import { Controller, useFormContext } from 'react-hook-form'
import { z } from 'zod'
import { OrganizationPicker } from '@/components/ContactSheet'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { closingSchema } from '@/lib/closing'
import type { Organization } from '@/lib/directory'

type ClosingValues = z.input<typeof closingSchema>

// Assunto, resolução, módulos, órgão, início e fim, dentro de um FormProvider
// cujo formulário tem ao menos os campos de `closingShape`.
export function ClosingFields({
  idPrefix,
  modules,
  emptyModules,
}: {
  idPrefix: string
  modules: { id: number; name: string }[]
  // Aviso quando não há módulo para escolher.
  emptyModules?: string
}) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ClosingValues>()

  return (
    <>
      <Field data-invalid={!!errors.subject}>
        <FieldLabel htmlFor={`${idPrefix}-subject`}>Assunto</FieldLabel>
        <Input
          id={`${idPrefix}-subject`}
          maxLength={500}
          aria-invalid={!!errors.subject}
          {...register('subject')}
        />
        <FieldError errors={[errors.subject]} />
      </Field>
      <Field data-invalid={!!errors.resolution}>
        <FieldLabel htmlFor={`${idPrefix}-resolution`}>Resolução</FieldLabel>
        <Textarea
          id={`${idPrefix}-resolution`}
          maxLength={10000}
          aria-invalid={!!errors.resolution}
          {...register('resolution')}
        />
        <FieldError errors={[errors.resolution]} />
      </Field>
      <Controller
        control={control}
        name="moduleIds"
        render={({ field }) => (
          <FieldSet data-invalid={!!errors.moduleIds}>
            <FieldLegend variant="label">Módulos</FieldLegend>
            {emptyModules && modules.length === 0 && (
              <FieldDescription>{emptyModules}</FieldDescription>
            )}
            <div className="flex flex-col gap-2">
              {modules.map((module) => (
                <label key={module.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={field.value.includes(module.id)}
                    onCheckedChange={(checked) =>
                      field.onChange(
                        checked
                          ? [...field.value, module.id]
                          : field.value.filter((id) => id !== module.id),
                      )
                    }
                  />
                  {module.name}
                </label>
              ))}
            </div>
            <FieldError errors={[errors.moduleIds]} />
          </FieldSet>
        )}
      />
      <Field data-invalid={!!errors.organization}>
        <FieldLabel htmlFor={`${idPrefix}-organization`}>Órgão</FieldLabel>
        <Controller
          control={control}
          name="organization"
          render={({ field }) => (
            <OrganizationPicker
              // Recria o campo quando o órgão sugerido chega, para mostrar o nome.
              key={field.value?.id ?? 'none'}
              id={`${idPrefix}-organization`}
              value={field.value as Organization | null}
              onChange={field.onChange}
              invalid={!!errors.organization}
            />
          )}
        />
        <FieldDescription>Trocar o órgão vale só para este chamado.</FieldDescription>
        <FieldError errors={[errors.organization]} />
      </Field>
      <div className="grid gap-[15px] sm:grid-cols-2">
        <Field data-invalid={!!errors.startedAt}>
          <FieldLabel htmlFor={`${idPrefix}-started-at`}>Início</FieldLabel>
          <Input
            id={`${idPrefix}-started-at`}
            type="datetime-local"
            className="mono-num"
            aria-invalid={!!errors.startedAt}
            {...register('startedAt')}
          />
          <FieldError errors={[errors.startedAt]} />
        </Field>
        <Field data-invalid={!!errors.endedAt}>
          <FieldLabel htmlFor={`${idPrefix}-ended-at`}>Fim</FieldLabel>
          <Input
            id={`${idPrefix}-ended-at`}
            type="datetime-local"
            className="mono-num"
            aria-invalid={!!errors.endedAt}
            {...register('endedAt')}
          />
          <FieldError errors={[errors.endedAt]} />
        </Field>
      </div>
    </>
  )
}
