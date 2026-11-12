import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SongForm } from '#/components/SongForm'
import { bandOp } from '#/server/fns'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/songs/new')({ component: NewSong })

function NewSong() {
  const { band } = Route.useParams()
  const navigate = useNavigate()
  const t = useT()
  return (
    <>
      <h1>{t.songs.add}</h1>
      <SongForm
        submitLabel={t.songs.add}
        onSubmit={async (fields) => {
          const song = await bandOp('createSong', band, fields)
          await navigate({ to: '/$band/songs/$song', params: { band, song: song.slug } })
        }}
      />
    </>
  )
}
