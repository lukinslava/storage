// Проверка связки с Meshy на тестовом ключе: запуск задачи, ожидание, скачивание .glb.
// Кредиты не тратит. Запуск: deno run --allow-net supabase/functions/generate-3d/smoke.ts

import { isFinalFailure, MESHY_TEST_KEY, meshyClient } from './meshy.ts'

const meshy = meshyClient(MESHY_TEST_KEY)
const photo = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/screenshot/screenshot.png'

const id = await meshy.start([photo, photo])
console.log('задача', id)

for (let i = 0; i < 30; i++) {
  const task = await meshy.task(id)
  console.log(task.status, task.progress ?? '')
  if (isFinalFailure(task)) throw new Error(task.task_error?.message ?? task.status)
  if (task.status === 'SUCCEEDED') {
    const glbUrl = task.model_urls?.glb
    if (!glbUrl) throw new Error('нет model_urls.glb')
    const glb = new Uint8Array(await (await fetch(glbUrl)).arrayBuffer())
    const magic = new TextDecoder().decode(glb.slice(0, 4))
    if (magic !== 'glTF') throw new Error(`скачан не .glb (${magic})`)
    console.log(`ok: .glb ${(glb.length / 1e6).toFixed(1)} МБ`)
    Deno.exit(0)
  }
  await new Promise((r) => setTimeout(r, 5000))
}
throw new Error('Meshy не закончил за 2.5 минуты')
