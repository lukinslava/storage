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

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось сохранить картинку'))), 'image/jpeg', quality),
  )
}

function pixelsOf(canvas: HTMLCanvasElement): Pixels {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
}

/** Готовит фото рисунка к кадрированию: уменьшенный исходник + найденные углы листа. */
export async function prepareDrawing(file: Blob): Promise<{ source: HTMLCanvasElement; quad: Quad; detected: boolean }> {
  const img = await loadImage(file)
  const source = toCanvas(img, MAX_SOURCE_SIDE)
  const small = toCanvas(source, 400)
  const found = detectPaper(pixelsOf(small))
  const k = source.width / small.width
  return {
    source,
    quad: found ? scaleQuad(found, k) : defaultQuad(source.width, source.height),
    detected: !!found,
  }
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

/** Картинка + миниатюра, готовые к загрузке. */
export async function encodeImage(canvas: HTMLCanvasElement): Promise<{ image: Blob; thumb: Blob; width: number; height: number }> {
  const image = await canvasToBlob(canvas)
  const thumb = await canvasToBlob(toCanvas(canvas, THUMB_SIDE), 0.82)
  return { image, thumb, width: canvas.width, height: canvas.height }
}

/** Фото поделки: просто уменьшаем. */
export async function preparePhoto(file: Blob): Promise<HTMLCanvasElement> {
  return toCanvas(await loadImage(file), 2048)
}
