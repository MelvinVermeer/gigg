import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main>
      <h1>Gigs, setlists and riders for bands.</h1>
    </main>
  )
}
