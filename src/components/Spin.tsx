import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { store } from '../lib/store'

/** С какого числа фото поделку можно крутить. */
export const SPIN_MIN = 6

/** Сколько пикселей провести пальцем, чтобы сменить кадр. */
const PX_PER_FRAME = 18
/** Пауза между кадрами, пока поделка крутится сама. */
const AUTO_MS = 450

/**
 * Поделка, которую крутят пальцем: кадры сняты по кругу, движение пальца листает их.
 * Бесплатная замена 3D-модели. Пока к ней не прикоснулись, она медленно вращается сама.
 */
export function Spin({ paths, alt }: { paths: string[]; alt: string }) {
  const [urls, setUrls] = useState<string[] | null>(null)
  const [frame, setFrame] = useState(0)
  const [touched, setTouched] = useState(false)
  const drag = useRef<{ x: number; start: number } | null>(null)
  const n = paths.length

  // Все кадры грузим заранее, иначе при вращении они будут мигать.
  useEffect(() => {
    let alive = true
    setUrls(null)
    Promise.all(paths.map((p) => store.fileUrl(p)))
      .then((list) => Promise.all(list.map(preload)).then(() => list))
      .then((list) => alive && setUrls(list), () => {})
    return () => {
      alive = false
    }
  }, [paths.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!urls || touched) return
    const t = setInterval(() => setFrame((f) => (f + 1) % n), AUTO_MS)
    return () => clearInterval(t)
  }, [urls, touched, n])

  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, start: frame }
    setTouched(true)
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const steps = Math.round((drag.current.x - e.clientX) / PX_PER_FRAME)
    setFrame((((drag.current.start + steps) % n) + n) % n)
  }
  const up = () => {
    drag.current = null
  }

  if (!urls) return <div className="spin spin--loading">Загружаю фото…</div>
  return (
    <div
      className="spin"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="img"
      aria-label={`${alt}: крутится пальцем, ${n} кадров`}
    >
      {urls.map((u, i) => (
        <img key={u} src={u} alt="" draggable={false} hidden={i !== frame} />
      ))}
      <span className="spin__hint">{touched ? `${frame + 1} / ${n}` : '↔ Крутите пальцем'}</span>
    </div>
  )
}

function preload(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = img.onerror = () => resolve()
    img.src = url
  })
}
