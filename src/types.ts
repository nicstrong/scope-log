export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  LOG = 4,
  DEBUG = 5,
}

export type Outputter = (
  level: LogLevel,
  message?: any,
  ...optionalArgs: any[]
) => void

export type LazyLogThunk = () => readonly unknown[]
