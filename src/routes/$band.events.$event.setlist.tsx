import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SetlistBuilder } from '#/components/SetlistBuilder'
import { SetlistDownload } from '#/components/SetlistDownload'
import { formatWhen } from '#/lib/date'
import { Check, Pencil } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Separator } from '#/components/ui/separator'
import { NativeSelect, NativeSelectOption } from '#/components/ui/native-select'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'
import { useT } from '#/lib/i18n'
import { useOnline } from '#/lib/online'

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
  const online = useOnline()
  // A new, empty setlist opens ready to build.
  const [editing, setEditing] = useState(member && data.sets.length === 0)
  const t = useT()

  async function run(op: 'useStandardSetlist' | 'useCustomSetlist', extra: object) {
    await bandOp(op, band.slug, { event: data.event.slug, ...extra })
    await router.invalidate()
  }
  const pickStandard = (setlist: string) => run('useStandardSetlist', { setlist })
  // The standard setlist waiting for "are you sure?".
  const [confirm, setConfirm] = useState('')

  return (
    <>
      <Link to="/$band/events/$event" params={params} className="text-sm text-muted-foreground hover:text-foreground">
        ← {data.event.title} · {formatWhen(data.event, t.intl)}
      </Link>
      <div className="mt-1 mb-4 flex items-center justify-between gap-3">
        <h1 className="mb-0">{t.common.setlist}</h1>
        {/* Offline you can't start editing, but an edit already open stays (and can be closed). */}
        {member && (online || editing) && (
          // Done refetches, so downloads include what was just edited.
          <Button size="sm" variant="outline" onClick={() => {
            setEditing(!editing)
            if (editing) router.invalidate()
          }}>
            {editing ? <Check aria-hidden /> : <Pencil aria-hidden />} {editing ? t.common.done : t.common.edit}
          </Button>
        )}
      </div>
      {member && editing && data.standards.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <NativeSelect
            aria-label={t.setlist.standard}
            value={data.standard?.id ?? ''}
            // Leaving a custom setlist throws it away: ask first.
            onChange={(e) => e.target.value && (data.standard || !data.sets.length ? pickStandard(e.target.value) : setConfirm(e.target.value))}
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
      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm('')}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.setlist.confirmStandardTitle}</DialogTitle>
            <DialogDescription>{t.setlist.confirmStandardText}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm('')}>
              {t.common.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await pickStandard(confirm)
                setConfirm('')
              }}
            >
              {t.setlist.confirmStandard}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SetlistBuilder
        // A fresh builder when switching between standard and custom.
        key={data.standard?.id ?? 'custom'}
        band={band.slug}
        target={{ event: data.event.slug }}
        data={data}
        editable={member && editing && !data.standard}
        actions={
          data.sets.length > 0 &&
          !editing && (
            <SetlistDownload
              file={data.event.slug}
              sets={data.sets}
              show={<Link to="/$band/events/$event/show" params={params} />}
              print={<Link to="/$band/events/$event/print" params={params} />}
            />
          )
        }
      />
      {member && editing && (
        <>
          <Separator className="my-8" />
          <div className="flex justify-end">
            <HistoryLink item={data.event.id} />
          </div>
        </>
      )}
    </>
  )
}
