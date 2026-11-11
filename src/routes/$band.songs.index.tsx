import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { formatDuration } from '#/lib/duration'
import { Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { bandOp } from '#/server/fns'

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
  const total = songs.reduce((sum, s) => sum + (s.durationSec ?? 0), 0)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{archived ? 'Archived songs' : 'Songs'}</h1>
        <div className="flex gap-2">
          {archived ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$band/songs" params={{ band: band.slug }}>
                Back to songs
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link to="/$band/setlists" params={{ band: band.slug }} hash="blocks">
                Blocks
              </Link>
            </Button>
          )}
          {!archived && band.role === 'member' && (
            <Button asChild size="sm">
              <Link to="/$band/songs/new" params={{ band: band.slug }}>
                <Plus aria-hidden /> Add song
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
                <TableHead className="pl-4">Title</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="pr-4 text-right">Duration</TableHead>
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
                  {songs.length} {songs.length === 1 ? 'song' : 'songs'}
                </TableCell>
                <TableCell />
                <TableCell className="pr-4 text-right tabular-nums">{formatDuration(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          {archived ? 'No archived songs.' : 'No songs yet.'}
        </p>
      )}
    </>
  )
}
