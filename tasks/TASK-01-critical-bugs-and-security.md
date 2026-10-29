# TASK-01: Устранение критических багов экспорта, анимаций, гейтинга L3 и уязвимостей безопасности (P0/P1)

## Контекст задачи
При аудите Baseline-версии выявлены 7 конкретных технических проблем в `platform/server.js`, `motion.js`, `tools/fill-slots.js` и `platform/validate.js`. Их необходимо устранить первым коммитом после инициализации репозитория, не нарушая пользовательский флоу уроков и инварианты из `docs/SYSTEM_INVARIANTS.md`.

## Файлы для чтения и изменения
1. `docs/SYSTEM_INVARIANTS.md` (прочитать перед правками!)
2. `motion.js`
3. `tools/fill-slots.js`
4. `platform/server.js`
5. `platform/validate.js`

---

## Пошаговый план исправлений

### 1. Починить синтаксическую ошибку (`SyntaxError`) в `motion.js`
- **Проблема:** В конце цикла `Letter Reveal` в `motion.js` (строки 41–44) дважды закрыт блок цикла:
  ```js
      el.appendChild(frag);
    });
      el.appendChild(frag);
    });
  ```
  Из-за лишнего `el.appendChild(frag); });` браузер выбрасывает `Uncaught SyntaxError: Unexpected token ')'`, и все скролл-анимации (`Fade & Rise`, `Side Slide`, `Letter Reveal`) на сайте ученика отключаются.
- **Исправление:** Удалить дублирующиеся строки 43–44 в `motion.js`, чтобы цикл закрывался один раз перед блоком `IntersectionObserver`.

### 2. Починить потерю текстов Урока 2 (`About Me` и `Hobbies`) при сборке сайта (`runExport` в `platform/server.js`)
- **Проблема:** В функции `runExport` (`platform/server.js`, строки 1196–1202) при сборе текстовых полей из `lessons[2].fields` стоит устаревшее условие:
  ```js
  var slots = {};
  (lessons[2].fields || []).forEach(function (f) {
    if (f.input !== 'direct' && f.input !== 'ai-cycle') return;
    if (!l2fields[f.id] || l2fields[f.id].status !== 'done') return;
    var v = String(l2fields[f.id].value || '');
    if (f.id === 'about-me' && v.indexOf('<p>') !== 0) v = '<p>' + v + '</p>';
    slots[f.id] = v;
  });
  ```
  В актуальном `platform/config/lesson-2.json` поле `about-me` имеет тип `ai-text-3step`, а поля `hobby-text-1`, `hobby-text-2`, `hobby-text-3` — тип `ai-cycle-bonus`. Из-за этого все 4 текста пропускаются при сборке, и в итоговом сайте остаются шаблонные заглушки про девочку Mia. Кроме того, если в `tools/fill-slots.js` перевести вставку на безопасный `textContent` (см. п. 4), то сырая обёртка `'<p>' + v + '</p>'` в `server.js` выведется на экран как видимые символы `<p>`.
- **Исправление:** В `runExport` (`platform/server.js`, строки 1195–1202) заменить блок сборки `slots` на:
  ```js
  var slots = {};
  var TEXT_INPUT_TYPES = { 'direct': true, 'ai-cycle': true, 'ai-text-3step': true, 'ai-cycle-bonus': true };
  (lessons[2].fields || []).forEach(function (f) {
    if (!TEXT_INPUT_TYPES[f.input]) return;
    if (!l2fields[f.id] || l2fields[f.id].status !== 'done') return;
    var v = String(l2fields[f.id].value || '');
    /* Передаём чистый текст без сырых HTML-тегов <p>;
       сам DOM-элемент <p> безопасно создаст tools/fill-slots.js */
    v = v.replace(/^<p>/i, '').replace(/<\/p>$/i, '');
    slots[f.id] = v;
  });
  ```

