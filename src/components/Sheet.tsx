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

/** Подтверждение опасного действия (вместо window.confirm, который не везде работает). */
export function ConfirmSheet({
  title,
  text,
  action,
  onConfirm,
  onClose,
}: {
  title: string
  text: string
  action: string
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="form">
        <p>{text}</p>
        <button className="btn btn--danger btn--wide" onClick={onConfirm}>
          {action}
        </button>
        <button className="btn btn--ghost btn--wide" onClick={onClose}>
          Отмена
        </button>
      </div>
    </Sheet>
  )
}
