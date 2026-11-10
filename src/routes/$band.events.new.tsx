import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { EventForm } from '#/components/EventForm'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/events/new')({
  loader: ({ params }) => bandOp('eventFormData', params.band, {}),
  component: NewEvent,
})

function NewEvent() {
  const data = Route.useLoaderData()
  const { band } = Route.useParams()
  const navigate = useNavigate()
  return (
    <>
      <h1>Add event</h1>
      <EventForm
        data={data}
        submitLabel="Add event"
        onSubmit={async (fields) => {
          const event = await bandOp('createEvent', band, fields)
          await navigate({ to: '/$band/events/$event', params: { band, event: event.slug } })
        }}
      />
    </>
  )
}
