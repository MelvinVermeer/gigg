import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { EventForm } from '#/components/EventForm'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/events/$event/edit')({
  loader: async ({ params }) => {
    const [res, data] = await Promise.all([
      bandOp('getEvent', params.band, { slug: params.event }),
      bandOp('eventFormData', params.band, {}),
    ])
    if (res.moved) throw redirect({ to: '/$band/events/$event/edit', params: { ...params, event: res.slug } })
    const { people } = await bandOp('getAvailability', params.band, { event: res.event.slug })
    return { ...res, data, participants: people.map((p) => p.userId) }
  },
  component: EditEvent,
})

function EditEvent() {
  const { event, contacts, data, participants } = Route.useLoaderData()
  const { band } = Route.useParams()
  const navigate = useNavigate()
  const t = useT()
  const router = useRouter()

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveEvent' : 'restoreEvent', band, { slug: event.slug })
    if (archived) await navigate({ to: '/$band/events', params: { band } })
    else await router.invalidate()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{t.events.editTitle(event.title)}</h1>
        <Button type="submit" form="event-form">
          {t.common.save}
        </Button>
      </div>
      {event.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.events.isArchived}
        </p>
      )}
      <EventForm
        id="event-form"
        data={data}
        initial={{ ...event, contacts }}
        participants={participants}
        submitLabel={t.common.save}
        onSubmit={async (fields) => (await bandOp('updateEvent', band, { slug: event.slug, fields })).slug}
        onSaved={(slug) => navigate({ to: '/$band/events/$event', params: { band, event: slug } })}
      />
      <Separator className="my-8" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setArchived(!event.archivedAt)}>
          {event.archivedAt ? t.common.restore : t.common.archive}
        </Button>
        <HistoryLink item={event.id} />
      </div>
    </>
  )
}
