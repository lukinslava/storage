import { assertEquals } from 'jsr:@std/assert@1'
import { pickViews } from './providers.ts'

Deno.test('до четырёх фото берутся как есть', () => {
  assertEquals(pickViews(['a', 'b']), ['a', 'b'])
  assertEquals(pickViews([1, 2, 3, 4]), [1, 2, 3, 4])
})

Deno.test('из 12 кадров по кругу — через каждые 90°', () => {
  const frames = Array.from({ length: 12 }, (_, i) => i)
  assertEquals(pickViews(frames), [0, 3, 6, 9])
})

Deno.test('из 10 кадров — ближайшие к четвертям круга', () => {
  const frames = Array.from({ length: 10 }, (_, i) => i)
  assertEquals(pickViews(frames), [0, 3, 5, 8])
})
