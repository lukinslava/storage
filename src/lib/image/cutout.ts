// Вырезание фигурной работы (ребёнок вырезал ножницами) из фона стола.
// Чистые функции без DOM — работают на уменьшенной картинке (~800px).

import type { Pixels, Quad } from './geometry'

export interface Cutout {
  /** 1 — работа, 0 — фон. Размер как у входной картинки. */
  mask: Uint8Array
  width: number
  height: number
  /** Рамка вокруг работы. */
  box: { x: number; y: number; w: number; h: number }
  /** Доля кадра, которую занимает работа. */
  coverage: number
}

type RGB = [number, number, number]

/** Вес яркости относительно оттенка в расстоянии между цветами. */
const LUMA = 0.8

/** RGB → YCbCr: яркость отдельно от оттенка. */
function ycc(r: number, g: number, b: number): RGB {
  return [
    0.299 * r + 0.587 * g + 0.114 * b,
    128 - 0.169 * r - 0.331 * g + 0.5 * b,
    128 + 0.5 * r - 0.419 * g - 0.081 * b,
  ]
}

/**
 * Расстояние между цветами (в YCbCr). Оттенок весит больше яркости:
 * волокна дерева и тени отличаются в основном яркостью, а работа — цветом.
 */
const dist = (a: RGB, y: number, cb: number, cr: number) =>
  Math.sqrt(LUMA * (a[0] - y) ** 2 + 2 * ((a[1] - cb) ** 2 + (a[2] - cr) ** 2))

/** Цвета фона: несколько кластеров по пикселям у краёв кадра (у дерева светлые и тёмные волокна). */
function backgroundColors(img: Pixels, band: number): { centers: RGB[]; samples: RGB[] } {
  const { width: w, height: h, data } = img
  const samples: RGB[] = []
  const step = Math.max(1, Math.floor((2 * (w + h)) / 1500))
  const push = (x: number, y: number) => {
    const o = (y * w + x) * 4
    samples.push(ycc(data[o], data[o + 1], data[o + 2]))
  }
  for (let b = 0; b < band; b++) {
    for (let x = 0; x < w; x += step) {
      push(x, b)
      push(x, h - 1 - b)
    }
    for (let y = 0; y < h; y += step) {
      push(b, y)
      push(w - 1 - b, y)
    }
  }
  // k-means, k = 4, детерминированная инициализация по яркости.
  const byLum = [...samples].sort((a, b) => a[0] - b[0])
  const k = 4
  let centers: RGB[] = Array.from({ length: k }, (_, i) => [...byLum[Math.floor(((i + 0.5) / k) * byLum.length)]] as RGB)
  let assign = new Int32Array(samples.length)
  for (let iter = 0; iter < 8; iter++) {
    const sum = centers.map(() => [0, 0, 0, 0])
    samples.forEach((s, i) => {
      let best = 0
      let bd = Infinity
      centers.forEach((c, j) => {
        const d = dist(c, s[0], s[1], s[2])
        if (d < bd) {
          bd = d
          best = j
        }
      })
      assign[i] = best
      sum[best][0] += s[0]
      sum[best][1] += s[1]
      sum[best][2] += s[2]
      sum[best][3]++
    })
    centers = centers.map((c, j) => (sum[j][3] ? [sum[j][0] / sum[j][3], sum[j][1] / sum[j][3], sum[j][2] / sum[j][3]] : c))
  }
  // Стол — самый частый цвет у краёв и близкие к нему оттенки (светлые/тёмные волокна).
  // Редкие или непохожие кластеры — предметы у края кадра (стопка бумаги, игрушка).
  const counts = centers.map((_, j) => assign.filter((a) => a === j).length)
  const main = counts.indexOf(Math.max(...counts))
  const kept = centers.filter(
    (c, j) => j === main || (counts[j] >= samples.length * 0.1 && dist(centers[main], c[0], c[1], c[2]) < 55),
  )
  return { centers: kept, samples: samples.filter((_, i) => kept.includes(centers[assign[i]])) }
}

