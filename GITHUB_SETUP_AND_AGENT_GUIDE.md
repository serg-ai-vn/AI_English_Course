# ИНСТРУКЦИЯ ДЛЯ ИИ-АГЕНТА: Инициализация GitHub-репозитория и пошаговая разработка

> **Для владельца проекта (Сергея):**
> 1. Скачай папку `Main/` с Google Диска к себе на компьютер и распакуй её в рабочую директорию проекта (например, `ai-english-course/`).
> 2. Открой в этой папке своего кодинг-агента (OpenCode / Cursor / Claude Code) и отправь ему **этот файл** (или просто скажи: *«Прочитай `GITHUB_SETUP_AND_AGENT_GUIDE.md` и выполни Шаг 1 и Шаг 2»*).

---

## ЧАСТЬ 1. Прямое задание для ИИ-агента: Выгрузка Baseline на GitHub

**Роль агента:** Ты — ведущий инженер проекта `AI English Course Platform`. Папка проекта приведена к структуре профессионального репозитория, укомплектована планами уроков (`curriculum/`), демо-ассетами (`rehearsal/assets/`) и паспортом инвариантов (`docs/SYSTEM_INVARIANTS.md`). Исходный код (`platform/`, `tools/`, шаблоны в корне) находится в состоянии **проверенного Baseline (`v0.5.0`)**.

**СТРОГОЕ ПРАВИЛО ПЕРЕД ПЕРВЫМ КОММИТОМ:**
**НЕ ИЗМЕНЯЙ ни одной строчки в файлах `.js`, `.html`, `.css`, `.json` до того, как сделаешь первый Baseline-коммит и отправишь его на GitHub!** Сначала мы фиксируем в Git 100% рабочую исходную точку, чтобы в любой момент к ней можно было откатиться через `git checkout v0.5.0-baseline`.

### Шаг 1. Проверка структуры папки перед `git init`
1. Убедись, что ты находишься внутри корневой папки репозитория (там, где лежат `package.json`, `AGENTS.md`, `SESSION.md`, `index.html`, `platform/`, `tools/`, `curriculum/`, `rehearsal/assets/`, `tasks/`, `docs/SYSTEM_INVARIANTS.md`).
2. Проверь, что временный файл сессий `platform/data/sessions.json` не попадёт в коммит (он уже добавлен в `.gitignore`). Если он существует, удали его из индекса Git: `rm -f platform/data/sessions.json`.
3. Быстро проверь синтаксическую целостность серверных файлов Baseline:
   - Запусти `node -c platform/server.js` и `node -c platform/validate.js`.

### Шаг 2. Инициализация Git и создание точки отката (`v0.5.0-baseline`)
Выполни в терминале следующие команды по порядку:

```bash
# 1. Инициализируем git-репозиторий с главной веткой main
git init -b main

# 2. Проверяем список файлов, которые пойдут в коммит (убедись, что нет .env и sessions.json)
git status

# 3. Индексируем все файлы чистого Baseline-слепка
git add -A

# 4. Делаем первый Baseline-коммит
git commit -m "chore: initial baseline v0.5.0 with curriculum and system invariants"

# 5. Ставим защитный тег, чтобы к исходной версии Сергея всегда можно было вернуться одной командой
git tag -a v0.5.0-baseline -m "Original working local baseline before Task 01-05"
```

### Шаг 3. Создание репозитория на GitHub и `git push`
1. Проверь, установлен ли и авторизован ли на компьютере GitHub CLI (`gh auth status`):
   - **Если `gh` авторизован**, создай приватный репозиторий и запушь в него код и тег одной командой:
     ```bash
     gh repo create ai-english-course-platform --private --source=. --remote=origin --push
     git push origin --tags
     ```
   - **Если `gh` не установлен или не авторизован**, попроси пользователя:
     > *«Сергей, создай пустой приватный репозиторий на https://github.com/new (без галочек Add a README / .gitignore) и пришли мне его ссылку вида `https://github.com/<username>/<repo>.git`»*.
     После получения ссылки выполни:
     ```bash
     git remote add origin <URL_РЕПОЗИТОРИЯ>
     git push -u origin main
     git push origin --tags
     ```

---

## ЧАСТЬ 2. Как вести дальнейшую разработку и защищать методологию курса

Как только Baseline загружен на GitHub, агент переходит к выполнению задач из папки `tasks/` **строго по одной задаче за итерацию**, а также помогает Сергею развивать и корректировать уроки.

### Правила контекстной гигиены и защиты инвариантов для агента:
1. **На старте каждой сессии читай 4 компактных файла:**
   - `AGENTS.md`
   - `SESSION.md`
   - `docs/SYSTEM_INVARIANTS.md` *(паспорт инвариантов уроков L1–L5, контракта для OpenAI и матрицы из 6 связанных слоёв кода)*
   - `tasks/00-BACKLOG.md`
