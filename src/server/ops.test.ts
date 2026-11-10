import { and, eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { changes, memberships } from './db/schema'
import { bandOps, Forbidden, slugify } from './ops'
import { testDb } from './test-db'

describe('authorisation', () => {
  it.each(Object.keys(bandOps) as (keyof typeof bandOps)[])('%s rejects users outside the band', async (op) => {
    const t = await testDb()
    await expect(bandOps[op](t.db, t.outsider, t.band, {})).rejects.toBeInstanceOf(Forbidden)
  })

  it('lets a reader read but not write', async () => {
    const t = await testDb()
    await expect(bandOps.listSongs(t.db, t.reader, t.band, {})).resolves.toHaveLength(3)
    await expect(bandOps.createSong(t.db, t.reader, t.band, { title: 'New' })).rejects.toBeInstanceOf(Forbidden)
  })

  it('rejects members who left the band', async () => {
    const t = await testDb()
    await t.db.update(memberships).set({ archivedAt: new Date() }).where(eq(memberships.userId, t.member))
    await expect(bandOps.listSongs(t.db, t.member, t.band, {})).rejects.toBeInstanceOf(Forbidden)
  })
})

describe('audit trail', () => {
  it('logs a write with the acting user and band', async () => {
    const t = await testDb()
    const song = await bandOps.createSong(t.db, t.member, t.band, { title: 'Brand New Song' })
    const [change] = await t.db
      .select()
      .from(changes)
      .where(and(eq(changes.tableName, 'songs'), eq(changes.rowId, song.id)))
    expect(change).toMatchObject({ action: 'insert', userId: t.member, bandId: song.bandId, before: null })
    expect(change.after).toMatchObject({ title: 'Brand New Song', slug: 'brand-new-song' })
  })

  it('is attached to every table except auth internals', async () => {
    const t = await testDb()
    const notAudited = ['changes', 'sessions', 'accounts', 'verifications', 'passkeys']
    const { rows } = (await t.db.execute(sql`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      except
      select distinct event_object_table from information_schema.triggers where trigger_name = 'audit'`)) as unknown as {
      rows: { table_name: string }[]
    }
    expect(rows.map((r) => r.table_name).filter((n) => !notAudited.includes(n))).toEqual([])
  })
})

it('slugify', () => {
  expect(slugify('A Day in the Life')).toBe('a-day-in-the-life')
  expect(slugify('  Café   Olé!! ')).toBe('cafe-ole')
  expect(slugify('!!!')).toBe('untitled')
})
