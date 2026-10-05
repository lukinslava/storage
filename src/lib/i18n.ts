// Язык интерфейса: русский (по умолчанию) или английский.
// Ключ перевода — сама русская строка, поэтому в коде видно, что написано на экране.

export type Lang = 'ru' | 'en'

const STORAGE_KEY = 'lang'

function detect(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'ru' || v === 'en') return v
  } catch {
    /* хранилище недоступно — остаёмся на русском */
  }
  return 'ru'
}

export const lang: Lang = detect()
if (typeof document !== 'undefined') document.documentElement.lang = lang

export function setLang(next: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* не сохранилось — язык сменится только до перезагрузки */
  }
  location.reload()
}

const EN: Record<string, string> = {
  // Разделы
  'Музей': 'Museum',
  'Коллекции': 'Collections',
  'Скан': 'Scan',
  'История': 'Story',
  'Настройки': 'Settings',
  'Разделы': 'Sections',
  // Общее
  'Назад': 'Back',
  'Изменить': 'Edit',
  'Удалить': 'Delete',
  'Закрыть': 'Close',
  'Отмена': 'Cancel',
  'Сохранить': 'Save',
  'Создать': 'Create',
  'Сохраняю…': 'Saving…',
  'Вместе': 'Together',
  'Все': 'All',
  'Работа': 'Artwork',
  'Без названия': 'Untitled',
  'Поделка': 'Craft',
  'Фото': 'Photos',
  'Фото {n}': 'Photo {n}',
  'Кирилл': 'Kirill',
  'Марк': 'Mark',
  // Музей
  'Фильтр': 'Filter',
  'Всё': 'Everything',
  'Рисунки': 'Drawings',
  'Поделки': 'Crafts',
  'Работы': 'Artworks',
  'Юный художник.': 'Small artist.',
  'Большой вернисаж.': 'Grand opening.',
  '{works} в музее': '{works} in the museum',
  'Повесить работу': 'Hang artwork',
  // Коллекции
  'Маленькие миры.': 'Little worlds.',
  'Все вместе.': 'Kept together.',
  'Новая коллекция': 'New collection',
  'Коллекция': 'Collection',
  'Название': 'Name',
  'Котики': 'Kitties',
  'Цвет': 'Color',
  'Коллекция не найдена.': 'Collection not found.',
  'К коллекциям': 'Back to collections',
  'Пока пусто. Выберите эту коллекцию, когда будете добавлять работу.':
    'Nothing here yet. Pick this collection when you add an artwork.',
  'Удалить коллекцию?': 'Delete collection?',
  'Коллекция «{name}» исчезнет, а работы из неё останутся в музее.':
    'The “{name}” collection will be removed. Its artworks stay in the museum.',
  'Удалить коллекцию': 'Delete collection',
  'Розовый': 'Pink',
  'Зелёный': 'Green',
  'Голубой': 'Blue',
  'Песочный': 'Sand',
  'Сиреневый': 'Lilac',
  'Персиковый': 'Peach',
  // История
  'Каждая работа —': 'Every piece is',
  'страничка истории.': 'a page of the story.',
  'Добавить первую': 'Add the first one',
  // Форма работы
  'Что нарисовано': 'What’s in the drawing',
  'Что за поделка': 'What’s the craft',
  'Котик на траве': 'Kitten on the grass',
  'Замок из пластилина': 'Clay castle',
  'Чья работа': 'Artist',
  'Дата': 'Date',
  'Без коллекции': 'No collection',
  'Заметка': 'Note',
  'Что рассказал автор': 'What the artist said',
  // Скан
  'Рисунок': 'Drawing',
  'Сфотографируйте лист или вырезанную фигурку — приложение само найдёт края и уберёт фон.':
    'Photograph a sheet or a cut-out figure. The app finds the edges and removes the background.',
  'Снять': 'Take photo',
  'Из галереи': 'From library',
  'Сфотографируйте её с нескольких сторон.': 'Photograph it from several sides.',
  ' Из фото получится 3D-модель.': ' The photos become a 3D model.',
  'Начать': 'Start',
  'Как вырезать': 'How to cut out',
  'Лист': 'Sheet',
  'По контуру': 'Outline',
  'Лист найден. Если нужно — подвиньте углы.': 'Sheet found. Drag the corners if needed.',
  'Не удалось найти лист — перетащите углы вручную.': 'Couldn’t find the sheet. Drag the corners into place.',
  'Весь кадр': 'Whole photo',
  'Вырезать': 'Crop',
  'Фон убран. Если пропали кусочки работы — сдвиньте ползунок влево, если остался стол — вправо.':
    'Background removed. If parts of the artwork are missing, move the slider left; if some table is left, move it right.',
  'Не получилось отделить работу от фона. Сдвиньте ползунок или сфотографируйте на однотонном фоне.':
    'Couldn’t separate the artwork from the background. Move the slider or shoot it on a plain background.',
  'Бережнее': 'Gentler',
  'Смелее': 'Bolder',
  'Сколько фона убирать': 'How much background to remove',
  'Готово': 'Done',
  'Вырезанный рисунок': 'Cropped drawing',
  'Повернуть': 'Rotate',
  'Повесить в музей': 'Hang in the museum',
  'Фото со всех сторон': 'Photos from every side',
  'Поставьте поделку на однотонный фон и снимите её со всех сторон при хорошем свете.':
    'Put the craft on a plain background and shoot it from every side in good light.',
  ' Для 3D используются первые 4 фото.': ' The first 4 photos are used for 3D.',
  'Спереди': 'Front',
  'Сбоку': 'Side',
  'Сзади': 'Back',
  'С другой стороны': 'Other side',
  'Убрать фото': 'Remove photo',
  'Ещё фото': 'More photos',
  'Дальше': 'Next',
  'Обложка поделки': 'Craft cover',
  'Сохранить в музей': 'Save to the museum',
  'Создать 3D-модель': 'Create 3D model',
  'Займёт несколько минут, можно закрыть приложение': 'Takes a few minutes; you can close the app',
  'Работа без фона': 'Artwork without background',
  'Ищу рисунок…': 'Looking for the artwork…',
  'Обрабатываю фото…': 'Processing photos…',
  'Загружаю фото…': 'Uploading photos…',
  'Отправляю на 3D…': 'Sending to 3D…',
  // Карточка работы
  'Загружаю 3D…': 'Loading 3D…',
  '3D-модели появятся, когда будет подключено облако (см. Настройки).':
    '3D models will appear once the cloud is connected (see Settings).',
  '3D-модель создаётся. Обычно это занимает 2–5 минут.': 'Building the 3D model. This usually takes 2–5 minutes.',
  'Не получилось: {error}': 'Didn’t work: {error}',
  'неизвестная ошибка': 'unknown error',
  'Попробовать снова': 'Try again',
  'Работа не найдена.': 'Artwork not found.',
  'В музей': 'To the museum',
  '{title}, фото {n}': '{title}, photo {n}',
  'Добавлено {date}': 'Added {date}',
  'Удалить работу?': 'Delete artwork?',
  '«{title}» пропадёт из музея вместе с фото. Это нельзя отменить.':
    '“{title}” and its photos will be removed from the museum. This can’t be undone.',
  // Настройки
  'Имя': 'Name',
  'Художники': 'Artists',
  'рисунков': 'drawings',
  'поделок': 'crafts',
  '3D-моделей': '3D models',
  'Хранилище': 'Storage',
  'Работы хранятся в облаке (Supabase) и доступны с любого устройства после входа.':
    'Artworks are stored in the cloud (Supabase) and available on any device after signing in.',
  'Выйти': 'Sign out',
  'Сейчас работы хранятся только в этом браузере. Чтобы они были в облаке и появились 3D-модели, подключите Supabase — инструкция в README проекта.':
    'Artworks are stored only in this browser for now. To keep them in the cloud and get 3D models, connect Supabase (see the project README).',
  'Язык': 'Language',
  // Вход
  'Маленький': 'Little',
  'музей.': 'museum.',
  'Почта': 'Email',
  'Пароль': 'Password',
  'Войти': 'Sign in',
  'Вхожу…': 'Signing in…',
  'Неверная почта или пароль': 'Wrong email or password',
  // Ошибки
  '3D-модели доступны только при подключённом облаке (Supabase).': '3D models need the cloud (Supabase) to be connected.',
}

/** Строка интерфейса на текущем языке. `{name}` в строке заменяется значением из `vars`. */
export function tr(ru: string, vars?: Record<string, string | number>): string {
  let s = lang === 'en' ? (EN[ru] ?? ru) : ru
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

/** Все ключи словаря — для теста на полноту перевода. */
export const EN_KEYS = Object.keys(EN)
