import { useState, type FormEvent, type ReactNode } from 'react'
import { useData } from '../lib/data'
import type { ArtworkKind, ArtworkMeta } from '../lib/types'

interface Props {
  kind: ArtworkKind
  initial: ArtworkMeta
  submitLabel: string
  busy?: boolean
  onSubmit: (meta: ArtworkMeta) => void
  /** Дополнительные поля перед кнопкой (например, «создать 3D»). */
  extra?: ReactNode
}

export function ArtworkForm({ kind, initial, submitLabel, busy, onSubmit, extra }: Props) {
  const { children, collections } = useData()
  const [meta, setMeta] = useState<ArtworkMeta>(initial)
  const set = <K extends keyof ArtworkMeta>(k: K, v: ArtworkMeta[K]) => setMeta((m) => ({ ...m, [k]: v }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit({ ...meta, title: meta.title.trim(), notes: meta.notes.trim() })
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>{kind === 'drawing' ? 'Что нарисовано' : 'Что за поделка'}</span>
        <input
          value={meta.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder={kind === 'drawing' ? 'Котик на траве' : 'Замок из пластилина'}
          maxLength={120}
        />
      </label>

      <div className="field">
        <span>Чья работа</span>
        <div className="segmented" role="radiogroup">
          {children.map((c) => (
            <button
              type="button"
              key={c.id}
              role="radio"
              aria-checked={meta.child_id === c.id}
              className={`seg tint-${c.color}` + (meta.child_id === c.id ? ' seg--on' : '')}
              onClick={() => set('child_id', c.id)}
            >
              {c.name}
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={meta.child_id === null}
            className={'seg' + (meta.child_id === null ? ' seg--on' : '')}
            onClick={() => set('child_id', null)}
          >
            Вместе
          </button>
        </div>
      </div>

      <label className="field">
        <span>Дата</span>
        <input type="date" value={meta.made_on} onChange={(e) => e.target.value && set('made_on', e.target.value)} required />
      </label>

      <label className="field">
        <span>Коллекция</span>
        <select value={meta.collection_id ?? ''} onChange={(e) => set('collection_id', e.target.value || null)}>
          <option value="">Без коллекции</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Заметка</span>
        <textarea
          value={meta.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          placeholder="Что рассказал автор"
          maxLength={1000}
        />
      </label>

      {extra}

      <button className="btn btn--primary btn--wide" type="submit" disabled={busy}>
        {busy ? 'Сохраняю…' : submitLabel}
      </button>
    </form>
  )
}
