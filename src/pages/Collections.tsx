import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderCard, FolderDefs, GhostFolder } from '../components/FolderCard'
import { PlusIcon } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { useData } from '../lib/data'
import { store } from '../lib/store'
import { TINTS, TINT_LABELS, type Tint } from '../lib/types'
import { tr } from '../lib/i18n'

export function Collections() {
  const { collections, artworks, loading } = useData()
  const [creating, setCreating] = useState(false)

  return (
    <div className="page">
      <header className="page__head">
        <h1>{tr('Коллекции')}</h1>
      </header>

      {!loading && (
        <div className="folders">
          <FolderDefs />
          {collections.map((c, i) => (
            <FolderCard key={c.id} collection={c} index={i} artworks={artworks.filter((a) => a.collection_id === c.id)} />
          ))}
          {collections.length === 0 && (
            <>
              <GhostFolder tint="pink" index={0} />
              <GhostFolder tint="green" index={1} />
            </>
          )}
        </div>
      )}

      <div className="hero">
        <p className="hero__title">
          {tr('Маленькие миры.')}
          <br />
          {tr('Все вместе.')}
        </p>
        <button className="btn btn--primary" onClick={() => setCreating(true)}>
          <PlusIcon width={20} height={20} /> {tr('Новая коллекция')}
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
    <Sheet title={tr(initial ? 'Коллекция' : 'Новая коллекция')} onClose={onClose}>
      <div className="form">
        <label className="field">
          <span>{tr('Название')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr('Котики')} autoFocus maxLength={60} />
        </label>
        <div className="field">
          <span>{tr('Цвет')}</span>
          <div className="swatches">
            {TINTS.map((t) => (
              <button
                key={t}
                type="button"
                className={`swatch tint-${t}` + (t === color ? ' swatch--on' : '')}
                onClick={() => setColor(t)}
                aria-label={tr(TINT_LABELS[t])}
                aria-pressed={t === color}
              />
            ))}
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn btn--primary btn--wide" onClick={save} disabled={busy || !name.trim()}>
          {tr(initial ? 'Сохранить' : 'Создать')}
        </button>
      </div>
    </Sheet>
  )
}
