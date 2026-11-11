import { useEffect, useRef, useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { deviceName } from '#/lib/device-name'

const DISMISSED = 'passkey-prompt-dismissed'

/**
 * After an email-link sign-in (login.tsx adds ?passkey=suggest to the link), offer a passkey
 * so the next sign-in skips the email. Not shown if the user already has one, or said "later" on this device.
 */
export function PasskeyPrompt() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const url = new URL(location.href)
    if (!url.searchParams.has('passkey')) return
    url.searchParams.delete('passkey')
    history.replaceState(history.state, '', url)
    try {
      if (localStorage.getItem(DISMISSED)) return
    } catch {}
    authClient.passkey.listUserPasskeys().then((res) => {
      if (res.data?.length === 0) dialog.current?.showModal()
    })
  }, [])

  async function add() {
    const res = await authClient.passkey.addPasskey({ name: deviceName(navigator.userAgent) })
    if (res?.error) setError(res.error.message ?? 'Could not add passkey')
    else dialog.current?.close()
  }

  function later() {
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {}
    dialog.current?.close()
  }

  return (
    <dialog ref={dialog} aria-labelledby="passkey-prompt-title" className="passkey-prompt">
      <h2 id="passkey-prompt-title">Sign in faster next time</h2>
      <p>Add a passkey and sign in with Face ID, Touch ID or your device PIN instead of an email link.</p>
      {error && <p role="alert">{error}</p>}
      <p>
        <button type="button" onClick={add}>
          Add passkey
        </button>{' '}
        <button type="button" onClick={later}>
          I'll configure later via settings
        </button>
      </p>
    </dialog>
  )
}
