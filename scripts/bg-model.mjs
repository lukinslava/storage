// Готовит файлы нейросети, которая вырезает фигуры из фона (@imgly/background-removal),
// в public/bg-removal/: модель и движок onnxruntime, нарезанные на куски по 4 МБ,
// плюс resources.json, по которому библиотека их собирает. Файлы лежат на нашем же сайте,
// чужой CDN не нужен. Запускается сам перед `npm run dev` и `npm run build`.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public/bg-removal')
const pkgDir = (name) => join(root, 'node_modules', name)
const version = (name) => JSON.parse(readFileSync(join(pkgDir(name), 'package.json'), 'utf8')).version

/**
 * Модель: isnet_quint8 (44 МБ) или isnet_fp16 (88 МБ). На тестовых фото фигурок
 * точность одинаковая, а quint8 вдвое легче и быстрее. Должна совпадать с MODEL в src/lib/image/ai.ts.
 */
const MODEL = 'isnet_quint8'
const DATA_MODEL = { isnet_fp16: 'medium', isnet_quint8: 'small' }[MODEL]
const CHUNK = 4 * 1024 * 1024

const data = join(pkgDir('@imgly/background-removal-data'), 'dist')
const ort = join(pkgDir('onnxruntime-web'), 'dist')
const stamp = [MODEL, version('@imgly/background-removal-data'), version('onnxruntime-web')].join(' ')

const stampFile = join(out, 'version.txt')
if (existsSync(stampFile) && readFileSync(stampFile, 'utf8') === stamp) process.exit(0)

/** Модель в пакете с данными тоже порезана на куски — склеиваем. */
function dataFile(key) {
  const entry = JSON.parse(readFileSync(join(data, 'resources.json'), 'utf8'))[key]
  return Buffer.concat(entry.chunks.map((c) => readFileSync(join(data, c.hash))))
}

const files = {
  [`/models/${MODEL}`]: { body: dataFile(`/models/${DATA_MODEL}`), mime: 'application/octet-stream' },
  '/onnxruntime-web/ort-wasm-simd-threaded.wasm': {
    body: readFileSync(join(ort, 'ort-wasm-simd-threaded.wasm')),
    mime: 'application/wasm',
  },
  '/onnxruntime-web/ort-wasm-simd-threaded.mjs': {
    body: readFileSync(join(ort, 'ort-wasm-simd-threaded.mjs')),
    mime: 'text/javascript',
  },
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const resources = {}
for (const [key, { body, mime }] of Object.entries(files)) {
  const chunks = []
  for (let start = 0; start < body.length; start += CHUNK) {
    const part = body.subarray(start, start + CHUNK)
    const name = createHash('sha256').update(part).digest('hex')
    writeFileSync(join(out, name), part)
    chunks.push({ name, offsets: [start, start + part.length] })
  }
  resources[key] = { chunks, size: body.length, mime }
}
writeFileSync(join(out, 'resources.json'), JSON.stringify(resources))
writeFileSync(stampFile, stamp)
console.log(`bg-removal: ${MODEL}, ${(Object.values(files).reduce((s, f) => s + f.body.length, 0) / 1e6).toFixed(0)} МБ → public/bg-removal/`)
