import { beforeEach, describe, expect, it } from 'vitest'
import { reset, RootNamespace, setLogLevel, shouldLog } from './scopedLog.js'
import { LogLevel } from './types.js'

beforeEach(() => {
  reset()
})

describe('shouldLog — default root (INFO)', () => {
  it.each([
    { level: LogLevel.ERROR, expected: true },
    { level: LogLevel.WARN, expected: true },
    { level: LogLevel.INFO, expected: true },
    { level: LogLevel.LOG, expected: false },
    { level: LogLevel.DEBUG, expected: false },
  ])('$level at root → $expected (INFO default)', ({ level, expected }) => {
    expect(shouldLog(level, RootNamespace)).toBe(expected)
  })

  it('unknown namespaces inherit the root cascading level', () => {
    expect(shouldLog(LogLevel.INFO, 'Anything:At:All')).toBe(true)
    expect(shouldLog(LogLevel.DEBUG, 'Anything:At:All')).toBe(false)
  })
})

describe('shouldLog — root override', () => {
  it('setLogLevel(RootNamespace, WARN) applies only to the root node', () => {
    setLogLevel(RootNamespace, LogLevel.WARN)
    // Root uses nodeLevel first, which is WARN.
    expect(shouldLog(LogLevel.WARN, RootNamespace)).toBe(true)
    expect(shouldLog(LogLevel.INFO, RootNamespace)).toBe(false)
    // Descendants still see the DEFAULT cascadingLevel (INFO).
    expect(shouldLog(LogLevel.INFO, 'A:B')).toBe(true)
    expect(shouldLog(LogLevel.LOG, 'A:B')).toBe(false)
  })

  it('setLogLevel("$:*", WARN) caps the whole tree', () => {
    setLogLevel('$:*', LogLevel.WARN)
    expect(shouldLog(LogLevel.WARN, RootNamespace)).toBe(true)
    expect(shouldLog(LogLevel.INFO, RootNamespace)).toBe(false)
    expect(shouldLog(LogLevel.WARN, 'A:B:C')).toBe(true)
    expect(shouldLog(LogLevel.INFO, 'A:B:C')).toBe(false)
  })
})

describe('shouldLog — exact vs wildcard resolution', () => {
  it('exact nodeLevel beats ancestor cascadingLevel', () => {
    setLogLevel('A:*', LogLevel.DEBUG)
    setLogLevel('A:B', LogLevel.INFO)
    expect(shouldLog(LogLevel.INFO, 'A:B')).toBe(true)
    expect(shouldLog(LogLevel.DEBUG, 'A:B')).toBe(false) // capped by exact
    expect(shouldLog(LogLevel.DEBUG, 'A:B:C')).toBe(true) // inherits A:* DEBUG
    expect(shouldLog(LogLevel.DEBUG, 'A:Other')).toBe(true)
  })

  it('falls back to nearest ancestor cascadingLevel when no exact match', () => {
    setLogLevel('A:*', LogLevel.DEBUG)
    setLogLevel('A:B:*', LogLevel.WARN)
    // A:B:* caps A:B and its descendants at WARN.
    expect(shouldLog(LogLevel.WARN, 'A:B')).toBe(true)
    expect(shouldLog(LogLevel.INFO, 'A:B')).toBe(false)
    expect(shouldLog(LogLevel.INFO, 'A:B:C')).toBe(false)
    // A:Sibling falls back to A:* (DEBUG).
    expect(shouldLog(LogLevel.DEBUG, 'A:Sibling')).toBe(true)
  })

  it('when a node has only nodeLevel, descendants skip past it', () => {
    setLogLevel(RootNamespace, LogLevel.DEBUG) // root nodeLevel
    setLogLevel('Customer', LogLevel.ERROR) // intermediate nodeLevel only
    // Customer (exact) capped at ERROR.
    expect(shouldLog(LogLevel.WARN, 'Customer')).toBe(false)
    // Customer:Sub inherits the NEAREST cascadingLevel, which is root's default INFO
    // (root's nodeLevel DEBUG does NOT cascade).
    expect(shouldLog(LogLevel.INFO, 'Customer:Sub')).toBe(true)
    expect(shouldLog(LogLevel.LOG, 'Customer:Sub')).toBe(false)
  })

  it('exact node with only cascadingLevel uses it as its own effective level', () => {
    setLogLevel('A:*', LogLevel.DEBUG)
    // "A" node exists with cascadingLevel=DEBUG, nodeLevel=null.
    expect(shouldLog(LogLevel.DEBUG, 'A')).toBe(true)
  })
})

describe('shouldLog — SILENT', () => {
  it('mutes the subtree it is set on', () => {
    setLogLevel('Quiet:*', LogLevel.SILENT)
    expect(shouldLog(LogLevel.ERROR, 'Quiet')).toBe(false)
    expect(shouldLog(LogLevel.ERROR, 'Quiet:Anything')).toBe(false)
    expect(shouldLog(LogLevel.DEBUG, 'Quiet:Anything')).toBe(false)
    // Siblings unaffected.
    expect(shouldLog(LogLevel.INFO, 'Loud')).toBe(true)
  })
})

describe('shouldLog — error cases', () => {
  it('throws when passed a wildcard namespace', () => {
    expect(() => shouldLog(LogLevel.INFO, 'A:*')).toThrow(/wildcard/i)
  })
})
