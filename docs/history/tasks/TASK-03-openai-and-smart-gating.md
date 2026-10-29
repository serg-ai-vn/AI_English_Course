> HISTORICAL SNAPSHOT 2026-10-29. Not instructions for current development.

# TASK-03: Подключение OpenAI API, жёсткого контракта генерации и умного ИИ-тьютора для мягкого гейтинга

## Контекст задачи
Сейчас в `platform/server.js` генерация текстов (`mockGenerate`) и картинок (`mockGenerateImage`) использует зашитые шаблонные ответы. Кроме того, в `platform/validate.js` регулярное выражение `hasPresentPerfect` даёт ложные срабатывания на простых фразах вроде `"I have red shoes"`, а при ошибках гейтинга ученик видит только стандартные подсказки.

Необходимо:
1. Починить эвристику `hasPresentPerfect` в `platform/validate.js` и убрать дубли глаголов в `platform/config/lesson-2.json`.
2. Вынести работу с ИИ в чистый модульный адаптер `platform/ai-provider.js` с поддержкой двух режимов через `.env`: `AI_PROVIDER=mock` (для бесплатных офлайн-тестов) и `AI_PROVIDER=openai` (реальные вызовы OpenAI API `gpt-4o-mini` и `dall-e-3` / `gpt-image-1`).
3. Обеспечить **100% соблюдение контракта гейтинга (`docs/SYSTEM_INVARIANTS.md` §3)** в ответах OpenAI, чтобы сгенерированный ИИ черновик никогда не блокировал ученика на финальной кнопке `Publish to Website` (`validate.checkText`).
4. Добавить функцию **Умного ИИ-тьютора (`generateGateHint`)** как **неблокирующее дополнение (`tutorHint`)** к стандартным детерминированным ошибкам `validate.js`.

## Файлы для чтения и изменения
1. `docs/SYSTEM_INVARIANTS.md` (разделы 2 и 3 — прочитать обязательно!)
2. `.env.example`
3. `platform/config/lesson-2.json`
4. `platform/validate.js`
5. `platform/ai-provider.js` (создать новый модуль)
6. `platform/server.js`
7. `platform/public/app.js` (только функция `showErrors` для отображения опционального `tutorHint`)

---

## Пошаговый план реализации

### 1. Исправить `hasPresentPerfect` в `platform/validate.js` и почистить `v3verbs` в `lesson-2.json`
- **Проблема в `platform/validate.js` (строки 62–77):**
  Сейчас функция `hasPresentPerfect(text, v3verbs)` ищет `/\b(have|has|'ve|'s)\s+([a-z']+)/gi` и считает причастием любое слово, заканчивающееся на `ed` (`/[a-z]+ed$/.test(next)`). Из-за этого:
  1. В простой фразе Present Simple `"I have red shoes"` или `"I have a red bed"` (если написать `"I have red..."` или `"I have just red"`) короткие существительные/прилагательные на `-ed` (`red`, `bed`, `sled`, `shed`, `seed`, `need`, `feed`, `weed`, `speed`) дают ложное срабатывание `true`!
  2. Если между `have/has` и глаголом стоит отрицание и наречие (например, `"I have not played"` или `"I have never been"` или `"I have already built"`), поддерживается только ограниченный список из 5 слов (`not|never|just|already|ever`), но не поддерживаются `always`, `often`, `also`, `recently` или связка из двух наречий (`have not ever played`).
- **Исправление в `platform/validate.js`:**
  1. Ввести стоп-лист не-причастий на `-ed`:
     ```js
     var NON_V3_ED = {
       red: 1, bed: 1, sled: 1, shed: 1, seed: 1, weed: 1,
       feed: 1, need: 1, speed: 1, bled: 1, fled: 1, fed: 1, led: 1
     };
     function isRegularEdVerb(word) {
       var w = String(word || '').toLowerCase();
       return w.length >= 4 && /^[a-z]+ed$/.test(w) && !NON_V3_ED[w];
     }
     ```
  2. Разрешить между `have|has|'ve|'s` (а также `haven't|hasn't`) и причастием (`v3[word]` или `isRegularEdVerb(word)`) от 0 до 2 наречий из белого списка `(?:not|never|ever|just|already|always|often|also|recently|only)`, но **не** артикли/прилагательные/местоимения (`a`, `the`, `my`, `two`).
- **Исправление в `platform/config/lesson-2.json`:**
  - Убрать дублирующиеся записи `"learned"` и `"won"` из массива `rules.v3verbs`.

### 2. Создать модульный адаптер `platform/ai-provider.js` с жёстким контрактом гейтинга
Используй встроенный в Node 18+ глобальный `fetch` (внешние npm-пакеты не нужны). Добавь в `platform/ai-provider.js` компактный загрузчик `.env` из корня проекта (если файл `.env` существует).

Модуль должен экспортировать 3 асинхронные функции:

