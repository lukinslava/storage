import type { CSSProperties } from 'react'
import { useFileUrl } from '../lib/data'
import { isCutout, type Artwork } from '../lib/types'

type FrameStyle = 'wood' | 'tape' | 'pin' | 'mat' | 'cutout'
const STYLES: FrameStyle[] = ['wood', 'tape', 'pin', 'mat']

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Оформление выбирается по id, поэтому у каждой работы оно своё и не «прыгает». */
export function frameFor(id: string): { style: FrameStyle; tilt: number } {
  const h = hash(id)
  return { style: STYLES[h % STYLES.length], tilt: ((h >> 8) % 7) - 3 }
}

interface Props {
  artwork: Artwork
  /** Высота картинки внутри рамки, px. */
  height: number
  full?: boolean
  tilt?: boolean
}

export function Framed({ artwork, height, full = false, tilt = true }: Props) {
  const url = useFileUrl(full ? artwork.image_path : artwork.thumb_path)
  const framed = frameFor(artwork.id)
  // Фигурка, вырезанная по контуру, висит без рамки — только тень.
  const style = isCutout(artwork) ? 'cutout' : framed.style
  const deg = framed.tilt
  const aspect = artwork.aspect || 0.75
  const css: CSSProperties = { transform: tilt ? `rotate(${deg * 0.6}deg)` : undefined }
  return (
    <div className={`frame frame--${style}`} style={css}>
      {style === 'wood' && <span className="frame__string" />}
      {style === 'tape' && <span className="frame__tape" />}
      {style === 'pin' && <span className="frame__pin" />}
      <div className="frame__inner" style={{ height, width: height * aspect }}>
        {url ? <img src={url} alt={artwork.title || 'Работа'} draggable={false} /> : <div className="frame__loading" />}
      </div>
      {artwork.kind === 'craft' && artwork.model_status === 'ready' && <span className="badge-3d">3D</span>}
    </div>
  )
}
