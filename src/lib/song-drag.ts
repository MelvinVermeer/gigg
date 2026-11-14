import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Gap } from '#/lib/drop'

/**
 * Drag a row to another spot, another list, or out (null = remove).
 * DOM contract: rows are `[data-drag-row]` inside a `[data-drop-zone]` (one per list, in list order) inside a `[data-drag-scope]`;
 * an empty zone marks where its first row would go with `[data-drop-empty]`.
 * Plain DOM while dragging (ghost, yellow line); React only hears about the drop.
 */
export type OnDrop = (from: Gap, to: Gap | null) => void

const LONG_PRESS_MS = 300
const SLOP_PX = 8
/** A drop this close to the screen's side edge removes (phones have barely any room outside the cards). */
const EDGE_PX = 24
const SCROLL_ZONE_PX = 56

let dragging = false
/** For a non-passive touchmove listener on the list: while dragging, the page must not scroll under the finger. */
export const preventScrollWhileDragging = (e: TouchEvent) => dragging && e.preventDefault()

/** Touch: long-press anywhere on the row. Moving first means scrolling, so that cancels. */
export function onRowPointerDown(e: ReactPointerEvent<HTMLElement>, onDrop: OnDrop) {
  if (e.pointerType === 'mouse' || !e.isPrimary) return
  const row = e.currentTarget
  const id = e.pointerId
  const x = e.clientX
  const y = e.clientY
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return
    if (Math.hypot(ev.clientX - x, ev.clientY - y) > SLOP_PX) stop()
  }
  const timer = setTimeout(() => {
    stop()
    begin(row, x, y, id, onDrop)
  }, LONG_PRESS_MS)
  function stop() {
    clearTimeout(timer)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
  window.addEventListener('pointercancel', stop)

  // Android's long-press menu would land mid-drag; keep it off until the finger lifts.
  const noMenu = (ev: Event) => ev.preventDefault()
  const lift = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return
    window.removeEventListener('pointerup', lift)
    window.removeEventListener('pointercancel', lift)
    setTimeout(() => window.removeEventListener('contextmenu', noMenu))
  }
  window.addEventListener('contextmenu', noMenu)
  window.addEventListener('pointerup', lift)
  window.addEventListener('pointercancel', lift)
}

/** Mouse: drag by the grip handle, right away. */
export function onHandlePointerDown(e: ReactPointerEvent<HTMLElement>, onDrop: OnDrop) {
  if (e.pointerType !== 'mouse' || e.button !== 0) return // touch goes through the row's long-press
  e.preventDefault() // no text selection
  begin(e.currentTarget.closest<HTMLElement>('[data-drag-row]')!, e.clientX, e.clientY, e.pointerId, onDrop)
}

const rowsOf = (zone: Element) => [...zone.querySelectorAll<HTMLElement>('[data-drag-row]')]

function begin(row: HTMLElement, x0: number, y0: number, pointerId: number, onDrop: OnDrop) {
  const zones = [...row.closest('[data-drag-scope]')!.querySelectorAll<HTMLElement>('[data-drop-zone]')]
  const fromZone = row.closest('[data-drop-zone]')!
  const from = { list: zones.indexOf(fromZone as HTMLElement), index: rowsOf(fromZone).indexOf(row) }
  dragging = true
  // A short tick on Android. iPhone has no way: since iOS 26.5 only a real tap on an `<input switch>` ticks, and a long-press drag never is one.
  navigator.vibrate?.(10)

  const rect = row.getBoundingClientRect()
  const ghost = row.cloneNode(true) as HTMLElement
  ghost.removeAttribute('data-drag-row')
  ghost.classList.add('drag-ghost')
  Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
  ghost.insertAdjacentHTML('beforeend', BIN)
  const line = document.createElement('div')
  line.className = 'drag-line'
  document.body.append(ghost, line)
  document.documentElement.classList.add('dragging')
  row.classList.add('drag-source')

  let x = x0
  let y = y0
  let to: Gap | null = from

  function target(): Gap | null {
    if (x < EDGE_PX || x > innerWidth - EDGE_PX) return null
    const rects = zones.map((z) => z.getBoundingClientRect())
    const first = rects[0]
    if (y < first.top || y > rects[rects.length - 1].bottom || x < first.left || x > first.right) return null
    // The zone under the pointer; in the gap between two, the nearer one.
    let list = rects.findIndex((r) => y <= r.bottom)
    if (list > 0 && y < rects[list].top && y - rects[list - 1].bottom < rects[list].top - y) list--
    const rows = rowsOf(zones[list]).map((r) => r.getBoundingClientRect())
    return { list, index: rows.filter((r) => r.top + r.height / 2 < y).length }
  }

  function render() {
    ghost.style.transform = `translate(${x - x0}px, ${y - y0}px)`
    ghost.classList.toggle('drag-remove', !to)
    line.hidden = !to
    if (!to) return
    const rows = rowsOf(zones[to.list]).map((r) => r.getBoundingClientRect())
    const at = rows.length ? rows[Math.min(to.index, rows.length - 1)] : zones[to.list].querySelector('[data-drop-empty]')!.getBoundingClientRect()
    const top = rows.length && to.index === rows.length ? at.bottom : at.top
    Object.assign(line.style, { left: `${at.left}px`, width: `${at.width}px`, top: `${top}px` })
  }

  let frame = 0
  function tick() {
    // Auto-scroll near the top/bottom edge, faster the closer the pointer.
    if (y < SCROLL_ZONE_PX) scrollBy(0, -(SCROLL_ZONE_PX - y) / 3)
    else if (y > innerHeight - SCROLL_ZONE_PX) scrollBy(0, (y - innerHeight + SCROLL_ZONE_PX) / 3)
    to = target()
    render()
    frame = requestAnimationFrame(tick)
  }
  tick()

  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    x = e.clientX
    y = e.clientY
  }
  const up = (e: PointerEvent) => e.pointerId === pointerId && end(true)
  const cancel = (e: PointerEvent) => e.pointerId === pointerId && end(false)
  const key = (e: KeyboardEvent) => e.key === 'Escape' && end(false)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', key)

  function end(drop: boolean) {
    cancelAnimationFrame(frame)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', key)
    ghost.remove()
    line.remove()
    document.documentElement.classList.remove('dragging')
    row.classList.remove('drag-source')
    dragging = false
    // The release would click the title link underneath.
    const noClick = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('click', noClick, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', noClick, { capture: true }), 400)
    if (drop) onDrop(from, to)
  }
}

/** lucide trash-2 */
const BIN =
  '<svg class="drag-bin" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>'
