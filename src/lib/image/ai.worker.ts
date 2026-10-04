// Нейросеть считает в отдельном потоке: на процессоре это ~10 секунд, и в основном потоке экран бы замирал.

import { segmentForeground } from '@imgly/background-removal'

export type AiRequest = { id: number; pixels: ImageData; publicPath: string; model: 'isnet_quint8' | 'isnet_fp16' }
export type AiReply = { id: number } & ({ share: number } | { alpha: Uint8Array } | { error: string })

const reply = (msg: AiReply, transfer: Transferable[] = []) => postMessage(msg, { transfer })

self.onmessage = async ({ data: { id, pixels, publicPath, model } }: MessageEvent<AiRequest>) => {
  try {
    // Сырые RGBA-пиксели в обе стороны: так библиотеке не нужен canvas, которого в потоке может не быть.
    const { width, height } = pixels
    const image = new Blob([pixels.data], { type: `image/x-rgba8;width=${width};height=${height}` })
    const out = await segmentForeground(image, {
      publicPath,
      model,
      output: { format: 'image/x-rgba8' },
      progress: (key, done, total) => {
        if (key.includes('/models/')) reply({ id, share: done / total })
      },
    })
    const rgba = new Uint8Array(await out.arrayBuffer())
    const alpha = new Uint8Array(width * height)
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
    reply({ id, alpha }, [alpha.buffer])
  } catch (e) {
    reply({ id, error: e instanceof Error ? e.message : String(e) })
  }
}
