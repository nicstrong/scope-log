import { test as base } from 'vitest'
import { ConsoleOutputter } from './console-outputter.js'
import {
  addOutputter,
  removeOutputter,
  reset,
  resetOutputters,
  setLogLevel,
} from './scopedLog.js'
import { LogLevel, type Outputter } from './types.js'

export type CapturedCall = { level: LogLevel; args: unknown[] }
export type Captured = CapturedCall[]

type Fixtures = {
  /**
   * Captured log calls for the current test. Pre-wired: state is reset, the
   * default ConsoleOutputter is removed, and a capture sink is registered
   * before the test body runs. Teardown re-clears everything.
   */
  capture: Captured
  /**
   * Same as `capture`, but with the root `cascadingLevel` set to `DEBUG` so
   * every `scopedLog(...)` call dispatches regardless of namespace. Use when
   * you want to assert prefix / argument shape without reasoning about level
   * filtering.
   */
  captureAtDebug: Captured
}

function installCaptureSink(): Captured {
  reset()
  resetOutputters()
  removeOutputter(ConsoleOutputter)
  const calls: Captured = []
  const sink: Outputter = (level, message, ...rest) =>
    calls.push({ level, args: [message, ...rest] })
  addOutputter(sink)
  return calls
}

function teardown() {
  reset()
  resetOutputters()
}

export const scopedTest = base.extend<Fixtures>({
  capture: async ({}, use) => {
    const calls = installCaptureSink()
    await use(calls)
    teardown()
  },
  captureAtDebug: async ({}, use) => {
    const calls = installCaptureSink()
    setLogLevel('$:*', LogLevel.DEBUG)
    await use(calls)
    teardown()
  },
})
