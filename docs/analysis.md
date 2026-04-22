# scope-log — API Analysis & Consumer Guide

## Overview

`scope-log` is a small (≈200 LoC of source) TypeScript package published to npm
as a **drop-in replacement for `console.log`**. It layers two ideas on top of
the native console:

1. **Hierarchical namespaces** — every call site is tagged with a colon-separated
   namespace (`Customer:Registration:Portal`) that forms a tree.
2. **Per-namespace log levels with cascading inheritance** — you can turn a whole
   subtree up to `DEBUG` while leaving the rest of the app at `INFO`, without
   touching call sites.

The package is pure ESM, ships its own type declarations, and has a single
runtime dependency model: the global singleton namespace tree lives inside the
module.

- Entry point: [src/index.ts](../src/index.ts)
- Core logic: [src/scopedLog.ts](../src/scopedLog.ts)
- Public types: [src/types.ts](../src/types.ts)
- Default outputter: [src/console-outputter.ts](../src/console-outputter.ts)

---

## Installation

```sh
pnpm add scope-log
# or
npm i scope-log
# or
yarn add scope-log
```

```ts
import {
  scopedLog,
  setLogLevel,
  LogLevel,
  RootNamespace,
} from 'scope-log'
```

---

## Public API surface

Everything exported from the package root (see [src/index.ts](../src/index.ts)):

| Export                    | Kind       | Purpose                                                         |
| ------------------------- | ---------- | --------------------------------------------------------------- |
| `scopedLog`               | function   | Build a namespaced logger (the main consumer entry point).      |
| `setLogLevel`             | function   | Set the effective log level for a namespace (or wildcard).      |
| `shouldLog`               | function   | Predicate — would a given level log under a given namespace?    |
| `reset`                   | function   | Clear the namespace tree back to defaults.                      |
| `getNamespaces`           | function   | Read the internal namespace tree (inspection / debugging).      |
| `addOutputter`            | function   | Register a custom sink alongside the defaults.                  |
| `removeOutputter`         | function   | Unregister a previously added sink.                             |
| `getOutputters`           | function   | Read the current outputter list (read-only).                    |
| `resetOutputters`         | function   | Restore the default `[ConsoleOutputter]` list.                  |
| `LogLevel`                | enum       | Ordered log levels from `SILENT` (0) to `DEBUG` (5).            |
| `Outputter`               | type       | Function signature for pluggable sinks.                         |
| `LazyLogThunk`            | type       | `() => readonly unknown[]` — shape of a lazy-log thunk.         |
| `ConsoleOutputter`        | value      | Default outputter that forwards to `console.*`.                 |
| `RootNamespace`           | symbol     | Sentinel for "the root" namespace, equivalent to `'$'`.         |
| `RootNamespaceType`       | type       | `typeof RootNamespace`.                                         |
| `DEFAULT_ROOT_LEVEL`      | constant   | Default level at the root of the tree (`LogLevel.INFO`).        |
| `WILDCARD_NAMESPACE_TOKEN`| constant   | `'*'` — trailing token that marks a level as *cascading*.       |
| `ROOT_NAMESPACE_KEY`      | constant   | `'$'` — the root key in string form.                            |

### `LogLevel`

Defined in [src/types.ts:1](../src/types.ts):

```ts
enum LogLevel {
  SILENT = 0,
  ERROR  = 1,
  WARN   = 2,
  INFO   = 3,
  LOG    = 4,
  DEBUG  = 5,
}
```

`shouldLog(check, ns)` returns `true` when `check <= effectiveLevel`. So setting
a namespace to `WARN` (2) enables `ERROR` and `WARN` and suppresses `INFO`,
`LOG`, `DEBUG`. Setting it to `SILENT` (0) suppresses everything.

---

## Namespaces

A namespace is either:

- A colon-separated string: `"Customer"`, `"Customer:Registration"`,
  `"Customer:Registration:Portal"`.
- The root, expressed as the `RootNamespace` symbol or the literal string `"$"`.
- A wildcard (accepted by `setLogLevel` and `shouldLog`, not by `scopedLog`),
  formed by appending `":*"` to any namespace, e.g. `"Customer:*"` or `"$:*"`
  for the whole tree.

### Parsing rules — [src/parser.ts](../src/parser.ts)

The parser (`namespaceParts`) enforces:

- Empty string and `"$"` both resolve to "the root".
- A namespace may not **end** with `":"` — throws.
- A namespace may not contain `"::"` (empty segments) — throws.
- `"*"` is only legal as the **final** segment. `setLogLevel` and `shouldLog`
  accept it; `scopedLog` does not (a logger bound to a wildcard has no
  coherent meaning).

### The tree — [src/scopedLog.ts:49](../src/scopedLog.ts)

