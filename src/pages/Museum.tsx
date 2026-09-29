import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Framed } from '../components/Framed'
import { FilterIcon, PlusIcon } from '../components/Icons'
import { useData } from '../lib/data'
import { worksCount } from '../lib/format'
import type { ArtworkKind } from '../lib/types'

export function Museum() {
  const { artworks, children, loading } = useData()
  const [showFilter, setShowFilter] = useState(false)
  const [child, setChild] = useState<string | 'all'>('all')
  const [kind, setKind] = useState<ArtworkKind | 'all'>('all')

  const list = useMemo(
    () => artworks.filter((a) => (child === 'all' || a.child_id === child) && (kind === 'all' || a.kind === kind)),
    [artworks, child, kind],
  )
  const filtered = child !== 'all' || kind !== 'all'

  return (
    <div className="page page--museum">
      <header className="page__head">
        <h1>Музей</h1>
        <button
          className={'icon-btn icon-btn--soft' + (filtered ? ' icon-btn--dot' : '')}
          onClick={() => setShowFilter((v) => !v)}
          aria-label="Фильтр"
          aria-expanded={showFilter}
        >
          <FilterIcon width={20} height={20} />
        </button>
      </header>

      {showFilter && (
        <div className="filters">
          <div className="chips">
            <button className={'chip' + (child === 'all' ? ' chip--on' : '')} onClick={() => setChild('all')}>
              Все
            </button>
            {children.map((c) => (
              <button
                key={c.id}
                className={`chip tint-${c.color}` + (child === c.id ? ' chip--on' : '')}
                onClick={() => setChild(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="chips">
            {(
              [
                ['all', 'Всё'],
                ['drawing', 'Рисунки'],
                ['craft', 'Поделки'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={'chip' + (kind === k ? ' chip--on' : '')} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="gallery" aria-label="Работы">
        {loading ? null : list.length === 0 ? (
          <div className="gallery__empty">
            <div className="empty-frame empty-frame--a" />
            <div className="empty-frame empty-frame--b" />
            <div className="empty-frame empty-frame--c" />
          </div>
        ) : (
          <div className="gallery__track">
            {list.map((a) => (
              <Link key={a.id} to={`/art/${a.id}`} className="gallery__item">
                <Framed artwork={a} height={a.aspect > 1.1 ? 160 : 210} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="hero">
        <p className="hero__title">
          Юный художник.
          <br />
          Большой вернисаж.
        </p>
        {list.length > 0 && <p className="hero__count muted">{worksCount(list.length)} в музее</p>}
        <Link to="/scan" className="btn btn--primary">
          <PlusIcon width={20} height={20} /> Повесить работу
        </Link>
      </div>
    </div>
  )
}

