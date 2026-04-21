import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConsoleOutputter } from './console-outputter.js'
import {
  addOutputter,
  getOutputters,
  removeOutputter,
  reset,
  resetOutputters,
  RootNamespace,
  scopedLog,
  setLogLevel,
} from './scopedLog.js'
import { LogLevel, type Outputter } from './types.js'

beforeEach(() => {
  reset()
  resetOutputters()
  // Remove the default ConsoleOutputter so tests don't spam stdout while
  // verifying registration mechanics.
  removeOutputter(ConsoleOutputter)
  setLogLevel('$:*', LogLevel.DEBUG)
})

afterEach(() => {
  reset()
  resetOutputters()
})

describe('outputter — registration', () => {
  it('starts with [ConsoleOutputter] after resetOutputters', () => {
    resetOutputters()
    expect(getOutputters()).toEqual([ConsoleOutputter])
  })

  it('addOutputter appends to the list', () => {
    const a: Outputter = () => {}
    const b: Outputter = () => {}
    addOutputter(a)
    addOutputter(b)
    expect(getOutputters()).toEqual([a, b])
  })

  it('removeOutputter returns true and drops the sink', () => {
    const sink: Outputter = () => {}
    addOutputter(sink)
    expect(removeOutputter(sink)).toBe(true)
    expect(getOutputters()).not.toContain(sink)
  })

  it('removeOutputter returns false for an unregistered sink', () => {
    const sink: Outputter = () => {}
    expect(removeOutputter(sink)).toBe(false)
  })

  it('getOutputters is readonly at the type level but reflects mutations', () => {
    const sink: Outputter = () => {}
    addOutputter(sink)
    const before = getOutputters().length
    removeOutputter(sink)
    expect(getOutputters().length).toBe(before - 1)
  })

  it('resetOutputters restores the default [ConsoleOutputter]', () => {
    addOutputter(() => {})
    addOutputter(() => {})
    resetOutputters()
    expect(getOutputters()).toEqual([ConsoleOutputter])
  })
})

describe('outputter — dispatch', () => {
  it('fan-out: every registered sink receives the same call', () => {
    const a: Array<[LogLevel, unknown[]]> = []
    const b: Array<[LogLevel, unknown[]]> = []
    addOutputter((level, msg, ...rest) => a.push([level, [msg, ...rest]]))
    addOutputter((level, msg, ...rest) => b.push([level, [msg, ...rest]]))
    scopedLog('ns').info('x', 1)
    expect(a).toEqual([[LogLevel.INFO, ['[ns]', 'x', 1]]])
    expect(b).toEqual([[LogLevel.INFO, ['[ns]', 'x', 1]]])
  })

  it('preserves registration order', () => {
    const order: string[] = []
    addOutputter(() => order.push('a'))
    addOutputter(() => order.push('b'))
    addOutputter(() => order.push('c'))
    scopedLog('ns').info('hi')
    expect(order).toEqual(['a', 'b', 'c'])
  })

  it('consults shouldLog before invoking sinks (single negative case)', () => {
    // The exhaustive level matrix lives in shouldLog.test.ts — we just need
    // one case here proving the guard is actually called.
    setLogLevel(RootNamespace, LogLevel.WARN)
    const calls: LogLevel[] = []
    addOutputter((level) => calls.push(level))
    const log = scopedLog(RootNamespace)
    log.info('filtered') // below WARN → suppressed
    log.warn('passes')
    expect(calls).toEqual([LogLevel.WARN])
  })
})
