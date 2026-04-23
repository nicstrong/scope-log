# scope-log ideas

## Core intent

`scope-log` is aimed at a logging-first debugging workflow:

- Keep default logging quiet enough to be usable in large apps.
- Let developers raise detail in one namespace or subtree without touching call sites.
- Make runtime tuning discoverable enough that logs can be adjusted during an investigation.
- Preserve signal in noisy hot paths instead of forcing developers to remove useful logs.

## Distilled feature candidates

Note: items 1 and 2 build on APIs that already exist. The new work is mostly in ergonomics, packaging, and developer tooling around those primitives.

### 1. Hierarchical log-level overrides

This already exists in the current API through exact namespace updates and wildcard subtree updates.

Why it matters:

- This is the core value of the library.
- It supports the workflow of "quiet by default, targeted verbosity during investigation".
- It covers cases like `Feature:* = DEBUG` with `Feature:HotPath = INFO`.

Suggested shape:

- Keep exact overrides and cascading subtree overrides as distinct concepts.
- Preserve the existing low-level API as the foundation.
- Add higher-level conveniences such as batch updates, profile application, and more targeted reset behavior.

Variations and alternates:

- Separate APIs for exact vs cascading updates.
- A batch API for applying a full logging profile in one call.
- Temporary overrides that expire after reload or after a timeout.

### 2. Runtime control surface

The current primitives already work at runtime if application code imports and exposes them. The new part would be an intentional developer-facing control surface for console and UI use.

Why it matters:

- Investigation usually happens after the app is already running.
- It reduces the need for code edits just to change logging.
- It becomes the foundation for a future UI.

Suggested shape:

```ts
scopeLogRuntime.set('Checkout:*', 'debug')
scopeLogRuntime.set('Checkout:Pricing', 'info')
scopeLogRuntime.list()
scopeLogRuntime.reset()
```

Variations and alternates:

- Expose the API on `globalThis` in development only.
- Offer a compact command-style parser for console usage.
- Keep the public runtime API small and build richer tooling on top of it.

### 3. Persistence for runtime overrides

Persist namespace-level overrides so debugging state survives a reload.

Why it matters:

- Reloading during debugging is common.
- Persisted overrides make runtime controls feel reliable instead of temporary.

Suggested shape:

- Keep persistence out of the core logger path when possible.
- Prefer a storage adapter model instead of hard-coding `localStorage` into the core package.
- Treat browser persistence as the default adapter in a browser-focused helper layer.

Variations and alternates:

- `localStorage` for sticky dev settings.
- `sessionStorage` for short-lived investigations.
- Import/export JSON for sharing logging profiles.
- URL-based overrides for reproducible bug reports.

### 4. Namespace discovery and inspection

Track namespaces so developers can inspect what exists and what is currently active.

Why it matters:

- A future UI needs a source of truth for the namespace tree.
- Discovery reduces guesswork when enabling logs in unfamiliar areas.
- It makes the system easier to operate in large codebases.

Suggested shape:

- Record namespaces when a logger is created, when it first logs, or both.
- Expose enough metadata to render a tree and show current effective levels.
- Keep the discovery API read-oriented so tooling can consume it without mutating state.

Variations and alternates:

- Track only known namespaces.
- Track known namespaces plus recent activity.
- Track counts or timestamps for recent emissions to help identify noisy areas.

### 5. Companion React or devtools UI

Build a separate package for a graphical log-control experience.

Why it matters:

- The UI is useful, but it should not increase the weight of the core package.
- A separate package keeps the core logger focused and portable.

Suggested shape:

- A hotkey-enabled overlay or panel that shows the namespace tree.
- Controls for exact and subtree levels.
- Search, filter, reset, and persistence controls.

Variations and alternates:

- A React overlay package for app-level integration.
- A devtools-style panel.
- A headless inspector API that any UI can consume.

### 6. Repeated-log collapsing

Optionally collapse repeated log lines and attach a count so useful signal is not buried in noise.

Why it matters:

- Repeated logs on hot render paths are often accidental but still occasionally useful.
- Collapsing keeps the information available without overwhelming the console.

Suggested shape:

- Keep this off by default.
- Implement it in the output layer instead of the core logger API.
- Define when a collapsed group flushes, for example on message change or after a time window.

Variations and alternates:

- Collapse only identical consecutive messages.
- Collapse within a short time window.
- Scope collapsing by namespace so one noisy area does not affect another.
- Add a summary line like "repeated 37 times" when the group flushes.

## Refinements to the current direction

- Separate core logging behavior from developer tooling. Core should stay centered on namespace parsing, level resolution, and outputters. Tooling should cover runtime controls, persistence, discovery, and UI.
- Prefer pluggable adapters over browser-only assumptions in the core package. This keeps the library usable outside React and outside the browser.
- Treat discovery and repeated-log collapsing as optional features. They are valuable, but they should not add avoidable overhead to hot paths.
- Consider logging profiles as a first-class concept. A profile could apply multiple exact and subtree rules in one operation.

