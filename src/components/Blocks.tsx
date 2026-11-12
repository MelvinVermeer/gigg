import { getRouteApi, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { SongListEditor, totalDuration } from '#/components/SongListEditor'
import type { SongRef } from '#/components/SongListEditor'
import { formatDuration } from '#/lib/duration'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { Field } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { bandOp } from '#/server/fns'
import { HistoryLink } from '#/components/HistoryLink'
import { useT } from '#/lib/i18n'

const bandRoute = getRouteApi('/$band')

type Block = { id: string; name: string; archivedAt: Date | null; songs: SongRef[] }

/** Create and edit blocks. `archived` lists the archived ones instead. */
export function Blocks({ blocks, songs, archived, }: { blocks: Block[]; songs: SongRef[]; archived: boolean }) {
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const editable = band.role === 'member'
  const t = useT()
  const [newId, setNewId] = useState<string>()

  async function create() {
    const { id } = await bandOp('saveBlock', band.slug, { name: t.blocks.newDefault, songIds: [] })
    await router.invalidate()
    setNewId(id)
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="blocks" className="mb-0">{archived ? t.blocks.archivedList : t.common.blocks}</h2>
        {!archived && editable && (
          <Button size="sm" onClick={create}>
            <Plus aria-hidden /> <span className="max-sm:sr-only">{t.blocks.create}</span>
          </Button>
        )}
      </div>
      {!archived && (
        <p className="mb-6 text-muted-foreground">{t.blocks.intro}</p>
      )}
      {blocks.length ? (
        <ul className="records divide-y rounded-xl border bg-card">
          {blocks.map((b) => (
            <BlockRow key={b.id} block={b} repertoire={songs} editable={editable} isNew={b.id === newId} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">{archived ? t.blocks.noArchived : t.blocks.none}</p>
      )}
    </>
  )
}

function BlockRow({ block, repertoire, editable, isNew }: { block: Block; repertoire: SongRef[]; editable: boolean; isNew: boolean }) {
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const [name, setName] = useState(block.name)
  const [songs, setSongs] = useState(block.songs)
  const [saved, setSaved] = useState(false)
  const t = useT()
  const details = useRef<HTMLDetailsElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)

  // A just-created block opens with its placeholder name selected, ready to type over.
  useEffect(() => {
    if (!isNew || !details.current) return
    details.current.open = true
    details.current.scrollIntoView({ block: 'center' })
    nameInput.current?.select()
  }, [isNew])

  async function save() {
    await bandOp('saveBlock', band.slug, { id: block.id, name, songIds: songs.map((s) => s.id) })
    setSaved(true)
    await router.invalidate()
  }

  async function setArchived(archived: boolean) {
    await bandOp(archived ? 'archiveBlock' : 'restoreBlock', band.slug, { id: block.id })
    await router.invalidate()
  }

  return (
    <li>
      <details ref={details} className="group">
        <summary className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
          <span className="grid flex-1 gap-0.5">
            <span className="font-medium">{block.name}</span>
            <span className="text-sm text-muted-foreground">
              {t.common.songCount(block.songs.length)} · {formatDuration(totalDuration(block.songs)) || '0:00'}
            </span>
          </span>
          <ChevronDown aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-4 border-t px-4 py-4">
          {editable && (
            <Field label={t.common.name}>
              <Input
                ref={nameInput}
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value)
                  setSaved(false)
                }}
              />
            </Field>
          )}
          <SongListEditor
            band={band.slug}
            label={name || block.name}
            songs={songs}
            repertoire={repertoire}
            editable={editable && !block.archivedAt}
            onChange={(next) => {
              setSongs(next)
              setSaved(false)
            }}
          />
          {editable && (
            <div className="flex flex-wrap items-center gap-2">
              {!block.archivedAt && (
                <Button onClick={save} aria-live="polite">
                  {saved ? (
                    <>
                      <Check aria-hidden /> {t.common.saved}
                    </>
                  ) : (
                    t.common.save
                  )}
                </Button>
              )}
              <Button variant="outline" onClick={() => setArchived(!block.archivedAt)}>
                {block.archivedAt ? t.common.restore : t.common.archive}
              </Button>
              <span className="ml-auto">
                <HistoryLink item={block.id} />
              </span>
            </div>
          )}
        </div>
      </details>
    </li>
  )
}
