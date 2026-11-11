import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/login')({ component: Login })

function Login() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function sendLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email'))
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: '/me?passkey=suggest' })
    if (error) setError(error.message ?? 'Something went wrong')
    else setSent(true)
  }

  async function withPasskey() {
    const { error } = await authClient.signIn.passkey()
    if (error) setError(error.message ?? 'Passkey sign-in failed')
    // Full page load, like the email link: every loader (and the user menu) starts fresh.
    else window.location.assign('/me')
  }

  return (
    <main>
      <h1>Sign in</h1>
      {sent ? (
        <p role="status">Check your email for a sign-in link.</p>
      ) : (
        <form onSubmit={sendLink}>
          <label>
            Email <input name="email" type="email" autoComplete="username webauthn" required />
          </label>{' '}
          <button type="submit">Email me a link</button>
        </form>
      )}
      <p>
        <button type="button" onClick={withPasskey}>
          Sign in with a passkey
        </button>
      </p>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