## Design questions worth resolving early

- Should namespace discovery happen on logger creation, first emission, or both?
- Should persisted state store only explicit overrides, or also derived effective levels?
- Should runtime APIs be available in production builds, or only in development mode?
- What defines a repeated log: exact arguments, rendered text, or a custom fingerprint?
- Should collapse happen before or after lazy log thunk evaluation?

## Follow-up ideas from Copilot

### Signals from existing loggers

- `debug`: namespace wildcards, include and exclude patterns, stable namespace identity, and lightweight elapsed-time hints are all a strong fit for `scope-log`.
- `loglevel`: persistent user-selected levels, separation between default levels and explicit overrides, named logger discovery, and a small plugin surface all map well to browser-oriented logging.
- `pino`: keep the hot path small, push heavier processing to transports or adapters, and consider child loggers or bound context as an optional advanced feature.
- `winston`: composable formatting and filtering are useful, but the full transport-and-pipeline model is probably heavier than this project needs in core.
- `consola`: reporter layering, pause and resume behavior, testability, and spam prevention are good ideas, but the CLI-oriented presentation features are lower priority here.

### High-fit ideas to consider

Note: most of the ideas below are adaptations rather than exact copies. The goal is to borrow proven patterns while reshaping them for a small, namespaced, console-first logger.

#### 1. Namespace selector expressions

Credit and fit:

