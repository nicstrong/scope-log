import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogLevel, type Outputter } from './types.js'

// This suite proves that two genuinely-separate module instances of
// `scopedLog.js` cooperate via the shared registry on `globalThis`. We use
// `vi.resetModules()` + dynamic `await import(...)` to force fresh module
// evaluation, which is the closest single-realm analogue of duplicate
// copies landing in `node_modules`.
//
// Caveats worth knowing if you're editing these tests:
// - RootNamespace in parser.ts is `Symbol('RootNamespace')`, so each module
//   instance produces a distinct symbol. Cross-instance assertions use
//   string forms (`'$'`, `'$:*'`) to stay identity-free.
// - Every test cleans the globalThis slot in beforeEach so the "first
//   caller creates the slot" path is actually exercised per-test.

const REGISTRY_KEY = Symbol.for('scope-log/registry@1')

beforeEach(() => {
  vi.resetModules()
  delete (globalThis as unknown as Record<symbol, unknown>)[REGISTRY_KEY]
})

describe('registry — cross-instance state sharing', () => {
  it('two module instances share setLogLevel writes via the registry', async () => {
    const a = await import('./scopedLog.js')
    vi.resetModules()
    const b = await import('./scopedLog.js')

    // Sanity: genuinely two different module instances.
    expect(a).not.toBe(b)
    expect(a.setLogLevel).not.toBe(b.setLogLevel)
    expect(a.shouldLog).not.toBe(b.shouldLog)

    // A writes, B reads back.
    a.setLogLevel('Shared:*', LogLevel.DEBUG)
    expect(b.shouldLog(LogLevel.DEBUG, 'Shared:Anything')).toBe(true)

    // And the reverse direction.
    b.setLogLevel('Other', LogLevel.ERROR)
    expect(a.shouldLog(LogLevel.ERROR, 'Other')).toBe(true)
    expect(a.shouldLog(LogLevel.WARN, 'Other')).toBe(false)
  })

  it('two module instances share the outputter list', async () => {
    const a = await import('./scopedLog.js')
    vi.resetModules()
    const b = await import('./scopedLog.js')

    const calls: LogLevel[] = []
    const sink: Outputter = (level) => {
      calls.push(level)
    }
    a.addOutputter(sink)

    // Widen the whole tree so the log emits regardless of namespace.
    a.setLogLevel('$:*', LogLevel.DEBUG)

    // A logger built from B's scopedLog still reaches the sink registered
    // against A — they share the outputter list.
    b.scopedLog('X').info('hi')
    expect(calls).toContain(LogLevel.INFO)
  })

  it('reset() from one instance clears the tree for all', async () => {
    const a = await import('./scopedLog.js')
    vi.resetModules()
    const b = await import('./scopedLog.js')

    a.setLogLevel('X:*', LogLevel.DEBUG)
    expect(b.shouldLog(LogLevel.DEBUG, 'X:Y')).toBe(true)

    b.reset()
    // Tree is back to defaults — X:* override is gone.
    expect(a.shouldLog(LogLevel.DEBUG, 'X:Y')).toBe(false)
    // Default root cascading level is INFO, so INFO still passes.
    expect(a.shouldLog(LogLevel.INFO, 'X:Y')).toBe(true)
  })

  it('resetOutputters() from one instance clears outputters for all', async () => {
    const a = await import('./scopedLog.js')
    vi.resetModules()
    const b = await import('./scopedLog.js')

    const extra: Outputter = () => {}
    a.addOutputter(extra)
    expect(b.getOutputters()).toContain(extra)

    b.resetOutputters()
    expect(a.getOutputters()).not.toContain(extra)
    // Default ConsoleOutputter reinstated.
    expect(a.getOutputters()).toHaveLength(1)
  })

  it('getOutputters() references stay live after resetOutputters() (in-place mutation)', async () => {
    const mod = await import('./scopedLog.js')
    const extra: Outputter = () => {}
    mod.addOutputter(extra)

    const captured = mod.getOutputters()
    expect(captured).toContain(extra)

    mod.resetOutputters()
    // The *same* array reference now reflects the reset — no stale view.
    expect(captured).not.toContain(extra)
    expect(captured).toHaveLength(1)
  })
})

describe('registry — globalThis slot', () => {
  it('registers under Symbol.for("scope-log/registry@1") on first access', async () => {
    const mod = await import('./scopedLog.js')
    // Nothing registered yet — getRegistry() is lazy.
    expect(
      (globalThis as unknown as Record<symbol, unknown>)[REGISTRY_KEY],
    ).toBeUndefined()

    // Any API call that reads the registry triggers lazy init.
    mod.getOutputters()

    const slot = (globalThis as unknown as Record<symbol, unknown>)[
      REGISTRY_KEY
    ] as { outputters: unknown; namespaces: unknown } | undefined
    expect(slot).toBeDefined()
    expect(Array.isArray(slot!.outputters)).toBe(true)
    expect(slot!.namespaces).toBeDefined()
  })

  it('reuses an existing registry on re-import — does not clobber state', async () => {
    const a = await import('./scopedLog.js')
    a.setLogLevel('Pre-existing:*', LogLevel.DEBUG)

    vi.resetModules()
    const b = await import('./scopedLog.js')

    // B's first read sees the registry A already populated.
    expect(b.shouldLog(LogLevel.DEBUG, 'Pre-existing:Anything')).toBe(true)
  })

  it('overwrites a malformed slot on globalThis', async () => {
    // Someone (or a previous incompatible copy) wrote garbage at our key.
    ;(globalThis as unknown as Record<symbol, unknown>)[REGISTRY_KEY] = {
      junk: true,
    }

    const mod = await import('./scopedLog.js')

    // getRegistry() detected the bad shape and built a fresh one.
    expect(mod.shouldLog(LogLevel.INFO, 'Fresh')).toBe(true) // root INFO default
    expect(mod.getOutputters()).toHaveLength(1)
  })

  it('recovers if the slot is a primitive', async () => {
    ;(globalThis as unknown as Record<symbol, unknown>)[REGISTRY_KEY] =
      'not a registry'
    const mod = await import('./scopedLog.js')
    expect(mod.shouldLog(LogLevel.INFO, 'Fresh')).toBe(true)
  })

  it('recovers if outputters is not an array', async () => {
    ;(globalThis as unknown as Record<symbol, unknown>)[REGISTRY_KEY] = {
      outputters: 'nope',
      namespaces: {},
    }
    const mod = await import('./scopedLog.js')
    expect(mod.getOutputters()).toHaveLength(1) // rebuilt with ConsoleOutputter
  })
})