function erode(m: Uint8Array, w: number, h: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(m.length)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      out[p] = m[p] & m[p - 1] & m[p + 1] & m[p - w] & m[p + w]
    }
  }
  return out
}

function dilate(m: Uint8Array, w: number, h: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(m.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      out[p] =
        m[p] | (x > 0 ? m[p - 1] : 0) | (x < w - 1 ? m[p + 1] : 0) | (y > 0 ? m[p - w] : 0) | (y < h - 1 ? m[p + w] : 0)
    }
  }
  return out
}

/** Метки связных областей маски (4-связность). */
function components(m: Uint8Array, w: number, h: number): { label: Int32Array; sizes: number[] } {
  const n = w * h
  const label = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  const sizes: number[] = []
  for (let s = 0; s < n; s++) {
    if (!m[s] || label[s] !== -1) continue
    const id = sizes.length
    let sp = 0
    let size = 0
    stack[sp++] = s
    label[s] = id
    while (sp) {
      const p = stack[--sp]
      size++
      const x = p % w
      if (x > 0 && m[p - 1] && label[p - 1] === -1) { label[p - 1] = id; stack[sp++] = p - 1 }
      if (x < w - 1 && m[p + 1] && label[p + 1] === -1) { label[p + 1] = id; stack[sp++] = p + 1 }
      if (p >= w && m[p - w] && label[p - w] === -1) { label[p - w] = id; stack[sp++] = p - w }
      if (p < n - w && m[p + w] && label[p + w] === -1) { label[p + w] = id; stack[sp++] = p + w }
    }
    sizes.push(size)
  }
  return { label, sizes }
}

/**
 * Находит работу, вырезанную по контуру, на фоне стола.
 * `sensitivity` > 1 — смелее отрезает фон, < 1 — осторожнее.
 */
