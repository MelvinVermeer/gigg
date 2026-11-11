import { Link, createFileRoute, getRouteApi, redirect } from '@tanstack/react-router'
import { formatDuration } from '#/lib/duration'
import { Pencil } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { bandOp } from '#/server/fns'
import { Files } from '#/components/Files'

export const Route = createFileRoute('/$band/songs/$song/')({
  loader: async ({ params }) => {
    const res = await bandOp('getSong', params.band, { slug: params.song })
    if (res.moved) throw redirect({ to: '/$band/songs/$song', params: { ...params, song: res.slug } })
    return res
  },
  component: Song,
})

const bandRoute = getRouteApi('/$band')

function Song() {
  const { song, files } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const params = { band: band.slug, song: song.slug }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/$band/songs" params={{ band: band.slug }} className="text-sm text-muted-foreground hover:text-foreground">
            ← All songs
          </Link>
          <h1 className="mt-1 mb-0">{song.title}</h1>
        </div>
        {band.role === 'member' && (
          <Button asChild variant="outline" size="sm">
            <Link to="/$band/songs/$song/edit" params={params}>
              <Pencil aria-hidden /> Edit
            </Link>
          </Button>
        )}
      </div>
      {song.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          This song is archived.
        </p>
      )}
      <Card>
        <CardContent>
          <dl className="fields grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="tabular-nums">{formatDuration(song.durationSec) || '–'}</dd>
            <dt className="text-muted-foreground">Key</dt>
            <dd>{song.key || '–'}</dd>
            <dt className="text-muted-foreground">BPM</dt>
            <dd>{song.bpm ?? '–'}</dd>
            <dt className="text-muted-foreground">Tuning</dt>
            <dd>{song.tuning || '–'}</dd>
            <dt className="text-muted-foreground">Tags</dt>
            <dd>{song.tags.length ? song.tags.join(', ') : '–'}</dd>
          </dl>
          {song.notes && <p className="notes mt-4 border-t pt-4 text-sm whitespace-pre-wrap">{song.notes}</p>}
        </CardContent>
      </Card>
      <Files band={band.slug} owner={{ song: song.slug }} files={files} canEdit={band.role === 'member' && !song.archivedAt} />
    </>
  )
}
