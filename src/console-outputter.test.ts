import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConsoleOutputter } from './console-outputter.js'
import { LogLevel } from './types.js'

// The one test file where console.* is legitimately spied on. Any other
// file touching console.* should be considered a layering violation.

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ConsoleOutputter — level routing', () => {
  it.each([
    { level: LogLevel.ERROR, method: 'error' as const },
    { level: LogLevel.WARN, method: 'warn' as const },
    { level: LogLevel.INFO, method: 'info' as const },
    { level: LogLevel.LOG, method: 'log' as const },
    { level: LogLevel.DEBUG, method: 'debug' as const },
  ])('$level routes to console.$method', ({ level, method }) => {
    const spy = vi.spyOn(console, method).mockImplementation(() => {})
    ConsoleOutputter(level, 'msg', 1, 2)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('msg', 1, 2)
  })
})

describe('ConsoleOutputter — SILENT', () => {
  it('does not call any console.* method', () => {
    const spies = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
    ConsoleOutputter(LogLevel.SILENT, 'should not be logged')
    for (const spy of Object.values(spies)) {
      expect(spy).not.toHaveBeenCalled()
    }
  })
})

describe('ConsoleOutputter — argument forwarding', () => {
  it('passes message and rest args through unchanged', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const obj = { a: 1 }
    ConsoleOutputter(LogLevel.INFO, 'prefix', obj, 42, null, undefined)
    expect(spy).toHaveBeenCalledWith('prefix', obj, 42, null, undefined)
    // Reference identity preserved.
    expect(spy.mock.calls[0]![1]).toBe(obj)
  })

  it('handles an undefined message (root-namespace logger case)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    ConsoleOutputter(LogLevel.LOG, undefined, 'only-arg')
    expect(spy).toHaveBeenCalledWith(undefined, 'only-arg')
  })
})
