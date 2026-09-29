import { Link } from 'react-router-dom'
import { useData, useFileUrl } from '../lib/data'
import { formatDate } from '../lib/format'
import type { Artwork } from '../lib/types'

function Card({ art }: { art: Artwork }) {
  const url = useFileUrl(art.thumb_path)
  const { children } = useData()
  const child = children.find((c) => c.id === art.child_id)
  return (
    <Link to={`/art/${art.id}`} className="card">
      <span className="card__img">
        {url && <img src={url} alt="" draggable={false} />}
        {art.kind === 'craft' && <span className="card__kind">{art.model_status === 'ready' ? '3D' : 'Поделка'}</span>}
      </span>
      <span className="card__title">{art.title || (art.kind === 'drawing' ? 'Без названия' : 'Поделка')}</span>
      <span className="card__meta">
        {child && <span className={`dot tint-${child.color}`} />}
        {child ? child.name : 'Вместе'} · {formatDate(art.made_on)}
      </span>
    </Link>
  )
}

export function ArtGrid({ artworks }: { artworks: Artwork[] }) {
  return (
    <div className="grid">
      {artworks.map((a) => (
        <Card key={a.id} art={a} />
      ))}
    </div>
  )
}
