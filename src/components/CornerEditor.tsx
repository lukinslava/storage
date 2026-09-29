import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Point, Quad } from '../lib/image/geometry'

interface Props {
  source: HTMLCanvasElement
  quad: Quad
  onChange: (q: Quad) => void
}

const LOUPE = 110
const ZOOM = 2.5

/** Фото с четырьмя перетаскиваемыми углами листа. */
export function CornerEditor({ source, quad, onChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const view = useRef<HTMLCanvasElement>(null)
  const loupe = useRef<HTMLCanvasElement>(null)
  const [scale, setScale] = useState(0)
  const [drag, setDrag] = useState<number | null>(null)

  // Масштаб под ширину экрана; по высоте оставляем место для заголовка, кнопок и меню.
  useLayoutEffect(() => {
    const fit = () => {
      const el = wrap.current
      if (!el) return
      const maxH = Math.max(260, window.innerHeight - 390)
      setScale(Math.min(el.clientWidth / source.width, maxH / source.height))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [source])

  useEffect(() => {
    const c = view.current
    if (!c || !scale) return
    const dpr = window.devicePixelRatio || 1
    c.width = Math.round(source.width * scale * dpr)
    c.height = Math.round(source.height * scale * dpr)
    c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height)
  }, [source, scale])

  useEffect(() => {
    const c = loupe.current
    if (!c || drag === null) return
    const dpr = window.devicePixelRatio || 1
    c.width = LOUPE * dpr
    c.height = LOUPE * dpr
    const ctx = c.getContext('2d')!
    const p = quad[drag]
    // Размер области исходника, которая попадает в лупу.
    const r = LOUPE / (scale * ZOOM) / 2
    ctx.fillStyle = '#222'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(source, p.x - r, p.y - r, r * 2, r * 2, 0, 0, c.width, c.height)
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = dpr
    ctx.beginPath()
    ctx.moveTo(c.width / 2, c.height / 2 - 10 * dpr)
    ctx.lineTo(c.width / 2, c.height / 2 + 10 * dpr)
    ctx.moveTo(c.width / 2 - 10 * dpr, c.height / 2)
    ctx.lineTo(c.width / 2 + 10 * dpr, c.height / 2)
    ctx.stroke()
  }, [drag, quad, scale, source])

  const toSource = (e: RPointerEvent): Point => {
    const rect = view.current!.getBoundingClientRect()
    return {
      x: Math.min(Math.max((e.clientX - rect.left) / scale, 0), source.width - 1),
      y: Math.min(Math.max((e.clientY - rect.top) / scale, 0), source.height - 1),
    }
  }

  const onMove = (e: RPointerEvent) => {
    if (drag === null) return
    const next = [...quad] as Quad
    next[drag] = toSource(e)
    onChange(next)
  }

  const w = source.width * scale
  const h = source.height * scale
  const pts = quad.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')
  // Лупа — в противоположном от пальца верхнем углу.
  const loupeLeft = drag !== null && quad[drag].x * scale < w / 2

  return (
    <div className="corner-editor" ref={wrap}>
      <div className="corner-editor__stage" style={{ width: w, height: h }} onPointerMove={onMove}>
        <canvas ref={view} style={{ width: w, height: h }} />
        <svg width={w} height={h} className="corner-editor__svg">
          <path d={`M0,0H${w}V${h}H0Z M${pts.split(' ').join(' L')}Z`} fillRule="evenodd" className="corner-editor__shade" />
          <polygon points={pts} className="corner-editor__edge" />
          {quad.map((p, i) => (
            <circle
              key={i}
              cx={p.x * scale}
              cy={p.y * scale}
              r={drag === i ? 14 : 11}
              className="corner-editor__handle"
              onPointerDown={(e) => {
                e.preventDefault()
                ;(e.target as Element).setPointerCapture(e.pointerId)
                setDrag(i)
              }}
              onPointerUp={() => setDrag(null)}
              onPointerCancel={() => setDrag(null)}
            />
          ))}
        </svg>
        {drag !== null && (
          <canvas
            ref={loupe}
            className="corner-editor__loupe"
            style={{ width: LOUPE, height: LOUPE, [loupeLeft ? 'right' : 'left']: 8 }}
          />
        )}
      </div>
    </div>
  )
}
