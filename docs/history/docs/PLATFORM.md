> HISTORICAL SNAPSHOT 2026-10-29. Not instructions for current development.

# PLATFORM.md — платформа «как есть» (истина = код)

> Единое описание работающей платформы: архитектура, данные, API, гейтинг, флоу уроков.
> Актуально на 06.08.2026 (Этап E, куски 1-4 готовы). Это НЕ дизайн-спека (она - `../3_platform_architecture_spec.md`),
> а описание текущей реализации. Если код и этот файл расходятся — правь этот файл.

## 1. Обзор

- **Стек**: Node.js, **ноль зависимостей** (только `http`/`fs`/`crypto`/`child_process`). JSON-файлы вместо БД. LLM и генерация картинок — **моки** (замена — в двух функциях, см. §9).
- **Пуск**: `node server.js` в `platform/` → `http://localhost:3000`. Статика из `public/`, путь заблокирован от выхода наружу.
- **Состав**: `server.js` (все роуты и обработчики), `validate.js` (детерминированный гейтинг), `config/lesson-{2,3,4,5}.json` (уроки как данные), `data/classes.json`, `data/sessions.json`, `data/progress/<id>.json`, `public/{login,workspace,teacher}.html` + `app.js`/`teacher.js`/`platform.css`, `design-lab/` (мокапы скина).
- **TRACK_ROOT** = `Kimi K3/` (шаблон, `tools/`, `rehearsal/`): роут `/preview/...` отдаёт оттуда файлы (картинки моков, `dist/*.html`), путь locked.

## 2. Авторизация и роли

- `POST /api/login` `{classCode, pin, role: 'student'|'teacher', name?}` → `{token, role, ...}`. Дальше — заголовок `Authorization: Bearer <token>`.
- **Ученик**: логин по `name` + `pin` (НЕ только pin), имя из `classes.json`.
- **Учитель**: `classCode` + `teacherPin` класса.
- Сессии — в `data/sessions.json` (token → `{role, studentId|classCode, name, created}`). Токен из памяти файла, `POST /api/logout` удаляет.
- **Guard-ы**: teacher-only — `/api/teacher/overview`, `/api/teacher/unlock-lesson`, `/api/teacher/build-site` (иначе 403); student-only — все остальные `/api/*` кроме login (иначе 403); без токена — 401.

## 3. Данные

- `data/progress/<studentId>.json`:
  ```json
  { "studentId": "lumi", "lesson": 2, "complete": false,
    "unlockedLessons": [2], "fields": {}, "built": null, "theme": null, "published": null }
  ```
  `fields` — по id поля: `direct` → `{value,status,ts}`; `checklist` (L5-аудит) → `{items:{id:bool},status,ts}`; `ai-text-3step` → `{value,status,nextStep,iterations[{stage,prompt,draft,good,needsChange,ts}],acceptedPrompts}`; `ai-cycle-bonus` → `{...,bonusClaimed,iterations[{stage,prompt,draft,edited,reason,ts}]}`; `ai-image-cycle` → `{status,nextStep,iterations[{version,prompt,image,structure,pros,cons,best,worst,ts}],acceptedImage}`; `ai-image-rapid` → `{...,publishedVersion,value,iterations[{version,prompt,image,structure,reason,ts}]}`; `theme-picker` → `{status,nextStep,iterations[{prompt,preset,version}],choice,justification,presetId}`.
  `built` = превью-сборка (учитель), `published` = финальный экспорт L5 `{ts,file,size,url}`.
- `classes.json`: `{classes:[{code,name,teacherPin,students:[{id,name,pin}]}]}`.
- Уроки загружаются в `server.js` в объект `lessons {2,3,4}`; активный урок = `progress.lesson`.

## 4. Конфиг урока (`config/lesson-N.json`) — схема

```json
{ "lesson": 2, "title": "...", "source": "откуда взята спека",
  "drivingQuestion": "...",
  "targetVocabulary": ["..."],          // глобальная лексика (всегда в гейте)
  "vocabByField": { "about-me": ["..."], "hobby-image": {"new":[...],"review":[...]} },
  "rules": { ... },                     // числа гейтинга (см. конфиги)
  "hints": { "ruleName": "текст подсказки" },
  "fields": [ { "id", "label", "input", "required", "maxLength", ... } ],
  "presets": [ ... ],                   // L4: id/name/moodWords/palette/fontHeading/fontBody/particle
  "order": N, "requiresLesson": N-1, "autoFields": { "author-name": "account.name" } }
```

Типы полей `input`: `direct` (просто ввод, опц. `minWords` — рефлексия L5), `checklist` (L5-аудит: чек-боксы, все обязательны), `ai-text-3step` (About Me), `ai-cycle-bonus` (хобби-текст), `ai-image-cycle` (L3 аватар/фон), `ai-image-rapid` (L4 хобби-картинки), `theme-picker` (L4 тема).

## 5. Движок гейтинга (`validate.js`)

Чистые функции, читают правила из конфига (один движок на все уроки):

