import { describe, it, expect } from 'vitest'
import { namespaceParts, RootNamespace } from './parser.js'

describe('namespaceParts — root forms', () => {
  it('resolves the RootNamespace symbol to the root', () => {
    expect(namespaceParts(RootNamespace, false)).toEqual([[], false])
    expect(namespaceParts(RootNamespace, true)).toEqual([[], false])
  })

  it.each(['', '$'])('resolves "%s" to the root', (input) => {
    expect(namespaceParts(input, false)).toEqual([[], false])
    expect(namespaceParts(input, true)).toEqual([[], false])
  })

  it('treats "$:*" as the wildcarded root', () => {
    expect(namespaceParts('$:*', true)).toEqual([[], true])
  })
})

describe('namespaceParts — simple segments', () => {
  it.each([
    { input: 'A', parts: ['A'] },
    { input: 'A:B', parts: ['A', 'B'] },
    { input: 'A:B:C', parts: ['A', 'B', 'C'] },
    { input: 'Feature:Area:Sub', parts: ['Feature', 'Area', 'Sub'] },
  ])('splits "$input" into $parts', ({ input, parts }) => {
    expect(namespaceParts(input, false)).toEqual([parts, false])
    expect(namespaceParts(input, true)).toEqual([parts, false])
  })
})

describe('namespaceParts — wildcards', () => {
  it.each([
    { input: 'A:*', parts: ['A'] },
    { input: 'A:B:*', parts: ['A', 'B'] },
    { input: 'Feature:Area:*', parts: ['Feature', 'Area'] },
  ])(
    'pops trailing "*" from "$input" when allowWildcard=true',
    ({ input, parts }) => {
      expect(namespaceParts(input, true)).toEqual([parts, true])
    },
  )

  it('throws when a trailing wildcard is seen but not allowed', () => {
    expect(() => namespaceParts('A:*', false)).toThrow(/wildcard/i)
    expect(() => namespaceParts('$:*', false)).toThrow(/wildcard/i)
  })
})

describe('namespaceParts — validation errors', () => {
  it('throws on trailing colon', () => {
    expect(() => namespaceParts('A:', true)).toThrow(/end with a colon/)
    expect(() => namespaceParts('A:B:', true)).toThrow(/end with a colon/)
  })

  it('throws on empty inner segments', () => {
    expect(() => namespaceParts('A::B', true)).toThrow(/empty segments/)
    expect(() => namespaceParts('A::', true)).toThrow() // trailing colon wins the race; pin that it rejects
  })
})

describe('namespaceParts — behaviour worth pinning', () => {
  // Pins current behaviour: only a *trailing* '*' is treated as a wildcard.
  // Non-trailing '*' is kept as a literal segment. The tree layer later
  // creates a child literally named '*'. If this ever changes (to reject
  // non-trailing wildcards), update this test deliberately.
  it('keeps a non-trailing "*" as a literal segment', () => {
    expect(namespaceParts('A:*:B', true)).toEqual([['A', '*', 'B'], false])
  })

  // `namespace === ''` returns the root early, so an otherwise-invalid empty
  // namespace never reaches the split/validation code. Pin that, too.
  it('treats the empty string as the root, not as an error', () => {
    expect(namespaceParts('', true)).toEqual([[], false])
  })
})
