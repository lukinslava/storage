import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArtworkForm } from '../components/ArtworkForm'
import { CornerEditor } from '../components/CornerEditor'
import { BackIcon, CameraIcon, CloseIcon, CubeIcon, ImageIcon, PhotoIcon, PlusIcon, RotateIcon } from '../components/Icons'
import { useData } from '../lib/data'
import {
  canvasToBlob,
  cutOut,
  encodeImage,
  prepareDrawing,
  preparePhoto,
  recut,
  renderCutout,
  rotate90,
  type DrawingMode,
  type PreparedDrawing,
} from '../lib/image/canvas'
import type { Cutout } from '../lib/image/cutout'
import { defaultQuad, type Quad } from '../lib/image/geometry'
import { store } from '../lib/store'
import { today, type ArtworkMeta } from '../lib/types'

type CropStep = {
  k: 'crop'
  prep: PreparedDrawing
  mode: DrawingMode
  quad: Quad
  cut: Cutout | null
  sensitivity: number
}

type Step =
  | { k: 'choose' }
  | CropStep
  | { k: 'drawing'; canvas: HTMLCanvasElement; transparent: boolean; preview: string; crop: CropStep }
  | { k: 'craft' }
  | { k: 'craft-details' }

interface Shot {
  canvas: HTMLCanvasElement
  preview: string
}

/** Подпись кадра поделки: съёмку начинают спереди и идут по кругу. */
const shotLabel = (i: number) => (i === 0 ? 'Спереди' : `Кадр ${i + 1}`)
const MAX_PHOTOS = 16

