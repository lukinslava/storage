import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArtworkForm } from '../components/ArtworkForm'
import { Framed } from '../components/Framed'
import { BackIcon, CubeIcon, EditIcon, TrashIcon } from '../components/Icons'
import { ModelView } from '../components/ModelView'
import { Sheet } from '../components/Sheet'
import { useData, useFileUrl } from '../lib/data'
import { formatDate } from '../lib/format'
import { store } from '../lib/store'
import type { Artwork } from '../lib/types'

const POLL_MS = 10_000

function Photo({ path, alt }: { path: string; alt: string }) {
  const url = useFileUrl(path)
  return <div className="photos__item">{url && <img src={url} alt={alt} draggable={false} />}</div>
}

function Model3D({ art }: { art: Artwork }) {
  const { putArtwork } = useData()
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  // Пока модель строится — периодически спрашиваем сервер.
  useEffect(() => {
    if (art.model_status !== 'processing') return
    const t = setInterval(() => {
      store.check3D(art.id).then(putArtwork, (e) => setError(String(e?.message ?? e)))
    }, POLL_MS)
    return () => clearInterval(t)
  }, [art.id, art.model_status, putArtwork])

  const start = async () => {
    setStarting(true)
    setError(null)
    try {
      putArtwork(await store.start3D(art.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  if (!store.can3D) {
    return <p className="note">3D-модели появятся, когда будет подключено облако (см. Настройки).</p>
  }
  if (art.model_status === 'processing') {
    return (
      <div className="note note--busy">
        <span className="spinner" /> 3D-модель создаётся. Обычно это занимает 2–5 минут.
      </div>
    )
  }
  if (art.model_status === 'ready') return null
  return (
    <div className="note">
      {art.model_status === 'failed' && <p className="error">Не получилось: {art.model_error ?? 'неизвестная ошибка'}</p>}
      {error && <p className="error">{error}</p>}
      <button className="btn btn--ghost" onClick={start} disabled={starting}>
        <CubeIcon width={20} height={20} /> {art.model_status === 'failed' ? 'Попробовать снова' : 'Создать 3D-модель'}
      </button>
    </div>
  )
}

export function ArtworkPage() {
  const { id } = useParams()
  const { artworks, children, collections, reload, loading } = useData()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'3d' | 'photos'>('3d')
  const art = artworks.find((a) => a.id === id)
  const posterUrl = useFileUrl(art?.kind === 'craft' ? art.thumb_path : null)

  if (loading) return null
  if (!art) {
    return (
      <div className="page">
        <p className="muted">Работа не найдена.</p>
        <Link to="/">В музей</Link>
      </div>
    )
  }

  const child = children.find((c) => c.id === art.child_id)
  const collection = collections.find((c) => c.id === art.collection_id)
  const title = art.title || (art.kind === 'drawing' ? 'Без названия' : 'Поделка')
  const has3D = art.kind === 'craft' && art.model_status === 'ready' && art.model_path

  const remove = async () => {
    if (!confirm(`Удалить «${title}» из музея? Это нельзя отменить.`)) return
    setBusy(true)
    await store.deleteArtwork(art)
    await reload()
    navigate(-1)
  }

  return (
    <div className="page page--art">
      <header className="page__head page__head--nav">
        <button className="icon-btn icon-btn--soft" onClick={() => navigate(-1)} aria-label="Назад">
          <BackIcon width={20} height={20} />
        </button>
        <div className="page__actions">
          <button className="icon-btn icon-btn--soft" onClick={() => setEditing(true)} aria-label="Изменить">
            <EditIcon width={20} height={20} />
          </button>
          <button className="icon-btn icon-btn--soft" onClick={remove} disabled={busy} aria-label="Удалить">
            <TrashIcon width={20} height={20} />
          </button>
        </div>
      </header>

      {art.kind === 'drawing' ? (
        <div className="art-hero">
          <Framed artwork={art} height={Math.min(window.innerHeight * 0.5, 440 / Math.max(art.aspect, 0.6))} full tilt={false} />
        </div>
      ) : (
        <>
          {has3D && (
            <div className="segmented segmented--small">
              <button className={'seg' + (view === '3d' ? ' seg--on' : '')} onClick={() => setView('3d')}>
                3D
              </button>
              <button className={'seg' + (view === 'photos' ? ' seg--on' : '')} onClick={() => setView('photos')}>
                Фото
              </button>
            </div>
          )}
          {has3D && view === '3d' ? (
            <ModelView path={art.model_path!} poster={posterUrl} alt={title} />
          ) : (
            <div className="photos">
              {(art.photo_paths.length ? art.photo_paths : [art.image_path]).map((p, i) => (
                <Photo key={p} path={p} alt={`${title}, фото ${i + 1}`} />
              ))}
            </div>
          )}
        </>
      )}

      <div className="art-info">
        <h1 className="title-serif">{title}</h1>
        <div className="meta-row">
          <span className={`chip chip--static tint-${child?.color ?? 'sand'}`}>{child ? child.name : 'Вместе'}</span>
          <span className="muted">{formatDate(art.made_on)}</span>
        </div>
        {collection && (
          <Link to={`/collections/${collection.id}`} className={`chip chip--link tint-${collection.color}`}>
            {collection.name}
          </Link>
        )}
        {art.notes && <p className="notes">{art.notes}</p>}
        <p className="muted small">Добавлено {formatDate(art.created_at)}</p>
        {art.kind === 'craft' && <Model3D art={art} />}
      </div>

      {editing && (
        <Sheet title="Изменить" onClose={() => setEditing(false)}>
          <ArtworkForm
            kind={art.kind}
            initial={{
              title: art.title,
              child_id: art.child_id,
              collection_id: art.collection_id,
              made_on: art.made_on,
              notes: art.notes,
            }}
            submitLabel="Сохранить"
            onSubmit={async (meta) => {
              await store.updateArtwork(art.id, meta)
              await reload()
              setEditing(false)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
