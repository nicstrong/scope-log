import { ConsoleOutputter } from './console-outputter.js'
import {
  RootNamespace,
  ROOT_NAMESPACE_KEY,
  WILDCARD_NAMESPACE_TOKEN,
  isRootNamespace,
  namespaceParts,
  type RootNamespaceType,
} from './parser.js'
import {
  createRootNode,
  DEFAULT_ROOT_LEVEL,
  getRegistry,
  type NamespaceNode,
} from './registry.js'
import { LazyLogThunk, LogLevel, Outputter } from './types.js'

export {
  RootNamespace,
  ROOT_NAMESPACE_KEY,
  WILDCARD_NAMESPACE_TOKEN,
  type RootNamespaceType,
  DEFAULT_ROOT_LEVEL,
}

export function scopedLog(namespace: string | RootNamespaceType) {
  const prefix = isRootNamespace(namespace) ? null : `[${namespace}]`

  const dispatch = (level: LogLevel, args: readonly unknown[]) => {
    if (prefix === null) {
      logToOutputters(namespace, level, ...args)
    } else {
      logToOutputters(namespace, level, prefix, ...args)
    }
  }

  const emit = (level: LogLevel, args: unknown[]) => dispatch(level, args)

  const emitLazy = (level: LogLevel, thunk: LazyLogThunk) => {
    if (!shouldLog(level, namespace)) return
    dispatch(level, thunk())
  }

  const base = (...args: unknown[]) => emit(LogLevel.LOG, args)
  base.error = (...args: unknown[]) => emit(LogLevel.ERROR, args)
  base.warn = (...args: unknown[]) => emit(LogLevel.WARN, args)
  base.info = (...args: unknown[]) => emit(LogLevel.INFO, args)
  base.log = (...args: unknown[]) => emit(LogLevel.LOG, args)
  base.debug = (...args: unknown[]) => emit(LogLevel.DEBUG, args)

  base.lazy = {
    error: (thunk: LazyLogThunk) => emitLazy(LogLevel.ERROR, thunk),
    warn: (thunk: LazyLogThunk) => emitLazy(LogLevel.WARN, thunk),
    info: (thunk: LazyLogThunk) => emitLazy(LogLevel.INFO, thunk),
    log: (thunk: LazyLogThunk) => emitLazy(LogLevel.LOG, thunk),
    debug: (thunk: LazyLogThunk) => emitLazy(LogLevel.DEBUG, thunk),
  }

  return base
}

export function addOutputter(outputter: Outputter): void {
  getRegistry().outputters.push(outputter)
}

export function removeOutputter(outputter: Outputter): boolean {
  const outputters = getRegistry().outputters
  const index = outputters.indexOf(outputter)
  if (index === -1) return false
  outputters.splice(index, 1)
  return true
}

export function getOutputters(): readonly Outputter[] {
  return getRegistry().outputters
}

export function resetOutputters(): void {
  // Mutate in place so callers that captured the array via `getOutputters()`
  // see the reset, rather than silently holding a stale reference.
  const outputters = getRegistry().outputters
  outputters.length = 0
  outputters.push(ConsoleOutputter)
}

function logToOutputters(
  namespace: string | RootNamespaceType,
  level: LogLevel,
  message?: any,
  ...optionalParams: any[]
) {
  if (shouldLog(level, namespace))
    for (const outputter of getRegistry().outputters) {
      outputter(level, message, ...optionalParams)
    }
}

export function getNamespaces(): NamespaceNode {
  return getRegistry().namespaces
}

export function reset() {
  // Replace the tree on the shared registry. The registry object itself is
  // stable across the call; every accessor re-reads `namespaces` through it.
  getRegistry().namespaces = createRootNode()
}

export function shouldLog(
  checkLevel: LogLevel,
  namespace: string | RootNamespaceType,
): boolean {
  // Wildcards are accepted here: `shouldLog(level, 'A:*')` asks the
  // cascade-only question — "would `level` fire for an arbitrary descendant
  // of A that has no override of its own?". Non-wildcard queries keep their
  // prefer-nodeLevel semantics.
  const [parts, isWildcard] = namespaceParts(namespace, true)
  const [nodes, remaining] = findNearestNode(parts)
  if (nodes.length === 0) {
    throw new Error(`No namespaces found invalid tree.`)
  }
  if (remaining.length === 0 && !isWildcard) {
    // exact non-wildcard match
    const level = nodes[0]!.nodeLevel ?? nodes[0]!.cascadingLevel
    if (level !== null) {
      return checkLevel <= level
    }
  }
  // wildcard, or no exact match — walk up looking for cascadingLevel
  for (const node of nodes) {
    const level = node.cascadingLevel
    if (level !== null) {
      return checkLevel <= level
    }
  }
  throw new Error('Invalid root namespace, no cascading level defined.')
}

export function setLogLevel(
  namespace: string | RootNamespaceType,
  level: LogLevel,
) {
  const [parts, isWildcard] = namespaceParts(namespace, true)
  const [nodes, remaining] = findNearestNode(parts)
  if (nodes.length === 0) {
    throw new Error(`No namespaces found invalid tree.`)
  }
  if (remaining.length === 0) {
    if (isWildcard) {
      nodes[0]!.cascadingLevel = level
    } else {
      nodes[0]!.nodeLevel = level
    }
    return
  }
  // add the remaining parts to the tree
  let currentNode = nodes[0]!
  for (let i = 0; i < remaining.length; i++) {
    const part = remaining[i]!
    if (currentNode.children.has(part)) {
      throw new Error(`Namespace shoudn't exist in the tree.`)
    }
    const childNode: NamespaceNode = {
      namespacePart: part,
      children: new Map<string, NamespaceNode>(),
      nodeLevel: null,
      cascadingLevel: null,
    }
    if (i === remaining.length - 1) {
      // last part so update the level
      if (isWildcard) {
        childNode.cascadingLevel = level
      } else {
        childNode.nodeLevel = level
      }
    }
    currentNode.children.set(part, childNode)
    currentNode = childNode
  }
}

// Finds the nearest node in the namespace tree
// and returns it along with the remaining namespace parts
function findNearestNode(
  namespaceParts: string[],
): readonly [NamespaceNode[], string[]] {
  let currentNode = getRegistry().namespaces
  const visited: NamespaceNode[] = [currentNode]
  for (let i = 0; i < namespaceParts.length; i++) {
    const part = namespaceParts[i]!
    const node = currentNode.children.get(part)
    if (node) {
      currentNode = node
      visited.unshift(currentNode) // nearest node at the top
    } else {
      return [visited, namespaceParts.slice(i)]
    }
  }
  return [visited, []]
}
