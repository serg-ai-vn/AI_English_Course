# TASK-02: Кроссплатформенный сборщик сайтов на чистом Node.js (Отказ от Windows PowerShell)

## Контекст задачи
Сейчас сборка финального сайта ученика (`runExport` в `platform/server.js`) вызывает `powershell.exe` для выполнения двух скриптов:
1. `tools/sample-particles.ps1` (использует Windows `.NET System.Drawing.Bitmap` для чтения пикселей картинки и генерации сетки точек `window.PARTICLE_DATA`).
2. `tools/export-site.ps1` (склеивает `index.html`, `styles.css`, JS-модули, `SITE_DATA` и кодирует картинки в `base64` data URI).

На любом облачном Linux-сервере (Ubuntu/Debian/Alpine в Railway, Render, DigitalOcean, Docker) нет `powershell.exe` и `System.Drawing`. Чтобы развернуть платформу на сервере и ускорить сборку в 50 раз, нужно заменить оба PowerShell-скрипта на **чистый кроссплатформенный Node.js-модуль `tools/site-builder.js`**, строго соблюдая контракт `docs/CONTRACT.md` и `slots-config.json`.

## Файлы для чтения и изменения
1. `docs/CONTRACT.md` и `slots-config.json` (прочитать контракт частиц и экспорта!)
2. `tools/export-site.ps1` (прочитать логику для точного переноса)
3. `tools/sample-particles.ps1` (прочитать логику для точного переноса)
4. `tools/site-builder.js` (создать новый файл)
5. `platform/server.js` (заменить вызовы `runPs(...)` в `runExport` / `proceedExport` на вызов функций из `tools/site-builder.js`)

---

## Техническое решение

### 1. Создать модуль `tools/site-builder.js`
Модуль должен работать на чистом Node.js (встроенные модули `fs`, `path`, `zlib`, без внешних C++ зависимостей) и экспортировать две функции: `sampleParticles(options)` и `exportSite(options)`.

#### А. Функция `exportSite({ rootDir, configPath, outPath, keepImageUrls = false })`
1. Читает JSON-конфигурацию экспорта (`configPath`).
2. Читает шаблонные файлы из `rootDir` в кодировке UTF-8:
   - `index.html`, `styles.css`, `motion.js`, `particles.js`, `flight.js`, `carousel.js`, `tools/fill-slots.js`.
3. Обрабатывает словарь изображений `cfg.images`:
   - Если `!keepImageUrls`, читает каждый файл изображения (`fs.readFileSync(path.join(rootDir, src))`), определяет MIME-тип по расширению (`.jpg`/`.jpeg` -> `image/jpeg`, `.png` -> `image/png`, `.webp` -> `image/webp`, `.gif` -> `image/gif`, `.svg` -> `image/svg+xml`) и преобразует в строку `data:${mime};base64,${b64}`.
4. Формирует объект `siteData = { theme: cfg.theme, pageTitle: cfg.pageTitle, slots: cfg.slots, images }`.
5. Сериализует `siteDataJson = JSON.stringify(siteData).replace(/<\//g, '<\\/')` (защита от закрытия тега `</script>`).
6. Собирает JS-код частиц `particleJs`, читая файлы, указанные в `cfg.particles` (относительно `rootDir`).
7. Выполняет замены в `html`:
   - Заменяет `<html lang="en" data-theme="sunny-day">` на `<html lang="en" data-theme="${cfg.theme}">`.
   - Заменяет `<title>My AI Site</title>` на `<title>${escapeHtml(cfg.pageTitle)}</title>`.
   - Заменяет `  <link rel="stylesheet" href="styles.css">` на `  <style>\n${css}\n  </style>`.
   - Заменяет блок внешних `<script src="..."></script>` (нормализуя `\r\n` и `\n` переводы строк, чтобы работало одинаково на Windows и Linux!) на встроенные `<script>` блоки в точном порядке: `window.SITE_DATA`, `fill-slots.js`, `particleJs`, `motion.js`, `particles.js`, `flight.js`, `carousel.js`. Если блок скриптов в шаблоне не найден — выбрасывает понятную ошибку `Error('Template script block not found in index.html')`.
