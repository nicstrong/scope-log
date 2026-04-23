import { ConsoleOutputter } from './console-outputter.js'
import { ROOT_NAMESPACE_KEY } from './parser.js'
import { LogLevel, type Outputter } from './types.js'

/**
 * The default cascading level seeded at the root of a fresh tree.
 * Re-exported from `scopedLog.ts` as part of the public API.
 */
export const DEFAULT_ROOT_LEVEL = LogLevel.INFO

export type NamespaceNode = {
  namespacePart: string
  children: Map<string, NamespaceNode>
  nodeLevel: LogLevel | null
  cascadingLevel: LogLevel | null
}

export function createRootNode(): NamespaceNode {
  return {
    namespacePart: ROOT_NAMESPACE_KEY,
    children: new Map<string, NamespaceNode>(),
    nodeLevel: null,
    cascadingLevel: DEFAULT_ROOT_LEVEL,
  }
}

/**
 * The shared singleton state. `outputters` is the registered sink list;
 * `namespaces` is the root of the namespace tree. Mutate both in place —
 * consumers cache references via `getOutputters()` / `getNamespaces()`, so
 * reassigning would leak stale state.
 */
type Registry = {
  outputters: Outputter[]
  namespaces: NamespaceNode
}

/**
 * Versioned global symbol key. Kept major-scoped so that scope-log 1.x and a
 * hypothetical 2.x don't collide on a shared registry shape that neither
 * understands. Within a single major, every copy of the package loaded into
 * the same realm cooperates via this one slot.
 */
const REGISTRY_KEY = Symbol.for('scope-log/registry@1')

function createRegistry(): Registry {
  return {
    outputters: [ConsoleOutputter],
    namespaces: createRootNode(),
  }
}

function isValidRegistry(slot: unknown): slot is Registry {
  if (typeof slot !== 'object' || slot === null) return false
  const candidate = slot as { outputters?: unknown; namespaces?: unknown }
  return (
    Array.isArray(candidate.outputters) &&
    typeof candidate.namespaces === 'object' &&
    candidate.namespaces !== null
  )
}

/**
 * Lazy, idempotent access to the shared registry.
 *
 * First caller in the realm creates the slot on `globalThis`; subsequent
 * callers (including *other* module instances loaded from duplicate paths)
 * read the same slot and cooperate on one tree + one outputter list.
 *
 * If the slot exists but its shape is wrong (a same-major copy somehow
 * wrote garbage there), we overwrite it — first-writer-wins is the only
 * safe strategy without explicit cross-copy coordination.
 *
 * Falls back gracefully in sealed / frozen `globalThis` environments: if
 * assignment throws, returns the fresh instance without stashing. Sharing
 * is lost in that environment; behaviour reverts to pre-registry (one tree
 * per module instance), which is no worse than today.
 */
export function getRegistry(): Registry {
  const g = globalThis as unknown as Record<symbol, unknown>
  const existing = g[REGISTRY_KEY]
  if (isValidRegistry(existing)) return existing
  const fresh = createRegistry()
  try {
    g[REGISTRY_KEY] = fresh
  } catch {
    // sealed / frozen globalThis — nothing we can do, caller still gets a
    // working registry, just without cross-instance sharing.
  }
  return fresh
}
