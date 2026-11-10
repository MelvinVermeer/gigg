import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { magicLink } from 'better-auth/plugins/magic-link'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { eq } from 'drizzle-orm'
import { db, isLocal, schema } from './db'
import { sendMail } from './mail'

const adminEmails = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const isAdminEmail = (email: string) => adminEmails.includes(email.toLowerCase())

/** Invitation only: accounts are created by an admin (or the seed). Admins may sign themselves up. */
async function mayHaveAccount(email: string) {
  if (isAdminEmail(email)) return true
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email.toLowerCase()))
  return !!user
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? (isLocal ? 'http://localhost:3000' : undefined),
  secret: process.env.BETTER_AUTH_SECRET ?? (isLocal ? 'local-dev-secret-not-for-production-use' : undefined),
  database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
  advanced: { database: { generateId: 'uuid' } },
  databaseHooks: {
    user: {
      create: { before: async (user) => (isAdminEmail(user.email) ? undefined : false) },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Same response either way, so this doesn't reveal who has an account.
        if (!(await mayHaveAccount(email))) return
        await sendMail({ to: email, subject: 'Sign in to Gigg', text: `Sign in: ${url}` })
      },
    }),
    passkey({ rpName: 'Gigg' }),
    tanstackStartCookies(), // must be last
  ],
})
