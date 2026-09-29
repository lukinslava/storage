import { quadFit, segmentCutout, type Cutout } from './cutout'
import { detectPaper, defaultQuad, quadOutputSize, scaleQuad, warpPerspective, type Pixels, type Quad } from './geometry'

/** iOS Safari не любит холсты больше ~16 Мпикс — держим исходник в разумных пределах. */
const MAX_SOURCE_SIDE = 3000
const MAX_OUTPUT_SIDE = 2400
export const THUMB_SIDE = 640

export async function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    // Картинка уже декодирована, ссылку можно отпустить чуть позже.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export function toCanvas(source: CanvasImageSource & { width: number; height: number }, maxSide: number): HTMLCanvasElement {
  const k = Math.min(1, maxSide / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(source.width * k)
  canvas.height = Math.round(source.height * k)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.88, type = 'image/jpeg'): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось сохранить картинку'))), type, quality),
  )
}

function pixelsOf(canvas: HTMLCanvasElement): Pixels {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
}

export type DrawingMode = 'sheet' | 'cutout'

export interface PreparedDrawing {
  source: HTMLCanvasElement
  /** Углы листа (режим «Лист»). */
  quad: Quad
  detected: boolean
  /** Уменьшенная копия для поиска контура (режим «По контуру»). */
  small: HTMLCanvasElement
  cut: Cutout | null
  /** Какой режим подходит лучше: прямоугольный лист или фигура, вырезанная по контуру. */
  mode: DrawingMode
}

const CUTOUT_SIDE = 800

/** Готовит фото рисунка: находит углы листа и контур фигуры, выбирает подходящий режим. */
export async function prepareDrawing(file: Blob): Promise<PreparedDrawing> {
  const img = await loadImage(file)
  const source = toCanvas(img, MAX_SOURCE_SIDE)
  const tiny = toCanvas(source, 400)
  const found = detectPaper(pixelsOf(tiny))
  const k = source.width / tiny.width
  const small = toCanvas(source, CUTOUT_SIDE)
  const cut = segmentCutout(pixelsOf(small))
  // Если фигура плохо совпадает с четырёхугольником по её углам — это не лист, а вырезанная фигурка.
  let mode: DrawingMode = 'sheet'
  if (cut && (!found || quadFit(cut, scaleQuad(found, small.width / tiny.width)) < 0.9)) mode = 'cutout'
  return {
    source,
    quad: found ? scaleQuad(found, k) : defaultQuad(source.width, source.height),
    detected: !!found,
    small,
    cut,
    mode,
  }
}

/** Пересчитывает контур с другой чувствительностью. */
export function recut(small: HTMLCanvasElement, sensitivity: number): Cutout | null {
  return segmentCutout(pixelsOf(small), sensitivity)
}

/** Вырезает фигуру по контуру: картинка с прозрачным фоном, обрезанная по фигуре. */
export function renderCutout(source: HTMLCanvasElement, cut: Cutout): HTMLCanvasElement {
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = cut.width
  maskCanvas.height = cut.height
  const mctx = maskCanvas.getContext('2d')!
  const m = mctx.createImageData(cut.width, cut.height)
  for (let i = 0; i < cut.mask.length; i++) m.data[i * 4 + 3] = cut.mask[i] ? 255 : 0
  mctx.putImageData(m, 0, 0)

  const k = source.width / cut.width
  const pad = Math.round(Math.max(cut.box.w, cut.box.h) * 0.02)
  const bx = Math.max(0, cut.box.x - pad)
  const by = Math.max(0, cut.box.y - pad)
  const bw = Math.min(cut.width, cut.box.x + cut.box.w + pad) - bx
  const bh = Math.min(cut.height, cut.box.y + cut.box.h + pad) - by
  const scale = Math.min(k, MAX_OUTPUT_SIDE / Math.max(bw, bh))

  const out = document.createElement('canvas')
  out.width = Math.round(bw * scale)
  out.height = Math.round(bh * scale)
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, bx * k, by * k, bw * k, bh * k, 0, 0, out.width, out.height)
  // Маска растягивается со сглаживанием — край получается мягким, без «лесенки».
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(maskCanvas, bx, by, bw, bh, 0, 0, out.width, out.height)
  return out
}

/** Вырезает и выпрямляет лист. */
export function cutOut(source: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  const { width, height } = quadOutputSize(quad, MAX_OUTPUT_SIDE)
  const out = warpPerspective(pixelsOf(source), quad, width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.putImageData(new ImageData(out.data as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0)
  return canvas
}

export function rotate90(canvas: HTMLCanvasElement, clockwise = true): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = canvas.height
  out.height = canvas.width
  const ctx = out.getContext('2d')!
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate(((clockwise ? 1 : -1) * Math.PI) / 2)
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2)
  return out
}

/** Картинка + миниатюра, готовые к загрузке. `transparent` — PNG с прозрачным фоном (вырезка по контуру). */
export async function encodeImage(
  canvas: HTMLCanvasElement,
  transparent = false,
): Promise<{ image: Blob; thumb: Blob; width: number; height: number }> {
  const type = transparent ? 'image/png' : 'image/jpeg'
  const image = await canvasToBlob(canvas, 0.88, type)
  const thumb = await canvasToBlob(toCanvas(canvas, THUMB_SIDE), 0.82, type)
  return { image, thumb, width: canvas.width, height: canvas.height }
}

/** Фото поделки: просто уменьшаем. */
export async function preparePhoto(file: Blob): Promise<HTMLCanvasElement> {
  return toCanvas(await loadImage(file), 2048)
}
