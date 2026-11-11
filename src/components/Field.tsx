import { cloneElement, useId } from 'react'
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
  return (
    <div className={cn('grid gap-2', className)}>
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
