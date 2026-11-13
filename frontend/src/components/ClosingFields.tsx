import { useState } from 'react'
import { Controller, useController, useFormContext, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { OrganizationPicker } from '@/components/ContactSheet'
import {
  Autocomplete,
  AutocompleteContent,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
} from '@/components/ui/autocomplete'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { closingSchema, type FormSubject, sameText } from '@/lib/closing'
import type { Organization } from '@/lib/directory'
import { normalizeSearch } from '@/lib/format'

type ClosingValues = z.input<typeof closingSchema>

// Assunto, resolução, módulos, órgão, início e fim, dentro de um FormProvider
// cujo formulário tem ao menos os campos de `closingShape`.
export function ClosingFields({
  idPrefix,
  modules,
  subjects,
  emptyModules,
}: {
  idPrefix: string
  modules: { id: number; name: string }[]
  // Assuntos da lista do setor, sugeridos enquanto a pessoa digita, com as
  // soluções de cada um.
  subjects: FormSubject[]
  // Aviso quando não há módulo para escolher.
  emptyModules?: string
}) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<ClosingValues>()
  const subject = useWatch<ClosingValues, 'subject'>({ name: 'subject' })
  const moduleIds = useWatch<ClosingValues, 'moduleIds'>({ name: 'moduleIds' })
  const selectedSubjects = subjects.filter((item) => moduleIds.includes(item.moduleId))
  const solutions = selectedSubjects
    .filter((item) => sameText(item.name, subject))
    .flatMap((item) => item.solutions)
    .filter(
      (solution, index, all) =>
        all.findIndex((other) => sameText(other.body, solution.body)) === index,
    )

  return (
    <>
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
      <Field data-invalid={!!errors.subject}>
        <FieldLabel htmlFor={`${idPrefix}-subject`}>Assunto</FieldLabel>
        <SubjectInput
          id={`${idPrefix}-subject`}
          subjects={selectedSubjects}
          invalid={!!errors.subject}
        />
        {moduleIds.length === 0 && (
          <FieldDescription>Marque um módulo para ver os assuntos.</FieldDescription>
        )}
        <FieldError errors={[errors.subject]} />
      </Field>
      {solutions.length > 0 && (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-solutions`}>Soluções sugeridas</FieldLabel>
          {/* Escolher substitui o texto da Resolução, que continua editável;
              a escolha não fica marcada, porque o texto pode mudar depois. */}
          <Select
            items={solutions.map((solution) => ({ value: solution.body, label: solution.body }))}
            value={null}
            onValueChange={(body) => {
              if (body) {
                setValue('resolution', body as string, { shouldDirty: true, shouldValidate: true })
              }
            }}
          >
            <SelectTrigger id={`${idPrefix}-solutions`} className="w-full">
              <SelectValue placeholder="Escolha para preencher a resolução" />
            </SelectTrigger>
            <SelectContent>
              {solutions.map((solution) => (
                <SelectItem key={solution.id} value={solution.body}>
                  <span className="line-clamp-3 min-w-0 flex-1 break-words whitespace-normal">
                    {solution.body}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
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

// Campo Assunto: sugere os assuntos do setor que contêm o texto digitado e
// aceita outro texto; nenhum vem marcado (spec.md, Assuntos e soluções). A
// lista só abre quando há sugestão, para não cobrir o formulário vazia.
function SubjectInput({
  id,
  subjects,
  invalid,
}: {
  id: string
  subjects: FormSubject[]
  invalid: boolean
}) {
  const {
    field: { ref, name, value, onChange, onBlur },
  } = useController<ClosingValues, 'subject'>({ name: 'subject' })
  const [open, setOpen] = useState(false)
  const typed = normalizeSearch(value.trim())
  const names = subjects
    .map((subject) => subject.name)
    .filter((name, index, all) => all.findIndex((other) => sameText(name, other)) === index)
  const matches = names.filter((item) => normalizeSearch(item).includes(typed))
  return (
    <Autocomplete
      items={names}
      filteredItems={matches}
      value={value}
      onValueChange={(next) => onChange(next)}
      open={open && matches.length > 0}
      onOpenChange={setOpen}
    >
      <AutocompleteInput
        id={id}
        ref={ref}
        name={name}
        onBlur={onBlur}
        // Esc só fecha a lista: sem ela aberta, não apaga o texto digitado, e a
        // janela com bloqueio continua aberta (spec.md, Janelas de formulário).
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !(open && matches.length > 0)) {
            event.preventBaseUIHandler()
          }
        }}
        maxLength={500}
        aria-invalid={invalid}
      />
      <AutocompleteContent>
        <AutocompleteList>
          {(name: string) => (
            <AutocompleteItem key={name} value={name}>
              <span className="min-w-0 flex-1 break-words">{name}</span>
              <span className="text-muted-foreground text-xs">
                {subjects
                  .filter((item) => sameText(item.name, name))
                  .map((item) => item.moduleName)
                  .join(', ')}
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
    </Autocomplete>
  )
}

// Pergunta ao salvar, na mesma janela do formulário (design.md): o assunto
// digitado não está na lista do setor (spec.md, Assuntos e soluções).
export function SubjectQuestion({ subject }: { subject: string }) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Adicionar assunto">
      <p>Este assunto não está na lista do setor. Deseja adicioná-lo?</p>
      <p className="body-strong break-words">{subject.trim()}</p>
    </div>
  )
}

// Pergunta ao salvar, depois da do assunto: a resolução não está na lista de
// soluções do assunto (spec.md, Assuntos e soluções).
export function SolutionQuestion({ subject, resolution }: { subject: string; resolution: string }) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Adicionar solução">
      <p>
        Esta resolução não está na lista de soluções do assunto{' '}
        <span className="body-strong break-words">{subject.trim()}</span>. Deseja adicioná-la?
      </p>
      <p className="body-strong break-words whitespace-pre-wrap">{resolution.trim()}</p>
    </div>
  )
}
