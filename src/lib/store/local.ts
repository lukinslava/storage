import type { Artwork, Child, Collection } from '../types'
import type { Snapshot, Store } from './types'

// Локальный режим: всё лежит в IndexedDB этого браузера.
// Удобно, чтобы попробовать приложение без облака.

const DB_NAME = 'little-museum'
const META = 'meta'
const FILES = 'files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(META)
      req.result.createObjectStore(FILES)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(db: IDBDatabase, store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const req = fn(t.objectStore(store))
    t.oncomplete = () => resolve(req ? req.result : (undefined as T))
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

const uid = () => crypto.randomUUID()

const SEED_CHILDREN: Child[] = [
  { id: 'kirill', name: 'Кирилл', color: 'blue', sort: 0 },
  { id: 'mark', name: 'Марк', color: 'green', sort: 1 },
]

export function createLocalStore(): Store {
  const dbPromise = openDb()
  const urls = new Map<string, string>()

  async function read(): Promise<Snapshot> {
    const db = await dbPromise
    const snap = await tx<Snapshot | undefined>(db, META, 'readonly', (s) => s.get('snapshot'))
    return snap ?? { children: SEED_CHILDREN, collections: [], artworks: [] }
  }

  async function write(snap: Snapshot) {
    const db = await dbPromise
    await tx(db, META, 'readwrite', (s) => s.put(snap, 'snapshot'))
  }

  async function mutate(fn: (s: Snapshot) => void) {
    const snap = await read()
    fn(snap)
    await write(snap)
  }

  async function putFile(path: string, blob: Blob) {
    const db = await dbPromise
    await tx(db, FILES, 'readwrite', (s) => s.put(blob, path))
  }

  async function deleteFile(path: string) {
    const db = await dbPromise
    await tx(db, FILES, 'readwrite', (s) => s.delete(path))
    const url = urls.get(path)
    if (url) URL.revokeObjectURL(url)
    urls.delete(path)
  }

  return {
    mode: 'local',
    can3D: false,

    load: read,

    async updateChild(id, patch) {
      await mutate((s) => {
        s.children = s.children.map((c) => (c.id === id ? { ...c, ...patch } : c))
      })
    },

    async createCollection(name, color) {
      const c: Collection = { id: uid(), name, color, created_at: new Date().toISOString() }
      await mutate((s) => s.collections.push(c))
      return c
    },

    async updateCollection(id, patch) {
      await mutate((s) => {
        s.collections = s.collections.map((c) => (c.id === id ? { ...c, ...patch } : c))
      })
    },

    async deleteCollection(id) {
      await mutate((s) => {
        s.collections = s.collections.filter((c) => c.id !== id)
        s.artworks = s.artworks.map((a) => (a.collection_id === id ? { ...a, collection_id: null } : a))
      })
    },

    async createArtwork(kind, meta, files) {
      const id = uid()
      const ext = files.image.type === 'image/png' ? 'png' : 'jpg'
      const image_path = `${id}/image.${ext}`
      const thumb_path = `${id}/thumb.${ext}`
      await putFile(image_path, files.image)
      await putFile(thumb_path, files.thumb)
      const photo_paths: string[] = []
      for (const [i, p] of files.photos.entries()) {
        const path = `${id}/photo-${i + 1}.jpg`
        await putFile(path, p)
        photo_paths.push(path)
      }
      const art: Artwork = {
        id,
        kind,
        ...meta,
        created_at: new Date().toISOString(),
        image_path,
        thumb_path,
        aspect: files.aspect,
        photo_paths,
        model_path: null,
        model_status: 'none',
        model_error: null,
      }
      await mutate((s) => s.artworks.push(art))
      return art
    },

    async updateArtwork(id, patch) {
      await mutate((s) => {
        s.artworks = s.artworks.map((a) => (a.id === id ? { ...a, ...patch } : a))
      })
    },

    async deleteArtwork(art) {
      await mutate((s) => {
        s.artworks = s.artworks.filter((a) => a.id !== art.id)
      })
      for (const p of [art.image_path, art.thumb_path, ...art.photo_paths, art.model_path]) {
        if (p) await deleteFile(p)
      }
    },

    async fileUrl(path) {
      const cached = urls.get(path)
      if (cached) return cached
      const db = await dbPromise
      const blob = await tx<Blob | undefined>(db, FILES, 'readonly', (s) => s.get(path))
      if (!blob) throw new Error(`Файл не найден: ${path}`)
      const url = URL.createObjectURL(blob)
      urls.set(path, url)
      return url
    },

    async start3D() {
      throw new Error('3D-модели доступны только при подключённом облаке (Supabase).')
    },

    async check3D() {
      throw new Error('3D-модели доступны только при подключённом облаке (Supabase).')
    },
  }
}
