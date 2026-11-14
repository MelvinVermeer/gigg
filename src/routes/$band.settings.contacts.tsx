import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { PhoneLink } from '#/components/PhoneLink'
import { RecordList } from '#/components/Records'
import { bandOp } from '#/server/fns'
import { archivedSearch } from '#/lib/archived'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/settings/contacts')({
  validateSearch: archivedSearch,
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listContacts', params.band, { archived: deps.archived }),
  component: Contacts,
})

const bandRoute = getRouteApi('/$band')

function Contacts() {
  const contacts = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const { archived } = Route.useSearch()
  const t = useT()
  return (
    <>
      <h1>{archived ? t.records.archivedContacts : t.common.contacts}</h1>
      {archived && (
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/$band/settings/contacts" params={{ band: band.slug }}>
            {t.records.backToContacts}
          </Link>
        </Button>
      )}
      <RecordList
        items={contacts}
        name={(c) => (
          <Link to="/$band/contacts/$contact" params={{ band: band.slug, contact: c.id }} className="hover:underline">
            {c.name}
          </Link>
        )}
        detail={(c) =>
          (c.organisation || c.phone || c.email) && (
            <>
              {c.organisation}
              {c.organisation && (c.phone || c.email) && ' · '}
              {c.phone ? <PhoneLink name={c.name} phone={c.phone} /> : c.email}
            </>
          )
        }
      />
    </>
  )
}
