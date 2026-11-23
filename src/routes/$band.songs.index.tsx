import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { formatDuration } from '#/lib/duration'
import { Plus, Upload } from 'lucide-react'
import { useState } from 'react'
import { SongImport, isCsvFile } from '#/components/SongImport'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'
import { useCanEdit } from '#/lib/online'

export const Route = createFileRoute('/$band/songs/')({
  validateSearch: (search: Record<string, unknown>): { archived?: true } =>
    search.archived === true || search.archived === 'true' ? { archived: true } : {},
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listSongs', params.band, { archived: deps.archived }),
  component: Songs,
})

const bandRoute = getRouteApi('/$band')

function Songs() {
  const songs = Route.useLoaderData()
  const { archived } = Route.useSearch()
  const band = bandRoute.useLoaderData()
  const canEdit = useCanEdit()
  const t = useT()
  const total = songs.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)
  // The import dialog: undefined = closed, '' = empty, else a dropped file's text.
  const [importing, setImporting] = useState<string>()
  const [dragging, setDragging] = useState(false)

  // Members can drop a CSV file on the song list (or the empty state) to import it.
  const dropProps =
    canEdit && !archived
      ? {
          onDragOver: (e: React.DragEvent) => {
            if (!e.dataTransfer.types.includes('Files')) return
            e.preventDefault()
            setDragging(true)
          },
          onDragLeave: (e: React.DragEvent) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
          },
          onDrop: async (e: React.DragEvent) => {
            e.preventDefault()
            setDragging(false)
            const file = [...e.dataTransfer.files].find(isCsvFile)
            if (file) setImporting(await file.text())
          },
        }
      : {}
  const dropClass = dragging && 'outline-2 outline-offset-2 outline-primary outline-dashed'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{archived ? t.songs.archivedList : t.common.songs}</h1>
        <div className="flex gap-2">
          {archived && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$band/songs" params={{ band: band.slug }}>
                {t.songs.back}
              </Link>
            </Button>
          )}
          {!archived && canEdit && (
            <Button asChild size="sm">
              <Link to="/$band/songs/new" params={{ band: band.slug }}>
                <Plus aria-hidden /> <span className="max-sm:sr-only">{t.songs.add}</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
      {songs.length ? (
        <div className={cn('rounded-xl border bg-card', dropClass)} {...dropProps}>
          <Table className="songs">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t.common.title}</TableHead>
                <TableHead>{t.common.key}</TableHead>
                <TableHead className="pr-4 text-right">{t.common.duration}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {songs.map((s) => (
                <TableRow key={s.slug}>
                  <TableCell className="pl-4 font-medium">
                    <Link to="/$band/songs/$song" params={{ band: band.slug, song: s.slug }} className="hover:underline">
                      {s.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.key}</TableCell>
                  <TableCell className="pr-4 text-right text-muted-foreground tabular-nums">{formatDuration(s.durationSec)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4">
                  {t.common.songCount(songs.length)}
                </TableCell>
                <TableCell />
                <TableCell className="pr-4 text-right tabular-nums">{formatDuration(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <div className={cn('rounded-xl border border-dashed p-8 text-center text-muted-foreground', dropClass)} {...dropProps}>
          <p className="mb-0">{archived ? t.songs.noArchived : t.common.noSongsYet}</p>
          {!archived && canEdit && (
            <>
              <Button size="sm" className="mt-4" onClick={() => setImporting('')}>
                <Upload aria-hidden /> {t.songImport.button}
              </Button>
              <p className="mt-2 mb-0 text-sm">{t.songImport.drop}</p>
            </>
          )}
        </div>
      )}
      {importing !== undefined && <SongImport band={band.slug} custom={band.songFields} initial={importing} hint onClose={() => setImporting(undefined)} />}
    </>
  )
}
