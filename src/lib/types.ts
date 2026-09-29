export type ArtworkKind = 'drawing' | 'craft'
export type ModelStatus = 'none' | 'processing' | 'ready' | 'failed'
export type Tint = 'pink' | 'green' | 'blue' | 'sand' | 'lilac' | 'peach'

export interface Child {
  id: string
  name: string
  color: Tint
  sort: number
}

export interface Collection {
  id: string
  name: string
  color: Tint
  created_at: string
}

export interface Artwork {
  id: string
  kind: ArtworkKind
  title: string
  child_id: string | null
  collection_id: string | null
  /** Дата, когда работа сделана (по умолчанию — дата добавления). YYYY-MM-DD */
  made_on: string
  /** Когда работу добавили в музей. */
  created_at: string
  /** Основная картинка: вырезанный рисунок или обложка поделки. */
  image_path: string
  thumb_path: string
  /** Ширина / высота основной картинки. */
  aspect: number
  /** Фото поделки с разных сторон. */
  photo_paths: string[]
  model_path: string | null
  model_status: ModelStatus
  model_error: string | null
  notes: string
}

/** Работа вырезана по контуру (картинка с прозрачным фоном). */
export const isCutout = (a: Pick<Artwork, 'image_path'>) => a.image_path.endsWith('.png')

export type ArtworkMeta = Pick<Artwork, 'title' | 'child_id' | 'collection_id' | 'made_on' | 'notes'>

export interface NewArtworkFiles {
  image: Blob
  thumb: Blob
  aspect: number
  photos: Blob[]
}

export const TINTS: Tint[] = ['pink', 'green', 'blue', 'sand', 'lilac', 'peach']

export const TINT_LABELS: Record<Tint, string> = {
  pink: 'Розовый',
  green: 'Зелёный',
  blue: 'Голубой',
  sand: 'Песочный',
  lilac: 'Сиреневый',
  peach: 'Персиковый',
}

export function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
