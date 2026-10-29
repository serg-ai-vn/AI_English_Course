# CONTRACT.md - контракт сайта с бэкендом

> Точка стыковки с платформой (Этап C). Бэкенд делает ровно то, что на репетиции
> делал агент руками: собирает export-конфиг, сэмплит частицы, запускает экспортёр.
> Схема слотов как данные - `slots-config.json`. Образцы конфигов - `*-export.json`.

## Пайплайн (4 шага)

```
Занятие 2: тексты ученика ──┐
Занятие 3: картинки ────────┼─> <name>-export.json ─> export-site.ps1 ─> dist/<name>.html
Занятие 3: avatar.png ──> sample-particles.ps1 ─> *-particles.js ┘   (один автономный файл)
Занятие 4: настроение ──> theme id (маппинг по moodWords из slots-config.json)
```

## 1. Export-конфиг (`<name>-export.json`)

Вход экспортёра. Все пути - относительно корня трека (`Kimi K3/`).

```json
{
  "name": "ziggy",                        // alias ученика, только для имени файла dist/<name>.html
  "pageTitle": "Ziggy's POW! Zone",       // <title> вкладки
  "theme": "comic-pop",                   // один из 6 id (см. п.3)
  "slots":   { "site-title": "...", "about-me": "<p>...</p>", "...": "..." },
  "images":  { "avatar": { "src": "rehearsal/assets/ziggy-avatar.png", "alt": "..." }, "...": {} },
  "particles": { "avatar": "rehearsal/assets/ziggy-avatar-particles.js" }
}
```

- Ключи `slots` и `images` = значения атрибутов `data-slot` в `index.html`.
  Полный список (13 текстовых + 5 картинок), обязательность, лимиты и спеки - в `slots-config.json`.
- Текстовые слоты - plain text; единственное исключение `about-me` (обёрнут в `<p>`).
- `footer-text` необязателен: если ключа нет, остаётся дефолт шаблона.

## 2. SITE_DATA (что реально попадает в страницу)

`tools/fill-slots.js` читает `window.SITE_DATA` и заполняет слоты синхронно,
до первой отрисовки (placeholder-контент не мелькает). Тот же файл можно
переиспользовать для live-страницы ученика в платформе.

```js
window.SITE_DATA = {
  theme: "comic-pop",                     // -> data-theme на <html>
  pageTitle: "Ziggy's POW! Zone",         // -> document.title
  slots:  { "site-title": "...", ... },   // -> innerHTML элемента [data-slot="..."]
  images: { "avatar": { src, alt }, ... } // -> вставляется <img> в слот
}
```

Нюансы:
- Значение слота-массива превращается в список `<li>` (наследие вырезанных mood-tags;
  текущий шаблон массивов не использует, но поведение сохранено).
- `src` картинки - URL или data-URI; экспортёр подставляет base64 data-URI,
  если не передан `-KeepImageUrls`.
- Экспортёр экранирует `</` -> `<\/` в JSON, чтобы литерал `</script>` в тексте
  ученика не сломал инлайн.

## 3. Тема

6 пресетов, выставляется атрибутом `data-theme` на `<html>`:
`sunny-day`, `ocean-calm`, `forest-explorer`, `comic-pop`, `comet-trail`, `deep-focus`.

- В экспортированном файле тема зашита дважды: атрибут в HTML + `SITE_DATA.theme`.
- Выбор темы (занятие 4): настроение ученика маппится на id по `moodWords`
  из `slots-config.json` (та же таблица, что в `../16_source_theme_presets.md`).
- Вся персонализация темы - только через пресет; произвольных цветов у ученика нет.

## 4. Particle-JSON

Генерируется заранее на сервере, устройство пиксели не сэмплит:

```
powershell -File tools\sample-particles.ps1 -Source <avatar.png> -Out <out.js> -SlotName avatar -Step 4
```

Формат выходного файла:

```js
window.PARTICLE_DATA = window.PARTICLE_DATA || {};
window.PARTICLE_DATA['avatar'] = { w: 256, h: 256, step: 4, points: [[x, y, luminance], ...] };
```

- `points`: координаты пикселей сетки с шагом `step`; пиксели с alpha < 128 пропущены
  (форма частиц повторяет силуэт PNG-аватара).
- `luminance` - 0-255. **Важно:** `particles.js` делит его на 100, значения > 100
  насыщаются (частицы ярче/крупнее). Это одобренный в галерее вид, не "чинить"
  нормализацией в 0-100.
- Рантайм: сборка односторонняя, ~1900 мс, затем показывается настоящее <img>,
  цикл останавливается. Бюджеты частиц 700/1400/3000 по железу; fallback-и -
  reduced-motion, нет canvas 2d (CSS blur+scale), нет данных (plain image).
- Ключ объекта (`avatar`) = `data-slot` слота с маркером `data-particle-src`.

## 5. Экспорт

```
powershell -File tools\export-site.ps1 -Config <name>-export.json [-Out dist\<name>.html] [-KeepImageUrls]
```

| Флаг | Зачем |
|---|---|
| `-Config` | Путь к export-конфигу (по умолчанию `demo-export.json`) |
| `-Out` | Куда писать (по умолчанию `dist\<name>.html`) |
| `-KeepImageUrls` | Не встраивать base64, оставить `src` как есть. Для живого предпросмотра в платформе; семье всегда отдавать со встроенными картинками (файл работает по `file://`) |

Экспортёр инлайнит CSS + 5 JS-модулей + SITE_DATA + particle-JS в один HTML.
Если блок скриптов в `index.html` изменился - экспортёр падает с понятной ошибкой
(страховка от рассинхрона шаблона и экспортёра).

## 6. Что делает бэкенд (эквивалент ручных действий агента)

1. Принимает артефакты занятий 2-4, валидирует по `slots-config.json`
   (required, maxLength, html только в `about-me`, спеки картинок, контент-правила).
2. Сжимает/ресайзит картинки под спеки (1600x900 q~82 фон, 256x256 PNG аватар,
   640x480 хобби).
3. Сэмплит аватар в particle-JS (порт `sample-particles.ps1` или вызов скрипта).
4. Маппит настроение на theme id.
5. Собирает export-конфиг, запускает экспортёр, отдаёт `dist/<name>.html`.
6. Для живого предпросмотра - тот же шаблон + `fill-slots.js` с SITE_DATA
   напрямую, без экспорта.
