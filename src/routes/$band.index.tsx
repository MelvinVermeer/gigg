import { createFileRoute, redirect } from '@tanstack/react-router'

// The band home becomes an overview (upcoming gigs) later; for now it's the repertoire.
export const Route = createFileRoute('/$band/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$band/songs', params })
  },
})