| Функция | Назначение |
|---|---|
| `checkPrompt` | L2-промпт: firstLength ≥5 / рост +3 слова, 4 метки формулы, vocab ≥2 (из targetVocabulary **∪ банка поля** — слова UI-банка всегда засчитываются), PP в промпте для `grammar:'present-perfect'` |
| `checkText` | финальный текст: непусто, minWords (about-me 40 / hobby 15), PP, maxLength |
| `checkDirect` | direct-поле: required + maxLength + опц. `minWords` (рефлексия L5) |
| `checkChecklist` | L5-аудит: все пункты `fieldDef.items` обязаны быть `true` |
| `checkReflectionVocab` | L5: кумулятивно по всем ответам рефлексии — ≥1 слово из `reflectionVocabWords` (publish/export/change/presentation) |
| `parseLabeled` / `parseImageStructure` / `checkImageStructurePresent` / `diffImageStructures` | формула Subject/Style/Framing/Lighting: парсинг, 4 непустых метки, diff ≥1 поля |
| `checkImagePrompt` | L3/L4 промпт картинки: empty, структура, vocab ≥1, diff (цепочка к последней принятой) |
| `checkImageEval` | pros/cons ≥3 слов каждая |
| `canAcceptImageField` | закрытие L3-поля: ≥3 итераций + 1 best + 1 worst (≠ best), оба с reason. **Нюанс**: считает `iterations.length` без повторной проверки pros/cons (UI-визард и так не пустит неоценённую итерацию) |
| `checkReason` | L4-регенерация: причина ≥3 слов |
| `hasComparative` | белый список -er/-est + more/most + than |
| `checkThemePrompt` | L4-тема: 4 метки R.C.T.F., Context ≥3 слов, mood-слово из 8 в Format (первое вхождение → пресет), Option 2 ≠ Option 1 (тот же пресет = мягкий warning `themeSame`) |
| `matchThemePreset` | первое mood-слово (из moodWords пресетов) в Format → пресет |
| `checkThemeJournal` | обоснование: ≥10 симв/3 слова + comparative + ≥1 дизайн-слово (designWords ∪ банк темы) |

## 6. API-эндпоинты

| Роут | Роль | Что делает |
|---|---|---|
| `POST /api/login`, `POST /api/logout` | — | вход/выход |
| `GET /api/me` | student | профиль + `config` (публичный срез) + `progress` |
| `POST /api/prompt` | student | промпт для `ai-text-3step` (A1/A2) или `ai-cycle-bonus` (B1) → mock-черновик; легаси `ai-cycle` fallback |
| `POST /api/save-eval` | student | A1/A2-оценка `good`+`needsChange` (оба обязательны) → следующая стадия |
| `POST /api/submit-text` | student | A3-публикация (≥1 символ правки vs draft, checkText) и хобби: publish as-is или Improve (`text`+`reason`, правка обязательна при bonus) |
| `POST /api/save-direct` | student | direct-поле И L5-чек-лист (`items`) — один save |
| `POST /api/save-edit` | student | правка draft (легаси) |
| `POST /api/lesson-switch` | student | смена активного урока (в пределах unlocked) |
| `POST /api/reset` / `api/reset-all` | student | сброс текущего урока / всего прогресса (**только Сергей нажимает в UI**) |
| `POST /api/image-prompt` | student | шаг 1 L3/L4: промпт картинки → генерация (итерация) |
| `POST /api/image-eval` | student | шаг 2 L3: pros/cons → nextStep (ещё итерация или pick) |
| `POST /api/image-best` / `image-worst` / `image-unmark` | student | выбор best/worst с reason (взаимоочистка на одной итерации, unmark снимает) |
| `POST /api/image-accept` | student | закрыть L3-поле (гейт `canAcceptImageField`), best → `acceptedImage` |
| `POST /api/image-regenerate` | student | L4: причина ≥3 слов + промпт с diff ≥1 поля → V{n+1} (до 6) |
| `POST /api/image-publish` | student | L4: опубликовать текущую версию → `publishedVersion`, `status='done'` |
| `POST /api/theme-prompt` / `theme-second` / `theme-choose` / `theme-justify` | student | L4-тема: T1 → T2 (сравнение) → выбор 1/2 → обоснование (журнал) |
| `GET /api/teacher/overview?lesson=N` | teacher | сводка по всем ученикам для выбранного урока: state, чипы полей, журнал, lastActivity, summary |
| `POST /api/teacher/unlock-lesson` | teacher | разблокировать N+1 (только если предыдущий complete) |
| `POST /api/teacher/build-site` | teacher | превью-сборка сайта (гейт L2-L4) → `built` |
| `POST /api/teacher/export-site` | teacher | **L5-публикация**: гейт L2-L5 + vocab рефлексии → пересборка + `published` (handover) |

## 7. nextStep-флоу полей (машина состояний UI)

