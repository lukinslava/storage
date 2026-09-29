import type { Artwork, ArtworkKind, ArtworkMeta, Child, Collection, NewArtworkFiles, Tint } from '../types'

export interface Snapshot {
  children: Child[]
  collections: Collection[]
  artworks: Artwork[]
}

/** Хранилище: облако (Supabase) или этот браузер (IndexedDB). */
export interface Store {
  readonly mode: 'cloud' | 'local'
  /** Умеет ли хранилище строить 3D-модели. */
  readonly can3D: boolean

  load(): Promise<Snapshot>

  updateChild(id: string, patch: Partial<Pick<Child, 'name' | 'color'>>): Promise<void>

  createCollection(name: string, color: Tint): Promise<Collection>
  updateCollection(id: string, patch: Partial<Pick<Collection, 'name' | 'color'>>): Promise<void>
  deleteCollection(id: string): Promise<void>

  createArtwork(kind: ArtworkKind, meta: ArtworkMeta, files: NewArtworkFiles): Promise<Artwork>
  updateArtwork(id: string, patch: Partial<ArtworkMeta>): Promise<void>
  deleteArtwork(artwork: Artwork): Promise<void>

  /** URL файла для <img> / <model-viewer>. */
  fileUrl(path: string): Promise<string>

  /** Запускает построение 3D-модели из фото поделки. */
  start3D(id: string): Promise<Artwork>
  /** Проверяет, готова ли модель; когда готова — сохраняет её в хранилище. */
  check3D(id: string): Promise<Artwork>
}
