import { Link, createFileRoute, getRouteApi, redirect, useRouter } from '@tanstack/react-router'
import { formatDuration } from '#/lib/duration'
import { bandOp } from '#/server/fns'
import { Files } from '#/components/Files'
import { HistoryLink } from '#/components/HistoryLink'

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
  const router = useRouter()
  const params = { band: band.slug, song: song.slug }

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveSong' : 'restoreSong', band.slug, { slug: song.slug })
    await router.invalidate()
  }

  return (
    <>
      <h1>{song.title}</h1>
      {song.archivedAt && <p role="status">This song is archived.</p>}
      <dl className="fields">
        <dt>Duration</dt>
        <dd>{formatDuration(song.durationSec) || '–'}</dd>
        <dt>Key</dt>
        <dd>{song.key || '–'}</dd>
        <dt>BPM</dt>
        <dd>{song.bpm ?? '–'}</dd>
        <dt>Tuning</dt>
        <dd>{song.tuning || '–'}</dd>
        <dt>Tags</dt>
        <dd>{song.tags.length ? song.tags.join(', ') : '–'}</dd>
      </dl>
      {song.notes && <p className="notes">{song.notes}</p>}
      <Files band={band.slug} owner={{ song: song.slug }} files={files} canEdit={band.role === 'member' && !song.archivedAt} />
      {band.role === 'member' && (
        <p>
          {song.archivedAt ? (
            <>
              <button type="button" onClick={() => setArchived(false)}>
                Restore
              </button>{' '}
              <HistoryLink item={song.id} />
            </>
          ) : (
            <>
              <Link to="/$band/songs/$song/edit" params={params}>
                Edit
              </Link>{' '}
              <button type="button" onClick={() => setArchived(true)}>
                Archive
              </button>
            </>
          )}
        </p>
      )}
      <p>
        <Link to="/$band/songs" params={{ band: band.slug }}>
          All songs
        </Link>
      </p>
    </>
  )
}
