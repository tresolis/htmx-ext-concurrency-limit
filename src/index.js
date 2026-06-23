// htmx extension `concurrency-limit`: caps simultaneous in-flight htmx requests
// per page at `data-htmx-max-concurrent` (default 6) and queues the rest (FIFO).
//
// Thin glue only — the counting/queue/drain logic lives in ./limiter.js so it can
// be unit-tested without a browser. This file maps htmx's request lifecycle onto it:
//   htmx:confirm       -> hold the request; issue now if a slot is free, else queue it
//   htmx:afterRequest  -> release the slot (any outcome) and drain the next queued one
import htmx from 'htmx.org'
import { createLimiter, parseMax } from './limiter.js'

const DEFAULT_MAX = 6
const PENDING_CLASS = 'htmx-request-queued'

let limiter = null

function getLimiter() {
  if (!limiter) {
    const max = parseMax(document.body && document.body.dataset.htmxMaxConcurrent, DEFAULT_MAX)
    limiter = createLimiter(max)
  }
  return limiter
}

function markQueued(elt) {
  if (elt && elt.classList) {
    elt.classList.add(PENDING_CLASS)
    elt.setAttribute('aria-busy', 'true')
  }
}

function unmarkQueued(elt) {
  if (elt && elt.classList) {
    elt.classList.remove(PENDING_CLASS)
    elt.removeAttribute('aria-busy')
  }
}

htmx.defineExtension('concurrency-limit', {
  init() {
    // Read the limit once at startup (page-wide, fixed for the page lifetime).
    getLimiter()
  },

  onEvent(name, evt) {
    if (name === 'htmx:confirm') {
      // Leave hx-confirm requests to htmx's native flow so the confirmation
      // prompt still runs exactly once. These discrete, user-confirmed actions
      // are not throttled (they are not a request-flood source).
      if (evt.detail.question) return

      const elt = evt.detail.elt
      const realIssue = evt.detail.issueRequest
      // Hold every other request; we decide when (or whether) it is sent.
      evt.preventDefault()
      const issue = () => {
        unmarkQueued(elt)
        realIssue(true)
      }
      if (getLimiter().request(issue) === 'queued') {
        markQueued(elt)
      }
    } else if (name === 'htmx:afterRequest') {
      getLimiter().release()
    }
  },
})
