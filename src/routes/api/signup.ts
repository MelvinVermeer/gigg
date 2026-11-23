import { createFileRoute } from '@tanstack/react-router'
import { timingSafeEqual } from 'node:crypto'
import { auth, signSignup, signupOpen } from '#/server/auth'
import { db } from '#/server/db'
import { createSignupBand } from '#/server/ops'

const maxAge = 24 * 60 * 60 * 1000 // well past the magic link's own expiry

/** Where the sign-up mail's link lands, signed in: create the band (signUp in fns.ts signed the name) and open it. */
export const Route = createFileRoute('/api/signup')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const session = await auth.api.getSession({ headers: request.headers })
        const [band, t, sig] = ['band', 't', 'sig'].map((k) => url.searchParams.get(k) ?? '')
        const expected = Buffer.from(signSignup([session?.user.email ?? '', band, t]))
        const valid = signupOpen && session && Buffer.byteLength(sig) === expected.length && timingSafeEqual(Buffer.from(sig), expected)
        if (!valid || !(Date.now() - Number(t) < maxAge)) return new Response('Not found', { status: 404 })
        const created = await createSignupBand(db, { email: session.user.email, name: band, since: new Date(Number(t)) })
        return Response.redirect(new URL(`/${created.slug}/welcome?passkey=suggest`, url), 302)
      },
    },
  },
})
