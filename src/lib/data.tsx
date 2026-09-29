import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { store, type Snapshot } from './store'
import type { Artwork } from './types'

interface DataContext extends Snapshot {
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /** Обновить одну работу в памяти (например, после проверки 3D). */
  putArtwork: (a: Artwork) => void
}

const Ctx = createContext<DataContext | null>(null)

const EMPTY: Snapshot = { children: [], collections: [], artworks: [] }

function sortArtworks(list: Artwork[]): Artwork[] {
  return [...list].sort((a, b) => b.made_on.localeCompare(a.made_on) || b.created_at.localeCompare(a.created_at))
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pinged = useRef(new Set<string>())

  const reload = useCallback(async () => {
    try {
      const s = await store.load()
      setSnap({ ...s, artworks: sortArtworks(s.artworks) })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const putArtwork = useCallback((a: Artwork) => {
    setSnap((s) => ({ ...s, artworks: sortArtworks(s.artworks.map((x) => (x.id === a.id ? a : x))) }))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  // Модели, которые строились, пока приложение было закрыто: разово проверяем их.
  useEffect(() => {
    if (!store.can3D) return
    for (const a of snap.artworks) {
      if (a.model_status !== 'processing' || pinged.current.has(a.id)) continue
      pinged.current.add(a.id)
      store.check3D(a.id).then(putArtwork, () => {})
    }
  }, [snap.artworks, putArtwork])

  const value = useMemo(() => ({ ...snap, loading, error, reload, putArtwork }), [snap, loading, error, reload, putArtwork])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): DataContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useData вне DataProvider')
  return ctx
}

/** URL файла из хранилища (подписанная ссылка или blob:). */
export function useFileUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setUrl(null)
    if (path) {
      store.fileUrl(path).then(
        (u) => alive && setUrl(u),
        () => {},
      )
    }
    return () => {
      alive = false
    }
  }, [path])
  return url
}