2. **При любых вопросах или изменениях по механике конкретного урока `N` (`Lesson 1..5`):**
   - Обязательно прочитай `curriculum/Lesson_N.md` и проверь матрицу межфайловых зависимостей в `docs/SYSTEM_INVARIANTS.md` (§4–5).
   - Если изменение детали урока может затронуть смежные процессы (`validate.js`, `server.js`, `app.js`, `teacher.js`, `fill-slots.js`), **сразу предупреди Сергея** до внесения правок и предложи безопасный способ реализации.
3. **НЕ читай без прямого запроса** только архивный лог `docs/SESSION_HISTORY_ARCHIVE.md` (45 КБ).
4. **Алгоритм работы над каждой задачей (`TASK-01` -> `TASK-02` -> `TASK-03` -> `TASK-04`):**
   - Создай рабочую ветку под задачу (или работай атомарными коммитами в `main`):
     ```bash
     git checkout -b task-01-critical-fixes
     ```
   - Прочитай файл задачи (например, `tasks/TASK-01-critical-bugs-and-security.md`) и открой файлы, перечисленные в начале этого ТЗ.
   - Внеси изменения строго по пунктам ТЗ.
   - Перезапусти локальный сервер (`node platform/server.js`) и выполни все проверки из раздела **`Критерии приёмки (Acceptance Criteria)`** в конце ТЗ + проверку 4 базовых маршрутов из `AGENTS.md`.
   - Обнови статус задачи в `tasks/00-BACKLOG.md` на `DONE` и добавь 1 строчку в `SESSION.md`.
   - Закоммить и запушь результат на GitHub:
     ```bash
     git add -A
     git commit -m "fix(task-01): fix L2 text export, motion.js syntax, L3 gate, and preview/API security"
     git checkout main
     git merge task-01-critical-fixes
     git push origin main
     ```
   - Остановись и отчитайся пользователю, прежде чем переходить к `TASK-02`!

---

## ЧАСТЬ 3. Краткая карта очереди задач (`tasks/`)

1. **`tasks/TASK-01-critical-bugs-and-security.md` (Приоритет P0/P1 — выполнить первым после пуша Baseline)**:
   - Чинит потерю текстов `About Me` (`ai-text-3step`) и `Hobbies` (`ai-cycle-bonus`) при экспорте сайта в `platform/server.js` (строка 1197).
   - Убирает дублирующуюся строчку `el.appendChild(frag); });` в `motion.js` (строка 44), которая ломала скролл-анимации.
   - Закрывает неавторизованный доступ к `sessions.json` через `/preview/` (`T01`), оставляя в белом списке `dist/`, `demo-assets/`, `rehearsal/assets/` и `generated/`.
   - Переводит `tools/fill-slots.js` с небезопасного `innerHTML` на безопасные DOM-узлы с созданием `<p>` для слота `about-me` (`T03`).
   - Добавляет серверную проверку `unlockedLessons` во все API сохранения прогресса (`T04`) и закрывает пропуск оценки `pros/cons` в Уроке 3.
   - Делает атомарную запись JSON через `.tmp`-файл и перехват битого JSON (`T06`).

2. **`tasks/TASK-02-linux-portable-builder.md` (Приоритет P0 для сервера)**:
   - Заменяет Windows-скрипты `tools/export-site.ps1` и `tools/sample-particles.ps1` на нативный кроссплатформенный модуль `tools/site-builder.js` на чистом Node.js с реальным декодером пикселей PNG через `zlib` (сохраняя яркость `0..255` и силуэт аватара по `docs/CONTRACT.md`).

3. **`tasks/TASK-03-openai-and-smart-gating.md` (Приоритет P1 — подключение GPT и мягкого гейтинга)**:
   - Создаёт модульный адаптер `platform/ai-provider.js` (переключается в `.env` между `AI_PROVIDER=mock` и `AI_PROVIDER=openai`).
   - Подключает `gpt-4o-mini` с **жёстким контрактом длины и Present Perfect** (`docs/SYSTEM_INVARIANTS.md` §3) и страховочным пост-чеком, чтобы ученик никогда не застрял на кнопке `Publish`.
   - Внедряет **неблокирующего ИИ-тьютора (`tutorHint`)** в дополнение к стандартным ошибкам `validate.js`.
   - Чинит ложные срабатывания `hasPresentPerfect` в `platform/validate.js` на коротких словах вроде `red` / `bed` и убирает дубли в `lesson-2.json`.

4. **`tasks/TASK-04-server-deploy-docker.md` (Приоритет P1 — деплой на сервер)**:
   - Добавляет `/api/health`, `Dockerfile`, `.dockerignore` и `docker-compose.yml` с сохранением данных в `volumes` для быстрого развёртывания на Railway, Render, Fly.io или любом VPS.

5. **`tasks/TASK-05-supabase-migration-plan.md` (Приоритет P2 — Этап 2 после первого пилота)**:
   - Готовая схема PostgreSQL и бакетов Supabase Storage для перехода на облачную БД на этапе масштабирования.
