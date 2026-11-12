import { createFileRoute } from '@tanstack/react-router'
import { useT } from '#/lib/i18n'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const t = useT()
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16">
      <h1 className="mt-16 max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">{t.home.tagline}</h1>
    </main>
  )
}
