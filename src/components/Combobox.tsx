import { useState } from 'react'
import type { ReactNode } from 'react'
import { Command, CommandInput, CommandItem, CommandList } from '#/components/ui/command'
import { cn } from '#/lib/utils'

export type ComboOption = { value: string; label: ReactNode; onSelect: () => void }

type Props = {
  /** Names the input for screen readers (and tests). */
  label: string
  value: string
  onValueChange: (text: string) => void
  placeholder?: string
  /** Already filtered by the caller; a "+ new …" option goes last. */
  options: ComboOption[]
  className?: string
}

/** A text box; typing opens the options below, tapping one or pressing Enter picks the highlighted one. */
export function Combobox({ label, value, onValueChange, placeholder, options, className }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <Command label={label} shouldFilter={false} className={cn('relative overflow-visible bg-transparent', className)}>
      <CommandInput
        value={value}
        onValueChange={(v) => {
          onValueChange(v)
          setOpen(true)
        }}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder={placeholder}
        className="h-9 rounded-md border border-input px-3 text-base shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
      />
      {open && value.trim() && options.length > 0 && (
        <CommandList
          // Keep focus (and the phone keyboard) on the input while picking.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute inset-x-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 shadow-md"
        >
          {options.map((o) => (
            <CommandItem
              key={o.value}
              value={o.value}
              onSelect={() => {
                setOpen(false)
                o.onSelect()
              }}
            >
              {o.label}
            </CommandItem>
          ))}
        </CommandList>
      )}
    </Command>
  )
}
