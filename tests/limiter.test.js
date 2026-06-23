import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLimiter, parseMax } from '../src/limiter.js'

// Records the order in which units are issued.
function recorder() {
  const log = []
  const issue = (id) => () => log.push(id)
  return { log, issue }
}

test('caps at max and issues immediately below cap (SC-001, SC-003)', () => {
  const { log, issue } = recorder()
  const l = createLimiter(3)
  for (let i = 0; i < 8; i++) l.request(issue(i))

  // Only 3 of 8 go out; the rest are held.
  assert.deepEqual(log, [0, 1, 2], 'never more than max issued at once')
  assert.equal(l.active, 3)
  assert.equal(l.pending, 5)

  // Below the cap: everything fires immediately, nothing queued (no added delay).
  const r2 = recorder()
  const l2 = createLimiter(3)
  for (let i = 0; i < 3; i++) l2.request(r2.issue(i))
  assert.deepEqual(r2.log, [0, 1, 2])
  assert.equal(l2.pending, 0)
})

test('drains queued requests FIFO until all are issued (SC-002, FR-003)', () => {
  const { log, issue } = recorder()
  const l = createLimiter(3)
  for (let i = 0; i < 8; i++) l.request(issue(i))

  for (let i = 0; i < 5; i++) l.release()

  assert.deepEqual(log, [0, 1, 2, 3, 4, 5, 6, 7], 'every request issued exactly once, in order')
  assert.equal(l.pending, 0)
  assert.equal(l.active, 3)
})

test('one release drains exactly one queued request (SC-004)', () => {
  const { log, issue } = recorder()
  const l = createLimiter(2)
  for (let i = 0; i < 5; i++) l.request(issue(i))
  assert.deepEqual(log, [0, 1])

  l.release()
  assert.deepEqual(log, [0, 1, 2], 'exactly one more, not the whole backlog')
  assert.equal(l.active, 2)
})

test('a throwing/detached unit still releases its slot and drains the next (SC-005, no deadlock)', () => {
  const log = []
  const l = createLimiter(1)
  l.request(() => log.push('a')) // active
  l.request(() => {
    throw new Error('element detached before issue')
  }) // queued, will throw when drained
  l.request(() => log.push('c')) // queued

  l.release() // frees 'a'; drains the bad unit (throws) then 'c'

  assert.deepEqual(log, ['a', 'c'], 'bad unit skipped, queue keeps draining')
  assert.equal(l.active, 1)
  assert.equal(l.pending, 0)
})

test('parseMax falls back on missing/empty/<1/NaN, accepts positive ints (FR-006)', () => {
  assert.equal(parseMax('2', 6), 2)
  assert.equal(parseMax('10', 6), 10)
  assert.equal(parseMax('', 6), 6)
  assert.equal(parseMax(undefined, 6), 6)
  assert.equal(parseMax('0', 6), 6)
  assert.equal(parseMax('-1', 6), 6)
  assert.equal(parseMax('abc', 6), 6)
})
