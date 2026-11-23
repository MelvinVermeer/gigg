import { createHmac } from 'node:crypto'
import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins/magic-link'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'
import { dicts, emailLocale, requestLocale } from '#/lib/i18n'
import { db, isLocal, schema } from './db'
import { letter, sendMail } from './mail'

// Local mode (dev/test): admin@example.com is the admin unless ADMIN_EMAILS says otherwise.
export const adminEmails = (process.env.ADMIN_EMAILS ?? (isLocal ? 'admin@example.com' : ''))
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const isAdminEmail = (email: string) => adminEmails.includes(email.toLowerCase())

/** OPEN_SIGNUP: anyone may sign up and start a band (signup.tsx). Off when unset. */
export const signupOpen = ['1', 'true', 'on', 'yes'].includes(process.env.OPEN_SIGNUP?.trim().toLowerCase() ?? '')

const secret = process.env.BETTER_AUTH_SECRET ?? (isLocal ? 'local-dev-secret-not-for-production-use' : undefined)

/** Signs the sign-up callback (email + band name + time), so only the mailed link can create a band. */
export const signSignup = (parts: string[]) => createHmac('sha256', secret ?? '').update(parts.join('\n')).digest('base64url')

/** Invitation only unless sign-up is open: accounts are created by an admin (or the seed). Admins may sign themselves up. */
async function account(email: string) {
  const [user] = await db.select({ locale: schema.users.locale }).from(schema.users).where(eq(schema.users.email, email.toLowerCase()))
  return user
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? (isLocal ? 'http://localhost:3000' : undefined),
  secret,
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  advanced: { database: { generateId: 'uuid' } },
  // Local mode is dev/test only; E2E tests sign in many times in a row.
  rateLimit: { enabled: !isLocal },
  // The user's language: set on invite (the inviter's), changeable in Settings (setLocale in fns.ts).
  // Push notification choices (Settings → Notifications, setNotifications in fns.ts).
  user: {
    additionalFields: {
      locale: { type: 'string', required: false, defaultValue: 'en', input: false },
      notifyAsked: { type: 'boolean', required: false, defaultValue: false, input: false },
      notifyAdded: { type: 'boolean', required: false, defaultValue: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      // Someone signing themselves up (an admin, or anyone with open sign-up) gets their browser's language.
      create: {
        before: async (user, ctx) =>
          signupOpen || isAdminEmail(user.email) ? { data: { ...user, locale: requestLocale(ctx?.headers) } } : false,
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }, ctx) => {
        const user = await account(email)
        // Same response either way, so this doesn't reveal who has an account.
        if (!user && !signupOpen && !isAdminEmail(email)) return
        const locale = emailLocale({ recipient: user?.locale, headers: ctx?.headers })
        const t = dicts[locale].mail
        // Self sign-up (fns.ts signUp) puts the band name in the callback: then the link creates the band.
        const callback = new URL(url).searchParams.get('callbackURL') ?? ''
        const band = callback.startsWith('/api/signup?') ? new URLSearchParams(callback.split('?')[1]).get('band') : null
        await sendMail({
          to: email,
          locale,
          subject: band ? t.signUpSubject(band) : t.signInSubject,
          ...letter({
            kicker: band ? t.signUpKicker : t.signInKicker,
            title: band ?? t.signInTitle,
            lines: [band ? t.signUpText : t.signInText],
            buttons: [{ label: band ? t.signUpButton : t.signInButton, url }],
            note: t.notYou,
          }),
        })
      },
    }),
    passkey({ rpName: 'Gigg' }),
    tanstackStartCookies(), // must be last
  ],
})
