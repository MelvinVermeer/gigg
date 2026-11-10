import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { EventForm } from '#/components/EventForm'
import { bandOp } from '#/server/fns'

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
  return (
    <>
      <h1>Edit {event.title}</h1>
      <EventForm
        data={data}
        initial={{ ...event, contacts }}
        submitLabel="Save"
        onSubmit={async (fields) => {
          const saved = await bandOp('updateEvent', band, { slug: event.slug, fields })
          await navigate({ to: '/$band/events/$event', params: { band, event: saved.slug } })
        }}
      />
    </>
  )
}
