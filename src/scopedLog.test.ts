import { describe, expect } from 'vitest'
import { RootNamespace, scopedLog } from './scopedLog.js'
import { LogLevel } from './types.js'
import { scopedTest as it } from './test-utils.js'

describe('scopedLog — logger factory', () => {
  it('prefixes calls with "[namespace]" and emits at LOG', ({
    captureAtDebug,
  }) => {
    const log = scopedLog('Feature:Area')
    log('hello', 123)
    expect(captureAtDebug).toEqual([
      { level: LogLevel.LOG, args: ['[Feature:Area]', 'hello', 123] },
    ])
  })

  it.for([
    { method: 'error', level: LogLevel.ERROR },
    { method: 'warn', level: LogLevel.WARN },
    { method: 'info', level: LogLevel.INFO },
    { method: 'log', level: LogLevel.LOG },
    { method: 'debug', level: LogLevel.DEBUG },
  ] as const)('.$method dispatches at $level', ({ method, level }, { captureAtDebug }) => {
    const log = scopedLog('ns')
    log[method]('payload', 1, 2)
    expect(captureAtDebug).toEqual([
      { level, args: ['[ns]', 'payload', 1, 2] },
    ])
  })

  it('direct call is equivalent to .log', ({ captureAtDebug }) => {
    const log = scopedLog('ns')
    log('a', 'b')
    log.log('a', 'b')
    expect(captureAtDebug).toHaveLength(2)
    expect(captureAtDebug[0]).toEqual(captureAtDebug[1])
  })

  it('emits without a prefix when the namespace is RootNamespace', ({
    captureAtDebug,
  }) => {
    const log = scopedLog(RootNamespace)
    log.info('plain')
    expect(captureAtDebug).toEqual([
      { level: LogLevel.INFO, args: [undefined, 'plain'] },
    ])
  })

  it('forwards arguments in order, as-is', ({ captureAtDebug }) => {
    const log = scopedLog('ns')
    const obj = { a: 1 }
    log.warn('s', obj, 42, null)
    expect(captureAtDebug).toEqual([
      { level: LogLevel.WARN, args: ['[ns]', 's', obj, 42, null] },
    ])
    // Reference identity preserved — not a structural copy.
    expect(captureAtDebug[0]!.args[2]).toBe(obj)
  })
})
