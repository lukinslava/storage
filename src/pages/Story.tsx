import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArtGrid } from '../components/ArtGrid'
import { useData } from '../lib/data'
import { formatMonth, worksCount } from '../lib/format'
import type { Artwork } from '../lib/types'

/** Лента по месяцам: как рос маленький художник. */
export function Story() {
  const { artworks, children, loading } = useData()
  const [child, setChild] = useState<string | 'all'>('all')

  const months = useMemo(() => {
    const groups = new Map<string, Artwork[]>()
    for (const a of artworks) {
      if (child !== 'all' && a.child_id !== child) continue
      const key = a.made_on.slice(0, 7)
      groups.set(key, [...(groups.get(key) ?? []), a])
    }
    return [...groups.entries()]
  }, [artworks, child])

  return (
    <div className="page">
      <header className="page__head">
        <h1>История</h1>
      </header>
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
            {c.name} · {artworks.filter((a) => a.child_id === c.id).length}
          </button>
        ))}
      </div>

      {!loading && months.length === 0 && (
        <div className="hero">
          <p className="hero__title">
            Каждая работа —
            <br />
            страничка истории.
          </p>
          <Link to="/scan" className="btn btn--primary">
            Добавить первую
          </Link>
        </div>
      )}

      <div className="timeline">
        {months.map(([key, list]) => (
          <section key={key} className="timeline__month">
            <h2 className="timeline__title">
              {formatMonth(`${key}-01`)} <span className="muted">{worksCount(list.length)}</span>
            </h2>
            <ArtGrid artworks={list} />
          </section>
        ))}
      </div>
    </div>
  )
}
