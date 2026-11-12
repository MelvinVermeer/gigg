import { Link, createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { formatDuration } from '#/lib/duration'
import { Music, Plus } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { bandOp } from '#/server/fns'
import { archivedSearch } from '#/lib/archived'
import { Blocks } from '#/components/Blocks'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/$band/setlists/')({
  validateSearch: archivedSearch,
  loaderDeps: ({ search }) => ({ archived: !!search.archived }),
  loader: async ({ params, deps }) => ({
    setlists: await bandOp('listSetlists', params.band, { archived: deps.archived }),
    blocks: await bandOp('listBlocks', params.band, { archived: deps.archived }),
  }),
  component: Setlists,
})

const bandRoute = getRouteApi('/$band')

/** Setlists not tied to an event: a standard show, a festival set. Events start from a copy. */
function Setlists() {
  const { setlists, blocks } = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const { archived } = Route.useSearch()
  const t = useT()

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const { id } = await bandOp('createSetlist', band.slug, { name })
    await navigate({ to: '/$band/setlists/$setlist', params: { band: band.slug, setlist: id } })
  }

  return (
    <>
      <h1>{archived ? t.setlist.archivedList : t.common.setlists}</h1>
      {archived ? (
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/$band/setlists" params={{ band: band.slug }}>
            {t.setlist.back2}
          </Link>
        </Button>
      ) : (
        <p className="mb-6 text-muted-foreground">{t.setlist.intro}</p>
      )}
      {!archived && band.role === 'member' && (
        <form className="mb-6 flex gap-2" onSubmit={create}>
          <Input aria-label={t.setlist.newName} placeholder={t.setlist.newPlaceholder} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit">
            <Plus aria-hidden /> {t.setlist.create}
          </Button>
        </form>
      )}
      <ul className="records divide-y rounded-xl border bg-card">
        {setlists.map((s) => (
          <li key={s.id} className="relative grid gap-0.5 px-4 py-3 hover:bg-muted/50">
            <Link to="/$band/setlists/$setlist" params={{ band: band.slug, setlist: s.id }} className="font-medium after:absolute after:inset-0">
              {s.name}
            </Link>
            <span className="text-sm text-muted-foreground">
              {t.common.songCount(s.songs)} · {formatDuration(s.durationSec) || '0:00'}
            </span>
          </li>
        ))}
        {!setlists.length && <li className="px-4 py-6 text-center text-muted-foreground">{archived ? t.setlist.noArchived : t.setlist.none}</li>}
        {!archived && (
          <li className="relative px-4 py-3 hover:bg-muted/50">
            <Link to="/$band/songs" params={{ band: band.slug }} className="flex items-center gap-2 font-medium after:absolute after:inset-0">
              <Music aria-hidden className="size-4 text-muted-foreground" /> {t.setlist.allSongs}
            </Link>
          </li>
        )}
      </ul>
      <section className="mt-10">
        <Blocks blocks={blocks.blocks} songs={blocks.songs} archived={!!archived} />
      </section>
    </>
  )
}
