import { createFileRoute, redirect } from '@tanstack/react-router'

// The band's start page: upcoming events.
export const Route = createFileRoute('/$band/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/$band/events', params })
  },
})
