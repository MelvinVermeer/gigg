import { createFileRoute } from '@tanstack/react-router'
import { ChevronDown } from 'lucide-react'
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
      <p className="mb-6 text-muted-foreground">Every change{item && ' to this item'}, newest first.</p>
      {!saves.length && <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">No changes yet.</p>}
      <ul className="history divide-y rounded-xl border bg-card empty:hidden">
        {saves.map((s) => (
          <li key={s.txId} className="grid gap-1 px-4 py-3">
            <small className="text-xs text-muted-foreground">
              {when(s.at)} · {s.who}
            </small>
            <details className="group">
              <summary className="flex items-start gap-2">
                <span className="grid flex-1 text-sm">
                  {s.lines.map((line, i) => (
                    <span key={i}>{line}</span>
                  ))}
                </span>
                <ChevronDown aria-hidden className="mt-0.5 size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <ul className="diffs mt-2 grid gap-2 border-l-2 pl-4">
                {s.diffs.map((d, i) => (
                  <li key={i} className="grid gap-1">
                    <small className="text-xs text-muted-foreground">
                      {d.what} · {d.field}
                    </small>
                    <div className="diff grid gap-1 text-sm whitespace-pre-line [overflow-wrap:anywhere] sm:grid-cols-[1fr_auto_1fr] sm:gap-2">
                      <span className="text-muted-foreground line-through decoration-muted-foreground/50">{d.from}</span>
                      <span aria-label="changed to" className="text-muted-foreground">
                        →
                      </span>
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