### 3. Закрыть неавторизованное чтение служебных файлов через `/preview/` (`T01` в `platform/server.js`)
- **Проблема:** Функция `servePreview(req, res, urlPath)` (строка 1553 в `platform/server.js`) раздаёт любые файлы от корня `TRACK_ROOT` без ограничений. Запрос `GET /preview/platform/data/sessions.json` возвращает `200 OK` и раскрывает все активные токены сессий.
- **Исправление:**
  1. Разрешить `servePreview` отдавать файлы **только** из безопасного белого списка директорий и шаблонных файлов:
     - подпапки: `dist/`, `demo-assets/`, `rehearsal/assets/`, `platform/public/generated/` (и `generated/`);
     - корневые файлы шаблона для live-превью: `index.html`, `particle-demo.html`, `styles.css`, `motion.js`, `particles.js`, `flight.js`, `carousel.js`, `dev-preview.js`.
  2. Любые обращения к `/preview/platform/data/`, `/preview/platform/config/`, `/preview/platform/server.js`, `/preview/tools/`, `/preview/tasks/`, `/preview/docs/`, `.env`, `.git` или `*.json` должны немедленно возвращать `403 Forbidden`.
  3. Проверять нормализованный путь через `path.relative`, убеждаясь, что он не содержит выхода за пределы разрешённой папки (`..`).

### 4. Устранить DOM XSS в `tools/fill-slots.js` без поломки тега `<p>` в слоте `about-me` (`T03`)
- **Проблема:** В `tools/fill-slots.js` (строки 35–40) пользовательские строки присваиваются через `el.innerHTML = v` без экранирования HTML-сущностей. При этом по контракту шаблона (`index.html` + `CONTRACT.md` §1) внутри `<div data-slot="about-me">` текст должен лежать внутри тега `<p>`.
- **Исправление:** Заменить цикл заполнения текстовых слотов в `tools/fill-slots.js` на безопасную работу с DOM-узлами:
  ```js
  var slots = d.slots || {};
  Object.keys(slots).forEach(function (name) {
    var el = document.querySelector('[data-slot="' + name + '"]');
    if (!el) return;
    var v = slots[name];
    el.textContent = '';
    if (Object.prototype.toString.call(v) === '[object Array]') {
      v.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = String(item || '');
        el.appendChild(li);
      });
    } else if (name === 'about-me') {
      var clean = String(v || '').replace(/^<p>/i, '').replace(/<\/p>$/i, '');
      var p = document.createElement('p');
      p.textContent = clean;
      el.appendChild(p);
    } else {
      el.textContent = String(v || '');
    }
  });
  ```

### 5. Проверять `unlockedLessons` во всех изменяющих API-хендлерах ученика (`T04` в `platform/server.js`)
- **Проблема:** Хендлер `handleLessonSwitch` проверяет `unlockedLessons`, но изменяющие хендлеры (`handleSaveDirect`, `handlePrompt`, `handleSaveEval`, `handleSubmitText`, `handleSaveEdit`, `handleImagePrompt`, `handleImageEval`, `handleImageBest`, `handleImageWorst`, `handleImageUnmark`, `handleImageAccept`, `handleImageRegenerate`, `handleImagePublish`, `handleThemePrompt`, `handleThemeSecond`, `handleThemeChoose`, `handleThemeJustify`) позволяют записать поле из ещё закрытого учителем урока (например, `reflection-1` из Урока 5, когда открыт только Урок 2).
- **Исправление:**
  1. Функция `fieldDef(fieldId)` в `platform/server.js` (строка 69) уже возвращает объект поля со свойством `def.lesson` (`Number(n)`).
  2. Написать компактный хелпер `isLessonUnlocked(progress, lessonNum)`:
     ```js
     function isLessonUnlocked(progress, lessonNum) {
       const unlocked = Array.isArray(progress.unlockedLessons) && progress.unlockedLessons.length
         ? progress.unlockedLessons : [DEFAULT_LESSON];
       return unlocked.indexOf(Number(lessonNum)) !== -1;
     }
     ```
  3. В начале каждого изменяющего API-хендлера ученика (после получения `def = fieldDef(body.field)` и `progress = getProgress(a.session.studentId)`) проверять:
     ```js
     if (!isLessonUnlocked(progress, def.lesson)) {
       return sendJson(res, 403, { ok: false, error: 'This lesson is locked by your teacher.', errors: [{ rule: 'lesson-locked', hint: 'This lesson is locked by your teacher.' }] });
     }
     ```

