import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SetlistBuilder } from '#/components/SetlistBuilder'
import { formatWhen } from '#/lib/date'
import { MonitorPlay, Printer } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'
import { useT } from '#/lib/i18n'

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
  const t = useT()

  async function run(op: 'useStandardSetlist' | 'useCustomSetlist', extra: object) {
    await bandOp(op, band.slug, { event: data.event.slug, ...extra })
    await router.invalidate()
  }

  return (
    <>
      <Link to="/$band/events/$event" params={params} className="text-sm text-muted-foreground hover:text-foreground">
        ← {data.event.title} · {formatWhen(data.event, t.intl)}
      </Link>
      <div className="mt-1 mb-4 flex items-center justify-between gap-3">
        <h1 className="mb-0">{t.common.setlist}</h1>
        {member && (
          <Button size="sm" variant={editing ? 'default' : 'secondary'} onClick={() => setEditing(!editing)}>
            {editing ? t.common.done : t.common.edit}
          </Button>
        )}
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {data.sets.length > 0 && (
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/$band/events/$event/show" params={params}>
                <MonitorPlay aria-hidden /> {t.setlist.showMode}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/$band/events/$event/print" params={params}>
                <Printer aria-hidden /> {t.setlist.stagePdf}
              </Link>
            </Button>
          </>
        )}
        {editing && <HistoryLink item={data.event.id} />}
      </div>
      {member && editing && data.standards.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <NativeSelect
            aria-label={t.setlist.standard}
            value={data.standard?.id ?? ''}
            onChange={(e) => e.target.value && run('useStandardSetlist', { setlist: e.target.value })}
            className="min-w-0 flex-1"
          >
            {!data.standard && <NativeSelectOption value="">{t.setlist.custom}</NativeSelectOption>}
            {data.standards.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {data.standard && (
            <Button variant="outline" onClick={() => run('useCustomSetlist', {})}>
              {t.setlist.customize}
            </Button>
          )}
        </div>
      )}
      {data.standard && (
        <p className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.setlist.usingStandard}{' '}
          <Link to="/$band/setlists/$setlist" params={{ band: band.slug, setlist: data.standard.id }} className="font-medium underline">
            {data.standard.name}
          </Link>
          {t.setlist.changesShowUp}
        </p>
      )}
      <SetlistBuilder band={band.slug} target={{ event: data.event.slug }} data={data} editable={member && editing && !data.standard} />
    </>
  )
}