- **`ai-text-3step` (About Me)**: `A1-prompt` → `A1-eval` → `A2-prompt` (промпт предзаполнен, ≥+3 слова) → `A2-eval` → `A3-publish` (Operator-правка ≥1 символа) → `done`. Ровно 2 промпта, третьего нет.
- **`ai-cycle-bonus` (Hobby)**: `B1-prompt` → `B1-fork` → `done` (Publish as-is) **или** Improve = ручная правка draft + причина → `done` (`bonusClaimed=true`). Второго промпта/генерации НЕТ (решение Сергея 04.08).
- **`ai-image-cycle` (L3)**: `I1-prompt` → `I1-eval` → `I2-prompt` → ... → `pick` (Best/Worst) → `accept` → `done`. До 6 итераций; только после ≥3 rated + best + worst.
- **`ai-image-rapid` (L4)**: `I1-prompt` → `I1-review` → (`publish` | `regenerate` с причиной + diff) → ... до 6, на 6-й только Publish. Без pros/cons/best/worst.
- **`theme-picker` (L4)**: T1 `theme-prompt` (R.C.T.F.) → превью пресета → T2 `theme-second` (изменённый Format) → dual-preview двух пресетов → `theme-choose` 1|2 → `theme-justify` (обоснование) → `done`. `progress.theme` = выбранный пресет.
- **`checklist` + `direct`/minWords (L5)**: аудит (все пункты) + 6 рефлексий по ≥15 слов — каждый поле закрывается одним save-direct. `complete` → учитель публикует.
- **`direct`**: один save.

## 8. Сборка сайта (`/api/teacher/build-site`) и публикация (`/api/teacher/export-site`)

**Build site** (превью, гейт L2+L3+L4):
1. Гейт: L2 + L3 + L4 `complete`.
2. Свести прогресс в `<id>-export.json` (слоты текстов L2 → картинки L3 → **тема из `progress.theme`** (fallback `sunny-day`) + 3 хобби-картинки L4 в слоты карусели).
3. `tools/sample-particles.ps1` (если нет готового particle-JSON для аватара) → `tools/export-site.ps1` через `child_process`.
4. Результат: `dist/<id>.html` (single-file, картинки base64, работает по `file://`), `progress.built = {ts, file, size}`.

**Export site** (L5-публикация, то же + `mark:'published'`):
- Гейт: L2-L5 complete + `validate.checkReflectionVocab` (≥1 слово из publish/export/change/presentation в рефлексии).
- Пересобирает сайт, ставит `progress.published = {ts, file, size, url}` — это handover семье.
- Скачивание: `/preview/dist/<id>.html?download=1` → `Content-Disposition: attachment`.

## 9. Mock-LLM (где менять на реальный API)

- `mockGenerate(fieldId, prompt)` — текст: берёт строку Context из промпта, собирает шаблонный абзац (about-me ~40 слов из длинного Context, иначе короче).
- `mockGenerateImage(studentId, def, iterIdx)` — картинки: подбор из `rehearsal/assets/` по имени студента/поля, fallback на `demo-assets/`, «swap-one-function» — одна картинка меняется местами на следующей итерации, чтобы diff был виден.
- Замена на реальные API — только эти две функции, остальной код не трогается.

## 10. UI

- **`workspace.html` + `app.js`**: DQ-баннер, вкладки уроков, карточки полей (одна стадия за раз), Vocab strip/bank per-field, журнал итераций (read-only после done), кнопки Reset this lesson / Reset ALL progress, «Proceed to Website Preview».
- **`teacher.html` + `teacher.js`**: summary-карточки, таблица (state-pill, мини-бар, чипы полей, lastActivity), expandable Prompt Journal по урокам (`?lesson=N`, кликабельные пилюли L2-L5), Actions: Unlock L3/L4/L5, Build site / **Publish site** (L5, `export-site`), ссылки open + **download** (`?download=1`); авто-refresh (5 с, чекбокс).
- **`platform.css`**: скин Night Lab, токены в шапке, все классы по секциям.

## 11. Операционное

- **Правила из корневого AGENTS.md**: не останавливать сервер «для уборки»; после каждой правки `platform/` — перезапуск (`Stop-Process node` → `Start-Process`) + проверка 4 эндпоинтов (login teacher + workspace.html + platform.css + app.js = 200); reset прогресса — только Сергей; ученики в `data/progress/` держать пустыми (lesson=2, fields={}, unlockedLessons=[2]).
- **Тесты**: `../gating_test/gating-test-lesson{2,3,4}.md` (журналы ожидаемых ответов по гейтам), `test-artifacts-L2-L3.md` (полный E2E-скрипт), `test-artifacts-L4.md`.
- **Демо-доступы**: класс DEMO/0000 (teacher), Lumi/1111, Ziggy/2222, Neo/3333.

## 12. Известные особенности и дыры

- `canAcceptImageField` не перепроверяет pros/cons (защита только на уровне UI-визарда).
- Hint «Too many iterations - accept or delete one first» обещает удаление итерации, но кнопки удаления в UI нет.
- Легаси `ai-cycle` (старые данные) — работает fallback-путь.
- Тема L4: 6 пресетов, moodWords частично дублируют gate-список из 8 слов (soft→Ocean, contrast→Comic добавлены).
- save-direct перезаписывает done-поле (без блокировки) — так L5-рефлексию можно править после сохранения (осознанно).
- Не реализовано: L1 (загрузка фото в консоль), реальные LLM/T2I, перенос на сервер, планшетный тест (Этап D).
