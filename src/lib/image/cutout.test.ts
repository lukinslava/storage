import { describe, expect, it } from 'vitest'
import { quadFit, segmentCutout } from './cutout'
import type { Pixels } from './geometry'

/** Деревянный стол: полосы светлых и тёмных волокон с шумом. */
function woodTable(w: number, h: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4)
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 12
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const grain = Math.sin(x / 6 + Math.sin(y / 40) * 2) * 22
      const o = (y * w + x) * 4
      data[o] = 165 + grain + rnd()
      data[o + 1] = 118 + grain * 0.8 + rnd()
      data[o + 2] = 82 + grain * 0.6 + rnd()
      data[o + 3] = 255
    }
  }
  return { width: w, height: h, data }
}

function fillEllipse(img: Pixels, cx: number, cy: number, rx: number, ry: number, rgb: [number, number, number]) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) img.data.set(rgb, (y * img.width + x) * 4)
    }
  }
}

describe('segmentCutout', () => {
  it('вырезает фигурку с кожей и тёмно-красными сапогами из деревянного стола', () => {
    const w = 240
    const h = 320
    const img = woodTable(w, h)
    // Фигурка: белая кромка, «лицо» цвета кожи, тёмно-красный «сапог» у края кромки.
    fillEllipse(img, 120, 90, 55, 60, [242, 240, 234])
    fillEllipse(img, 120, 90, 45, 50, [236, 196, 165])
    fillEllipse(img, 120, 210, 60, 80, [242, 240, 234])
    fillEllipse(img, 120, 220, 50, 65, [40, 60, 140])
    fillEllipse(img, 95, 270, 22, 16, [150, 45, 35])

    const c = segmentCutout(img)
    expect(c).not.toBeNull()
    const at = (x: number, y: number) => c!.mask[y * w + x]
    // Лицо, тело и сапог — работа; углы кадра и стол сбоку — фон.
    expect(at(120, 90)).toBe(1)
    expect(at(120, 220)).toBe(1)
    expect(at(95, 270)).toBe(1)
    expect(at(5, 5)).toBe(0)
    expect(at(20, 200)).toBe(0)
    expect(at(230, 310)).toBe(0)
    // Рамка вокруг работы — примерно по белой кромке.
    expect(Math.abs(c!.box.x - 60)).toBeLessThanOrEqual(4)
    expect(Math.abs(c!.box.y + c!.box.h - 290)).toBeLessThanOrEqual(4)
  })

  it('отличает прямоугольный лист от фигурки', () => {
    const w = 200
    const h = 200
    const mask = new Uint8Array(w * h)
    for (let y = 40; y < 160; y++) for (let x = 50; x < 150; x++) mask[y * w + x] = 1
    const cut = { mask, width: w, height: h, box: { x: 50, y: 40, w: 100, h: 120 }, coverage: 0.3 }
    const rect = [
      { x: 50, y: 40 },
      { x: 149, y: 40 },
      { x: 149, y: 159 },
      { x: 50, y: 159 },
    ] as const
    expect(quadFit(cut, [...rect])).toBeGreaterThan(0.95)
    // Та же маска, но «лист» вдвое шире — фигура его не заполняет.
    const wide = [
      { x: 0, y: 40 },
      { x: 199, y: 40 },
      { x: 199, y: 159 },
      { x: 0, y: 159 },
    ] as const
    expect(quadFit(cut, [...wide])).toBeLessThan(0.6)
  })

  it('возвращает null на пустом столе', () => {
    expect(segmentCutout(woodTable(120, 120))).toBeNull()
  })
})