export function segmentCutout(img: Pixels, sensitivity = 1): Cutout | null {
  const { width: w, height: h, data } = img
  const n = w * h
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.01))
  const { centers, samples } = backgroundColors(img, band)

  // Цвета после лёгкого размытия 3×3 — меньше шума JPEG и волокон.
  const Y = new Float32Array(n)
  const Cb = new Float32Array(n)
  const Cr = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, k = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          const o = (yy * w + xx) * 4
          r += data[o]; g += data[o + 1]; b += data[o + 2]; k++
        }
      }
      const c = ycc(r / k, g / k, b / k)
      const p = y * w + x
      Y[p] = c[0]; Cb[p] = c[1]; Cr[p] = c[2]
    }
  }

  const d = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let best = Infinity
    for (const c of centers) best = Math.min(best, dist(c, Y[i], Cb[i], Cr[i]))
    d[i] = best
  }
  // Порог — по разбросу цвета самого стола.
  const bd = samples.map((s) => Math.min(...centers.map((c) => dist(c, s[0], s[1], s[2])))).sort((a, b) => a - b)
  // Коэффициент 1.6 подобран на фото вырезанной фигурки на деревянном столе:
  // смелее — начинают пропадать тёмные места работы, осторожнее — остаются щепки стола.
  const t = Math.min(48, Math.max(15, bd[Math.floor(bd.length * 0.9)] * 1.6)) * sensitivity
  // Максимальный шаг цвета между соседями внутри фона: резкая граница (край бумаги) его останавливает.
  const edge = Math.max(10, t * 0.45)

  // Шаг между соседями — по несглаженным пикселям, чтобы размытие не «стирало» край бумаги.
  const raw = (p: number) => ycc(data[p * 4], data[p * 4 + 1], data[p * 4 + 2])
  const step = (p: number, q: number) => {
    const a = raw(p)
    return dist(a, ...raw(q))
  }

  // Заливка фона от краёв кадра.
  const bg = new Uint8Array(n)
  const stack = new Int32Array(n)
  let sp = 0
  const seed = (p: number) => {
    if (!bg[p] && d[p] <= t) { bg[p] = 1; stack[sp++] = p }
  }
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1) }
  const visit = (p: number, q: number) => {
    if (!bg[q] && d[q] <= t && step(p, q) <= edge) { bg[q] = 1; stack[sp++] = q }
  }
  while (sp) {
    const p = stack[--sp]
    const x = p % w
    if (x > 0) visit(p, p - 1)
    if (x < w - 1) visit(p, p + 1)
    if (p >= w) visit(p, p - w)
    if (p < n - w) visit(p, p + w)
  }

  // Второй проход: волокна дерева со «ступенькой» останавливают заливку — добираем
  // всё, что очень похоже на стол и соседствует с уже найденным фоном.
  for (let i = 0; i < n; i++) if (bg[i]) stack[sp++] = i
  const tight = t * 0.6
  while (sp) {
    const p = stack[--sp]
    const x = p % w
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
      if (q < 0 || q >= n || bg[q] || d[q] > tight) continue
      bg[q] = 1
      stack[sp++] = q
    }
  }

  // Просветы стола внутри фигуры не вырезаем: у детских работ их почти не бывает,
  // а похожие по цвету места (кожа, картон) пропадали бы.
  let fg = new Uint8Array(n)
  for (let i = 0; i < n; i++) fg[i] = bg[i] ? 0 : 1

  // Убираем «ворс» по краю и тонкие перемычки к предметам вокруг.
  fg = dilate(erode(fg, w, h), w, h)

  const comp = components(fg, w, h)
  let best = -1
  let bestSize = 0
  comp.sizes.forEach((s, i) => {
    if (s > bestSize) {
      bestSize = s
      best = i
    }
  })
  if (best < 0 || bestSize < n * 0.03) return null

  const mask = new Uint8Array(n)
  let x0 = w, y0 = h, x1 = 0, y1 = 0
  for (let p = 0; p < n; p++) {
    if (comp.label[p] !== best) continue
    mask[p] = 1
    const x = p % w
    const y = (p - x) / w
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  // Небольшие дырки внутри работы (блики, тени) закрашиваем.
  const minHole = n * 0.004
  const holes = components(mask.map((v) => 1 - v), w, h)
  const outside = new Uint8Array(holes.sizes.length)
  for (let x = 0; x < w; x++) for (const p of [x, (h - 1) * w + x]) if (holes.label[p] >= 0) outside[holes.label[p]] = 1
  for (let y = 0; y < h; y++) for (const p of [y * w, y * w + w - 1]) if (holes.label[p] >= 0) outside[holes.label[p]] = 1
  for (let p = 0; p < n; p++) {
    const l = holes.label[p]
    if (l >= 0 && !outside[l] && holes.sizes[l] < minHole) mask[p] = 1
  }

  return {
    mask,
    width: w,
    height: h,
    box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    coverage: bestSize / n,
  }
}

/**
 * Насколько фигура совпадает с четырёхугольником листа (IoU, 0…1).
 * У прямоугольного листа ≈ 1, у фигурки, вырезанной по контуру, заметно меньше.
 * `quad` — в координатах маски.
 */
export function quadFit(c: Cutout, quad: Quad): number {
  const inside = (x: number, y: number) => {
    let sign = 0
    for (let i = 0; i < 4; i++) {
      const a = quad[i]
      const b = quad[(i + 1) % 4]
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)
      if (cross === 0) continue
      const s = cross > 0 ? 1 : -1
      if (sign && s !== sign) return false
      sign = s
    }
    return true
  }
  let both = 0
  let either = 0
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const m = c.mask[y * c.width + x] === 1
      const q = inside(x, y)
      if (m && q) both++
      if (m || q) either++
    }
  }
  return either ? both / either : 0
}
