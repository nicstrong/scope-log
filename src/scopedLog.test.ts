import {
  DEFAULT_ROOT_LEVEL,
  getNamespaces,
  scopedLog,
  reset,
  RootNamespace,
  setLogLevel,
  shouldLog,
  addOutputter,
  removeOutputter,
  getOutputters,
  resetOutputters,
} from './scopedLog.js'
import { LogLevel, type Outputter } from './types.js'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

describe('scopedLog tests', () => {
  let originalLog: any
  let originalError: any
  let originalWarn: any
  let originalInfo: any
  let logs: any[]
  let errors: any[]
  let warns: any[]
  let infos: any[]

  beforeAll(() => {
    // Set the log level to DEBUG for all tests
    setLogLevel('$:*', LogLevel.DEBUG)
  })

  beforeEach(() => {
    logs = []
    errors = []
    warns = []
    infos = []
    originalLog = console.log
    originalError = console.error
    originalWarn = console.warn
    originalInfo = console.info
    console.log = (...args: any[]) => logs.push(args)
    console.error = (...args: any[]) => errors.push(args)
    console.warn = (...args: any[]) => warns.push(args)
    console.info = (...args: any[]) => infos.push(args)
  })

  afterEach(() => {
    console.log = originalLog
    console.error = originalError
    console.warn = originalWarn
    console.info = originalInfo
  })

  it('should log with namespace', () => {
    const log = scopedLog('test')
    log('hello', 123)
    expect(logs[0][0]).toBe('[test]')
    expect(logs[0][1]).toBe('hello')
    expect(logs[0][2]).toBe(123)
  })

  it('should log error with namespace', () => {
    const log = scopedLog('err')
    log.error('fail', 42)
    expect(errors[0][0]).toBe('[err]')
    expect(errors[0][1]).toBe('fail')
    expect(errors[0][2]).toBe(42)
  })

  it('should log warn with namespace', () => {
    const log = scopedLog('warn')
    log.warn('warned', 'foo')
    expect(warns[0][0]).toBe('[warn]')
    expect(warns[0][1]).toBe('warned')
    expect(warns[0][2]).toBe('foo')
  })

  it('should log info with namespace', () => {
    const log = scopedLog('info')
    log.info('info', { a: 1 })
    expect(infos[0][0]).toBe('[info]')
    expect(infos[0][1]).toBe('info')
    expect(infos[0][2]).toEqual({ a: 1 })
  })

  it('should log with .log method', () => {
    const log = scopedLog('log')
    log.log('foo', 'bar')
    expect(logs[0][0]).toBe('[log]')
    expect(logs[0][1]).toBe('foo')
    expect(logs[0][2]).toBe('bar')
  })
})

describe('setLogLevel and shouldLog', () => {
  beforeEach(() => {
    // Reset log levels for each test
    reset()
  })

  it('should use root level for empty namespace', () => {
    setLogLevel(RootNamespace, LogLevel.WARN)
    expect(shouldLog(LogLevel.ERROR, RootNamespace)).toBe(true)
    expect(shouldLog(LogLevel.WARN, RootNamespace)).toBe(true)
    expect(shouldLog(LogLevel.INFO, RootNamespace)).toBe(false)
    expect(shouldLog(LogLevel.LOG, RootNamespace)).toBe(false)
    expect(shouldLog(LogLevel.DEBUG, RootNamespace)).toBe(false)
  })

  it('should use specific namespace level', () => {
    setLogLevel('Customer', LogLevel.WARN)
    expect(shouldLog(LogLevel.ERROR, 'Customer')).toBe(true)
    expect(shouldLog(LogLevel.WARN, 'Customer')).toBe(true)
    expect(shouldLog(LogLevel.INFO, 'Customer')).toBe(false)
  })

  it('should use wildcard namespace level', () => {
    setLogLevel('Customer:*', LogLevel.ERROR)
    expect(shouldLog(LogLevel.ERROR, 'Customer:Registration')).toBe(true)
    expect(shouldLog(LogLevel.WARN, 'Customer:Registration')).toBe(false)
    expect(shouldLog(LogLevel.ERROR, 'Customer:Other')).toBe(true)
  })

  it('should use most specific namespace level', () => {
    setLogLevel('Customer:*', LogLevel.WARN)
    setLogLevel('Customer:Registration', LogLevel.LOG)
    expect(shouldLog(LogLevel.LOG, 'Customer:Registration')).toBe(true)
    expect(shouldLog(LogLevel.INFO, 'Customer:Registration')).toBe(true)
    expect(shouldLog(LogLevel.WARN, 'Customer:Registration')).toBe(true)
    expect(shouldLog(LogLevel.DEBUG, 'Customer:Registration')).toBe(false)
    expect(shouldLog(LogLevel.WARN, 'Customer:Other')).toBe(true)
    expect(shouldLog(LogLevel.INFO, 'Customer:Other')).toBe(false)
    expect(shouldLog(LogLevel.INFO, 'Customer')).toBe(false)
    expect(shouldLog(LogLevel.WARN, 'Customer')).toBe(true)
  })

  it('should inherit from parent if no specific or wildcard', () => {
    setLogLevel('$', LogLevel.DEBUG)
    setLogLevel('Customer', LogLevel.ERROR)
    // should skip the Cusomer level as i=t's not a wildcard
    expect(shouldLog(LogLevel.INFO, 'Customer:Registration:Portal')).toBe(true)
    expect(shouldLog(LogLevel.WARN, 'Customer:Registration:Portal')).toBe(true)
    expect(shouldLog(LogLevel.DEBUG, 'Customer:Registration:Portal')).toBe(
      false
    )
  })
})

