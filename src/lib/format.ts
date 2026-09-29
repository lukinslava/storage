export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return one
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few
  return many
}

/** «2026-09-29» — локальная дата; полная ISO-метка — момент времени. */
const parse = (value: string) => {
  if (value.length > 10) return new Date(value)
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** «12 сентября 2026» */
export function formatDate(ymd: string): string {
  return parse(ymd)
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/\s*г\.?$/, '')
}

/** «Сентябрь 2026» */
export function formatMonth(ymd: string): string {
  const s = parse(ymd).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/\s*г\.?$/, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** «5 работ» */
export function worksCount(n: number): string {
  return `${n} ${plural(n, 'работа', 'работы', 'работ')}`
}
