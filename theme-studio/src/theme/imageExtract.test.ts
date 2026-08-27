import { describe, expect, it } from 'vitest'
import { quantizeColors } from './imageExtract'

// jsdom has no real <canvas> 2D context (would need the optional `canvas`
// npm package this project deliberately doesn't depend on), so these test
// the actual quantization algorithm directly against hand-built pixel
// arrays rather than extractPaletteFromImage's canvas-sampling wrapper.

function repeat<T>(value: T, count: number): T[] {
  return Array.from({ length: count }, () => value)
}

describe('quantizeColors', () => {
  it('returns nothing for an empty pixel list', () => {
    expect(quantizeColors([], 10)).toEqual({ colors: [], averageLuminance: 0 })
  })

  it('returns a single color unchanged for a solid-color image', () => {
    const pixels = repeat([30, 30, 30] as const, 500)
    const result = quantizeColors(pixels, 10)
    expect(result.colors).toEqual(['#1e1e1e'])
  })

  it('separates two well-separated solid colors into two clusters, dominant first', () => {
    const pixels = [...repeat([255, 0, 0] as const, 700), ...repeat([0, 0, 255] as const, 300)]
    const result = quantizeColors(pixels, 10)
    expect(result.colors).toEqual(['#ff0000', '#0000ff'])
  })

  it('never returns more clusters than the image actually has', () => {
    const pixels = [...repeat([10, 10, 10] as const, 10), ...repeat([200, 200, 200] as const, 10)]
    const result = quantizeColors(pixels, 10)
    expect(result.colors).toHaveLength(2)
  })

  it('caps output at clusterCount for a genuinely varied image', () => {
    const pixels: Array<readonly [number, number, number]> = []
    for (let r = 0; r < 256; r += 32) {
      for (let g = 0; g < 256; g += 32) {
        pixels.push([r, g, 128])
      }
    }
    const result = quantizeColors(pixels, 5)
    expect(result.colors).toHaveLength(5)
  })

  it('weights the average toward the larger cluster', () => {
    // A cluster made mostly of near-black with a few near-white outliers
    // should average out closer to black than to grey.
    const pixels = [...repeat([0, 0, 0] as const, 90), ...repeat([255, 255, 255] as const, 10)]
    const result = quantizeColors(pixels, 1)
    expect(result.colors).toEqual(['#1a1a1a'])
  })

  it('computes averageLuminance across all sampled pixels', () => {
    const result = quantizeColors([[0, 0, 0], [255, 255, 255]], 10)
    expect(result.averageLuminance).toBeCloseTo(0.5, 1)
  })
})