Internally the namespaces form a tree of `NamespaceNode`s:

```ts
type NamespaceNode = {
  namespacePart: string
  children: Map<string, NamespaceNode>
  nodeLevel: LogLevel | null       // level for this exact node
  cascadingLevel: LogLevel | null  // level that also applies to descendants
}
```

Two levels per node is the key idea:

- `nodeLevel` is set by a non-wildcard assignment (`setLogLevel('A:B', …)`).
  It only applies to that exact namespace.
- `cascadingLevel` is set by a wildcard assignment (`setLogLevel('A:B:*', …)`).
  It applies to that node **and** every descendant that doesn't override it.

### Resolution order — [src/scopedLog.ts:75](../src/scopedLog.ts)

For a call like `log.info(...)` on namespace `"A:B:C"`:

1. Walk as far down the tree as matches `A → B → C`, keeping a visited stack
   with the deepest match first.
2. If the exact node `A:B:C` exists, prefer its `nodeLevel`, falling back to its
   `cascadingLevel`.
3. Otherwise, walk back up the visited stack and return the first
   `cascadingLevel` encountered.
4. The root always has `DEFAULT_ROOT_LEVEL` (`INFO`) as its initial
   `cascadingLevel`, so resolution is always defined unless something has
   corrupted the tree.

---

## Consuming the API

### 1. Creating a logger

```ts
import { scopedLog } from 'scope-log'

const log = scopedLog('Customer:Registration')

log('hello', { userId: 42 })   // console.log('[Customer:Registration]', 'hello', { userId: 42 })
log.info('signed up')
log.warn('slow response')
log.error(new Error('boom'))
log.debug('raw payload', payload)
```

`scopedLog` returns a callable object:

