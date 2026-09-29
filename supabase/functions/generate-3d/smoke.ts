// Проверка связки с сервисом 3D: запуск задачи, ожидание, скачивание .glb.
// Тратит кредиты на одну модель. Ключ берётся из TRIPO_API_KEY или MESHY_API_KEY:
//   TRIPO_API_KEY=... deno run --allow-net --allow-env supabase/functions/generate-3d/smoke.ts

import { pickProvider } from './providers.ts'

const provider = pickProvider((name) => Deno.env.get(name))
if (!provider) throw new Error('Нужен TRIPO_API_KEY или MESHY_API_KEY')

// Утка из образцов glTF: четыре ракурса одного и того же предмета.
const base = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/screenshot/screenshot.png'
const id = await provider.start([base, base])
console.log(provider.name, 'задача', id)

for (let i = 0; i < 60; i++) {
  const task = await provider.task(id)
  console.log(task.state, task.progress)
  if (task.state === 'failed') throw new Error(task.error)
  if (task.state === 'done') {
    if (!task.glbUrl) throw new Error('сервис не вернул ссылку на .glb')
    const glb = new Uint8Array(await (await fetch(task.glbUrl)).arrayBuffer())
    const magic = new TextDecoder().decode(glb.slice(0, 4))
    if (magic !== 'glTF') throw new Error(`скачан не .glb (${magic})`)
    console.log(`ok: .glb ${(glb.length / 1e6).toFixed(1)} МБ`)
    Deno.exit(0)
  }
  await new Promise((r) => setTimeout(r, 5000))
}
throw new Error('Модель не построилась за 5 минут')
