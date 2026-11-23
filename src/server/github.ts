// Optional: feedback also becomes a GitHub issue (GITHUB_REPO=owner/name, GITHUB_TOKEN with issues:write).
// Only the text goes out: no name, email or band, since a public repo shows issues to everyone.
const { GITHUB_REPO, GITHUB_TOKEN } = process.env

/** The feedback page warns that the text ends up in public when this is on. */
export const feedbackGoesPublic = !!(GITHUB_REPO && GITHUB_TOKEN)

/** Best effort: a GitHub outage never loses the feedback, which is already saved. */
export async function feedbackIssue(body: string) {
  if (!GITHUB_REPO || !GITHUB_TOKEN) return
  const firstLine = body.split('\n')[0].trim()
  const title = firstLine.length > 80 ? `${firstLine.slice(0, 79)}…` : firstLine
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'gigg' },
      body: JSON.stringify({ title: `Feedback: ${title}`, body, labels: ['feedback'] }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) console.error(`[github] issue failed: ${res.status} ${await res.text()}`)
  } catch (e) {
    console.error('[github] issue failed', e)
  }
}
