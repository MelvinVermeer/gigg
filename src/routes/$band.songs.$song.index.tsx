import { Link, createFileRoute, getRouteApi, redirect } from '@tanstack/react-router'
import { Fragment } from 'react'
import { formatDuration } from '#/lib/duration'
import { Pencil } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { bandOp } from '#/server/fns'
import { Files } from '#/components/Files'
import { Markdown } from '#/components/Markdown'
import { useT } from '#/lib/i18n'
import { useCanEdit } from '#/lib/online'

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
  const canEdit = useCanEdit()
  const params = { band: band.slug, song: song.slug }
  const t = useT()

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/$band/songs" params={{ band: band.slug }} className="text-sm text-muted-foreground hover:text-foreground">
            {t.songs.allSongs}
          </Link>
          <h1 className="mt-1 mb-0">{song.title}</h1>
        </div>
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link to="/$band/songs/$song/edit" params={params}>
              <Pencil aria-hidden /> {t.common.edit}
            </Link>
          </Button>
        )}
      </div>
      {song.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.songs.isArchived}
        </p>
      )}
      <Card>
        <CardContent>
          <dl className="fields grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">{t.common.duration}</dt>
            <dd className="tabular-nums">{formatDuration(song.durationSec) || '–'}</dd>
            <dt className="text-muted-foreground">{t.common.key}</dt>
            <dd>{song.key || '–'}</dd>
            <dt className="text-muted-foreground">{t.common.bpm}</dt>
            <dd>{song.bpm ?? '–'}</dd>
            <dt className="text-muted-foreground">{t.common.tuning}</dt>
            <dd>{song.tuning || '–'}</dd>
            {band.songFields.map((f) => (
              <Fragment key={f.id}>
                <dt className="text-muted-foreground [overflow-wrap:anywhere]">{f.name}</dt>
                <dd className="[overflow-wrap:anywhere]">{song.custom[f.id] || '–'}</dd>
              </Fragment>
            ))}
            <dt className="text-muted-foreground">{t.common.tags}</dt>
            <dd>{song.tags.length ? song.tags.join(', ') : '–'}</dd>
          </dl>
          {song.notes && <Markdown className="notes mt-4 border-t pt-4 text-sm">{song.notes}</Markdown>}
          {song.lyrics && (
            <section className="mt-4 border-t pt-4">
              <h2 className="mb-2 text-base">{t.common.lyrics}</h2>
              <Markdown className="lyrics text-sm">{song.lyrics}</Markdown>
            </section>
          )}
        </CardContent>
      </Card>
      <Files band={band.slug} owner={{ song: song.slug }} files={files} canEdit={canEdit && !song.archivedAt} />
    </>
  )
}
