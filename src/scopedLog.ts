import { ConsoleOutputter } from './console-outputter.js'
import {
  RootNamespace,
  ROOT_NAMESPACE_KEY,
  WILDCARD_NAMESPACE_TOKEN,
  namespaceParts,
  type RootNamespaceType,
} from './parser.js'
import { LogLevel, Outputter } from './types.js'

export {
  RootNamespace,
  ROOT_NAMESPACE_KEY,
  WILDCARD_NAMESPACE_TOKEN,
  type RootNamespaceType,
}

export const DEFAULT_ROOT_LEVEL = LogLevel.INFO

export function scopedLog(namespace: string | RootNamespaceType) {
  const message = typeof namespace === 'symbol' ? undefined : `[${namespace}]`
  const base = (...optionalParams: any[]) => {
    logToOutputters(namespace, LogLevel.LOG, message, ...optionalParams)
  }
  base.error = (...optionalParams: any[]) => {
    logToOutputters(namespace, LogLevel.ERROR, message, ...optionalParams)
  }
  base.warn = (...optionalParams: any[]) => {
    logToOutputters(namespace, LogLevel.WARN, message, ...optionalParams)
  }
  base.info = (...optionalParams: any[]) => {
    logToOutputters(namespace, LogLevel.INFO, message, ...optionalParams)
  }
  base.log = (...optionalParams: any[]) => {
    logToOutputters(namespace, LogLevel.LOG, message, ...optionalParams)
  }
  base.debug = (...optionalParams: any[]) => {
    logToOutputters(namespace, LogLevel.DEBUG, message, ...optionalParams)
  }

  return base
}

let outputters: Outputter[] = [ConsoleOutputter]

export function addOutputter(outputter: Outputter): void {
  outputters.push(outputter)
}

export function removeOutputter(outputter: Outputter): boolean {
  const index = outputters.indexOf(outputter)
  if (index === -1) return false
  outputters.splice(index, 1)
  return true
}

export function getOutputters(): readonly Outputter[] {
  return outputters
}

export function resetOutputters(): void {
  outputters = [ConsoleOutputter]
}

function logToOutputters(
  namespace: string | RootNamespaceType,
  level: LogLevel,
  message?: any,
  ...optionalParams: any[]
) {
  if (shouldLog(level, namespace))
    for (const outputter of outputters) {
      outputter(level, message, ...optionalParams)
    }
}

type NamespaceNode = {
  namespacePart: string
  children: Map<string, NamespaceNode>
  nodeLevel: LogLevel | null
  cascadingLevel: LogLevel | null
}

function createRootNode(): NamespaceNode {
  return {
    namespacePart: ROOT_NAMESPACE_KEY,
    children: new Map<string, NamespaceNode>(),
    nodeLevel: null,
    cascadingLevel: DEFAULT_ROOT_LEVEL,
  }
}

let _namespaces = createRootNode()

export function getNamespaces(): NamespaceNode {
  return _namespaces
}

export function reset() {
  _namespaces = createRootNode()
}

export function shouldLog(
  checkLevel: LogLevel,
  namespace: string | RootNamespaceType,
): boolean {
  const [parts, _isWildcard] = namespaceParts(namespace, false)
  const [nodes, remaining] = findNearestNode(parts)
  if (nodes.length === 0) {
    throw new Error(`No namespaces found invalid tree.`)
  }
  if (remaining.length === 0) {
    // found exact match
    const level = nodes[0]!.nodeLevel ?? nodes[0]!.cascadingLevel
    if (level !== null) {
      return checkLevel <= level
    }
  }
  // search up till find a cascading level
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
  let currentNode = _namespaces
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
