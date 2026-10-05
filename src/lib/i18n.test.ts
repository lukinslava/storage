import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EN_KEYS } from './i18n'
import { TINT_LABELS } from './types'

const ROOT = join(__dirname, '..')
// Строки, которые намеренно не переводятся.
const KEEP = new Set(['Русский'])

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) && !e.name.includes('.test.') ? [join(dir, e.name)] : [],
  )
}

describe('английский перевод интерфейса', () => {
  it('есть для каждой русской строки в экранах и компонентах', () => {
    const missing = new Set<string>()
    for (const file of [...sources(join(ROOT, 'pages')), ...sources(join(ROOT, 'components'))]) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
      for (const [, s] of code.matchAll(/'([^'\n]*[А-Яа-яЁё][^'\n]*)'/g)) {
        if (!KEEP.has(s) && !EN_KEYS.includes(s)) missing.add(s)
      }
    }
    for (const label of Object.values(TINT_LABELS)) if (!EN_KEYS.includes(label)) missing.add(label)
    expect([...missing]).toEqual([])
  })
})
