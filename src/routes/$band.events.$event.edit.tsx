import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { EventForm } from '#/components/EventForm'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'

export const Route = createFileRoute('/$band/events/$event/edit')({
  loader: async ({ params }) => {
    const [res, data] = await Promise.all([
      bandOp('getEvent', params.band, { slug: params.event }),
      bandOp('eventFormData', params.band, {}),
    ])
    if (res.moved) throw redirect({ to: '/$band/events/$event/edit', params: { ...params, event: res.slug } })
    return { ...res, data }
  },
  component: EditEvent,
})

function EditEvent() {
  const { event, contacts, data } = Route.useLoaderData()
  const { band } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveEvent' : 'restoreEvent', band, { slug: event.slug })
    if (archived) await navigate({ to: '/$band/events', params: { band } })
    else await router.invalidate()
  }

  return (
    <>
      <h1>Edit {event.title}</h1>
      {event.archivedAt && <p role="status">This event is archived.</p>}
      <p>
        <HistoryLink item={event.id} />
      </p>
      <EventForm
        data={data}
        initial={{ ...event, contacts }}
        submitLabel="Save"
        onSubmit={async (fields) => {
          const saved = await bandOp('updateEvent', band, { slug: event.slug, fields })
          await navigate({ to: '/$band/events/$event', params: { band, event: saved.slug } })
        }}
      />
      <p>
        <button type="button" onClick={() => setArchived(!event.archivedAt)}>
          {event.archivedAt ? 'Restore' : 'Archive'}
        </button>
      </p>
    </>
  )
}
