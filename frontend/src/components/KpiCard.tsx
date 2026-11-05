import { useId, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'

// KpiCard do design system: rótulo overline, valor kpi-value e subtexto caption.
export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  const id = useId()
  return (
    <Card role="group" aria-labelledby={id} className="min-w-0 px-4 py-3">
      <p id={id} className="overline text-ink-faint no-underline!">
        {label}
      </p>
      <p className="kpi-value">{value}</p>
      {hint && <p className="caption text-ink-faint">{hint}</p>}
    </Card>
  )
}
