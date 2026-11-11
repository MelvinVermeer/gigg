import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { SongForm } from '#/components/SongForm'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'

export const Route = createFileRoute('/$band/songs/$song/edit')({
  loader: async ({ params }) => {
    const res = await bandOp('getSong', params.band, { slug: params.song })
    if (res.moved) throw redirect({ to: '/$band/songs/$song/edit', params: { ...params, song: res.slug } })
    return res.song
  },
  component: EditSong,
})

function EditSong() {
  const song = Route.useLoaderData()
  const { band } = Route.useParams()
  const navigate = useNavigate()
  const router = useRouter()

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveSong' : 'restoreSong', band, { slug: song.slug })
    if (archived) await navigate({ to: '/$band/songs', params: { band } })
    else await router.invalidate()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">Edit {song.title}</h1>
        <HistoryLink item={song.id} />
      </div>
      {song.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          This song is archived.
        </p>
      )}
      <SongForm
        initial={song}
        submitLabel="Save"
        onSubmit={async (fields) => {
          const saved = await bandOp('updateSong', band, { slug: song.slug, fields })
          await navigate({ to: '/$band/songs/$song', params: { band, song: saved.slug } })
        }}
      />
      <Separator className="my-8" />
      <Button variant="outline" onClick={() => setArchived(!song.archivedAt)}>
        {song.archivedAt ? 'Restore' : 'Archive'}
      </Button>
    </>
  )
}