describe('setLogLevel tests', () => {
  beforeEach(() => {
    // Reset log levels for each test
    reset()
  })

  it('should be able to set root namespace by symbol', () => {
    setLogLevel(RootNamespace, LogLevel.DEBUG)
    expect(getNamespaces().cascadingLevel).toBe(DEFAULT_ROOT_LEVEL)
    expect(getNamespaces().nodeLevel).toBe(LogLevel.DEBUG)
  })

  it('should be able to set root namespace wildcard', () => {
    setLogLevel('$:*', LogLevel.DEBUG)
    expect(getNamespaces().cascadingLevel).toBe(LogLevel.DEBUG)
    expect(getNamespaces().nodeLevel).toBe(null)
  })
})

describe('outputter registration', () => {
  let originalLog: any
  let logs: any[]

  beforeEach(() => {
    resetOutputters()
    setLogLevel('$:*', LogLevel.DEBUG)
    logs = []
    originalLog = console.log
    console.log = (...args: any[]) => logs.push(args)
  })

  afterEach(() => {
    console.log = originalLog
    resetOutputters()
  })

  it('should dispatch to a registered outputter', () => {
    const captured: Array<[LogLevel, any[]]> = []
    const sink: Outputter = (level, message, ...rest) => {
      captured.push([level, [message, ...rest]])
    }
    addOutputter(sink)
    scopedLog('ns')('hello', 1)
    expect(captured).toHaveLength(1)
    expect(captured[0]![0]).toBe(LogLevel.LOG)
    expect(captured[0]![1]).toEqual(['[ns]', 'hello', 1])
  })

  it('should dispatch to all registered outputters alongside the default', () => {
    const a: any[] = []
    const b: any[] = []
    addOutputter((level, message, ...rest) => a.push([level, message, ...rest]))
    addOutputter((level, message, ...rest) => b.push([level, message, ...rest]))
    scopedLog('ns').info('hi')
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    expect(logs).toHaveLength(0) // info is not console.log
  })

  it('should remove a registered outputter and return true', () => {
    const captured: any[] = []
    const sink: Outputter = (level, message) => captured.push([level, message])
    addOutputter(sink)
    expect(removeOutputter(sink)).toBe(true)
    scopedLog('ns')('after-remove')
    expect(captured).toHaveLength(0)
  })

  it('should return false when removing an unregistered outputter', () => {
    const sink: Outputter = () => {}
    expect(removeOutputter(sink)).toBe(false)
  })

  it('should expose the current outputter list as readonly', () => {
    const before = getOutputters().length
    const sink: Outputter = () => {}
    addOutputter(sink)
    expect(getOutputters().length).toBe(before + 1)
    expect(getOutputters()).toContain(sink)
  })

  it('should restore the default outputter list on resetOutputters', () => {
    const sink: Outputter = () => {}
    addOutputter(sink)
    resetOutputters()
    expect(getOutputters()).toHaveLength(1)
    expect(getOutputters()).not.toContain(sink)
  })

  it('should respect log level filtering for custom outputters', () => {
    setLogLevel(RootNamespace, LogLevel.WARN)
    const captured: LogLevel[] = []
    addOutputter((level) => captured.push(level))
    const log = scopedLog(RootNamespace)
    log.info('filtered')
    log.warn('passed')
    expect(captured).toEqual([LogLevel.WARN])
  })
})
