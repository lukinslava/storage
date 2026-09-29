// Чистые функции без DOM: их можно тестировать в node.

export interface Point {
  x: number
  y: number
}

/** Четыре угла листа: верх-лево, верх-право, низ-право, низ-лево. */
export type Quad = [Point, Point, Point, Point]

/** Минимальный аналог ImageData, чтобы код работал и в браузере, и в тестах. */
export interface Pixels {
  width: number
  height: number
  data: Uint8ClampedArray
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Гомография 3x3 (h33 = 1), переводящая точки `from[i]` в `to[i]`.
 * Решаем линейную систему 8x8 методом Гаусса.
 */
export function homography(from: Quad, to: Quad): number[] {
  const A: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const n = 8
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r
    }
    if (Math.abs(A[pivot][col]) < 1e-12) throw new Error('Вырожденный четырёхугольник')
    ;[A[col], A[pivot]] = [A[pivot], A[col]]
    ;[b[col], b[pivot]] = [b[pivot], b[col]]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = A[r][col] / A[col][col]
      if (f === 0) continue
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c]
      b[r] -= f * b[col]
    }
  }
  const h = b.map((v, i) => v / A[i][i])
  return [...h, 1]
}

export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  }
}

/** Размер «выпрямленного» листа по длинам его сторон. */
export function quadOutputSize(q: Quad, maxSide: number): { width: number; height: number } {
  const w = (dist(q[0], q[1]) + dist(q[3], q[2])) / 2
  const h = (dist(q[0], q[3]) + dist(q[1], q[2])) / 2
  const scale = Math.min(1, maxSide / Math.max(w, h))
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  }
}

/** Вырезает четырёхугольник `quad` из `src` и выпрямляет его в прямоугольник. */
export function warpPerspective(src: Pixels, quad: Quad, width: number, height: number): Pixels {
  const rect: Quad = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ]
  // Для каждого пикселя результата ищем точку в исходнике.
  const h = homography(rect, quad)
  const out = new Uint8ClampedArray(width * height * 4)
  const sw = src.width
  const sh = src.height
  const s = src.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const w = h[6] * x + h[7] * y + h[8]
      let sx = (h[0] * x + h[1] * y + h[2]) / w
      let sy = (h[3] * x + h[4] * y + h[5]) / w
      sx = Math.min(Math.max(sx, 0), sw - 1)
      sy = Math.min(Math.max(sy, 0), sh - 1)
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const x1 = Math.min(x0 + 1, sw - 1)
      const y1 = Math.min(y0 + 1, sh - 1)
      const fx = sx - x0
      const fy = sy - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = (y0 * sw + x1) * 4
      const i01 = (y1 * sw + x0) * 4
      const i11 = (y1 * sw + x1) * 4
      const o = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const top = s[i00 + c] + (s[i10 + c] - s[i00 + c]) * fx
        const bot = s[i01 + c] + (s[i11 + c] - s[i01 + c]) * fx
        out[o + c] = top + (bot - top) * fy
      }
      out[o + 3] = 255
    }
  }
  return { width, height, data: out }
}

function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (const v of gray) hist[v]++
  const total = gray.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0
  let wB = 0
  let best = 0
  let threshold = 127
  for (let t = 0; t < 256; t++) {
    wB += hist[t]
    if (wB === 0) continue
    const wF = total - wB
    if (wF === 0) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const between = wB * wF * (mB - mF) ** 2
    if (between > best) {
      best = between
      threshold = t
    }
  }
  return threshold
}

/** Самая большая связная область маски (4-связность). */
function largestComponent(mask: Uint8Array, w: number, h: number): { label: Int32Array; id: number; size: number } {
  const n = w * h
  const label = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  let bestId = -1
  let bestSize = 0
  let current = 0
  for (let start = 0; start < n; start++) {
    if (!mask[start] || label[start] !== -1) continue
    let sp = 0
    stack[sp++] = start
    label[start] = current
    let size = 0
    while (sp > 0) {
      const p = stack[--sp]
      size++
      const x = p % w
      if (x > 0 && mask[p - 1] && label[p - 1] === -1) { label[p - 1] = current; stack[sp++] = p - 1 }
      if (x < w - 1 && mask[p + 1] && label[p + 1] === -1) { label[p + 1] = current; stack[sp++] = p + 1 }
      if (p >= w && mask[p - w] && label[p - w] === -1) { label[p - w] = current; stack[sp++] = p - w }
      if (p < n - w && mask[p + w] && label[p + w] === -1) { label[p + w] = current; stack[sp++] = p + w }
    }
    if (size > bestSize) {
      bestSize = size
      bestId = current
    }
    current++
  }
  return { label, id: bestId, size: bestSize }
}

