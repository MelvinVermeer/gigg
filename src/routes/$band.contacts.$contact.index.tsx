import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Markdown } from '#/components/Markdown'
import { PhoneLink } from '#/components/PhoneLink'
import { LinkedEvents } from '#/components/Records'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'
import { useCanEdit } from '#/lib/online'

export const Route = createFileRoute('/$band/contacts/$contact/')({
  loader: ({ params }) => bandOp('getContact', params.band, { id: params.contact }),
  component: Contact,
})

const bandRoute = getRouteApi('/$band')

function Contact() {
  const { contact, events } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const canEdit = useCanEdit()
  const t = useT()

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/$band/settings/contacts" params={{ band: band.slug }} className="text-sm text-muted-foreground hover:text-foreground">
            {t.records.backToContacts}
          </Link>
          <h1 className="mt-1 mb-0">{contact.name}</h1>
        </div>
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link to="/$band/contacts/$contact/edit" params={{ band: band.slug, contact: contact.id }}>
              <Pencil aria-hidden /> {t.common.edit}
            </Link>
          </Button>
        )}
      </div>
      {contact.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.records.contactArchived}
        </p>
      )}
      <Card>
        <CardContent>
          <dl className="fields grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">{t.common.organisation}</dt>
            <dd>{contact.organisation || '–'}</dd>
            <dt className="text-muted-foreground">{t.common.phone}</dt>
            <dd>{contact.phone ? <PhoneLink name={contact.name} phone={contact.phone} /> : '–'}</dd>
            <dt className="text-muted-foreground">{t.common.email}</dt>
            <dd className="break-all">{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : '–'}</dd>
          </dl>
          {contact.notes && <Markdown className="notes mt-4 border-t pt-4 text-sm">{contact.notes}</Markdown>}
        </CardContent>
      </Card>
      <LinkedEvents band={band.slug} events={events} />
    </>
  )
}
