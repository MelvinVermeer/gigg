import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'
import { PhoneLink } from '#/components/PhoneLink'
import { RecordList } from '#/components/RecordList'
import type { Field } from '#/components/RecordList'
import { bandOp } from '#/server/fns'
import { archivedSearch } from '#/lib/archived'
import type { ContactFields } from '#/server/ops'
import { useT } from '#/lib/i18n'
import type { Dict } from '#/lib/i18n'

export const Route = createFileRoute('/$band/settings/contacts')({
  validateSearch: archivedSearch,
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listContacts', params.band, { archived: deps.archived }),
  component: Contacts,
})

const bandRoute = getRouteApi('/$band')

const fields = (t: Dict): Field[] => [
  { name: 'name', label: t.common.name, required: true, max: 200 },
  { name: 'organisation', label: t.common.organisation, max: 200 },
  { name: 'email', label: t.common.email, type: 'email', max: 200 },
  { name: 'phone', label: t.common.phone, type: 'tel', max: 50 },
  { name: 'notes', label: t.common.notes, type: 'textarea', max: 10_000 },
]

function Contacts() {
  const contacts = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
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
        fields={fields(t)}
        detail={(c) =>
          (c.organisation || c.phone || c.email) && (
            <>
              {c.organisation}
              {c.organisation && (c.phone || c.email) && ' · '}
              {c.phone ? <PhoneLink name={c.name} phone={c.phone} /> : c.email}
            </>
          )
        }
        canEdit={band.role === 'member'}
        onSave={async (id, values) => {
          await bandOp('updateContact', band.slug, { id, fields: values as ContactFields })
          await router.invalidate()
        }}
        onArchive={async (id, archived) => {
          await bandOp(archived ? 'archiveContact' : 'restoreContact', band.slug, { id })
          await router.invalidate()
        }}
      />
    </>
  )
}
