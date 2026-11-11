import { createFileRoute } from '@tanstack/react-router'
import { bandOp } from '#/server/fns'

export const Route = createFileRoute('/$band/history')({
  validateSearch: (search: Record<string, unknown>): { item?: string } =>
    typeof search.item === 'string' ? { item: search.item } : {},
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => bandOp('listChanges', params.band, deps),
  component: History,
})

const when = (d: Date) =>
  new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Who changed what, when; each save folds open to show before → after. */
function History() {
  const saves = Route.useLoaderData()
  const { item } = Route.useSearch()

  return (
    <>
      <h1>History</h1>
      <p>Every change{item && ' to this item'}, newest first.</p>
      {!saves.length && <p>No changes yet.</p>}
      <ul className="history">
        {saves.map((s) => (
          <li key={s.txId}>
            <small>
              {when(s.at)} · {s.who}
            </small>
            <details>
              <summary>
                {s.lines.map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </summary>
              <ul className="diffs">
                {s.diffs.map((d, i) => (
                  <li key={i}>
                    <small>
                      {d.what} · {d.field}
                    </small>
                    <div className="diff">
                      <span>{d.from}</span>
                      <span aria-label="changed to">→</span>
                      <span>{d.to}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </>
  )
}
