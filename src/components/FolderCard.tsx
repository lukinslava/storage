import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useFileUrl } from '../lib/data'
import { isCutout, type Artwork, type Collection, type Tint } from '../lib/types'

// Задняя стенка папки с «ушком» слева, в единицах ширины папки (100 × 94).
// Пропорции стенки заданы в CSS (aspect-ratio папки и отступ сверху), поэтому
// растянутая без сохранения пропорций маска не искажает скругления.
const BACK = 'M0 9Q0 0 9 0L31 0C37 0 38 7 44 7L91 7Q100 7 100 16L100 85Q100 94 91 94L9 94Q0 94 0 85Z'
const BACK_MASK = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 94' preserveAspectRatio='none'><path d='${BACK}'/></svg>`,
)}")`

function Paper({ art, i }: { art: Artwork; i: number }) {
  const url = useFileUrl(art.thumb_path)
  return (
    <span className={`folder__paper folder__paper--${i}` + (isCutout(art) ? ' folder__paper--cutout' : '')}>{url && <img src={url} alt="" draggable={false} />}</span>
  )
}

/** Пустой листок — когда в папке ещё нет работ. */
function BlankPaper({ i }: { i: number }) {
  return <span className={`folder__paper folder__paper--blank folder__paper--${i}`} />
}

const FACES = ['smile', 'sleepy', 'wow'] as const

/** Рожица на папке: у соседних папок разное настроение. */
function Face({ kind }: { kind: (typeof FACES)[number] }) {
  return (
    <svg className="folder__face" viewBox="0 0 60 36" aria-hidden="true">
      {[18, 42].map((x) =>
        kind === 'sleepy' ? (
          <g key={x}>
            <path d={`M${x - 6.5} 11a6.5 8 0 0 0 13 0z`} fill="#fff" />
            <ellipse cx={x} cy="14.5" rx="3.6" ry="3.4" fill="#1d1d1b" />
            <path d={`M${x - 7.5} 11h15`} stroke="#1d1d1b" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ) : (
          <g key={x}>
            <ellipse cx={x} cy="12" rx="6.5" ry="9" fill="#fff" />
            <ellipse cx={x + 1} cy="13" rx="3.6" ry="5.2" fill="#1d1d1b" />
          </g>
        ),
      )}
      {kind === 'smile' && <path d="M23 27q7 6 14 0" fill="none" stroke="#1d1d1b" strokeWidth="2.4" strokeLinecap="round" />}
      {kind === 'sleepy' && <path d="M22 29h16" stroke="#1d1d1b" strokeWidth="2.2" strokeLinecap="round" />}
      {kind === 'wow' && <ellipse cx="30" cy="29" rx="3.5" ry="4" fill="#1d1d1b" />}
    </svg>
  )
}

/** Папка из кожзама: задняя стенка с «ушком», листы внутри, передняя стенка с рожицей. */
function LeatherFolder({ papers, index, children }: { papers: ReactNode; index: number; children?: ReactNode }) {
  return (
    <>
      <span className="folder__back" style={{ maskImage: BACK_MASK, WebkitMaskImage: BACK_MASK }} />
      <span className="folder__papers">{papers}</span>
      <span className="folder__front" />
      <span className="folder__label">
        <Face kind={FACES[index % FACES.length]} />
        {children}
      </span>
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
      <LeatherFolder
        index={index}
        papers={top.length ? top.map((a, i) => <Paper key={a.id} art={a} i={i} />) : [0, 1].map((i) => <BlankPaper key={i} i={i} />)}
      >
        <span className="folder__name">{collection.name}</span>
        <span className="folder__count">{artworks.length}</span>
      </LeatherFolder>
    </Link>
  )
}

/** Бледная папка-заглушка, пока коллекций нет. */
export function GhostFolder({ tint, index }: { tint: Tint; index: number }) {
  return (
    <div className={`folder folder--ghost tint-${tint}`} style={{ ['--tilt' as string]: `${index % 2 ? 2 : -2}deg` }}>
      <LeatherFolder index={index} papers={[0, 1].map((i) => <BlankPaper key={i} i={i} />)} />
    </div>
  )
}
