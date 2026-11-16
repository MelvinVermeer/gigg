import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins/magic-link'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'
import { dicts, localeOf, pickLocale } from '#/lib/i18n'
import { db, isLocal, schema } from './db'
import { sendMail } from './mail'

// Local mode (dev/test): admin@example.com is the admin unless ADMIN_EMAILS says otherwise.
const adminEmails = (process.env.ADMIN_EMAILS ?? (isLocal ? 'admin@example.com' : ''))
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const isAdminEmail = (email: string) => adminEmails.includes(email.toLowerCase())

/** Invitation only: accounts are created by an admin (or the seed). Admins may sign themselves up. */
async function account(email: string) {
  const [user] = await db.select({ locale: schema.users.locale }).from(schema.users).where(eq(schema.users.email, email.toLowerCase()))
  return user
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? (isLocal ? 'http://localhost:3000' : undefined),
  secret: process.env.BETTER_AUTH_SECRET ?? (isLocal ? 'local-dev-secret-not-for-production-use' : undefined),
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
      // An admin signing themselves up gets their browser's language.
      create: {
        before: async (user, ctx) =>
          isAdminEmail(user.email) ? { data: { ...user, locale: pickLocale(ctx?.headers?.get('accept-language')) } } : false,
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }, ctx) => {
        const user = await account(email)
        // Same response either way, so this doesn't reveal who has an account.
        if (!user && !isAdminEmail(email)) return
        const t = dicts[user ? localeOf(user.locale) : pickLocale(ctx?.headers?.get('accept-language'))]
        await sendMail({ to: email, subject: t.mail.signInSubject, text: t.mail.signInText(url) })
      },
    }),
    passkey({ rpName: 'Gigg' }),
    tanstackStartCookies(), // must be last
  ],
})
