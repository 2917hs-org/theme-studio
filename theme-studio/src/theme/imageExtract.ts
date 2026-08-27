import { rgbToHex } from './colorParse';

export interface ExtractedPalette {
  /** Hex colors, sorted by cluster weight (dominant first). */
  colors: string[];
  averageLuminance: number;
}

type Pixel = readonly [number, number, number];

// Extraction quality doesn't benefit from full resolution; speed does — and
// decoding a large photo at full size before downscaling is the actual
// memory risk on low-end mobile (see ImageThemeTab, which decodes straight
// to this size via createImageBitmap's resizeWidth/resizeHeight so a 40MP
// photo is never fully decoded in the first place). This cap is a defensive
// fallback for any caller that hands over a bigger bitmap.
const MAX_SAMPLE_DIMENSION = 100;

/**
 * Median-cut color quantization over raw RGB samples — deterministic (same
 * image, same output, which matters for the share-link story) and simple
 * enough to keep dependency-free. Recursively splits whichever remaining
 * box has the widest channel range, until there are `clusterCount` boxes or
 * every remaining box is a single flat color (fewer real clusters than
 * `clusterCount` — the low-color-image edge case resolves naturally here,
 * not as a special case).
 *
 * Each split cuts at the single largest jump in value along the box's
 * widest channel, not blindly at the middle pixel — the ordinary
 * median-cut midpoint can slice straight through the dense part of one
 * real cluster when two clusters are very unevenly sized (e.g. a small
 * logo's accent color against a large background), which is exactly the
 * shape a lot of real photos and graphics have.
 */
export function quantizeColors(pixels: Pixel[], clusterCount: number): ExtractedPalette {
  if (pixels.length === 0) return { colors: [], averageLuminance: 0 };

  const boxes: Pixel[][] = [pixels];
  while (boxes.length < clusterCount) {
    let splitIndex = -1;
    let splitRange = 0; // only a strictly positive range is worth splitting
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      const range = channelRange(boxes[i], longestAxis(boxes[i]));
      if (range > splitRange) {
        splitRange = range;
        splitIndex = i;
      }
    }
    if (splitIndex === -1) break; // every remaining box is already a flat color

    const box = boxes[splitIndex];
    const axis = longestAxis(box);
    const sorted = [...box].sort((a, b) => a[axis] - b[axis]);
    const cut = largestGapIndex(sorted, axis);
    boxes.splice(splitIndex, 1, sorted.slice(0, cut), sorted.slice(cut));
  }

  const colors = boxes
    .map((box) => ({ hex: averageColor(box), weight: box.length }))
    .sort((a, b) => b.weight - a.weight)
    .map((c) => c.hex);

  const averageLuminance = pixels.reduce((sum, [r, g, b]) => sum + relativeLuminanceRgb(r, g, b), 0) / pixels.length;

  return { colors, averageLuminance };
}

function longestAxis(pixels: Pixel[]): 0 | 1 | 2 {
  const min = [255, 255, 255];
  const max = [0, 0, 0];
  for (const p of pixels) {
    for (let c = 0; c < 3; c++) {
      if (p[c] < min[c]) min[c] = p[c];
      if (p[c] > max[c]) max[c] = p[c];
    }
  }
  const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return ranges.indexOf(Math.max(...ranges)) as 0 | 1 | 2;
}

/** Index of the biggest jump in `axis` value between consecutive (already-sorted) pixels, falling back to the midpoint if every gap is equal (a smooth gradient with no real cluster boundary). */
function largestGapIndex(sorted: Pixel[], axis: 0 | 1 | 2): number {
  let bestGap = -1;
  let bestIndex = Math.floor(sorted.length / 2);
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i][axis] - sorted[i - 1][axis];
    if (gap > bestGap) {
      bestGap = gap;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function channelRange(pixels: Pixel[], axis: 0 | 1 | 2): number {
  let min = 255;
  let max = 0;
  for (const p of pixels) {
    if (p[axis] < min) min = p[axis];
    if (p[axis] > max) max = p[axis];
  }
  return max - min;
}

function averageColor(pixels: Pixel[]): string {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const p of pixels) {
    r += p[0];
    g += p[1];
    b += p[2];
  }
  return rgbToHex(r / pixels.length, g / pixels.length, b / pixels.length);
}

function relativeLuminanceRgb(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Draws `bitmap` to an offscreen canvas (downscaled defensively, see
 * MAX_SAMPLE_DIMENSION), reads its pixels, and quantizes them down to
 * `clusterCount` dominant colors. Fully client-side, no network request.
 */
export function extractPaletteFromImage(bitmap: ImageBitmap, clusterCount = 10): ExtractedPalette {
  const scale = Math.min(1, MAX_SAMPLE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const pixels: Pixel[] = [];
  for (let i = 0; i < data.length; i += 4) {
    // A transparent pixel isn't a real color in the photo — most visibly
    // with a PNG that has a transparent background, which would otherwise
    // quantize in as a phantom black cluster.
    if (data[i + 3] < 128) continue;
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }

  return quantizeColors(pixels, clusterCount);
}
