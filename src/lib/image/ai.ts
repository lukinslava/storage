// Вырезание фигуры нейросетью прямо в телефоне (@imgly/background-removal, модель ISNet).
// Файлы модели лежат на нашем же сайте (их готовит scripts/bg-model.mjs). В первый раз
// скачивается около 60 МБ, дальше они берутся из кэша приложения.

import type { AiReply, AiRequest } from './ai.worker'

/** Та же модель, что готовит scripts/bg-model.mjs. */
const MODEL = 'isnet_quint8'

/**
 * Сколько ждать ответа нейросети, прежде чем сдаться: поток мог упасть без ошибки,
 * например от нехватки памяти. Пока модель скачивается, ждём дольше — сеть бывает медленной.
 */
const WAIT_MS = 2 * 60_000
const DOWNLOAD_WAIT_MS = 10 * 60_000

type Job = { resolve: (alpha: Uint8Array) => void; reject: (e: Error) => void; onDownload: (share: number) => void }

// Поток живёт, пока открыто приложение: загруженная модель переиспользуется для следующих фото.
let worker: Worker | null = null
/** Модель в потоке уже загружена. */
let warm = false
const jobs = new Map<number, Job>()
let nextId = 1

function getWorker(): Worker {
  if (worker) return worker
  const w = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = ({ data }: MessageEvent<AiReply>) => {
    const job = jobs.get(data.id)
    if (!job) return
    if ('share' in data) return job.onDownload(data.share)
    jobs.delete(data.id)
    if ('alpha' in data) job.resolve(data.alpha)
    else job.reject(new Error(data.error))
  }
  w.onerror = (e) => {
    e.preventDefault()
    reset(e.message || 'Нейросеть не запустилась')
  }
  return (worker = w)
}

/** Поток упал или завис — бросаем его; следующая попытка начнёт с нового. */
function reset(reason: string) {
  worker?.terminate()
  worker = null
  warm = false
  for (const job of jobs.values()) job.reject(new Error(reason))
  jobs.clear()
}

/**
 * Маска фигуры: 0…255 на пиксель (255 — работа), размер как у картинки.
 * `onDownload` получает долю скачанной модели (0…1), пока она грузится.
 */
export function aiMask(canvas: HTMLCanvasElement, onDownload?: (share: number) => void): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const id = nextId++
    let timer = 0
    const wait = (downloading: boolean) => {
      clearTimeout(timer)
      timer = window.setTimeout(() => reset('Нейросеть не ответила'), downloading ? DOWNLOAD_WAIT_MS : WAIT_MS)
    }
    jobs.set(id, {
      resolve: (alpha) => {
        clearTimeout(timer)
        warm = true
        resolve(alpha)
      },
      reject: (e) => {
        clearTimeout(timer)
        reject(e)
      },
      onDownload: (share) => {
        wait(share < 1)
        onDownload?.(share)
      },
    })
    wait(!warm)
    const msg: AiRequest = {
      id,
      pixels: canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height),
      publicPath: new URL(`${import.meta.env.BASE_URL}bg-removal/`, location.href).href,
      model: MODEL,
    }
    getWorker().postMessage(msg)
  })
}
