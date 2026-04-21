import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_ROOT_LEVEL,
  getNamespaces,
  reset,
  RootNamespace,
  setLogLevel,
} from './scopedLog.js'
import { LogLevel } from './types.js'

beforeEach(() => {
  reset()
})

describe('setLogLevel — initial tree state', () => {
  it('root starts with cascadingLevel=DEFAULT_ROOT_LEVEL and nodeLevel=null', () => {
    const root = getNamespaces()
    expect(root.cascadingLevel).toBe(DEFAULT_ROOT_LEVEL)
    expect(root.nodeLevel).toBe(null)
    expect(root.children.size).toBe(0)
  })

  it('reset() restores the initial tree even after mutations', () => {
    setLogLevel('A:B:C', LogLevel.DEBUG)
    expect(getNamespaces().children.size).toBe(1)
    reset()
    expect(getNamespaces().children.size).toBe(0)
    expect(getNamespaces().cascadingLevel).toBe(DEFAULT_ROOT_LEVEL)
  })
})

describe('setLogLevel — root forms', () => {
  it('RootNamespace symbol sets root.nodeLevel, leaves cascadingLevel default', () => {
    setLogLevel(RootNamespace, LogLevel.DEBUG)
    expect(getNamespaces().nodeLevel).toBe(LogLevel.DEBUG)
    expect(getNamespaces().cascadingLevel).toBe(DEFAULT_ROOT_LEVEL)
  })

  it('"$" string is equivalent to RootNamespace', () => {
    setLogLevel('$', LogLevel.DEBUG)
    expect(getNamespaces().nodeLevel).toBe(LogLevel.DEBUG)
  })

  it('"$:*" sets root.cascadingLevel, leaves nodeLevel null', () => {
    setLogLevel('$:*', LogLevel.DEBUG)
    expect(getNamespaces().cascadingLevel).toBe(LogLevel.DEBUG)
    expect(getNamespaces().nodeLevel).toBe(null)
  })
})

describe('setLogLevel — leaf creation', () => {
  it('non-wildcard sets only nodeLevel on a new leaf', () => {
    setLogLevel('A', LogLevel.WARN)
    const a = getNamespaces().children.get('A')!
    expect(a.nodeLevel).toBe(LogLevel.WARN)
    expect(a.cascadingLevel).toBe(null)
  })

  it('wildcard sets only cascadingLevel on a new leaf', () => {
    setLogLevel('A:*', LogLevel.WARN)
    const a = getNamespaces().children.get('A')!
    expect(a.nodeLevel).toBe(null)
    expect(a.cascadingLevel).toBe(LogLevel.WARN)
  })

  it('creates intermediate nodes with both levels null', () => {
    setLogLevel('A:B:C:D', LogLevel.DEBUG)
    const a = getNamespaces().children.get('A')!
    const b = a.children.get('B')!
    const c = b.children.get('C')!
    const d = c.children.get('D')!
    expect(a.nodeLevel).toBe(null)
    expect(a.cascadingLevel).toBe(null)
    expect(b.nodeLevel).toBe(null)
    expect(b.cascadingLevel).toBe(null)
    expect(c.nodeLevel).toBe(null)
    expect(c.cascadingLevel).toBe(null)
    expect(d.nodeLevel).toBe(LogLevel.DEBUG)
    expect(d.cascadingLevel).toBe(null)
  })
})

describe('setLogLevel — overlapping assignments on the same node', () => {
  it('nodeLevel and cascadingLevel coexist independently', () => {
    setLogLevel('A', LogLevel.WARN)
    setLogLevel('A:*', LogLevel.DEBUG)
    const a = getNamespaces().children.get('A')!
    expect(a.nodeLevel).toBe(LogLevel.WARN)
    expect(a.cascadingLevel).toBe(LogLevel.DEBUG)
  })

  it('later non-wildcard replaces an earlier non-wildcard', () => {
    setLogLevel('A', LogLevel.WARN)
    setLogLevel('A', LogLevel.ERROR)
    expect(getNamespaces().children.get('A')!.nodeLevel).toBe(LogLevel.ERROR)
  })

  it('later wildcard replaces an earlier wildcard', () => {
    setLogLevel('A:*', LogLevel.WARN)
    setLogLevel('A:*', LogLevel.DEBUG)
    expect(getNamespaces().children.get('A')!.cascadingLevel).toBe(
      LogLevel.DEBUG,
    )
  })
})

describe('setLogLevel — validation errors', () => {
  it('rejects trailing colon', () => {
    expect(() => setLogLevel('A:', LogLevel.INFO)).toThrow(/colon/)
  })

  it('rejects empty inner segments', () => {
    expect(() => setLogLevel('A::B', LogLevel.INFO)).toThrow(/empty segments/)
  })
})
