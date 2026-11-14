import { Download, FileSpreadsheet, MonitorPlay, Printer } from 'lucide-react'
import { cloneElement } from 'react'
import type { ReactElement } from 'react'
import { Button } from '#/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { useT } from '#/lib/i18n'
import { setlistCsv } from '#/lib/setlist-csv'

type Props = {
  /** File name without extension, already slugified. */
  file: string
  sets: Parameters<typeof setlistCsv>[0]
  /** Childless links to the show and print routes; the menu fills in icon and label. */
  show: ReactElement
  print: ReactElement
}

/** Excel (CSV, built here so it works offline), print and show mode in one menu. */
export function SetlistDownload({ file, sets, show, print }: Props) {
  const t = useT()

  function excel() {
    const c = t.common
    const csv = setlistCsv(sets, ['#', c.title, c.key, c.bpm, c.tuning, c.duration])
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `${file}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href))
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="ml-auto">
          <Download aria-hidden /> <span className="max-sm:sr-only">{t.setlist.download}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={excel}>
          <FileSpreadsheet aria-hidden /> {t.setlist.excel}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {cloneElement(print, {}, <><Printer aria-hidden /> {t.setlist.print}</>)}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {cloneElement(show, {}, <><MonitorPlay aria-hidden /> {t.setlist.showMode}</>)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
