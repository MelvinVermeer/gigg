import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import { Mail } from 'lucide-react'
import { Field, FormError } from '#/components/Field'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { Input } from '#/components/ui/input'
import { useT } from '#/lib/i18n'
import { getMe, signUp } from '#/server/fns'

/** Self-service sign-up (OPEN_SIGNUP). The band is created when the mailed link is opened (api/signup.ts). */
export const Route = createFileRoute('/signup')({
  loader: async () => {
    if (!(await getMe()).signupOpen) throw notFound()
  },
  component: Signup,
})

function Signup() {
  const t = useT()
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      await signUp({ data: { email: String(form.get('email')), band: String(form.get('band')) } })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.somethingWrong)
    }
  }

  return (
    <main className="mx-auto w-full max-w-sm px-4 pt-16 pb-16">
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1} className="text-xl">
            {t.signup.title}
          </CardTitle>
          <CardDescription>{t.signup.intro}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {sent ? (
            <p role="status" className="rounded-md bg-muted px-3 py-2 text-sm">
              {t.signup.checkEmail}
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              <Field label={t.common.email}>
                <Input name="email" type="email" autoComplete="email" required />
              </Field>
              <Field label={t.signup.band}>
                <Input name="band" required maxLength={200} autoComplete="organization" />
              </Field>
              <Button type="submit">
                <Mail aria-hidden /> {t.signup.submit}
              </Button>
              <p className="text-xs text-muted-foreground">
                <Link to="/privacy" className="underline">
                  {t.signup.privacy}
                </Link>
              </p>
            </form>
          )}
          <FormError>{error}</FormError>
          <Link to="/login" className="text-sm underline">
            {t.signup.haveAccount}
          </Link>
        </CardContent>
      </Card>
    </main>
  )
}
