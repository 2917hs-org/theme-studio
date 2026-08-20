import { describe, expect, it } from 'vitest'
import { colorForScope } from './previewTokenize'

describe('colorForScope', () => {
  it('matches an exact scope', () => {
    const assignments = new Map([['keyword.control.enum.ts', '#ff0000']])
    expect(colorForScope('keyword.control.enum.ts', assignments)).toBe('#ff0000')
  })

  it('falls back to a broader dot-segment prefix, most specific first', () => {
    const assignments = new Map([
      ['keyword', '#111111'],
      ['keyword.control', '#222222'],
    ])
    // "keyword.control.enum.ts" isn't assigned directly, but "keyword.control" is
    // more specific than "keyword" and should win.
    expect(colorForScope('keyword.control.enum.ts', assignments)).toBe('#222222')
  })

  it('falls back all the way to a top-level scope', () => {
    const assignments = new Map([['keyword', '#111111']])
    expect(colorForScope('keyword.control.enum.ts', assignments)).toBe('#111111')
  })

  it('returns undefined when nothing matches', () => {
    const assignments = new Map([['string', '#00ff00']])
    expect(colorForScope('keyword.control.enum.ts', assignments)).toBeUndefined()
  })

  it('does not match an unrelated scope that happens to share a prefix word', () => {
    // "keywordish" must not match an assignment on "keyword" — matching is
    // by dot-segment, not raw string prefix.
    const assignments = new Map([['keyword', '#111111']])
    expect(colorForScope('keywordish.other', assignments)).toBeUndefined()
  })
})
