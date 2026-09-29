// Сервисы, которые строят 3D-модель по фото. Функция берёт тот, чей ключ задан в секретах
// Supabase: TRIPO_API_KEY, а если его нет — MESHY_API_KEY. Оба сервиса платные.
// Модуль не зависит от Supabase, его можно проверить отдельно (см. smoke.ts).

/** Состояние задачи, одинаковое для всех сервисов. */
export type Task = {
  state: 'running' | 'done' | 'failed'
  /** Готовность в процентах. */
  progress: number
  /** Ссылка на готовую модель .glb (временная, модель надо скачать к себе). */
  glbUrl?: string
  error?: string
}

export interface Provider {
  /** Метка в начале id задачи, чтобы статус спрашивать у того же сервиса, что её начал. */
  name: 'tripo' | 'meshy'
  /** Запускает построение по ссылкам на фото: спереди, слева, сзади, справа. Возвращает id задачи. */
  start(photoUrls: string[]): Promise<string>
  task(id: string): Promise<Task>
}

/** Сервис по ключам из окружения, или null, если ни один ключ не задан. */
export function pickProvider(env: (name: string) => string | undefined): Provider | null {
  const tripo = env('TRIPO_API_KEY')
  if (tripo) return tripoProvider(tripo)
  const meshy = env('MESHY_API_KEY')
  if (meshy) return meshyProvider(meshy)
  return null
}

/**
 * Из фото, снятых по кругу, выбирает до четырёх: спереди, слева, сзади, справа.
 * Съёмку начинают спереди и идут вправо, поэтому четверть круга — это левый бок поделки.
 * До четырёх фото берутся как есть, в порядке съёмки.
 */
export function pickViews<T>(photos: T[]): T[] {
  const n = photos.length
  if (n <= 4) return photos
  return [0, 1, 2, 3].map((q) => photos[Math.round((q * n) / 4) % n])
}

async function request(url: string, key: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

// ——— Tripo, API v3: https://developers.tripo3d.ai/en/docs/generation-multiview-to-model/standard ———

const TRIPO = 'https://openapi.tripo3d.ai/v3'
const TRIPO_VIEWS = ['front', 'left', 'back', 'right'] as const

export function tripoProvider(key: string): Provider {
  const call = async (path: string, init?: RequestInit) => {
    const { ok, status, body } = await request(TRIPO + path, key, init)
    // Ошибки приходят как { code, message, suggestion }; code 0 — успех.
    if (!ok || (body.code && body.code !== 0)) {
      const hint = body.code === 2010 ? ' (закончились кредиты Tripo)' : body.code === 1000 ? ' (неверный ключ Tripo)' : ''
      throw new Error((body.message ?? `Tripo ответил ${status}`) + hint)
    }
    return body.data
  }

  return {
    name: 'tripo',

    async start(photoUrls) {
      if (photoUrls.length < 2) throw new Error('Для 3D-модели нужно хотя бы 2 фото поделки')
      const data = await call('/generation/multiview-to-model', {
        method: 'POST',
        body: JSON.stringify({
          model: 'v3.1-20260211',
          inputs: photoUrls.slice(0, 4).map((url, i) => ({ [TRIPO_VIEWS[i]]: url })),
          texture: true,
          // Без PBR файл заметно легче, а для поделок на телефоне разница не видна.
          pbr: false,
        }),
      })
      if (!data?.task_id) throw new Error('Tripo не вернул id задачи')
      return data.task_id
    },

    async task(id) {
      const t = await call(`/tasks/${id}`)
      if (t.status === 'success') {
        return { state: 'done', progress: 100, glbUrl: t.output?.model_url }
      }
      if (t.status === 'queued' || t.status === 'running') return { state: 'running', progress: t.progress ?? 0 }
      return { state: 'failed', progress: 0, error: t.error_message || `Tripo: ${t.status}` }
    },
  }
}

// ——— Meshy, Multi-Image to 3D: https://docs.meshy.ai ———

const MESHY = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d'

export function meshyProvider(key: string): Provider {
  const call = async (path: string, init?: RequestInit) => {
    const { ok, status, body } = await request(MESHY + path, key, init)
    if (!ok) throw new Error(body.message ?? `Meshy ответил ${status}`)
    return body
  }

  return {
    name: 'meshy',

    async start(photoUrls) {
      const body = await call('', {
        method: 'POST',
        body: JSON.stringify({
          image_urls: photoUrls.slice(0, 4),
          should_texture: true,
          should_remesh: true,
          enable_pbr: false,
        }),
      })
      if (!body.result) throw new Error('Meshy не вернул id задачи')
      return body.result
    },

    async task(id) {
      const t = await call(`/${id}`)
      if (t.status === 'SUCCEEDED') return { state: 'done', progress: 100, glbUrl: t.model_urls?.glb }
      if (t.status === 'PENDING' || t.status === 'IN_PROGRESS') return { state: 'running', progress: t.progress ?? 0 }
      return { state: 'failed', progress: 0, error: t.task_error?.message || `Meshy: ${t.status}` }
    },
  }
}