- Calling it directly emits at `LogLevel.LOG`.
- `.log`, `.info`, `.warn`, `.error`, `.debug` emit at the matching level.
- `.lazy.log`, `.lazy.info`, `.lazy.warn`, `.lazy.error`, `.lazy.debug` take a
  single thunk (`() => readonly unknown[]`) and only invoke it when the level
  is enabled for this namespace — see
  ["Probing before expensive logging"](#3-probing-before-expensive-logging)
  below.
- Every call is prefixed with `[<namespace>]` as the first argument — unless
  the namespace is a root form (`RootNamespace`, `''`, or `'$'`), in which
  case no prefix is added ([src/scopedLog.ts](../src/scopedLog.ts)).

A typical pattern is one logger per module:

```ts
// src/features/checkout/pricing.ts
import { scopedLog } from 'scope-log'
const log = scopedLog('Checkout:Pricing')

export function computeTotal(...) {
  log.debug('inputs', ...)
  // ...
  log.info('total computed', total)
}
```

### 2. Configuring levels

Call `setLogLevel` once at application start-up, or dynamically from a dev
console / feature flag:

```ts
import { setLogLevel, LogLevel, RootNamespace } from 'scope-log'

// Quiet default for the whole app.
setLogLevel(RootNamespace, LogLevel.WARN)

// Turn on everything under Checkout during an investigation.
setLogLevel('Checkout:*', LogLevel.DEBUG)

// But keep the chatty pricing module down.
setLogLevel('Checkout:Pricing', LogLevel.INFO)
```

The resolution rules above mean that:

- A `log.debug(...)` in `Checkout:Orders` will fire (inherits `Checkout:*` =
  `DEBUG`).
- A `log.debug(...)` in `Checkout:Pricing` will **not** fire (exact match beats
  the wildcard).
- A `log.debug(...)` in `Admin` will not fire (falls back to the root `WARN`).

### 3. Deferring expensive argument construction

The eager methods evaluate their arguments unconditionally — `log.debug(JSON.stringify(big))`
still serialises `big` when the level is filtered out. Two escape hatches, in
order of preference:

#### `log.lazy.*` — thunked arguments (recommended)

Each level has a `.lazy` mirror that takes a single thunk returning the arg
array. The thunk runs **only** when `shouldLog(level, namespace)` passes for
this logger, so expensive work is skipped wholesale when the level is off.

```ts
import { scopedLog } from 'scope-log'
const log = scopedLog('Checkout:Pricing')

// Eager — serialises on every call, even when DEBUG is filtered.
log.debug('cart snapshot', JSON.stringify(cart))

// Lazy — thunk runs only when DEBUG is enabled for Checkout:Pricing.
log.lazy.debug(() => ['cart snapshot', JSON.stringify(cart)])
```

Contract:

- The thunk receives no arguments and returns a `readonly unknown[]` that is
  spread into the outputter after the `[namespace]` prefix (or with no prefix
  for root loggers).
- The thunk is invoked **at most once** per call — zero times if the level is
  filtered, exactly once otherwise.
- Errors thrown from the thunk propagate to the caller (when the level fires);
  if the level is filtered the thunk never runs, so no error is raised.
- `log.debug(fn)` is unchanged — the eager methods still log function
  references as-is. Lazy is strictly opt-in via `.lazy`.

When to reach for `.lazy`:

| Argument shape | Pick |
| --- | --- |
| Primitives / already-built objects (`log.info('ok', userId)`) | eager |
| `JSON.stringify(big)` / `obj.toString()` on large data | **lazy** |
| Template string with function calls (`` `${items.map(...).join(',')}` ``) | **lazy** |
| `deepClone(state)` for a snapshot | **lazy** |
| Iterating a collection to build a summary | **lazy** |

Examples:

```ts
// 1. Multiple expensive args — all deferred together.
log.lazy.debug(() => [
  'tax breakdown',
  computeTaxLines(cart),
  computeFees(cart),
])

// 2. Reference identity is preserved — the returned array is spread, not
//    re-cloned, so `payload` reaches the outputter by reference.
const payload = { userId: 42, cart }
log.lazy.debug(() => ['payload', payload])

// 3. Root logger — no prefix, identical to eager.
scopedLog(RootNamespace).lazy.info(() => ['plain message'])

// 4. Don't over-engineer cheap calls.
log.lazy.info(() => ['order placed', orderId]) // wasteful — just use log.info
log.info('order placed', orderId)              // prefer this
```

#### `shouldLog(level, namespace)` — imperative guard

Still useful when the guard should cover a **block** of work, not just one
log call (e.g. building intermediate state used by several logs):

```ts
import { shouldLog, LogLevel } from 'scope-log'

if (shouldLog(LogLevel.DEBUG, 'Checkout:Pricing')) {
  const summary = buildHeavySummary(cart)
  log.debug('summary', summary)
  log.debug('hash', hash(summary))
}
```

For the single-log-call case, `log.lazy.*` is shorter and keeps the namespace
implicit.

`shouldLog` also accepts a trailing wildcard for *subtree* queries — useful
for dev tooling that wants to answer "would anything under `A` log at this
level?" without picking a specific descendant:

```ts
// After setLogLevel('Checkout:*', LogLevel.DEBUG)
shouldLog(LogLevel.DEBUG, 'Checkout:*')  // → true  (cascade-only)
shouldLog(LogLevel.DEBUG, 'Checkout')    // → depends on Checkout's nodeLevel
```

The wildcard form skips any `nodeLevel` set on the target and resolves via
`cascadingLevel` only — exactly mirroring what `setLogLevel('A:*', …)` wrote.

### 4. Custom outputters

An `Outputter` is any function matching:

```ts
type Outputter = (
  level: LogLevel,
  message?: any,
  ...optionalArgs: any[]
) => void
```

The bundled `ConsoleOutputter` ([src/console-outputter.ts](../src/console-outputter.ts))
fans out to `console.error/warn/info/log/debug` based on level. `SILENT` is
simply not handled — at the outputter level it's a no-op, and `shouldLog`
blocks it earlier anyway.

Register custom sinks with `addOutputter` / `removeOutputter`:

```ts
import { addOutputter, removeOutputter, type Outputter } from 'scope-log'

const sentrySink: Outputter = (level, message, ...rest) => {
  if (level === LogLevel.ERROR) Sentry.captureMessage(String(message))
}

addOutputter(sentrySink)
// …later
removeOutputter(sentrySink)
```

`getOutputters()` returns the current list (read-only), and `resetOutputters()`
restores the default `[ConsoleOutputter]` — useful in tests.

### 5. Inspection & tests

- `getNamespaces()` returns the live root `NamespaceNode`. Useful in tests and
  dev tools to visualise the tree; don't mutate it directly.
- `reset()` throws the tree away and re-creates the root with
  `DEFAULT_ROOT_LEVEL`. Call it in `beforeEach` in tests to get deterministic
  behaviour — that's how the project's own suite works
  ([src/scopedLog.test.ts:92](../src/scopedLog.test.ts)).

---

## Worked examples

### Example: per-feature verbosity

```ts
import { setLogLevel, LogLevel, scopedLog } from 'scope-log'

setLogLevel('$:*', LogLevel.WARN)        // whole app: warnings and above
setLogLevel('Auth:*', LogLevel.INFO)     // auth: info and above
setLogLevel('Auth:Token', LogLevel.DEBUG)// token subsystem: everything

const authLog  = scopedLog('Auth:Session')
const tokenLog = scopedLog('Auth:Token')
const uiLog    = scopedLog('UI:Header')

authLog.info('session restored')   // ✅ logs   — inherits Auth:* = INFO
authLog.debug('session cookie…')   // ❌ skipped — Auth:* caps at INFO
tokenLog.debug('decoded jwt', jwt) // ✅ logs   — Auth:Token = DEBUG
uiLog.info('rendered header')      // ❌ skipped — falls back to $:* = WARN
uiLog.warn('slow paint')           // ✅ logs
```

### Example: zero-cost debug logging on hot paths

```ts
import { scopedLog } from 'scope-log'

const log = scopedLog('Render:Frame')

function onFrame(scene: Scene) {
  // Runs 60 times a second. In production the subtree sits at WARN; the
  // thunk never runs and the summary is never built.
  log.lazy.debug(() => [
    'frame',
    scene.id,
    `${scene.nodes.length} nodes, ${scene.lights.length} lights`,
    JSON.stringify(scene.camera),
  ])

  // …render…
}

// During an investigation:
//   setLogLevel('Render:*', LogLevel.DEBUG)
// flips the thunk on — no code change, no redeploy.
```

### Example: runtime control from the browser console

Expose the setter once during bootstrap and you can reconfigure verbosity live:

```ts
import { setLogLevel, LogLevel } from 'scope-log'

// Development build only — don't ship this to production.
;(window as any).__setLogLevel = (ns: string, level: keyof typeof LogLevel) =>
  setLogLevel(ns, LogLevel[level])

// Then in DevTools:
//   __setLogLevel('Checkout:*', 'DEBUG')
```

### Example: test harness

```ts
import { beforeEach } from 'vitest'
import { reset, setLogLevel, LogLevel } from 'scope-log'

beforeEach(() => {
  reset()
  setLogLevel('$:*', LogLevel.DEBUG) // see every log during tests
})
```

---

## Behaviour and edge cases worth knowing

- **Global state.** The namespace tree and outputter list are module-level
  singletons. If the package ends up loaded more than once (e.g. via duplicate
  copies in `node_modules`), each copy has its own tree — levels set in one
  won't be seen by the other.
- **Root-level logging.** `scopedLog(RootNamespace)`, `scopedLog('$')` and
  `scopedLog('')` are equivalent: all three emit **without** a `[prefix]` and
  pass the caller's arguments straight through to outputters — no synthetic
  `undefined` leads the argument list. Use whichever form reads best; the
  `RootNamespace` symbol is still the most intention-revealing.
- **Wildcard is trailing-only.** `"A:*:C"` throws; `"*"` alone is also not
  accepted outside of `"$:*"` semantics (the parser pops the trailing `*` then
  requires the remaining parts to be a valid namespace).
- **`shouldLog` wildcards are cascade-only.** `shouldLog(level, 'A:*')` asks
  "would `level` fire for an arbitrary descendant of `A` that has no override
  of its own?" — it deliberately skips any `nodeLevel` on `A` itself and
  resolves via `cascadingLevel` only. This is the mirror of
  `setLogLevel('A:*', …)`, which writes to the same slot. Non-wildcard queries
  (`shouldLog(level, 'A')`) keep their prefer-nodeLevel semantics.
- **Eager arguments are always evaluated.** `log.debug(expensive())` calls
  `expensive()` regardless of level. Use `log.lazy.debug(() => [expensive()])`
  to defer — the thunk runs only when the level is enabled. `shouldLog(...)`
  remains available for guarding blocks of work that span multiple log calls
  (see [§3](#3-deferring-expensive-argument-construction)).
- **`SILENT`.** Setting any namespace to `LogLevel.SILENT` (0) makes every
  `shouldLog(level, ns)` return `false` for `level >= 1`, effectively muting
  that subtree.
- **Overlapping assignments.** Setting `setLogLevel('A', X)` then
  `setLogLevel('A:*', Y)` on the same node keeps both values: the exact node
  stays at `X` (via `nodeLevel`), descendants inherit `Y` (via
  `cascadingLevel`). See the
  ["should use most specific namespace level"](../src/scopedLog.test.ts) test.

---

## Summary for consumers

If you remember four things:

1. `const log = scopedLog('Feature:Area')` gives you `log`, `log.info`,
   `log.warn`, `log.error`, `log.debug`, `log.log`.
2. `log.lazy.debug(() => [...])` defers expensive arg construction — the thunk
   only runs when the level is enabled for this namespace.
3. `setLogLevel('Feature:*', LogLevel.DEBUG)` turns a whole subtree on;
   `setLogLevel('Feature:Area', LogLevel.WARN)` narrows a single node.
4. Exact match wins; otherwise the nearest wildcard ancestor wins; ultimately
   the root (`INFO` by default) wins.

Everything else — `shouldLog`, `reset`, `getNamespaces`, `Outputter`,
`LazyLogThunk`, `addOutputter` / `removeOutputter`, `RootNamespace` — is there
for tests, tooling, and extension points.