export function Scan() {
  const [step, setStep] = useState<Step>({ k: 'choose' })
  const [shots, setShots] = useState<Shot[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [make3D, setMake3D] = useState(store.can3D)
  const { reload } = useData()
  const navigate = useNavigate()
  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)
  const craftInput = useRef<HTMLInputElement>(null)

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e.message : String(e))
    setBusy(null)
  }

  const onDrawingFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setBusy('Ищу рисунок…')
    try {
      const prep = await prepareDrawing(file)
      setStep({ k: 'crop', prep, mode: prep.mode, quad: prep.quad, cut: prep.cut, sensitivity: 1 })
      setBusy(null)
    } catch (err) {
      fail(err)
    }
  }

  const onCraftFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - shots.length)
    e.target.value = ''
    if (!files.length) return
    setError(null)
    setBusy('Обрабатываю фото…')
    try {
      const added: Shot[] = []
      for (const f of files) {
        const canvas = await preparePhoto(f)
        added.push({ canvas, preview: canvas.toDataURL('image/jpeg', 0.6) })
      }
      setShots((s) => [...s, ...added])
      setBusy(null)
    } catch (err) {
      fail(err)
    }
  }

  const finish = async (id: string) => {
    await reload()
    navigate(`/art/${id}`, { replace: true })
  }

  const saveDrawing = async (canvas: HTMLCanvasElement, transparent: boolean, meta: ArtworkMeta) => {
    setBusy('Сохраняю…')
    try {
      const enc = await encodeImage(canvas, transparent)
      const art = await store.createArtwork('drawing', meta, {
        image: enc.image,
        thumb: enc.thumb,
        aspect: enc.width / enc.height,
        photos: [],
      })
      await finish(art.id)
    } catch (err) {
      fail(err)
    }
  }

  const saveCraft = async (meta: ArtworkMeta) => {
    setBusy('Загружаю фото…')
    try {
      const cover = await encodeImage(shots[0].canvas)
      const photos = await Promise.all(shots.map((s) => canvasToBlob(s.canvas, 0.85)))
      const art = await store.createArtwork('craft', meta, {
        image: cover.image,
        thumb: cover.thumb,
        aspect: cover.width / cover.height,
        photos,
      })
      if (make3D && store.can3D) {
        setBusy('Отправляю на 3D…')
        // Ошибку запуска покажет карточка работы — сама работа уже сохранена.
        await store.start3D(art.id).catch(() => {})
      }
      await finish(art.id)
    } catch (err) {
      fail(err)
    }
  }

  const showDrawing = (canvas: HTMLCanvasElement, transparent: boolean, crop: CropStep) =>
    setStep({
      k: 'drawing',
      canvas,
      transparent,
      crop,
      preview: transparent ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.7),
    })

  const finishCrop = (c: CropStep) => {
    if (c.mode === 'cutout' && c.cut) showDrawing(renderCutout(c.prep.source, c.cut), true, c)
    else showDrawing(cutOut(c.prep.source, c.quad), false, c)
  }

  const back = () => {
    setError(null)
    if (step.k === 'crop' || step.k === 'craft') setStep({ k: 'choose' })
    else if (step.k === 'craft-details') setStep({ k: 'craft' })
    else if (step.k === 'drawing') setStep(step.crop)
  }

  const initialMeta: ArtworkMeta = { title: '', child_id: null, collection_id: null, made_on: today(), notes: '' }

  return (
    <div className="page page--scan">
      <header className="page__head">
        {step.k === 'choose' ? (
          <h1>Скан</h1>
        ) : (
          <button className="icon-btn icon-btn--soft" onClick={back} aria-label="Назад" disabled={!!busy}>
            <BackIcon width={20} height={20} />
          </button>
        )}
      </header>

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onDrawingFile} />
      <input ref={libraryInput} type="file" accept="image/*" hidden onChange={onDrawingFile} />
      <input ref={craftInput} type="file" accept="image/*" multiple hidden onChange={onCraftFiles} />

      {step.k === 'choose' && (
        <>
          <div className="choose">
            <div className="choose__card tint-sand">
              <PhotoIcon width={36} height={36} />
              <h2>Рисунок</h2>
              <p>Сфотографируйте лист или вырезанную фигурку — приложение само найдёт края и уберёт фон.</p>
              <div className="choose__actions">
                <button className="btn btn--primary" onClick={() => cameraInput.current?.click()} disabled={!!busy}>
                  <CameraIcon width={20} height={20} /> Снять
                </button>
                <button className="btn btn--ghost" onClick={() => libraryInput.current?.click()} disabled={!!busy}>
                  <ImageIcon width={20} height={20} /> Из галереи
                </button>
              </div>
            </div>
            <div className="choose__card tint-green">
              <CubeIcon width={36} height={36} />
              <h2>Поделка</h2>
              <p>
                Сфотографируйте её по кругу, и её можно будет крутить пальцем.
                {store.can3D ? ' Из фото получится 3D-модель.' : ''}
              </p>
              <div className="choose__actions">
                <button className="btn btn--primary" onClick={() => setStep({ k: 'craft' })} disabled={!!busy}>
                  <CameraIcon width={20} height={20} /> Начать
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {step.k === 'crop' && (
        <div className="stack">
          <div className="segmented" role="radiogroup" aria-label="Как вырезать">
            <button
              role="radio"
              aria-checked={step.mode === 'sheet'}
              className={'seg' + (step.mode === 'sheet' ? ' seg--on' : '')}
              onClick={() => setStep({ ...step, mode: 'sheet' })}
            >
              Лист
            </button>
            <button
              role="radio"
              aria-checked={step.mode === 'cutout'}
              className={'seg' + (step.mode === 'cutout' ? ' seg--on' : '')}
              onClick={() => setStep({ ...step, mode: 'cutout' })}
            >
              По контуру
            </button>
          </div>

          {step.mode === 'sheet' ? (
            <>
              <p className="muted">
                {step.prep.detected
                  ? 'Лист найден. Если нужно — подвиньте углы.'
                  : 'Не удалось найти лист — перетащите углы вручную.'}
              </p>
              <CornerEditor source={step.prep.source} quad={step.quad} onChange={(quad) => setStep({ ...step, quad })} />
              <div className="row">
                <button
                  className="btn btn--ghost"
                  onClick={() =>
                    setStep({ ...step, quad: defaultQuad(step.prep.source.width, step.prep.source.height, 0) })
                  }
                >
                  Весь кадр
                </button>
                <button className="btn btn--primary" onClick={() => finishCrop(step)}>
                  Вырезать
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">
                {step.cut
                  ? 'Фон убран. Если пропали кусочки работы — сдвиньте ползунок влево, если остался стол — вправо.'
                  : 'Не получилось отделить работу от фона. Сдвиньте ползунок или сфотографируйте на однотонном фоне.'}
              </p>
              <CutoutPreview small={step.prep.small} cut={step.cut} />
              <label className="slider">
                <span>Бережнее</span>
                <input
                  type="range"
                  min={0.5}
                  max={1.6}
                  step={0.05}
                  value={step.sensitivity}
                  onChange={(e) => {
                    const sensitivity = Number(e.target.value)
                    setStep({ ...step, sensitivity, cut: recut(step.prep.small, sensitivity) })
                  }}
                  aria-label="Сколько фона убирать"
                />
                <span>Смелее</span>
              </label>
              <button className="btn btn--primary btn--wide" disabled={!step.cut} onClick={() => finishCrop(step)}>
                Готово
              </button>
            </>
          )}
        </div>
      )}

      {step.k === 'drawing' && (
        <div className="stack">
          <div className={'preview' + (step.transparent ? ' preview--cutout' : '')}>
            <img src={step.preview} alt="Вырезанный рисунок" />
            <button
              className="icon-btn icon-btn--soft preview__rotate"
              onClick={() => showDrawing(rotate90(step.canvas), step.transparent, step.crop)}
              aria-label="Повернуть"
            >
              <RotateIcon width={20} height={20} />
            </button>
          </div>
          <ArtworkForm
            kind="drawing"
            initial={initialMeta}
            submitLabel="Повесить в музей"
            busy={!!busy}
            onSubmit={(meta) => saveDrawing(step.canvas, step.transparent, meta)}
          />
        </div>
      )}

      {step.k === 'craft' && (
        <div className="stack">
          <h2 className="step-title">Фото со всех сторон</h2>
          <p className="muted">
            Поставьте поделку на однотонный фон. Начните спереди и обходите её вправо по кругу, делая снимок примерно
            каждые 30°, на одной высоте и расстоянии. Из 8–12 кадров поделку можно будет крутить пальцем.
            {store.can3D ? ' Для 3D из них выберутся четыре ракурса: спереди, слева, сзади и справа.' : ''}
          </p>
          <div className="shots">
            {shots.map((s, i) => (
              <div key={i} className="shot">
                <img src={s.preview} alt={shotLabel(i)} />
                <span className="shot__label">{shotLabel(i)}</span>
                <button
                  className="shot__remove"
                  onClick={() => setShots((list) => list.filter((_, j) => j !== i))}
                  aria-label="Убрать фото"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </div>
            ))}
            {shots.length < MAX_PHOTOS && (
              <button className="shot shot--add" onClick={() => craftInput.current?.click()} disabled={!!busy}>
                <PlusIcon width={28} height={28} />
                <span>{shotLabel(shots.length)}</span>
              </button>
            )}
          </div>
          <button
            className="btn btn--primary btn--wide"
            disabled={!shots.length || !!busy}
            onClick={() => setStep({ k: 'craft-details' })}
          >
            Дальше
          </button>
        </div>
      )}

      {step.k === 'craft-details' && (
        <div className="stack">
          <div className="preview">
            <img src={shots[0]?.preview} alt="Обложка поделки" />
          </div>
          <ArtworkForm
            kind="craft"
            initial={initialMeta}
            submitLabel="Сохранить в музей"
            busy={!!busy}
            onSubmit={saveCraft}
            extra={
              store.can3D ? (
                <label className="check">
                  <input type="checkbox" checked={make3D} onChange={(e) => setMake3D(e.target.checked)} />
                  <span>
                    Создать 3D-модель
                    <small>Займёт несколько минут, можно закрыть приложение</small>
                  </span>
                </label>
              ) : null
            }
          />
        </div>
      )}

      {busy && (
        <div className="busy" role="status">
          <span className="spinner" /> {busy}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

/** Предпросмотр вырезки по контуру (на уменьшенной копии — быстро пересчитывается). */
function CutoutPreview({ small, cut }: { small: HTMLCanvasElement; cut: Cutout | null }) {
  const url = useMemo(() => (cut ? renderCutout(small, cut).toDataURL('image/png') : null), [small, cut])
  return (
    <div className="preview preview--cutout preview--tall">
      {url ? <img src={url} alt="Работа без фона" /> : <img src={small.toDataURL('image/jpeg', 0.7)} alt="Фото" />}
    </div>
  )
}