8. Записывает готовый файл в `outPath` (UTF-8) и возвращает `{ outPath, sizeBytes, sizeKb }`.

#### Б. Функция `sampleParticles({ sourcePath, outPath, slotName = 'avatar', step = 4 })`
- **СТРОГОЕ ТРЕБОВАНИЕ КОНТРАКТА (`docs/CONTRACT.md` §4 и `slots-config.json`):**
  - **ЗАПРЕЩЕНО** генерировать фейковые/процедурные точки «по хешу буфера»! Частицы на сайте ученика обязаны повторять **реальный силуэт и яркость пикселей** PNG-аватара.
  - Реализовать в `tools/site-builder.js` честный декодер PNG на встроенном модуле Node.js `zlib`:
    1. Прочитать заголовок `IHDR` (ширина `w`, высота `h`, `bitDepth`, `colorType`), собрать все чанки `IDAT` и распаковать их через `zlib.inflateSync(idatBuffer)`.
    2. Реконструировать байты сканлайнов PNG с поддержкой всех 5 стандартных PNG-фильтров (`0 = None`, `1 = Sub`, `2 = Up`, `3 = Average`, `4 = Paeth`) для `colorType = 6` (RGBA) и `colorType = 2` (RGB) (плюс базовую поддержку палитры `colorType = 3` через `PLTE`/`tRNS` при наличии).
    3. Если исходный PNG больше `256x256` (например, `1024x1024` от OpenAI в `TASK-03`), приводить сетку координат к виртуальному холсту `256x256` (масштабируя выборку пикселя `srcX = Math.floor(x * srcW / 256)`, `srcY = Math.floor(y * srcH / 256)` с шагом `step = 4` по сетке `256x256`), чтобы бюджет частиц всегда оставался оптимальным для планшетов!
    4. Пропускать прозрачные пиксели с `alpha < 128`.
    5. Вычислять яркость пикселя строго по формуле `const l = Math.round(0.2126 * R + 0.7152 * G + 0.0722 * B)` в диапазоне **`0..255`** (**НЕ нормализовать в `0..100`**, так как `particles.js` сам делит `l / 100` и использует значения `> 100` для эффекта насыщения!).
    6. Записывать результат в `outPath`:
       ```js
       window.PARTICLE_DATA = window.PARTICLE_DATA || {};
       window.PARTICLE_DATA['avatar'] = { w: 256, h: 256, step: 4, points: [[x,y,l], ...] };
       ```
  - Если на вход подан JPEG без альфа-канала (например, `demo-assets/avatar.jpg`) и для него уже существует готовый `demo-assets/avatar-particles.js` или `rehearsal/assets/<student>-avatar-particles.js`, копировать/использовать готовый файл частиц.

### 2. Обновить `runExport` и `proceedExport` в `platform/server.js`
- Убрать функцию `runPs` и вызовы `powershell.exe`.
- Импортировать `const siteBuilder = require('../tools/site-builder.js');`.
- В `runExport` и `proceedExport` вызывать `siteBuilder.sampleParticles(...)` и `siteBuilder.exportSite(...)` напрямую внутри процесса Node.js.
- Добавить CLI-интерфейс в конец `tools/site-builder.js` (`if (require.main === module)`), чтобы сборщик можно было вызывать и из терминала: `node tools/site-builder.js --config demo-export.json`.

---

## Критерии приёмки (Acceptance Criteria)
1. В `platform/server.js` больше нет ни одного вызова `powershell.exe` или `.ps1`.
2. Декодер PNG в `siteBuilder.sampleParticles` на реальном файле `rehearsal/assets/lumi-avatar.png` генерирует массив точек `points: [[x, y, lum], ...]`, совпадающий по силуэту и диапазону яркости (`0..255`) с эталонным `rehearsal/assets/lumi-avatar-particles.js`.
3. Сборка сайта через `POST /api/teacher/build-site` (и `POST /api/teacher/export-site`) отрабатывает менее чем за 200 мс и создаёт валидный автономный файл `dist/<student>.html` со встроенными `base64` картинками, CSS, JS и частицами.
4. Команда `node tools/site-builder.js --config demo-export.json` успешно собирает `dist/mia.html` из терминала.
