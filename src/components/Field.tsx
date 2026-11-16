import { cloneElement, useEffect, useId, useRef } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { Label } from '#/components/ui/label'
import { cn } from '#/lib/utils'

/** A label above one form control; wires up the id so the label names the control. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  className?: string
  children: ReactElement<{ id?: string }>
}) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  // aria-invalid mirrors :user-invalid (only after interaction or a failed submit); "false" until then.
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('input, select, textarea')
    if (!el) return
    const sync = () => {
      try {
        el.setAttribute('aria-invalid', String(el.matches(':user-invalid')))
      } catch {} // ponytail: selector unsupported (old browsers/jsdom), leave unset
    }
    const events = ['blur', 'input', 'change', 'invalid']
    sync()
    events.forEach((e) => el.addEventListener(e, sync))
    return () => events.forEach((e) => el.removeEventListener(e, sync))
  }, [])
  return (
    <div ref={ref} className={cn('grid gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {cloneElement(children, { id })}
    </div>
  )
}

/** The error under a form, announced to screen readers. */
export function FormError({ children }: { children: ReactNode }) {
  return children ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {children}
    </p>
  ) : null
}
