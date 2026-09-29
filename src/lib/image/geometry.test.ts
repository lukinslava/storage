import { describe, expect, it } from 'vitest'
import {
  applyHomography,
  detectPaper,
  homography,
  quadOutputSize,
  warpPerspective,
  type Pixels,
  type Point,
  type Quad,
} from './geometry'

function blank(width: number, height: number, rgb: [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data.set([...rgb, 255], i * 4)
  }
  return { width, height, data }
}

function inside(q: Quad, p: Point): boolean {
  // Выпуклый четырёхугольник: точка слева от всех рёбер (обход по часовой стрелке в экранных координатах).
  for (let i = 0; i < 4; i++) {
    const a = q[i]
    const b = q[(i + 1) % 4]
    if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false
  }
  return true
}

function paint(img: Pixels, q: Quad, rgb: [number, number, number]) {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (inside(q, { x, y })) img.data.set(rgb, (y * img.width + x) * 4)
    }
  }
}

const near = (a: Point, b: Point, tol: number) => Math.hypot(a.x - b.x, a.y - b.y) <= tol

describe('homography', () => {
  it('переводит углы в углы', () => {
    const from: Quad = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ]
    const to: Quad = [
      { x: 10, y: 20 },
      { x: 120, y: 5 },
      { x: 130, y: 90 },
      { x: 3, y: 70 },
    ]
    const h = homography(from, to)
    from.forEach((p, i) => {
      const r = applyHomography(h, p)
      expect(r.x).toBeCloseTo(to[i].x, 6)
      expect(r.y).toBeCloseTo(to[i].y, 6)
    })
  })
})

describe('warpPerspective', () => {
  it('выпрямляет наклонённый лист, не захватывая фон', () => {
    const img = blank(200, 200, [30, 30, 30])
    const quad: Quad = [
      { x: 40, y: 30 },
      { x: 170, y: 45 },
      { x: 160, y: 180 },
      { x: 30, y: 165 },
    ]
    paint(img, quad, [240, 240, 235])
    const size = quadOutputSize(quad, 1000)
    const out = warpPerspective(img, quad, size.width, size.height)
    // Внутренность результата (с отступом 2px от края) должна быть «бумагой».
    let dark = 0
    for (let y = 2; y < out.height - 2; y++) {
      for (let x = 2; x < out.width - 2; x++) {
        if (out.data[(y * out.width + x) * 4] < 200) dark++
      }
    }
    expect(dark).toBe(0)
  })

  it('ограничивает размер результата', () => {
    const quad: Quad = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 },
    ]
    expect(quadOutputSize(quad, 2000)).toEqual({ width: 2000, height: 1500 })
  })
})

describe('detectPaper', () => {
  it('находит светлый лист на тёмном столе', () => {
    const img = blank(300, 400, [90, 70, 50])
    const quad: Quad = [
      { x: 50, y: 60 },
      { x: 240, y: 40 },
      { x: 260, y: 330 },
      { x: 60, y: 350 },
    ]
    paint(img, quad, [235, 232, 225])
    // Детский рисунок посередине листа не должен мешать.
    paint(
      img,
      [
        { x: 100, y: 120 },
        { x: 200, y: 120 },
        { x: 200, y: 250 },
        { x: 100, y: 250 },
      ],
      [200, 40, 40],
    )
    const found = detectPaper(img)
    expect(found).not.toBeNull()
    found!.forEach((p, i) => expect(near(p, quad[i], 4)).toBe(true))
  })

  it('не обрезает лист по тёмной траве у нижнего края', () => {
    const img = blank(300, 400, [120, 85, 55])
    const quad: Quad = [
      { x: 40, y: 50 },
      { x: 250, y: 60 },
      { x: 255, y: 340 },
      { x: 35, y: 330 },
    ]
    paint(img, quad, [245, 243, 236])
    // Тёмно-зелёная трава по всей ширине низа листа.
    paint(
      img,
      [
        { x: 37, y: 280 },
        { x: 253, y: 290 },
        { x: 254, y: 339 },
        { x: 36, y: 329 },
      ],
      [50, 110, 40],
    )
    const found = detectPaper(img)
    expect(found).not.toBeNull()
    found!.forEach((p, i) => expect(near(p, quad[i], 5)).toBe(true))
  })

  it('возвращает null, когда листа нет', () => {
    expect(detectPaper(blank(100, 100, [128, 128, 128]))).toBeNull()
  })
})
