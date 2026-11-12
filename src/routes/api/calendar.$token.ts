import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/server/db'
import { calendarByToken, NotFound } from '#/server/ops'
import { toIcs } from '#/lib/ics'
import { dicts, localeOf } from '#/lib/i18n'

/** Subscribed-calendar feed: /api/calendar/<token>.ics. No session; the token is the credential (see ops.ts). */
export const Route = createFileRoute('/api/calendar/$token')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = params.token.replace(/\.ics$/, '')
        try {
          const { band, events } = await calendarByToken(db, token)
          const origin = new URL(request.url).origin
          const body = toIcs({
            name: `gigg – ${band.name}`,
            timeZone: band.timeZone,
            option: dicts[localeOf(band.locale)].calendar.option,
            events: events.map((e) => ({
              id: e.id,
              title: e.title,
              date: e.date,
              startTime: e.startTime,
              endTime: e.endTime,
              tentative: e.bookingStatus === 'option',
              location: [e.venue, e.address].filter(Boolean).join(', ') || null,
              description: e.notes,
              url: `${origin}/${band.slug}/events/${e.slug}`,
            })),
          })
          return new Response(body, {
            headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'private, max-age=300', 'x-robots-tag': 'noindex' },
          })
        } catch (e) {
          if (e instanceof NotFound) return new Response('Not found', { status: 404 })
          throw e
        }
      },
    },
  },
})
