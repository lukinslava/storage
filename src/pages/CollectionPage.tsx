import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArtGrid } from '../components/ArtGrid'
import { BackIcon, EditIcon, TrashIcon } from '../components/Icons'
import { ConfirmSheet } from '../components/Sheet'
import { useData } from '../lib/data'
import { store } from '../lib/store'
import { CollectionSheet } from './Collections'
import { worksCount } from '../lib/format'
import { tr } from '../lib/i18n'

export function CollectionPage() {
  const { id } = useParams()
  const { collections, artworks, reload, loading } = useData()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const collection = collections.find((c) => c.id === id)
  const list = artworks.filter((a) => a.collection_id === id)

  if (loading) return null
  if (!collection) {
    return (
      <div className="page">
        <p className="muted">{tr('Коллекция не найдена.')}</p>
        <Link to="/collections">{tr('К коллекциям')}</Link>
      </div>
    )
  }

  const remove = async () => {
    await store.deleteCollection(collection.id)
    await reload()
    navigate('/collections')
  }

  return (
    <div className={`page tint-page tint-${collection.color}`}>
      <header className="page__head page__head--nav">
        <button className="icon-btn icon-btn--soft" onClick={() => navigate(-1)} aria-label={tr('Назад')}>
          <BackIcon width={20} height={20} />
        </button>
        <div className="page__actions">
          <button className="icon-btn icon-btn--soft" onClick={() => setEditing(true)} aria-label={tr('Изменить')}>
            <EditIcon width={20} height={20} />
          </button>
          <button className="icon-btn icon-btn--soft" onClick={() => setConfirming(true)} aria-label={tr('Удалить')}>
            <TrashIcon width={20} height={20} />
          </button>
        </div>
      </header>
      <h1 className="title-serif">{collection.name}</h1>
      <p className="muted">
        {worksCount(list.length)}
      </p>
      {list.length ? (
        <ArtGrid artworks={list} />
      ) : (
        <p className="muted empty-note">{tr('Пока пусто. Выберите эту коллекцию, когда будете добавлять работу.')}</p>
      )}
      {confirming && (
        <ConfirmSheet
          title={tr('Удалить коллекцию?')}
          text={tr('Коллекция «{name}» исчезнет, а работы из неё останутся в музее.', { name: collection.name })}
          action={tr('Удалить коллекцию')}
          onConfirm={remove}
          onClose={() => setConfirming(false)}
        />
      )}
      {editing && <CollectionSheet initial={collection} onClose={() => setEditing(false)} />}
    </div>
  )
}
