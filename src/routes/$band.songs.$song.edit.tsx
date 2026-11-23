import { createFileRoute, getRouteApi, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { SongForm } from '#/components/SongForm'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/songs/$song/edit')({
  loader: async ({ params }) => {
    const res = await bandOp('getSong', params.band, { slug: params.song })
    if (res.moved) throw redirect({ to: '/$band/songs/$song/edit', params: { ...params, song: res.slug } })
    return res.song
  },
  component: EditSong,
})

const bandRoute = getRouteApi('/$band')

function EditSong() {
  const song = Route.useLoaderData()
  const { songFields } = bandRoute.useLoaderData()
  const { band } = Route.useParams()
  const navigate = useNavigate()
  const t = useT()
  const router = useRouter()

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveSong' : 'restoreSong', band, { slug: song.slug })
    if (archived) await navigate({ to: '/$band/songs', params: { band } })
    else await router.invalidate()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="mb-0">{t.songs.editTitle(song.title)}</h1>
        <Button type="submit" form="song-form">
          {t.common.save}
        </Button>
      </div>
      {song.archivedAt && (
        <p role="status" className="mb-4 rounded-md bg-muted px-3 py-2 text-sm">
          {t.songs.isArchived}
        </p>
      )}
      <SongForm
        id="song-form"
        initial={song}
        customFields={songFields}
        submitLabel={t.common.save}
        onSubmit={async (fields) => {
          const saved = await bandOp('updateSong', band, { slug: song.slug, fields })
          await navigate({ to: '/$band/songs/$song', params: { band, song: saved.slug } })
        }}
      />
      <Separator className="my-8" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setArchived(!song.archivedAt)}>
          {song.archivedAt ? t.common.restore : t.common.archive}
        </Button>
        <HistoryLink item={song.id} />
      </div>
    </>
  )
}
