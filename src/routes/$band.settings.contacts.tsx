import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { RecordList } from '#/components/RecordList'
import type { Field } from '#/components/RecordList'
import { bandOp } from '#/server/fns'
import { archivedSearch } from '#/lib/archived'
import type { ContactFields } from '#/server/ops'

export const Route = createFileRoute('/$band/settings/contacts')({
  validateSearch: archivedSearch,
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: ({ params, deps }) => bandOp('listContacts', params.band, { archived: deps.archived }),
  component: Contacts,
})

const bandRoute = getRouteApi('/$band')

const fields: Field[] = [
  { name: 'name', label: 'Name', required: true, max: 200 },
  { name: 'organisation', label: 'Organisation', max: 200 },
  { name: 'email', label: 'Email', type: 'email', max: 200 },
  { name: 'phone', label: 'Phone', type: 'tel', max: 50 },
  { name: 'notes', label: 'Notes', type: 'textarea', max: 10_000 },
]

function Contacts() {
  const contacts = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const { archived } = Route.useSearch()
  return (
    <>
      <h1>{archived ? 'Archived contacts' : 'Contacts'}</h1>
      {archived && (
        <p>
          <Link to="/$band/settings/contacts" params={{ band: band.slug }}>
            Back to contacts
          </Link>
        </p>
      )}
      <RecordList
        items={contacts}
        fields={fields}
        detail={(c) => [c.organisation, c.phone ?? c.email].filter(Boolean).join(' · ') || null}
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
