import { getRouteApi } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  addEventListener('online', onChange)
  addEventListener('offline', onChange)
  return () => {
    removeEventListener('online', onChange)
    removeEventListener('offline', onChange)
  }
}

/** Offline the app is read-only: every control that writes to the server hides (forms already open stay). */
export const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true)

const bandRoute = getRouteApi('/$band')

/** Members edit, but only while online. */
export function useCanEdit() {
  const online = useOnline()
  return bandRoute.useLoaderData().role === 'member' && online
}
