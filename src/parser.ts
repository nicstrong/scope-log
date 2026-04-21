export const RootNamespace: unique symbol = Symbol('RootNamespace')
export type RootNamespaceType = typeof RootNamespace

export const WILDCARD_NAMESPACE_TOKEN = '*'
export const ROOT_NAMESPACE_KEY = '$'

export function namespaceParts(
  namespace: string | RootNamespaceType,
  allowWildcard: boolean
): [string[], boolean] {
  if (namespace === RootNamespace) {
    return [[], false]
  }
  if (namespace === '' || namespace === ROOT_NAMESPACE_KEY) {
    return [[], false]
  }
  if (namespace.endsWith(':')) {
    throw new Error(`Namespace "${namespace}" cannot end with a colon ':'.`)
  }
  if (namespace.includes('::')) {
    throw new Error(
      `Namespace "${namespace}" cannot contain empty segments (e.g., "Level1::Level2").`
    )
  }
  const parts = namespace.split(':')
  if (parts.length === 0) {
    throw new Error(`Namespace "${namespace}" cannot be empty.`)
  }

  let isWildcard = false
  if (parts[parts.length - 1] === WILDCARD_NAMESPACE_TOKEN) {
    isWildcard = true
    if (!allowWildcard) {
      throw new Error(
        `Namespace "${namespace}" cannot end with a wildcard token '${WILDCARD_NAMESPACE_TOKEN}'.`
      )
    }
    parts.pop()
  }
  if (parts.length === 1 && parts[0] === ROOT_NAMESPACE_KEY) {
    return [[], isWildcard]
  }
  return [parts, isWildcard]
}
