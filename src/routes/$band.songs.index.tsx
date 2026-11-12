import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { formatDuration } from '#/lib/duration'
import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'

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
  const t = useT()
  const total = songs.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{archived ? t.songs.archivedList : t.common.songs}</h1>
        <div className="flex gap-2">
          {archived ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$band/songs" params={{ band: band.slug }}>
                {t.songs.back}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$band/setlists" params={{ band: band.slug }} hash="blocks">
                {t.common.blocks}
              </Link>
            </Button>
          )}
          {!archived && band.role === 'member' && (
            <Button asChild size="sm">
              <Link to="/$band/songs/new" params={{ band: band.slug }}>
                <Plus aria-hidden /> {t.songs.add}
              </Link>
            </Button>
          )}
        </div>
      </div>
      {songs.length ? (
        <div className="rounded-xl border bg-card">
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
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {archived ? t.songs.noArchived : t.common.noSongsYet}
        </p>
      )}
    </>
  )
}
