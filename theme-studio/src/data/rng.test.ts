import { describe, expect, it } from 'vitest'
import { mulberry32, pick, pickN, randInt } from './rng'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 5 }, () => a())
    const seqB = Array.from({ length: 5 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(a()).not.toBe(b())
  })

  it('always returns values in [0, 1)', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 200; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('pick', () => {
  it('returns a stable, in-range item for a fixed rng', () => {
    const items = ['a', 'b', 'c', 'd'] as const
    const rng = () => 0.5
    expect(pick(rng, items)).toBe('c')
  })

  it('never indexes out of bounds even when rng returns just under 1', () => {
    const items = ['x', 'y', 'z']
    const rng = () => 0.999999
    expect(items).toContain(pick(rng, items))
  })
})

describe('pickN', () => {
  it('returns n distinct items without replacement', () => {
    const items = [1, 2, 3, 4, 5]
    const rng = mulberry32(3)
    const result = pickN(rng, items, 3)
    expect(result).toHaveLength(3)
    expect(new Set(result).size).toBe(3)
    for (const v of result) expect(items).toContain(v)
  })

  it('caps at the pool size when n exceeds it', () => {
    const items = [1, 2, 3]
    const rng = mulberry32(1)
    const result = pickN(rng, items, 10)
    expect(result).toHaveLength(3)
    expect(new Set(result)).toEqual(new Set(items))
  })

  it('returns an empty array for an empty pool', () => {
    const rng = mulberry32(1)
    expect(pickN(rng, [], 3)).toEqual([])
  })
})

describe('randInt', () => {
  it('is inclusive of both bounds', () => {
    const seen = new Set<number>()
    for (let seed = 0; seed < 500; seed++) {
      seen.add(randInt(mulberry32(seed), 0, 2))
    }
    expect(seen).toEqual(new Set([0, 1, 2]))
  })

  it('returns the single value when min equals max', () => {
    expect(randInt(() => 0.5, 4, 4)).toBe(4)
  })
})
