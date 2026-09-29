import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

/** Нижняя панель поверх экрана. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
