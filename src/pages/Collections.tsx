import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderCard } from '../components/FolderCard'
import { PlusIcon } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { useData } from '../lib/data'
import { store } from '../lib/store'
import { TINTS, TINT_LABELS, type Tint } from '../lib/types'

export function Collections() {
  const { collections, artworks, loading } = useData()
  const [creating, setCreating] = useState(false)

  return (
    <div className="page">
      <header className="page__head">
        <h1>Коллекции</h1>
      </header>

      {!loading && (
        <div className="folders">
          {collections.map((c, i) => (
            <FolderCard key={c.id} collection={c} index={i} artworks={artworks.filter((a) => a.collection_id === c.id)} />
          ))}
          {collections.length === 0 && (
            <>
              <div className="folder folder--ghost tint-pink" style={{ ['--tilt' as string]: '-2.5deg' }}>
                <span className="folder__pocket" />
              </div>
              <div className="folder folder--ghost tint-green" style={{ ['--tilt' as string]: '2.5deg' }}>
                <span className="folder__pocket" />
              </div>
            </>
          )}
        </div>
      )}

      <div className="hero">
        <p className="hero__title">
          Маленькие миры.
          <br />
          Все вместе.
        </p>
        <button className="btn btn--primary" onClick={() => setCreating(true)}>
          <PlusIcon width={20} height={20} /> Новая коллекция
        </button>
      </div>

      {creating && <CollectionSheet onClose={() => setCreating(false)} />}
    </div>
  )
}

export function CollectionSheet({
  onClose,
  initial,
}: {
  onClose: () => void
  initial?: { id: string; name: string; color: Tint }
}) {
  const { reload, collections } = useData()
  const navigate = useNavigate()
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState<Tint>(initial?.color ?? TINTS[collections.length % TINTS.length])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      if (initial) {
        await store.updateCollection(initial.id, { name: name.trim(), color })
        await reload()
        onClose()
      } else {
        const c = await store.createCollection(name.trim(), color)
        await reload()
        navigate(`/collections/${c.id}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <Sheet title={initial ? 'Коллекция' : 'Новая коллекция'} onClose={onClose}>
      <div className="form">
        <label className="field">
          <span>Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Котики" autoFocus maxLength={60} />
        </label>
        <div className="field">
          <span>Цвет</span>
          <div className="swatches">
            {TINTS.map((t) => (
              <button
                key={t}
                type="button"
                className={`swatch tint-${t}` + (t === color ? ' swatch--on' : '')}
                onClick={() => setColor(t)}
                aria-label={TINT_LABELS[t]}
                aria-pressed={t === color}
              />
            ))}
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn--primary btn--wide" onClick={save} disabled={busy || !name.trim()}>
          {initial ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </Sheet>
  )
}
