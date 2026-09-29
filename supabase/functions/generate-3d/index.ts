// Supabase Edge Function: 3D-модель поделки из её фото через Meshy (Multi-Image to 3D).
//
// POST { action: 'start' | 'status', artworkId: string }
//   start  — отправляет до 4 фото поделки в Meshy и помечает работу как processing;
//   status — спрашивает Meshy о готовности; когда модель готова, скачивает .glb
//            в хранилище (ссылки Meshy со временем протухают) и помечает работу ready.
//
// Секрет: MESHY_API_KEY (supabase secrets set MESHY_API_KEY=...).
// Работает от имени вошедшего пользователя, поэтому действуют те же права (RLS), что и в приложении.
// Деплоится с --no-verify-jwt (шлюз не понимает новые ключи подписи), вход проверяется здесь.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { isFinalFailure, meshyClient } from './meshy.ts'

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

  // Ключ берём тот же, с которым пришло приложение (publishable), а старый anon — запасной вариант.
  const apiKey = req.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY')!
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, apiKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: user } = await sb.auth.getUser(token)
  if (!user?.user) return json({ error: 'Нужно войти в приложение' }, 401)

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

  const meshy = meshyClient(key)

  try {
    if (action === 'start') {
      const photos: string[] = (art.photo_paths?.length ? art.photo_paths : [art.image_path]).slice(0, 4)
      const { data: signed, error: signError } = await sb.storage.from(BUCKET).createSignedUrls(photos, 60 * 60)
      if (signError) throw new Error(signError.message)
      const taskId = await meshy.start(signed.map((s) => s.signedUrl))
      const artwork = await update({ model_status: 'processing', model_task_id: taskId, model_error: null })
      return json({ artwork })
    }

    if (action === 'status') {
      if (art.model_status !== 'processing' || !art.model_task_id) return json({ artwork: art })
      const task = await meshy.task(art.model_task_id)

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
      if (isFinalFailure(task)) {
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
