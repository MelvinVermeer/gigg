import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { KeyRound, Mail } from 'lucide-react'
import { Field, FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { Separator } from '#/components/ui/separator'
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
    <main className="mx-auto w-full max-w-sm px-4 pt-16 pb-16">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1} className="text-xl">
            Sign in
          </CardTitle>
          <CardDescription>We'll email you a link, or use a passkey.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {sent ? (
            <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
              Check your email for a sign-in link.
            </p>
          ) : (
            <form onSubmit={sendLink} className="grid gap-3">
              <Field label="Email">
                <Input name="email" type="email" autoComplete="username webauthn" required />
              </Field>
              <Button type="submit">
                <Mail aria-hidden /> Email me a link
              </Button>
            </form>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" /> or <Separator className="flex-1" />
          </div>
          <Button variant="outline" onClick={withPasskey}>
            <KeyRound aria-hidden /> Sign in with a passkey
          </Button>
          <FormError>{error}</FormError>
        </CardContent>
      </Card>
    </main>
  )
}
