import { useEffect, useState } from 'react'
import { useFileUrl } from '../lib/data'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        poster?: string
        alt?: string
        ar?: boolean
        'camera-controls'?: boolean
        'auto-rotate'?: boolean
        'shadow-intensity'?: string
        exposure?: string
        'touch-action'?: string
      }
    }
  }
}

/** Вращаемая 3D-модель поделки. model-viewer грузится только когда нужен. */
export function ModelView({ path, poster, alt }: { path: string; poster?: string | null; alt: string }) {
  const url = useFileUrl(path)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    import('@google/model-viewer').then(() => setReady(true))
  }, [])
  if (!url || !ready) return <div className="model model--loading">Загружаю 3D…</div>
  return (
    <model-viewer
      className="model"
      src={url}
      poster={poster ?? undefined}
      alt={alt}
      camera-controls
      auto-rotate
      ar
      shadow-intensity="1"
      exposure="1.05"
      touch-action="pan-y"
    />
  )
}
