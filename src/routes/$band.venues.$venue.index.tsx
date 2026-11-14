import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Card, CardContent } from '#/components/ui/card'
import { Markdown } from '#/components/Markdown'
import { LinkedEvents } from '#/components/Records'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'
import { useCanEdit } from '#/lib/online'

export const Route = createFileRoute('/$band/venues/$venue/')({
  loader: ({ params }) => bandOp('getVenue', params.band, { slug: params.venue }),
  component: Venue,
})

const bandRoute = getRouteApi('/$band')

function Venue() {
  const { venue, events } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const canEdit = useCanEdit()
  const t = useT()

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/$band/settings/venues" params={{ band: band.slug }} className="text-sm text-muted-foreground hover:text-foreground">
            {t.records.backToVenues}
          </Link>
          <h1 className="mt-1 mb-0">{venue.name}</h1>
        </div>
        {canEdit && (
          <Button asChild variant="outline" size="sm">
            <Link to="/$band/venues/$venue/edit" params={{ band: band.slug, venue: venue.slug }}>
              <Pencil aria-hidden /> {t.common.edit}
            </Link>
          </Button>
        )}
      </div>
      {venue.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.records.venueArchived}
        </p>
      )}
      <Card>
        <CardContent>
          <dl className="fields grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">{t.common.address}</dt>
            <dd>
              {venue.address ? (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`} target="_blank" rel="noreferrer">
                  {venue.address}
                </a>
              ) : (
                '–'
              )}
            </dd>
          </dl>
          {venue.notes && <Markdown className="notes mt-4 border-t pt-4 text-sm">{venue.notes}</Markdown>}
        </CardContent>
      </Card>
      <LinkedEvents band={band.slug} events={events} />
    </>
  )
}
