import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <h1 className="mt-16 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">Gigs, setlists and riders for bands.</h1>
    </main>
  )
}
