import { useState } from 'react'
import { useData } from '../lib/data'
import { worksCount } from '../lib/format'
import { store, supabase } from '../lib/store'
import { TINTS, TINT_LABELS, type Child } from '../lib/types'
import { lang, setLang, tr } from '../lib/i18n'

function ChildRow({ child }: { child: Child }) {
  const { artworks, reload } = useData()
  const [name, setName] = useState(child.name)
  const save = async (patch: Partial<Pick<Child, 'name' | 'color'>>) => {
    await store.updateChild(child.id, patch)
    await reload()
  }
  return (
    <div className="settings-row">
      <div className="settings-row__main">
        <input
          className="inline-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== child.name && save({ name: name.trim() })}
          aria-label={tr('Имя')}
        />
        <span className="muted small">{worksCount(artworks.filter((a) => a.child_id === child.id).length)}</span>
      </div>
      <div className="swatches swatches--small">
        {TINTS.map((t) => (
          <button
            key={t}
            className={`swatch tint-${t}` + (t === child.color ? ' swatch--on' : '')}
            onClick={() => save({ color: t })}
            aria-label={tr(TINT_LABELS[t])}
            aria-pressed={t === child.color}
          />
        ))}
      </div>
    </div>
  )
}

export function Settings() {
  const { children, artworks } = useData()
  const drawings = artworks.filter((a) => a.kind === 'drawing').length
  const crafts = artworks.length - drawings
  const models = artworks.filter((a) => a.model_status === 'ready').length

  return (
    <div className="page">
      <header className="page__head">
        <h1>{tr('Настройки')}</h1>
      </header>

      <section className="settings-group">
        <h2>{tr('Художники')}</h2>
        {children.map((c) => (
          <ChildRow key={c.id} child={c} />
        ))}
      </section>

      <section className="settings-group">
        <h2>{tr('Музей')}</h2>
        <div className="stats">
          <div>
            <b>{drawings}</b>
            <span>{tr('рисунков')}</span>
          </div>
          <div>
            <b>{crafts}</b>
            <span>{tr('поделок')}</span>
          </div>
          <div>
            <b>{models}</b>
            <span>{tr('3D-моделей')}</span>
          </div>
        </div>
      </section>

      <section className="settings-group">
        <h2>{tr('Язык')}</h2>
        <div className="segmented" role="radiogroup" aria-label={tr('Язык')}>
          {(
            [
              ['ru', 'Русский'],
              ['en', 'English'],
            ] as const
          ).map(([code, label]) => (
            <button
              key={code}
              role="radio"
              aria-checked={lang === code}
              className={'seg' + (lang === code ? ' seg--on' : '')}
              onClick={() => lang !== code && setLang(code)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>{tr('Хранилище')}</h2>
        {store.mode === 'cloud' ? (
          <>
            <p>{tr('Работы хранятся в облаке (Supabase) и доступны с любого устройства после входа.')}</p>
            <button className="btn btn--ghost" onClick={() => supabase?.auth.signOut()}>
              {tr('Выйти')}
            </button>
          </>
        ) : (
          <p>
            {tr(
              'Сейчас работы хранятся только в этом браузере. Чтобы они были в облаке и появились 3D-модели, подключите Supabase — инструкция в README проекта.',
            )}
          </p>
        )}
      </section>
    </div>
  )
}
