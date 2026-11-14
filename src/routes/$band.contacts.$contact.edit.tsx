import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { HistoryLink } from '#/components/HistoryLink'
import { RecordForm } from '#/components/Records'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { bandOp } from '#/server/fns'
import type { ContactFields } from '#/server/ops'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/contacts/$contact/edit')({
  loader: async ({ params }) => (await bandOp('getContact', params.band, { id: params.contact })).contact,
  component: EditContact,
})

function EditContact() {
  const contact = Route.useLoaderData()
  const { band } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()
  const t = useT()
  const params = { band, contact: contact.id }

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveContact' : 'restoreContact', band, { id: contact.id })
    if (archived) await navigate({ to: '/$band/settings/contacts', params: { band } })
    else await router.invalidate()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{t.records.editTitle(contact.name)}</h1>
        <HistoryLink item={contact.id} />
      </div>
      {contact.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.records.contactArchived}
        </p>
      )}
      <RecordForm
        initial={contact}
        fields={[
          { name: 'name', label: t.common.name, required: true, max: 200 },
          { name: 'organisation', label: t.common.organisation, max: 200 },
          { name: 'email', label: t.common.email, type: 'email', max: 200 },
          { name: 'phone', label: t.common.phone, type: 'tel', max: 50 },
          { name: 'notes', label: t.common.notes, type: 'textarea', max: 10_000 },
        ]}
        onSubmit={async (values) => {
          await bandOp('updateContact', band, { id: contact.id, fields: values as ContactFields })
          await navigate({ to: '/$band/contacts/$contact', params })
        }}
      />
      <Separator className="my-8" />
      <Button variant="outline" onClick={() => setArchived(!contact.archivedAt)}>
        {contact.archivedAt ? t.common.restore : t.common.archive}
      </Button>
    </>
  )
}
