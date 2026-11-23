import { appendFile } from 'node:fs/promises'
import nodemailer from 'nodemailer'
import type { Locale } from '#/lib/i18n'
import { isLocal } from './db'

/** `locale`: the language it is written in (emailLocale in i18n.ts picks it). */
type Mail = { to: string; subject: string; text: string; html: string; locale: Locale }

/** Local mode writes mails to the console and `.outbox.jsonl` (read by E2E tests); otherwise SMTP. */
export async function sendMail({ locale, ...mail }: Mail) {
  if (isLocal) {
    console.log(`[mail] to ${mail.to} (${locale}): ${mail.subject}\n${mail.text}`)
    await appendFile('.outbox.jsonl', JSON.stringify({ ...mail, locale }) + '\n')
    return
  }
  // RESEND_API_KEY is a shortcut for Resend's SMTP server; any other provider uses SMTP_URL.
  const key = process.env.RESEND_API_KEY
  const url = process.env.SMTP_URL ?? (key && `smtps://resend:${encodeURIComponent(key)}@smtp.resend.com:465`)
  if (!url) throw new Error('SMTP_URL (or RESEND_API_KEY) is not set')
  await nodemailer
    .createTransport(url)
    .sendMail({ from: process.env.MAIL_FROM ?? 'Gigg <no-reply@gigg.band>', ...mail })
}

export type Letter = {
  kicker: string
  title: string
  lines: string[]
  buttons: { label: string; url: string }[]
  note: string
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"

/**
 * One layout for every mail: a yellow gig ticket with a tear-off stub holding the buttons.
 * Tables and inline styles only, so it holds up in Outlook and Gmail. Text part: same words, links spelled out.
 */
export function letter(l: Letter): { text: string; html: string } {
  const text = [l.title, '', ...l.lines, '', ...l.buttons.map((b) => `${b.label}: ${b.url}`), '', l.note].join('\n')
  const pill = (b: Letter['buttons'][number], extra: string) =>
    `<a href="${esc(b.url)}" style="background:#111111;color:#FFD400;text-decoration:none;font-weight:700;font-size:15px;line-height:20px;padding:11px 18px;border-radius:999px;white-space:nowrap;${extra}">${esc(b.label)}</a>`
  // Several buttons (Yes / Maybe / No): equal-width cells in one row, so they never wrap onto a second line.
  const buttons =
    l.buttons.length === 1
      ? pill(l.buttons[0], 'display:inline-block;')
      : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${l.buttons
          .map(
            (b, i) =>
              `<td width="${Math.floor(100 / l.buttons.length)}%" style="padding:0 ${i < l.buttons.length - 1 ? 8 : 0}px 0 0">${pill(b, 'display:block;text-align:center;padding-left:4px;padding-right:4px;')}</td>`,
          )
          .join('')}</tr></table>`
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><title>${esc(l.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4"><tr><td align="center" style="padding:32px 16px;font-family:${font}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">
<tr><td align="center" style="padding:0 0 14px;font-weight:800;font-size:20px;letter-spacing:-0.3px;color:#111111">gigg</td></tr>
<tr><td style="background:#FFD400;border-radius:14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:28px 28px 22px;color:#111111">
<div style="font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#5c5200">${esc(l.kicker)}</div>
<div style="margin:6px 0 12px;font-size:26px;font-weight:800;line-height:1.15">${esc(l.title)}</div>
${l.lines.map((s) => `<p style="margin:0 0 8px;font-size:15px;line-height:1.55">${esc(s)}</p>`).join('\n')}
</td></tr>
<tr><td style="border-top:2px dashed #8a7a00;padding:14px 28px 16px">${buttons}</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:16px 8px 0;font-size:12px;line-height:1.5;color:#888888">${esc(l.note)}</td></tr>
</table>
</td></tr></table>
</body></html>`
  return { text, html }
}
