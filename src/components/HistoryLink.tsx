import { Link, useParams } from '@tanstack/react-router'
import { History } from 'lucide-react'
import { Button } from '#/components/ui/button'

/** Link to the changes of one item (song, event, setlist, block, venue, contact) */
export function HistoryLink({ item }: { item: string }) {
  const { band } = useParams({ strict: false }) as { band: string }
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to="/$band/history" params={{ band }} search={{ item }}>
        <History aria-hidden /> History
      </Link>
    </Button>
  )
}
