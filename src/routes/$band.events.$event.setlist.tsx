import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SetlistBuilder } from '#/components/SetlistBuilder'
import { formatDate } from '#/lib/date'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'

export const Route = createFileRoute('/$band/events/$event/setlist')({
  loader: ({ params }) => bandOp('getSetlist', params.band, { event: params.event }),
  component: Setlist,
})

const bandRoute = getRouteApi('/$band')

function Setlist() {
  const data = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const params = { band: band.slug, event: data.event.slug }
  const member = band.role === 'member'
  const [editing, setEditing] = useState(false)

  async function run(op: 'useStandardSetlist' | 'useCustomSetlist', extra: object) {
    await bandOp(op, band.slug, { event: data.event.slug, ...extra })
    await router.invalidate()
  }

  return (
    <>
      <p>
        <Link to="/$band/events/$event" params={params}>
          ← {data.event.title}
        </Link>{' '}
        · {formatDate(data.event.date)}
        {data.sets.length > 0 && (
          <>
            {' · '}
            <Link to="/$band/events/$event/show" params={params}>
              Show mode
            </Link>
            {' · '}
            <Link to="/$band/events/$event/print" params={params}>
              Stage-floor PDF
            </Link>
          </>
        )}
        {' · '}
        <HistoryLink item={data.event.id} />
      </p>
      <h1>Setlist</h1>
      {member && (
        <p>
          <button type="button" onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        </p>
      )}
      {member && editing && data.standards.length > 0 && (
        <p className="row">
          <select
            aria-label="Standard setlist"
            value={data.standard?.id ?? ''}
            onChange={(e) => e.target.value && run('useStandardSetlist', { setlist: e.target.value })}
          >
            {!data.standard && <option value="">Custom setlist</option>}
            {data.standards.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {data.standard && (
            <button type="button" onClick={() => run('useCustomSetlist', {})}>
              Customize
            </button>
          )}
        </p>
      )}
      {data.standard && (
        <p>
          Using the standard setlist{' '}
          <Link to="/$band/setlists/$setlist" params={{ band: band.slug, setlist: data.standard.id }}>
            {data.standard.name}
          </Link>
          . Changes there show up here.
        </p>
      )}
      <SetlistBuilder band={band.slug} target={{ event: data.event.slug }} data={data} editable={member && editing && !data.standard} />
    </>
  )
}
