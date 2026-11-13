import { useState } from 'react'
import { SolutionQuestion, SubjectQuestion } from '@/components/ClosingFields'
import type { FormQuestion } from '@/components/FormDialog'
import { type FormSubject, sameText } from '@/lib/closing'

type Answerable = { subject: string; resolution: string; moduleIds: number[] }
type Module = { id: number; name: string }

export function useClosingQuestions<V extends Answerable>({
  subjects,
  modules,
  askSubject = () => true,
  askSolution = () => true,
  save,
}: {
  subjects: FormSubject[]
  modules: Module[]
  askSubject?: (values: V) => boolean
  askSolution?: (values: V) => boolean
  save: (
    values: V,
    addSubject: boolean,
    addSolution: boolean,
    subjectModuleId?: number,
    solutionModuleId?: number,
  ) => void
}) {
  const [asking, setAsking] = useState<{
    values: V
    step: 'subject' | 'solution'
    addSubject: boolean
    subjectModuleId?: number
    retry?: boolean
  } | null>(null)
  const [chosen, setChosen] = useState<number | null>(null)
  const [error, setError] = useState(false)

  const matching = (values: V) =>
    subjects.filter(
      (item) => values.moduleIds.includes(item.moduleId) && sameText(item.name, values.subject),
    )
  const solutionMissing = (values: V, addingSubject: boolean) => {
    if (!askSolution(values)) return false
    const matches = matching(values)
    return matches.length
      ? !matches.some((item) =>
          item.solutions.some((solution) => sameText(solution.body, values.resolution)),
        )
      : addingSubject
  }
  const begin = (
    values: V,
    step: 'subject' | 'solution',
    addSubject: boolean,
    subjectModuleId?: number,
    retry = false,
  ) => {
    setChosen(null)
    setError(false)
    setAsking({ values, step, addSubject, subjectModuleId, retry })
  }
  const start = (values: V) => {
    const active = modules.filter((module) => values.moduleIds.includes(module.id))
    if (askSubject(values) && !matching(values).length && active.length) {
      begin(values, 'subject', false)
    } else if (solutionMissing(values, false)) {
      begin(values, 'solution', false)
    } else {
      save(values, false, false)
    }
  }

  let question: FormQuestion | null = null
  if (asking) {
    const { values, addSubject, subjectModuleId, step, retry } = asking
    const options =
      step === 'subject'
        ? modules.filter((module) => values.moduleIds.includes(module.id))
        : addSubject
          ? modules.filter((module) => module.id === subjectModuleId)
          : matching(values).map((item) => ({ id: item.moduleId, name: item.moduleName }))
    const selected = options.length === 1 && !retry ? options[0].id : chosen
    question = {
      id: step,
      body: (
        <>
          {step === 'subject' ? (
            <SubjectQuestion subject={values.subject} />
          ) : (
            <SolutionQuestion subject={values.subject} resolution={values.resolution} />
          )}
          {retry && (
            <p role="alert">O módulo escolhido foi desativado. Escolha outro módulo ativo.</p>
          )}
          {(options.length > 1 || retry) && (
            <fieldset>
              <legend>Adicionar em qual módulo?</legend>
              {options.map((module) => (
                <label key={module.id} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="question-module"
                    checked={chosen === module.id}
                    onChange={() => {
                      setChosen(module.id)
                      setError(false)
                    }}
                  />
                  {module.name}
                </label>
              ))}
            </fieldset>
          )}
          {error && <p role="alert">Escolha o módulo.</p>}
        </>
      ),
      onBack: () => setAsking(null),
      onSkip: () => save(values, addSubject, false, subjectModuleId),
      onConfirm: () => {
        if (selected == null) {
          setError(true)
          return
        }
        if (step === 'subject') {
          if (solutionMissing(values, true)) begin(values, 'solution', true, selected)
          else save(values, true, false, selected)
        } else {
          save(values, addSubject, true, subjectModuleId, selected)
        }
      },
    }
  }
  return {
    start,
    question,
    retry: (values: V) => begin(values, 'subject', false, undefined, true),
    reset: () => setAsking(null),
  }
}
