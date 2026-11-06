import { useState } from 'react'
import { SolutionQuestion, SubjectQuestion } from '@/components/ClosingFields'
import type { FormQuestion } from '@/components/FormDialog'
import { type FormSubject, findSubject, hasSolution, inList } from '@/lib/closing'

type Answerable = { subject: string; resolution: string }

// Perguntas ao salvar o formulário, em sequência (spec.md, Assuntos e
// soluções): primeiro o assunto fora da lista do setor; depois, com o assunto
// na lista ou adicionado, a resolução fora da lista do assunto. Sem o assunto
// na lista, não há pergunta da solução. `askSubject` e `askSolution` limitam as
// perguntas, por exemplo, aos campos alterados na correção. Voltar não salva.
export function useClosingQuestions<V extends Answerable>({
  subjects,
  askSubject = () => true,
  askSolution = () => true,
  save,
}: {
  subjects: FormSubject[]
  askSubject?: (values: V) => boolean
  askSolution?: (values: V) => boolean
  save: (values: V, addSubject: boolean, addSolution: boolean) => void
}) {
  const [asking, setAsking] = useState<{
    values: V
    step: 'subject' | 'solution'
    addSubject: boolean
  } | null>(null)

  // A resolução fora da lista do assunto, que está na lista ou será adicionado
  // (um assunto novo ainda não tem soluções).
  const solutionMissing = (values: V, addingSubject: boolean) => {
    if (!askSolution(values)) {
      return false
    }
    const subject = findSubject(subjects, values.subject)
    if (subject) {
      return !hasSolution(subject, values.resolution)
    }
    return addingSubject
  }

  const start = (values: V) => {
    if (askSubject(values) && !inList(values.subject, subjects)) {
      setAsking({ values, step: 'subject', addSubject: false })
    } else if (solutionMissing(values, false)) {
      setAsking({ values, step: 'solution', addSubject: false })
    } else {
      save(values, false, false)
    }
  }

  let question: FormQuestion | null = null
  if (asking?.step === 'subject') {
    const { values } = asking
    question = {
      id: 'subject',
      body: <SubjectQuestion subject={values.subject} />,
      onBack: () => setAsking(null),
      // Sem o assunto na lista, não há pergunta da solução.
      onSkip: () => save(values, false, false),
      onConfirm: () =>
        solutionMissing(values, true)
          ? setAsking({ values, step: 'solution', addSubject: true })
          : save(values, true, false),
    }
  } else if (asking?.step === 'solution') {
    const { values, addSubject } = asking
    question = {
      id: 'solution',
      body: <SolutionQuestion subject={values.subject} resolution={values.resolution} />,
      onBack: () => setAsking(null),
      onSkip: () => save(values, addSubject, false),
      onConfirm: () => save(values, addSubject, true),
    }
  }

  return { start, question, reset: () => setAsking(null) }
}