- Primary source: [`debug` wildcards](https://github.com/debug-js/debug#wildcards) and [`debug.enable()` / `debug.disable()`](https://github.com/debug-js/debug#set-dynamically).
- Relationship: near-direct borrowing of selector syntax, but distilled for `scope-log` so selectors would drive hierarchical level rules instead of simple enabled or disabled matching.

Support compact include and exclude expressions for runtime control.

Examples:

```ts
scopeLogRuntime.enable('Checkout:*,-Checkout:Rendering')
scopeLogRuntime.enable('Auth:*,Payments:*,-Payments:Polling')
```

Why it is useful:

- This is a natural extension of namespaced logging.
- It makes console-driven debugging much faster.
- It matches how developers already think about narrowing noisy areas.

#### 2. Default vs explicit vs persisted levels

Credit and fit:

- Primary source: [`loglevel.setLevel(level, [persist])`](https://github.com/pimterry/loglevel#logsetlevellevel-persist), [`loglevel.setDefaultLevel(level)`](https://github.com/pimterry/loglevel#logsetdefaultlevellevel), and [`loglevel.resetLevel()`](https://github.com/pimterry/loglevel#logresetlevel).
- Relationship: distilled from `loglevel`'s separation of runtime level, default level, and persisted state. The shape here is adapted to namespace trees rather than flat named loggers.

Split the concept of "app default" from "developer override".

Why it is useful:

- Applications should be able to set sensible defaults.
- Developers should be able to temporarily override those defaults without fighting app initialization.
- Persistence becomes easier to reason about when only explicit developer overrides are stored.

Possible API direction:

```ts
setDefaultLogLevel('Checkout:*', LogLevel.INFO)
setLogLevel('Checkout:Pricing', LogLevel.DEBUG)
clearPersistedLogLevels()
```

#### 3. Read-oriented inspection APIs

Credit and fit:

- Primary source: [`loglevel.getLogger(loggerName)`](https://github.com/pimterry/loglevel#loggetloggerloggername) and [`loglevel.getLoggers()`](https://github.com/pimterry/loglevel#loggetloggers).
- Relationship: distilled from `loglevel`'s explicit logger discovery, but adapted toward tree inspection and tooling-friendly queries for `scope-log`.

Add ergonomic inspection helpers instead of making tooling depend on raw internal tree structures.

Possible additions:

- `getKnownNamespaces()`
- `getEffectiveLogLevel(namespace)`
- `getExplicitLogRules()`
- `findNamespaces({ prefix, text, activeOnly })`

Why it is useful:

- This makes console tooling and future UI work simpler.
- It keeps the internal tree free to evolve.

#### 4. Logging profiles and shareable presets

Credit and fit:

- Primary source: [`debug.enable()` selector strings](https://github.com/debug-js/debug#set-dynamically), [`loglevel` persisted levels](https://github.com/pimterry/loglevel#logsetlevellevel-persist), and [`winston` logger reconfiguration](https://github.com/winstonjs/winston#creating-your-own-logger).
- Relationship: distilled combination. This is not an exact copy from one library; it combines selector-driven activation, persistence, and whole-logger reconfiguration into a `scope-log` concept of reusable namespace rule sets.

Support applying multiple rules in one operation.

Examples:

- "quiet app, verbose checkout"
- "network investigation"
- "render-noise safe mode"

Why it is useful:

- Real debugging sessions usually involve more than one namespace rule.
- Profiles are easier to persist, export, import, and share.

#### 5. Outputter middleware or transforms

Credit and fit:

- Primary source: [`winston` formats](https://github.com/winstonjs/winston#formats), [`winston` custom formats](https://github.com/winstonjs/winston#creating-custom-formats), [`winston` transports](https://github.com/winstonjs/winston#transports), [`loglevel` plugins](https://github.com/pimterry/loglevel#plugins), and [`consola` custom reporters](https://github.com/unjs/consola#custom-reporters).
- Relationship: distilled combination. The proposal keeps the idea of pluggable processing, but trims it down to a lighter-weight layer around `scope-log` outputters instead of adopting a full transport pipeline.

Add a light transformation layer around outputters for concerns that should not live in the core logger.

Candidate uses:

- repeated-log collapsing
- throttling or rate limiting
- redaction
- timestamps
- namespace coloring
- structured metadata formatting

Why it is useful:

- It keeps the logging core small.
- It allows advanced behavior without turning every feature into core API surface.

#### 6. Child loggers or bound context

Credit and fit:

- Primary source: [`pino` child loggers](https://github.com/pinojs/pino/blob/main/docs/child-loggers.md) and [`winston` child loggers](https://github.com/winstonjs/winston#creating-child-loggers).
- Relationship: direct borrowing of the child-logger concept, but distilled for `scope-log` by combining namespace extension with optional bound metadata.

Allow callers to derive a logger with attached metadata or an extended namespace.

Examples:

```ts
const checkoutLog = scopedLog('Checkout')
const paymentLog = checkoutLog.child('Payments')
const requestLog = paymentLog.with({ requestId })
```

Why it is useful:

- It reduces repeated metadata in related log lines.
- It fits well with request-scoped or operation-scoped debugging.

Tradeoff:

- This starts to move the library from pure console-style logging toward structured logging, so it may belong in an advanced layer instead of the base API.

#### 7. Timing helpers and elapsed-time hints

Credit and fit:

- Primary source: [`debug` millisecond diff](https://github.com/debug-js/debug#millisecond-diff) and [`winston` profiling](https://github.com/winstonjs/winston#profiling).
- Relationship: distilled combination. The elapsed-time suffix is inspired directly by `debug`, while explicit timing helpers are closer to `winston` profiling and the wider console API family.

Add optional timing helpers for investigating latency and churn.

Examples:

- `log.time('fetch-user')`
- `log.timeEnd('fetch-user')`
- automatic `+23ms` suffixes between log calls in a namespace

Why it is useful:

- It is lightweight but often immediately helpful during debugging.
- It pairs well with namespaced investigation.

#### 8. Spam control beyond collapse

Credit and fit:

- Primary source: [`consola` "spam prevention by throttling logs"](https://github.com/unjs/consola#why-consola).
- Relationship: distilled from `consola`'s anti-spam idea, but expanded for `scope-log` into a broader set of namespace-aware noise controls instead of one throttling behavior.

Treat repeated-log collapse as one option inside a broader anti-noise toolkit.

Candidate variants:

- collapse repeated identical lines
- log only once per key
- rate limit a namespace
- sample repeated debug logs
- summarize suppressed lines when the burst ends

Why it is useful:

- Different noise patterns need different controls.
- Hot render paths and polling loops do not always benefit from the same strategy.

#### 9. Test and capture helpers

Credit and fit:

- Primary source: [`consola.mockTypes`](https://github.com/unjs/consola#consola-methods), [`consola` test integration examples](https://github.com/unjs/consola#integrations), and [`consola.wrapAll()`](https://github.com/unjs/consola#consola-methods).
- Relationship: distilled from `consola`'s testing ergonomics. The proposed version is smaller and centered on capturing `scope-log` outputters and active rules for assertions.

Provide a lightweight test adapter for asserting logs in unit tests.

Examples:

- capture all emitted log events into an array
- install a temporary outputter for one test
- snapshot the active rules for setup and teardown

Why it is useful:

- Logging-heavy code often needs assertions during refactors.
- It makes the package friendlier for users building tooling around it.

### Lower-fit ideas or likely separate packages

- full Node transport ecosystems like files, HTTP drains, and worker-thread processing
- uncaught exception and unhandled rejection logging
- heavy pretty-print pipelines designed for backend structured logs
- interactive CLI prompts and terminal presentation helpers

### Additional original ideas

#### 1. Runtime rule history

Keep a short history of recent runtime changes so developers can undo or inspect how the current state was reached.

#### 2. Hot-spot detection

Optionally track very noisy namespaces and expose a "top talkers" view to help identify render loops or polling noise.

#### 3. Shareable rule strings

Support exporting the current rule set as a compact string that can be copied into local storage, a URL parameter, or a bug report.

#### 4. Namespace aliases

Allow teams to define friendly aliases for long namespaces, especially in console tooling or UI overlays.

#### 5. Devtools event stream

Expose a subscription API for namespace discovery, rule changes, and emitted log metadata so a future UI can stay in sync without polling.

#### 6. Optional callsite capture

Allow a debug-only mode that records callsite information for emitted logs, with the expectation that it is too expensive for the default hot path.
