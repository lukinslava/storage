# Маленький музей

Приложение для хранения рисунков и поделок Кирилла и Марка.

- **Рисунок:** сфотографировать → приложение само находит лист на фото, выравнивает перспективу и вырезает. Углы можно поправить вручную.
- **Поделка:** сфотографировать с нескольких сторон → фото сохраняются, из первых четырёх строится 3D-модель, её можно вращать пальцем и смотреть в AR на iPhone.
- У каждой работы есть автор (Кирилл, Марк или «вместе»), дата и подпись. Дату добавления приложение ставит само. Можно добавить заметку и положить работу в коллекцию.
- Разделы: **Музей** (карусель в рамках), **Коллекции** (цветные папки), **Скан**, **История** (лента по месяцам), **Настройки**.

Это веб-приложение (PWA). На iPhone его открывают в Safari и добавляют на домашний экран через «Поделиться → На экран „Домой“». Дальше оно работает как обычное приложение.

## Два режима хранения

| | Локальный | Облако (Supabase) |
|---|---|---|
| Где хранятся работы | только в этом браузере | в Supabase, видно со всех устройств |
| Нужна настройка | нет | да, см. ниже |
| 3D-модели | нет | да (через Meshy) |

По умолчанию приложение подключено к семейному проекту Supabase (`src/lib/store/index.ts`). Для локального режима запустите с `VITE_SUPABASE_URL=local`, например `VITE_SUPABASE_URL=local npm run dev`. В этом режиме при очистке данных Safari всё пропадёт.

## Запуск на компьютере

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # тесты поиска листа и выравнивания
npm run build    # сборка в dist/
```

Чтобы открыть с телефона в той же Wi-Fi-сети, запустите `npm run dev -- --host`. Камера в браузере требует HTTPS, поэтому полноценно снимать удобнее уже с опубликованной версии.

## Подключение облака (Supabase)

1. Создайте проект на [supabase.com](https://supabase.com) (бесплатного тарифа хватит).
2. Откройте **SQL Editor**, вставьте и выполните содержимое файла `supabase/migrations/0001_init.sql`. Он создаст таблицы, детей (Кирилл и Марк), приватное хранилище `art` и правила доступа.
3. Создайте аккаунты родителей в **Authentication → Users → Add user**, с почтой и паролем и галочкой *Auto Confirm User*.
4. Разрешите этим почтам доступ, выполнив в SQL Editor:
   ```sql
   insert into public.family (email) values ('mama@example.com'), ('papa@example.com');
   ```
   Доступ есть только у почт из таблицы `family`. Для надёжности выключите регистрацию: **Authentication → Sign In / Providers → Allow new users to sign up**.
5. Адрес и publishable key уже прописаны в `src/lib/store/index.ts`. Для другого проекта задайте их в `.env.local`, взяв за образец `.env.example`:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```

## 3D-модели поделок (Meshy)

3D-модели строит сервис [Meshy](https://www.meshy.ai) (Multi-Image to 3D, от 1 до 4 фото). API-ключ хранится только на сервере, в Supabase Edge Function, и в приложение не попадает.

1. Получите API-ключ в Meshy: Settings → API. Сервис платный и тратит кредиты на каждую модель.
2. Получите токен Supabase: https://supabase.com/dashboard/account/tokens → **Generate new token**.
3. Добавьте оба значения в GitHub: **Settings → Secrets and variables → Actions → New repository secret**, с именами `MESHY_API_KEY` и `SUPABASE_ACCESS_TOKEN`.
4. Запустите workflow **3D models (Supabase function)** во вкладке **Actions** (кнопка *Run workflow*). Он проверит ключ Meshy, сохранит его в Supabase и опубликует функцию `generate-3d`. Дальше функция публикуется сама при каждом её изменении.

   То же самое вручную через [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   supabase secrets set --project-ref <id-проекта> MESHY_API_KEY=msy_...
   supabase functions deploy generate-3d --project-ref <id-проекта> --no-verify-jwt
   ```
5. Дальше при сохранении поделки отметьте «Создать 3D-модель». Модель строится несколько минут. Приложение само проверяет готовность и сохраняет `.glb` в ваше хранилище.

Проверить связку с Meshy, не заходя в приложение, можно так (тратит кредиты на одну модель):

```bash
MESHY_API_KEY=msy_... deno run --allow-net --allow-env supabase/functions/generate-3d/smoke.ts
```

То же самое делает workflow **3D models** при ручном запуске.

Чтобы модель получилась хорошей, поставьте поделку на однотонный фон, снимайте при ровном свете и обходите её по кругу: спереди, сбоку, сзади, с другой стороны.

## Публикация на GitHub Pages

В репозитории уже есть workflow `.github/workflows/deploy.yml`. Он собирает и публикует приложение при каждом пуше в основную ветку.

1. **Settings → Pages → Source:** выберите *GitHub Actions*.
2. Настраивать переменные не нужно: адрес Supabase уже в коде. Для другого проекта задайте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` в **Settings → Secrets and variables → Actions → Variables**.
3. Приложение откроется по адресу `https://<логин>.github.io/storage/`.

Для приватного репозитория GitHub Pages доступен только на платных тарифах. Альтернатива: Vercel или Netlify. Там импортируйте репозиторий и задайте те же две переменные.

## Устройство проекта

```
src/
  lib/image/geometry.ts   поиск листа на фото и выравнивание перспективы (без зависимостей, с тестами)
  lib/image/canvas.ts     работа с фото в браузере: уменьшение, вырезание, миниатюры
  lib/store/              хранилище: local.ts (IndexedDB) и cloud.ts (Supabase)
  lib/data.tsx            общее состояние приложения
  pages/                  экраны: Музей, Коллекции, Скан, История, Настройки, карточка работы
  components/             рамки, папки, редактор углов, 3D-просмотр, форма
supabase/
  migrations/0001_init.sql        схема базы и права
  functions/generate-3d/index.ts  построение 3D через Meshy
```
