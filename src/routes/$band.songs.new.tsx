import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SongForm } from '#/components/SongForm'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/songs/new')({ component: NewSong })

function NewSong() {
  const { band } = Route.useParams()
  const navigate = useNavigate()
  return (
    <>
      <h1>Add song</h1>
      <SongForm
        submitLabel="Add song"
        onSubmit={async (fields) => {
          const song = await bandOp('createSong', band, fields)
          await navigate({ to: '/$band/songs/$song', params: { band, song: song.slug } })
        }}
      />
    </>
  )
}
