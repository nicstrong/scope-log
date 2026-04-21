import { describe, expect } from 'vitest'
import {
  addOutputter,
  removeOutputter,
  RootNamespace,
  scopedLog,
  setLogLevel,
  shouldLog,
} from './scopedLog.js'
import { LogLevel, type Outputter } from './types.js'
import { scopedTest as it } from './test-utils.js'

// End-to-end coverage anchored to docs/analysis.md. Each test maps to a
// named example and must continue to pass verbatim after internal refactors.

describe('smoke — consumer examples', () => {
  it('1. creating a logger — prefix + every level method (docs/analysis.md:150)', ({
    captureAtDebug,
  }) => {
    const log = scopedLog('Customer:Registration')
    log('hello', { userId: 42 })
    log.info('signed up')
    log.warn('slow response')
    log.error('boom')
    log.debug('payload', { a: 1 })

    expect(captureAtDebug).toEqual([
      {
        level: LogLevel.LOG,
        args: ['[Customer:Registration]', 'hello', { userId: 42 }],
      },
      {
        level: LogLevel.INFO,
        args: ['[Customer:Registration]', 'signed up'],
      },
      {
        level: LogLevel.WARN,
        args: ['[Customer:Registration]', 'slow response'],
      },
      {
        level: LogLevel.ERROR,
        args: ['[Customer:Registration]', 'boom'],
      },
      {
        level: LogLevel.DEBUG,
        args: ['[Customer:Registration]', 'payload', { a: 1 }],
      },
    ])
  })

  it('2. per-feature verbosity — the full worked example (docs/analysis.md:272)', ({
    capture,
  }) => {
    setLogLevel('$:*', LogLevel.WARN)
    setLogLevel('Auth:*', LogLevel.INFO)
    setLogLevel('Auth:Token', LogLevel.DEBUG)

    const authLog = scopedLog('Auth:Session')
    const tokenLog = scopedLog('Auth:Token')
    const uiLog = scopedLog('UI:Header')

    authLog.info('session restored') // ✅ Auth:* = INFO
    authLog.debug('session cookie') // ❌ Auth:* caps at INFO
    tokenLog.debug('decoded jwt') // ✅ Auth:Token = DEBUG
    uiLog.info('rendered header') // ❌ $:* = WARN
    uiLog.warn('slow paint') // ✅

    expect(capture.map((c) => c.args[1])).toEqual([
      'session restored',
      'decoded jwt',
      'slow paint',
    ])
  })

  it('3. exact beats wildcard (docs/analysis.md:186)', ({ capture }) => {
    setLogLevel('Checkout:*', LogLevel.DEBUG)
    setLogLevel('Checkout:Pricing', LogLevel.INFO)

    const orders = scopedLog('Checkout:Orders')
    const pricing = scopedLog('Checkout:Pricing')
    const admin = scopedLog('Admin')

    orders.debug('orders-debug') // ✅ inherits Checkout:* = DEBUG
    pricing.debug('pricing-debug') // ❌ exact match beats wildcard
    admin.debug('admin-debug') // ❌ root default INFO

    expect(capture.map((c) => c.args[1])).toEqual(['orders-debug'])
  })

  it('4. shouldLog as a guard (docs/analysis.md:213)', () => {
    setLogLevel('Checkout:Pricing', LogLevel.INFO)
    expect(shouldLog(LogLevel.DEBUG, 'Checkout:Pricing')).toBe(false)
    expect(shouldLog(LogLevel.INFO, 'Checkout:Pricing')).toBe(true)
  })

  it('5. custom outputter — add / remove (docs/analysis.md:226)', ({
    captureAtDebug,
  }) => {
    const secondCalls: Array<unknown> = []
    const second: Outputter = (_level, message) => secondCalls.push(message)
    addOutputter(second)

    scopedLog('ns')('one')
    expect(captureAtDebug).toHaveLength(1)
    expect(secondCalls).toEqual(['[ns]'])

    removeOutputter(second)
    scopedLog('ns')('two')
    expect(captureAtDebug).toHaveLength(2)
    expect(secondCalls).toEqual(['[ns]']) // unchanged after removal
  })

  it('6. test harness reset — fixture teardown isolates tests', ({
    capture,
  }) => {
    setLogLevel('Noisy:*', LogLevel.DEBUG)
    scopedLog('Noisy:Sub').debug('during this test')
    expect(capture).toHaveLength(1)
    // Subsequent tests get a fresh tree + empty capture via the fixture —
    // the independence is implicit in every other test in this file.
  })

  it('7. root-namespace logger emits without a "[…]" prefix (docs/analysis.md:327)', ({
    captureAtDebug,
  }) => {
    scopedLog(RootNamespace).info('plain message')
    expect(captureAtDebug).toEqual([
      { level: LogLevel.INFO, args: [undefined, 'plain message'] },
    ])
  })
})
