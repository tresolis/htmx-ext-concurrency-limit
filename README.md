# htmx-ext-concurrency-limit

An [htmx](https://htmx.org) extension that caps the number of **simultaneous in-flight
requests per page** and puts the rest in a FIFO standby queue, releasing them
automatically as active requests finish.

It changes **timing only** — request content, headers, target, swap, and response
handling are untouched. Nothing is dropped.

## How it works

htmx fires `htmx:confirm` for every request trigger. The extension holds each request
(`preventDefault`) and either issues it immediately (a slot is free) or queues its
`issueRequest` callback. On `htmx:afterRequest` (success, error, timeout, or abort) a
slot is freed and the next queued request is issued. The cap can never be exceeded and
a finished request always frees its slot (no deadlock).

The counting/queue/drain logic lives in a pure, dependency-free module
([`src/limiter.js`](./src/limiter.js)) and is unit-tested with `node --test`.

## Install

In-repo pnpm workspace package. Register it in `pnpm-workspace.yaml` (`packages/*`) and
reference it with the workspace protocol:

```jsonc
// package.json
"dependencies": {
  "htmx-ext-concurrency-limit": "workspace:*"
}
```

Then `pnpm install`. `htmx.org` (^2.0.10) is a peer dependency.

## Usage

```js
// bundle entry (e.g. main.js) — registers the extension
import 'htmx-ext-concurrency-limit'
```

```html
<!-- enable page-wide and set the limit X -->
<body hx-ext="concurrency-limit" data-htmx-max-concurrent="6">
```

- Enable via `hx-ext="concurrency-limit"` on `<body>` (or any subtree). Descendants
  inherit it; requests outside an enabled subtree are not limited.
- `data-htmx-max-concurrent` — maximum simultaneous in-flight requests. Read once at
  startup. Missing / empty / `< 1` / non-numeric → defaults to **6**.

While a request waits in the queue, its triggering element gets the
`htmx-request-queued` class and `aria-busy="true"`; both are removed when it is issued.

## Test

```bash
npm test    # node --test
```

## License

MIT
