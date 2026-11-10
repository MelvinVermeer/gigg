import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { SongForm } from '#/components/SongForm'
import { bandOp } from '#/server/fns'

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
  return (
    <>
      <h1>Edit {song.title}</h1>
      <SongForm
        initial={song}
        submitLabel="Save"
        onSubmit={async (fields) => {
          const saved = await bandOp('updateSong', band, { slug: song.slug, fields })
          await navigate({ to: '/$band/songs/$song', params: { band, song: saved.slug } })
        }}
      />
    </>
  )
}