### 6. Закрыть пропуск оценки `pros/cons` в Уроке 3 (`platform/validate.js` и `platform/server.js`)
- **Проблема:** В `platform/server.js` обработчик `handleImagePrompt` (строка 617) для `def.input === 'ai-image-cycle'` не проверяет `f.nextStep`, позволяя отправить новый промпт без сохранения `pros/cons` предыдущей картинки (`I{n}-eval`). А в `platform/validate.js` функция `canAcceptImageField(iterations, cfg)` (строка 339) проверяет только `iterations.length >= minImageIterations`, не проверяя, что у итераций реально заполнены `pros` и `cons`.
- **Исправление:**
  1. В `handleImagePrompt` (`platform/server.js`, после строки 626) для `def.input === 'ai-image-cycle'` добавить проверку стадии:
     ```js
     if (def.input === 'ai-image-cycle') {
       const step = f.nextStep || 'I1-prompt';
       if (!/-prompt$/.test(step) && step !== 'pick') {
         return sendJson(res, 200, { ok: false, errors: [{ rule: 'stage', hint: 'Rate the current image (pros and cons) and save it before generating the next one.' }] });
       }
     }
     ```
  2. В `canAcceptImageField(iterations, cfg)` (`platform/validate.js`, строка 339) считать количество **оцененных** итераций (`ratedCount`), у которых `countWords(it.pros) >= (cfg.rules.prosMinWords || 3)` и `countWords(it.cons) >= (cfg.rules.consMinWords || 3)`, и требовать `ratedCount >= (cfg.rules.minImageIterations || 3)`.

### 7. Сделать атомарную запись JSON и безопасную обработку битого JSON в запросах (`T06` в `platform/server.js`)
- **Проблема:** При отправке некорректного JSON в `readBody(req)` промис отклоняется с `'bad json'`, но в главном роутере `http.createServer` нет `try / catch` с отправкой `400 Bad Request` (сервер падает по `UnhandledPromiseRejection`). Кроме того, `writeJson(file, obj)` пишет напрямую в целевой файл.
- **Исправление:**
  1. В `writeJson(file, obj)` сначала записывать данные во временный файл `file + '.' + process.pid + '.tmp'`, а затем атомарно переименовывать через `fs.renameSync(tmpFile, file)`.
  2. Обернуть тело `http.createServer(async (req, res) => { try { ... } catch (err) { ... } })`, возвращая `400` (`{ error: 'Invalid JSON in request body.' }`) при `err && err.message === 'bad json'`, `413` при `err && err.message === 'body too large'` и `500` при прочих ошибках.

---

## Критерии приёмки (Acceptance Criteria)
1. `node -c motion.js`, `node -c tools/fill-slots.js`, `node -c platform/validate.js` и `node -c platform/server.js` проходят без синтаксических ошибок.
2. Запрос `GET http://localhost:3000/preview/platform/data/sessions.json` возвращает `403`.
3. Запросы `GET http://localhost:3000/preview/dist/lumi.html` и `GET http://localhost:3000/preview/rehearsal/assets/lumi-avatar.png` возвращают `200`.
4. При попытке ученика с `unlockedLessons: [2]` отправить `POST /api/save-direct` для поля `reflection-1` (Урок 5) сервер возвращает `403`.
5. При вызове сборки сайта (`runExport`) для ученицы `lumi` поля `about-me` и `hobby-text-1..3` попадают в `platform/data/lumi-export.json` и в `dist/lumi.html` (без сырых символов `<p>` в видимом тексте, но внутри DOM-элемента `<p>` в блоке `#slot-about-me`).
6. Строка `<img src=x onerror=alert(1)>` в любом текстовом слоте отображается на собранном сайте как обычный текст и не выполняет JS.
