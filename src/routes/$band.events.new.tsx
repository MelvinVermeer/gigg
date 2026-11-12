import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { EventForm } from '#/components/EventForm'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/events/new')({
  loader: ({ params }) => bandOp('eventFormData', params.band, {}),
  component: NewEvent,
})

function NewEvent() {
  const data = Route.useLoaderData()
  const { band } = Route.useParams()
  const navigate = useNavigate()
  const t = useT()
  return (
    <>
      <h1>{t.events.add}</h1>
      <EventForm
        data={data}
        submitLabel={t.events.add}
        onSubmit={async (fields) => {
          const event = await bandOp('createEvent', band, fields)
          await navigate({ to: '/$band/events/$event', params: { band, event: event.slug } })
        }}
      />
    </>
  )
}
