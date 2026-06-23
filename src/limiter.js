// Pure concurrency limiter: a counter + FIFO queue, with no DOM or htmx dependency.
// All the risk-bearing logic lives here so it can be unit-tested with `node --test`.

/**
 * Parse a max-concurrency value, falling back when missing/empty/<1/NaN.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
export function parseMax(value, fallback) {
  const n = parseInt(value, 10)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/**
 * Create a limiter allowing at most `max` concurrent "issued" units.
 *
 * @param {number} max
 * @returns {{
 *   request: (issue: () => void) => 'active' | 'queued',
 *   release: () => void,
 *   readonly active: number,
 *   readonly pending: number,
 * }}
 */
export function createLimiter(max) {
  let active = 0
  const queue = []

  // Issue one unit and account for it; on throw, undo the slot so we never leak it.
  function run(issue) {
    active++
    try {
      issue()
    } catch {
      active--
      return false
    }
    return true
  }

  function request(issue) {
    if (active < max) {
      run(issue)
      return 'active'
    }
    queue.push(issue)
    return 'queued'
  }

  function release() {
    if (active > 0) active--
    // Fill every freed slot (normally one). A throwing unit frees its slot again,
    // so the loop simply continues to the next queued unit — no deadlock.
    while (queue.length > 0 && active < max) {
      run(queue.shift())
    }
  }

  return {
    request,
    release,
    get active() {
      return active
    },
    get pending() {
      return queue.length
    },
  }
}
