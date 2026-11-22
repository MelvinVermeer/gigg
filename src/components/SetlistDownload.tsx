import { Download, FileSpreadsheet, MicVocal, MonitorPlay, Printer } from 'lucide-react'
import { cloneElement } from 'react'
import type { ReactElement } from 'react'
import { Button } from '#/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '#/components/ui/dropdown-menu'
import { useT } from '#/lib/i18n'
import { setlistCsv } from '#/lib/setlist-csv'
import { fieldName, useShownFields } from '#/lib/song-fields'
import { StagePrint } from '#/components/SetlistViews'

type Props = {
  /** File name without extension, already slugified. */
  file: string
  sets: Parameters<typeof StagePrint>[0]['sets']
  /** Heading on every printed page, after the set name. */
  title: string
  /** Childless links to the show routes; the menu fills in icon and label. */
  show: ReactElement
  lyrics: ReactElement
}

/** Excel (CSV, built here so it works offline), print and show mode in one menu. */
export function SetlistDownload({ file, title, sets, show, lyrics }: Props) {
  const t = useT()
  const { cols, custom } = useShownFields('excel')

  function excel() {
    // '#' (number) is always first, then the title, then the rest.
    const names = cols.map((f) => fieldName(t, f, custom))
    const header = cols[0] === 'number' ? [names[0], t.common.title, ...names.slice(1)] : [t.common.title, ...names]
    const csv = setlistCsv(sets, cols, header)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `${file}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href))
  }

  return (
    <>
    <StagePrint title={title} sets={sets} />
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
        <DropdownMenuItem onSelect={() => window.print()}>
          <Printer aria-hidden /> {t.setlist.print}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {cloneElement(show, {}, <><MonitorPlay aria-hidden /> {t.setlist.showMode}</>)}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          {cloneElement(lyrics, {}, <><MicVocal aria-hidden /> {t.setlist.lyricsMode}</>)}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  )
}
