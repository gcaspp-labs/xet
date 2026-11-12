import { useState } from 'react'
import {
  markedSubjects,
  mergedSolutions,
  SolutionQuestion,
  SubjectQuestion,
  subjectsNamed,
} from '@/components/ClosingFields'
import type { FormQuestion } from '@/components/FormDialog'
import { type FormSubject, inList, sameText } from '@/lib/closing'

type Answerable = { subject: string; resolution: string; moduleIds: number[] }
type Option = { id: number; name: string }

// PROTÓTIPO #150: perguntas ao salvar, em sequência, agora por módulo:
// 1. o assunto fora da lista dos módulos marcados; com um módulo ativo marcado,
//    entra nele; com mais de um, a pessoa escolhe; sem nenhum ativo marcado (só
//    na correção), não pergunta;
// 2. a resolução fora das soluções do assunto; se o assunto existe em mais de
//    um módulo marcado, a pessoa escolhe em qual entra a solução.
// Voltar não salva.
export function useClosingQuestions<V extends Answerable>({
  subjects,
  modules,
  askSubject = () => true,
  askSolution = () => true,
  save,
}: {
  subjects: FormSubject[]
  // Módulos ativos do setor: os únicos que recebem assunto novo.
  modules: Option[]
  askSubject?: (values: V) => boolean
  askSolution?: (values: V) => boolean
  save: (values: V, addSubject: boolean, addSolution: boolean) => void
}) {
  const [asking, setAsking] = useState<{
    values: V
    step: 'subject' | 'solution'
    addSubject: boolean
    subjectModule: number | null
  } | null>(null)
  const [choice, setChoice] = useState<number | null>(null)
  const [choiceError, setChoiceError] = useState(false)

  const activeMarked = (values: V) => modules.filter((m) => values.moduleIds.includes(m.id))
  const visible = (values: V) => markedSubjects(subjects, values.moduleIds)

  // Módulos do assunto em que a solução pode entrar.
  const solutionModules = (values: V, subjectModule: number | null): Option[] => {
    if (subjectModule !== null) {
      return modules.filter((m) => m.id === subjectModule)
    }
    return subjectsNamed(visible(values), values.subject).map((s) => ({
      id: s.moduleId,
      name: s.moduleName,
    }))
  }

  const solutionMissing = (values: V, subjectModule: number | null) => {
    if (!askSolution(values)) {
      return false
    }
    if (subjectModule !== null) {
      return true // assunto novo ainda não tem soluções
    }
    const found = subjectsNamed(visible(values), values.subject)
    return (
      found.length > 0 &&
      !mergedSolutions(visible(values), values.subject).some((s) =>
        sameText(s.body, values.resolution),
      )
    )
  }

  const go = (next: typeof asking) => {
    setChoice(null)
    setChoiceError(false)
    setAsking(next)
  }

  const toSolutionOrSave = (values: V, subjectModule: number | null) => {
    if (solutionMissing(values, subjectModule)) {
      go({ values, step: 'solution', addSubject: subjectModule !== null, subjectModule })
    } else {
      save(values, subjectModule !== null, false)
    }
  }

  const start = (values: V) => {
    if (
      askSubject(values) &&
      !inList(values.subject, visible(values)) &&
      activeMarked(values).length > 0
    ) {
      go({ values, step: 'subject', addSubject: false, subjectModule: null })
    } else {
      toSolutionOrSave(values, null)
    }
  }

  // Confirma só com um módulo escolhido quando há mais de uma opção.
  const confirmWith = (options: Option[], then: (id: number) => void) => {
    const id = options.length === 1 ? options[0].id : choice
    if (id === null) {
      setChoiceError(true)
      return
    }
    then(id)
  }

  const choiceFor = (options: Option[]) =>
    options.length > 1
      ? {
          modules: options,
          value: choice,
          onChange: (id: number | null) => {
            setChoice(id)
            setChoiceError(false)
          },
          error: choiceError,
        }
      : undefined

  let question: FormQuestion | null = null
  if (asking?.step === 'subject') {
    const { values } = asking
    const options = activeMarked(values)
    question = {
      id: 'subject',
      body: (
        <SubjectQuestion
          subject={values.subject}
          module={options.length === 1 ? options[0].name : undefined}
          choice={choiceFor(options)}
        />
      ),
      onBack: () => go(null),
      onSkip: () => save(values, false, false),
      onConfirm: () => confirmWith(options, (id) => toSolutionOrSave(values, id)),
    }
  } else if (asking?.step === 'solution') {
    const { values, addSubject, subjectModule } = asking
    const options = solutionModules(values, subjectModule)
    question = {
      id: 'solution',
      body: (
        <SolutionQuestion
          subject={values.subject}
          resolution={values.resolution}
          module={options.length === 1 ? options[0].name : undefined}
          choice={choiceFor(options)}
        />
      ),
      onBack: () => go(null),
      onSkip: () => save(values, addSubject, false),
      onConfirm: () => confirmWith(options, () => save(values, addSubject, true)),
    }
  }

  return { start, question, reset: () => go(null) }
}
