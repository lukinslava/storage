// Тонкая обёртка над Meshy Multi-Image to 3D. Вынесена отдельно, чтобы её можно было
// проверить на тестовом ключе Meshy без Supabase (см. smoke.ts).

export const MESHY = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d'

/** Тестовый ключ Meshy: возвращает демо-модель и не тратит кредиты. */
export const MESHY_TEST_KEY = 'msy_dummy_api_key_for_test_mode_12345678'

export type MeshyTask = {
  id: string
  status: 'PENDING' | 'IN_PROGRESS' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'EXPIRED'
  progress?: number
  model_urls?: { glb?: string }
  task_error?: { message?: string }
}

export function meshyClient(key: string) {
  const call = async (path: string, init?: RequestInit) => {
    const res = await fetch(MESHY + path, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init?.headers },
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.message ?? `Meshy ответил ${res.status}`)
    return body
  }

  return {
    /** Запускает построение модели, возвращает id задачи. */
    async start(imageUrls: string[]): Promise<string> {
      const body = await call('', {
        method: 'POST',
        body: JSON.stringify({
          image_urls: imageUrls,
          should_texture: true,
          should_remesh: true,
          enable_pbr: false,
        }),
      })
      if (!body.result) throw new Error('Meshy не вернул id задачи')
      return body.result
    },

    task: (id: string): Promise<MeshyTask> => call(`/${id}`),
  }
}

export const isFinalFailure = (t: MeshyTask) => ['FAILED', 'CANCELED', 'EXPIRED'].includes(t.status)
