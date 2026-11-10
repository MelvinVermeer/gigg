import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/settings')({ component: Settings })

function Settings() {
  const [status, setStatus] = useState('')

  async function addPasskey() {
    const res = await authClient.passkey.addPasskey()
    setStatus(res?.error ? (res.error.message ?? 'Could not add passkey') : 'Passkey added')
  }

  return (
    <main>
      <h1>Settings</h1>
      <p>
        <button type="button" onClick={addPasskey}>
          Add a passkey
        </button>
      </p>
      {status && <p role="status">{status}</p>}
    </main>
  )
}
