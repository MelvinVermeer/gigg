import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/history')({
  loader: ({ params }) => bandOp('listChanges', params.band, {}),
  component: History,
})

const bandRoute = getRouteApi('/$band')

const when = (d: Date) =>
  new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Who changed what, when; members can undo any save. */
function History() {
  const saves = Route.useLoaderData()
  const band = bandRoute.useLoaderData()
  const router = useRouter()
  const [message, setMessage] = useState<{ txId: number; text: string }>()

  async function undo(txId: number) {
    const res = await bandOp('undo', band.slug, { txId })
    setMessage({ txId, text: res.ok ? 'Undone' : res.reason })
    if (res.ok) await router.invalidate()
  }

  return (
    <>
      <h1>History</h1>
      <p>Every change, newest first. Undoing is a change too, so it can be undone as well.</p>
      <ul className="history">
        {saves.map((s) => (
          <li key={s.txId}>
            <small>
              {when(s.at)} · {s.who}
            </small>
            {s.lines.map((line, i) => (
              <span key={i}>{line}</span>
            ))}
            {band.role === 'member' && s.canUndo && (
              <span>
                <button type="button" onClick={() => undo(s.txId)}>
                  Undo
                </button>{' '}
                {message?.txId === s.txId && <span role="status">{message.text}</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
