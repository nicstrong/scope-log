import { describe, expect, vi } from 'vitest'
import { RootNamespace, scopedLog, setLogLevel } from './scopedLog.js'
import { scopedTest as it } from './test-utils.js'
import { LogLevel } from './types.js'

describe('scopedLog.lazy — thunked argument evaluation', () => {
  it('invokes the thunk and emits when the level is enabled', ({
    captureAtDebug,
  }) => {
    const log = scopedLog('ns')
    const thunk = vi.fn(() => ['expensive', 42] as const)
    log.lazy.debug(thunk)
    expect(thunk).toHaveBeenCalledTimes(1)
    expect(captureAtDebug).toEqual([
      { level: LogLevel.DEBUG, args: ['[ns]', 'expensive', 42] },
    ])
  })

  it('skips the thunk entirely when the level is filtered out', ({
    capture,
  }) => {
    // Default root level is INFO; DEBUG is filtered out.
    const log = scopedLog('ns')
    const thunk = vi.fn(() => ['should not run'] as const)
    log.lazy.debug(thunk)
    expect(thunk).not.toHaveBeenCalled()
    expect(capture).toHaveLength(0)
  })

  it.for([
    { method: 'error', level: LogLevel.ERROR },
    { method: 'warn', level: LogLevel.WARN },
    { method: 'info', level: LogLevel.INFO },
    { method: 'log', level: LogLevel.LOG },
    { method: 'debug', level: LogLevel.DEBUG },
  ] as const)(
    'lazy.$method dispatches at $level',
    ({ method, level }, { captureAtDebug }) => {
      const log = scopedLog('ns')
      log.lazy[method](() => ['payload', 1, 2])
      expect(captureAtDebug).toEqual([
        { level, args: ['[ns]', 'payload', 1, 2] },
      ])
    },
  )

  it('spreads the returned array after the prefix', ({ captureAtDebug }) => {
    const log = scopedLog('Feature:Area')
    const obj = { a: 1 }
    log.lazy.warn(() => ['s', obj, 42, null])
    expect(captureAtDebug).toEqual([
      { level: LogLevel.WARN, args: ['[Feature:Area]', 's', obj, 42, null] },
    ])
    // Reference identity preserved — not a structural copy.
    expect(captureAtDebug[0]!.args[2]).toBe(obj)
  })

  it('emits without a prefix for the root namespace', ({ captureAtDebug }) => {
    scopedLog(RootNamespace).lazy.info(() => ['plain', 1])
    expect(captureAtDebug).toEqual([
      { level: LogLevel.INFO, args: ['plain', 1] },
    ])
  })

  it.for([
    { label: "'$'", ns: '$' },
    { label: "''", ns: '' },
  ] as const)(
    'emits without a prefix for the root-equivalent string $label',
    ({ ns }, { captureAtDebug }) => {
      scopedLog(ns).lazy.info(() => ['plain'])
      expect(captureAtDebug).toEqual([
        { level: LogLevel.INFO, args: ['plain'] },
      ])
    },
  )

  it('an empty thunk return emits just the prefix', ({ captureAtDebug }) => {
    scopedLog('ns').lazy.info(() => [])
    expect(captureAtDebug).toEqual([{ level: LogLevel.INFO, args: ['[ns]'] }])
  })

  it('thunk errors propagate to the caller when the level is enabled', ({
    captureAtDebug: _,
  }) => {
    const log = scopedLog('ns')
    expect(() =>
      log.lazy.debug(() => {
        throw new Error('boom')
      }),
    ).toThrow('boom')
  })

  it('thunk errors do not propagate when the level is filtered', ({
    capture,
  }) => {
    // Default INFO root; DEBUG is filtered, so the thunk must never run.
    const log = scopedLog('ns')
    expect(() =>
      log.lazy.debug(() => {
        throw new Error('should not run')
      }),
    ).not.toThrow()
    expect(capture).toHaveLength(0)
  })

  it('respects per-namespace level changes between calls', ({ capture }) => {
    const log = scopedLog('Quiet')
    const thunk = vi.fn(() => ['now you see me'] as const)

    // Root INFO by default — DEBUG filtered.
    log.lazy.debug(thunk)
    expect(thunk).not.toHaveBeenCalled()

    setLogLevel('Quiet:*', LogLevel.DEBUG)
    log.lazy.debug(thunk)
    expect(thunk).toHaveBeenCalledTimes(1)
    expect(capture).toEqual([
      { level: LogLevel.DEBUG, args: ['[Quiet]', 'now you see me'] },
    ])
  })
})
