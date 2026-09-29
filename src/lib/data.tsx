import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { store, type Snapshot } from './store'
import type { Artwork } from './types'

interface DataContext extends Snapshot {
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /** Обновить одну работу в памяти (например, после проверки 3D). */
  putArtwork: (a: Artwork) => void
  /** Готовность 3D-модели в процентах, по id работы. */
  progress3D: Record<string, number>
}

const Ctx = createContext<DataContext | null>(null)

/** Как часто спрашивать сервер, готова ли модель. */
const POLL_MS = 10_000

const EMPTY: Snapshot = { children: [], collections: [], artworks: [] }

function sortArtworks(list: Artwork[]): Artwork[] {
  return [...list].sort((a, b) => b.made_on.localeCompare(a.made_on) || b.created_at.localeCompare(a.created_at))
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress3D, setProgress3D] = useState<Record<string, number>>({})

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

  // Пока хоть одна модель строится, спрашиваем сервер о готовности. Опрос общий для всего
  // приложения, поэтому модель дойдёт до конца, даже если уйти с этой работы на другой экран.
  const building = snap.artworks
    .filter((a) => a.model_status === 'processing')
    .map((a) => a.id)
    .join(',')
  useEffect(() => {
    if (!store.can3D || !building) return
    let alive = true
    const tick = () => {
      for (const id of building.split(',')) {
        store.check3D(id).then(({ artwork, progress }) => {
          if (!alive) return
          putArtwork(artwork)
          setProgress3D((p) => ({ ...p, [id]: artwork.model_status === 'processing' ? (progress ?? p[id] ?? 0) : 100 }))
        }, () => {})
      }
    }
    tick()
    const t = setInterval(tick, POLL_MS)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [building, putArtwork])

  const value = useMemo(
    () => ({ ...snap, loading, error, reload, putArtwork, progress3D }),
    [snap, loading, error, reload, putArtwork, progress3D],
  )
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