#### А. `generateStudentText({ fieldId, prompt, stage, studentName, cfg, fieldDef })`
- Если `AI_PROVIDER !== 'openai'` или не задан `OPENAI_API_KEY`, возвращает результат детерминированной функции `mockGenerate(fieldId, prompt)` (при этом убедись, что `mockGenerate` для `about-me` всегда выдаёт `>= 42 слов` и сохраняет Present Perfect из `Context` ученика, чтобы `validate.checkText` проходил с первого раза!).
- Если `AI_PROVIDER === 'openai'`, отправляет запрос к `https://api.openai.com/v1/chat/completions` (модель `process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini'`, таймаут `AbortSignal.timeout(25000)`):
  - **Для `fieldId === 'about-me'` (`ai-text-3step`):**
    - Системный промпт обязан жёстко фиксировать контракт `validate.checkText`:
      > *"You are an AI writing co-pilot for a 10-14 year old ESL student (CEFR A2-B1) building their personal website. Follow the student's Role, Context, Task, and Format instructions. Write a single paragraph in first person ('I...'). CRITICAL VALIDATION CONTRACT: 1) Your output MUST be strictly between 48 and 70 words (and under 520 characters). 2) You MUST include at least one explicit Present Perfect sentence using 'I have <V3>' (e.g., 'I have played...', 'I have drawn...', 'I have built...', 'I have learned...') preserving the experience from the student's Context line. 3) Do NOT wrap the text in quotes or markdown headings."*
    - Если `stage === 1` (Итерация V1): добавить инструкцию сделать текст чуть более сухим/общим или включить 1–2 чуть сложных слова, чтобы ребёнку было что найти и покритиковать в шаге `A1-eval` (`What needs to change?`). Если `stage === 2` (Итерация V2): учесть все уточнения ученика и сделать текст живым, естественным и понятным для уровня A2–B1.
  - **Для `fieldId.startsWith('hobby-text-')` (`ai-cycle-bonus`):**
    - Системный промпт обязан жёстко соблюдать лимит `15+ слов` и `<= 180 символов` (`maxLength: 200`):
      > *"You are an AI writing co-pilot for a 10-14 year old ESL student (CEFR A2-B1). Write 2-3 short, energetic sentences in first person ('I...') about the student's hobby based on their Role, Context, Task, and Format prompt. CRITICAL VALIDATION CONTRACT: 1) Your output MUST be between 18 and 28 words and STRICTLY UNDER 180 CHARACTERS total! 2) You MUST include at least one explicit Present Perfect verb phrase ('I have <V3>', e.g., 'I have played...', 'I have practiced...'). 3) Plain text only, no quotes."*
  - **Страховочный пост-чек (Safety Post-Check перед возвратом черновика ученику):**
    - Проверить полученный от OpenAI текст через `validate.checkText(fieldDef, draft, cfg)`.
    - Если по какой-то причине LLM выдала текст короче `minWords`, длиннее `maxLength` или потеряла `Present Perfect`, автоматически скорректировать черновик (например, подрезать до лимита символов по границе предложения или добавить предложение с Present Perfect из строки `Context:` промпта ученика), чтобы платформа **никогда** не отдала ребёнку черновик, который заблокирует кнопку `Publish`!

#### Б. `generateStudentImage({ fieldId, prompt, iteration, studentId, fieldDef })`
- Если `AI_PROVIDER === 'openai'`, вызывает `https://api.openai.com/v1/images/generations` (модель `process.env.OPENAI_IMAGE_MODEL || 'dall-e-3'`), добавляя защитные модификаторы по `docs/SYSTEM_INVARIANTS.md`:
  - для `avatar`: *"Stylized digital character avatar illustration, clean solid or high-contrast dark background for silhouette particle extraction, NO real human photography"*;
  - для `background`: *"Atmospheric wide background illustration, NO people, NO readable text, NO watermarks"*;
  - скачивает PNG/JPG в `platform/public/generated/${studentId}-${fieldId}-v${iteration}-${Date.now()}.png` и возвращает `{ path: 'platform/public/generated/...', url: '/preview/platform/public/generated/...' }`.
- При ошибке сети или в режиме `mock` возвращает картинку из `mockGenerateImage`.

#### В. `generateGateHint({ fieldId, studentInput, errors })` (Неблокирующий ИИ-тьютор)
- **Инвариант:** ИИ-тьютор **НЕ заменяет** детерминированные ошибки `errors: [{ rule, hint }]` из `validate.js`!
- Если `check.ok === false`, `AI_TUTOR_HINTS_ENABLED === 'true'` и `AI_PROVIDER === 'openai'`, сервер вызывает `generateGateHint` (`max_tokens: 80`, `temperature: 0.3`, таймаут `4000 мс`):
  > *"You are a warm, supportive English teacher in Vietnam helping a 12-year-old student (CEFR A2 level). The student wrote: '<studentInput>'. It didn't pass these rules: <errors>. Write a short, encouraging 1-2 sentence tip in very simple A2 English showing HOW to fix it (give a tiny pattern example like 'Try adding: I have played...'), without writing the full prompt for them."*
- Сервер возвращает `{ ok: false, errors: check.errors, tutorHint: tutorHint || null }`.
- В `platform/public/app.js` функция `showErrors(card, errors, tutorHint)` рендерит стандартные детерминированные плашки `errors`, а если передан непустой `tutorHint` — добавляет под ними аккуратный блок подсказки `🤖 AI Co-pilot Tip: ...`.

---

## Критерии приёмки (Acceptance Criteria)
1. Фразы `"I have red shoes."` и `"I have a red bed."` возвращают `false` в `validate.hasPresentPerfect`, а `"I have played football for 3 years."`, `"I have already built two robots."` и `"I have been drawing since Monday."` возвращают `true`.
2. В `platform/config/lesson-2.json` в массиве `rules.v3verbs` нет дубликатов.
3. Без `.env` файла (или с `AI_PROVIDER=mock`) сервер работает на 100% автономно без интернета.
4. Любой черновик, сгенерированный `generateStudentText` (как в режиме `mock`, так и в режиме `openai`), гарантированно проходит `validate.checkText` по длине и наличию Present Perfect.
5. При ошибке гейтинга стандартный массив `errors` из `validate.js` всегда сохраняется неизменным, а `tutorHint` передаётся дополнительным полем.
