import { Link, useParams } from '@tanstack/react-router'

/** Link to the changes of one item (song, event, setlist, block, venue, contact) */
export function HistoryLink({ item }: { item: string }) {
  const { band } = useParams({ strict: false }) as { band: string }
  return (
    <Link to="/$band/history" params={{ band }} search={{ item }}>
      History
    </Link>
  )
}
