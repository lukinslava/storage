// Supabase Edge Function: 3D-модель поделки из её фото через Meshy (Multi-Image to 3D).
//
// POST { action: 'start' | 'status', artworkId: string }
//   start  — отправляет до 4 фото поделки в Meshy и помечает работу как processing;
//   status — спрашивает Meshy о готовности; когда модель готова, скачивает .glb
//            в хранилище (ссылки Meshy со временем протухают) и помечает работу ready.
//
// Секрет: MESHY_API_KEY (supabase secrets set MESHY_API_KEY=...).
// Работает от имени вошедшего пользователя, поэтому действуют те же права (RLS), что и в приложении.

import { createClient } from 'npm:@supabase/supabase-js@2'

const MESHY = 'https://api.meshy.ai/openapi/v1/multi-image-to-3d'
const BUCKET = 'art'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Только POST' }, 405)

  const key = Deno.env.get('MESHY_API_KEY')
  if (!key) return json({ error: 'На сервере не задан MESHY_API_KEY' }, 500)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })

  let action: string, artworkId: string
  try {
    ;({ action, artworkId } = await req.json())
  } catch {
    return json({ error: 'Неверный запрос' }, 400)
  }

  const { data: art, error } = await sb.from('artworks').select('*').eq('id', artworkId).maybeSingle()
  if (error) return json({ error: error.message }, 500)
  if (!art) return json({ error: 'Работа не найдена или нет доступа' }, 404)
  if (art.kind !== 'craft') return json({ error: '3D-модель строится только для поделок' }, 400)

  const update = async (patch: Record<string, unknown>) => {
    const { data, error } = await sb.from('artworks').update(patch).eq('id', artworkId).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  const meshy = (path: string, init?: RequestInit) =>
    fetch(MESHY + path, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init?.headers },
    })

  try {
    if (action === 'start') {
      const photos: string[] = (art.photo_paths?.length ? art.photo_paths : [art.image_path]).slice(0, 4)
      const { data: signed, error: signError } = await sb.storage.from(BUCKET).createSignedUrls(photos, 60 * 60)
      if (signError) throw new Error(signError.message)
      const res = await meshy('', {
        method: 'POST',
        body: JSON.stringify({
          image_urls: signed.map((s) => s.signedUrl),
          should_texture: true,
          should_remesh: true,
          enable_pbr: false,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.result) throw new Error(body.message ?? `Meshy ответил ${res.status}`)
      const artwork = await update({ model_status: 'processing', model_task_id: body.result, model_error: null })
      return json({ artwork })
    }

    if (action === 'status') {
      if (art.model_status !== 'processing' || !art.model_task_id) return json({ artwork: art })
      const res = await meshy(`/${art.model_task_id}`)
      const task = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(task.message ?? `Meshy ответил ${res.status}`)

      if (task.status === 'SUCCEEDED') {
        const glbUrl = task.model_urls?.glb
        if (!glbUrl) throw new Error('Meshy не вернул .glb')
        const glb = await fetch(glbUrl)
        if (!glb.ok) throw new Error(`Не удалось скачать модель (${glb.status})`)
        const path = `${artworkId}/model.glb`
        const { error: upError } = await sb.storage
          .from(BUCKET)
          .upload(path, await glb.arrayBuffer(), { contentType: 'model/gltf-binary', upsert: true })
        if (upError) throw new Error(upError.message)
        return json({ artwork: await update({ model_status: 'ready', model_path: path, model_error: null }) })
      }
      if (['FAILED', 'CANCELED', 'EXPIRED'].includes(task.status)) {
        const reason = task.task_error?.message || task.status
        return json({ artwork: await update({ model_status: 'failed', model_error: reason }) })
      }
      return json({ artwork: art, progress: task.progress ?? 0 })
    }

    return json({ error: 'Неизвестное действие' }, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (action === 'start') await update({ model_status: 'failed', model_error: message }).catch(() => {})
    return json({ error: message }, 502)
  }
})
