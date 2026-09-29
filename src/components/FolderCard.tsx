import { Link } from 'react-router-dom'
import { useFileUrl } from '../lib/data'
import { isCutout, type Artwork, type Collection } from '../lib/types'

function Paper({ art, i }: { art: Artwork; i: number }) {
  const url = useFileUrl(art.thumb_path)
  return (
    <span className={`folder__paper folder__paper--${i}` + (isCutout(art) ? ' folder__paper--cutout' : '')}>{url && <img src={url} alt="" draggable={false} />}</span>
  )
}

export function FolderCard({ collection, artworks, index }: { collection: Collection; artworks: Artwork[]; index: number }) {
  const top = artworks.slice(0, 3)
  return (
    <Link
      to={`/collections/${collection.id}`}
      className={`folder tint-${collection.color}`}
      style={{ ['--tilt' as string]: `${index % 2 ? 2.5 : -2.5}deg` }}
    >
      <span className="folder__papers">
        {top.map((a, i) => (
          <Paper key={a.id} art={a} i={i} />
        ))}
      </span>
      <span className="folder__pocket">
        <span className="folder__name">{collection.name}</span>
        <span className="folder__count">{artworks.length}</span>
      </span>
    </Link>
  )
}