/** Углы области: крайние точки по диагоналям. */
function cornersOf(label: Int32Array, id: number, w: number): Quad {
  let tl = { x: 0, y: 0, s: Infinity }
  let br = { x: 0, y: 0, s: -Infinity }
  let tr = { x: 0, y: 0, s: -Infinity }
  let bl = { x: 0, y: 0, s: Infinity }
  for (let p = 0; p < label.length; p++) {
    if (label[p] !== id) continue
    const x = p % w
    const y = (p - x) / w
    const sum = x + y
    const diff = x - y
    if (sum < tl.s) tl = { x, y, s: sum }
    if (sum > br.s) br = { x, y, s: sum }
    if (diff > tr.s) tr = { x, y, s: diff }
    if (diff < bl.s) bl = { x, y, s: diff }
  }
  return [
    { x: tl.x, y: tl.y },
    { x: tr.x, y: tr.y },
    { x: br.x, y: br.y },
    { x: bl.x, y: bl.y },
  ]
}

function plausible(q: Quad, w: number, h: number): boolean {
  const area = quadArea(q)
  if (area < w * h * 0.08) return false
  // Все углы в самых краях кадра — скорее всего, нашли не лист, а весь кадр.
  const edge = q.filter((p) => p.x <= 1 || p.y <= 1 || p.x >= w - 2 || p.y >= h - 2).length
  return !(edge === 4 && area > w * h * 0.97)
}

/**
 * Способ 1: фон (стол) — то, что похоже по цвету на края кадра и связано с ними.
 * Всё остальное, включая тёмные места рисунка, — лист.
 */
function detectByBackground(img: Pixels): Quad | null {
  const { width: w, height: h, data } = img
  const n = w * h
  const border: number[][] = [[], [], []]
  const pushBorder = (p: number) => {
    for (let c = 0; c < 3; c++) border[c].push(data[p * 4 + c])
  }
  for (let x = 0; x < w; x++) { pushBorder(x); pushBorder((h - 1) * w + x) }
  for (let y = 1; y < h - 1; y++) { pushBorder(y * w); pushBorder(y * w + w - 1) }
  const bg = border.map((ch) => ch.sort((a, b) => a - b)[ch.length >> 1])

  const d = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    const v = Math.hypot(data[o] - bg[0], data[o + 1] - bg[1], data[o + 2] - bg[2])
    d[i] = Math.min(255, v)
  }
  // Порог — по разбросу цвета самого стола (края кадра), а не по всей картинке:
  // иначе тёмные части рисунка (трава, небо) «сливаются» с фоном.
  const borderDist: number[] = []
  for (let x = 0; x < w; x++) borderDist.push(d[x], d[(h - 1) * w + x])
  for (let y = 1; y < h - 1; y++) borderDist.push(d[y * w], d[y * w + w - 1])
  borderDist.sort((a, b) => a - b)
  const t = Math.min(90, Math.max(28, borderDist[Math.floor(borderDist.length * 0.9)] * 2))

  // Заливка фона от краёв кадра.
  const isBg = new Uint8Array(n)
  const stack = new Int32Array(n)
  let sp = 0
  const seed = (p: number) => {
    if (!isBg[p] && d[p] <= t) { isBg[p] = 1; stack[sp++] = p }
  }
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1) }
  while (sp > 0) {
    const p = stack[--sp]
    const x = p % w
    if (x > 0) seed(p - 1)
    if (x < w - 1) seed(p + 1)
    if (p >= w) seed(p - w)
    if (p < n - w) seed(p + w)
  }
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = isBg[i] ? 0 : 1
  const { label, id, size } = largestComponent(mask, w, h)
  if (id < 0 || size < n * 0.08) return null
  const q = cornersOf(label, id, w)
  return plausible(q, w, h) ? q : null
}

/** Способ 2: самая большая светлая область (если края кадра пёстрые). */
function detectByBrightness(img: Pixels): Quad | null {
  const { width: w, height: h, data } = img
  const n = w * h
  const gray = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    gray[i] = (data[o] * 299 + data[o + 1] * 587 + data[o + 2] * 114) / 1000
  }
  const t = otsuThreshold(gray)
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) mask[i] = gray[i] > t ? 1 : 0
  const { label, id, size } = largestComponent(mask, w, h)
  if (id < 0 || size < n * 0.08) return null
  const q = cornersOf(label, id, w)
  return plausible(q, w, h) ? q : null
}

/**
 * Ищет на фото лист бумаги. Работает на уменьшенной картинке (~400px).
 * Возвращает углы в её координатах или null, если уверенно найти лист не удалось.
 */
export function detectPaper(img: Pixels): Quad | null {
  return detectByBackground(img) ?? detectByBrightness(img)
}

export function quadArea(q: Quad): number {
  let a = 0
  for (let i = 0; i < 4; i++) {
    const p = q[i]
    const n = q[(i + 1) % 4]
    a += p.x * n.y - n.x * p.y
  }
  return Math.abs(a) / 2
}

/** Прямоугольник с отступом — если лист не нашёлся. */
export function defaultQuad(width: number, height: number, inset = 0.06): Quad {
  const dx = width * inset
  const dy = height * inset
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ]
}

export function scaleQuad(q: Quad, k: number): Quad {
  return q.map((p) => ({ x: p.x * k, y: p.y * k })) as Quad
}
