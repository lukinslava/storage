import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useFileUrl } from '../lib/data'
import { isCutout, type Artwork, type Collection, type Tint } from '../lib/types'

// Передняя стенка папки с «ушком» слева, в единицах ширины папки (100 × 66).
// Пропорции стенки заданы в CSS (aspect-ratio папки и отступ сверху), поэтому
// растянутая без сохранения пропорций картинка не искажает скругления.
const FRONT = 'M0 7Q0 0 7 0L46 0C52 0 53 9 60 9L93 9Q100 9 100 16L100 59Q100 66 93 66L7 66Q0 66 0 59Z'
const FRONT_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 66' preserveAspectRatio='none'><path d='${FRONT}'/></svg>`,
)}")`

function Paper({ art, i }: { art: Artwork; i: number }) {
  const url = useFileUrl(art.thumb_path)
  return (
    <span className={`folder__paper folder__paper--${i}` + (isCutout(art) ? ' folder__paper--cutout' : '')}>{url && <img src={url} alt="" draggable={false} />}</span>
  )
}

/** Пустой листок со строчками — когда в папке ещё нет работ. */
function BlankPaper({ i }: { i: number }) {
  return (
    <span className={`folder__paper folder__paper--blank folder__paper--${i}`}>
      <i />
      <i />
      <i />
    </span>
  )
}

/** Стеклянная папка: тёмная задняя стенка, листы внутри и матовая передняя стенка. */
function GlassFolder({ papers, children }: { papers: ReactNode; children?: ReactNode }) {
  return (
    <>
      <span className="folder__back" />
      <span className="folder__papers">{papers}</span>
      <span className="folder__front" style={{ maskImage: FRONT_MASK, WebkitMaskImage: FRONT_MASK }} />
      <svg className="folder__glass" viewBox="0 0 100 66" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="folder-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={FRONT} fill="url(#folder-sheen)" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {children && <span className="folder__label">{children}</span>}
    </>
  )
}

export function FolderCard({ collection, artworks, index }: { collection: Collection; artworks: Artwork[]; index: number }) {
  const top = artworks.slice(0, 3)
  return (
    <Link
      to={`/collections/${collection.id}`}
      className={`folder tint-${collection.color}`}
      style={{ ['--tilt' as string]: `${index % 2 ? 2 : -2}deg` }}
    >
      <GlassFolder
        papers={top.length ? top.map((a, i) => <Paper key={a.id} art={a} i={i} />) : [0, 1].map((i) => <BlankPaper key={i} i={i} />)}
      >
        <span className="folder__name">{collection.name}</span>
        <span className="folder__count">{artworks.length}</span>
      </GlassFolder>
    </Link>
  )
}

/** Бледная папка-заглушка, пока коллекций нет. */
export function GhostFolder({ tint, index }: { tint: Tint; index: number }) {
  return (
    <div className={`folder folder--ghost tint-${tint}`} style={{ ['--tilt' as string]: `${index % 2 ? 2 : -2}deg` }}>
      <GlassFolder papers={[0, 1].map((i) => <BlankPaper key={i} i={i} />)} />
    </div>
  )
}
