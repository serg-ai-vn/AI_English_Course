> HISTORICAL SNAPSHOT 2026-10-29. Not instructions for current development.

# SESSION.md — Точка входа для ИИ-агента

> **Правило для агента:** Держи этот файл короче 100 строк! При старте сессии читай `AGENTS.md`, `SESSION.md`, `docs/SYSTEM_INVARIANTS.md` и `tasks/00-BACKLOG.md`. При любых вопросах или правках по механике уроков обязательно сверяйся с `curriculum/Lesson_N.md` и матрицей связности в `docs/SYSTEM_INVARIANTS.md`. Архив `docs/SESSION_HISTORY_ARCHIVE.md` не читай без явной просьбы Сергея.

## Суть проекта в двух строках
Платформа персональных сайтов для детского курса **English + AI Literacy** (10–14 лет, A2–B1, Вьетнам / Online). Ученик по шагам проходит уроки 2–5 в веб-воркспейсе (`platform/`), пишет и улучшает промпты на английском по принципу **«The Operator Rule»**, а система собирает для него готовый интерактивный персональный сайт (`index.html` + частицы + темы).

## Текущая точка (Baseline v0.5.0 — после аудита 29.10.2026)
- **Код зафиксирован в состоянии Baseline (без правок поверх рабочей локальной версии Сергея):**
  - Вся цепочка уроков L2 (`lesson-2.json`), L3 (`lesson-3.json`), L4 (`lesson-4.json`) и L5 (`lesson-5.json`) реализована в `platform/server.js`, `platform/validate.js` и `platform/public/app.js`.
  - Консоль учителя (`platform/public/teacher.html` + `teacher.js`) поддерживает открытие уроков, просмотр журнала промптов и запуск сборки (`Build site` / `Publish site`).
- **Репозиторий `Main/` полностью укомплектован и защищён от потери контекста:**
  - Ассеты демо-учеников возвращены в `Main/rehearsal/assets/`, чтобы все изображения и частицы работали из коробки.
  - Планы уроков и методичка возвращены внутрь репозитория в `Main/curriculum/` (`Lesson_1.md..Lesson_5.md`, `1_course_guide_teacher.md`, `16_source_theme_presets.md`).
  - В `Main/docs/SYSTEM_INVARIANTS.md` создан единый паспорт педагогических инвариантов, контрактов ИИ и матрицы связности 6 слоёв кода.
  - В `platform/data/classes.json` добавлены все 6 демо-учеников (`Lumi` — готовый демо-профиль; `Ziggy`, `Neo`, `Khoa`, `Nia`, `Rex` — чистые профили для ручного тестирования).

## Следующий шаг (Очередь задач)
1. **Инициализация Git и выгрузка Baseline на GitHub** (по инструкции `GITHUB_SETUP_AND_AGENT_GUIDE.md`, тег `v0.5.0-baseline`).
2. **Выполнение `tasks/TASK-01-critical-bugs-and-security.md`**:
   - Починить потерю текстов `ai-text-3step` (`about-me`) и `ai-cycle-bonus` (`hobby-text-1..3`) при экспорте в `platform/server.js` (`runExport`, строка 1197).
   - Убрать лишнюю строку `el.appendChild(frag); });` в `motion.js` (строка 44).
   - Закрыть неавторизованный доступ к служебным файлам через `/preview/` (`T01`, оставив белый список `dist/`, `demo-assets/`, `rehearsal/assets/`), безопасно создавать `<p>` для `about-me` в `tools/fill-slots.js` (`T03`), проверять `unlockedLessons` в API (`T04`) и проверять `nextStep` / `pros+cons` в Уроке 3.
3. **Выполнение `tasks/TASK-02-linux-portable-builder.md`**:
   - Заменить вызовы Windows PowerShell (`export-site.ps1`, `sample-particles.ps1`) на чистый Node.js модуль `tools/site-builder.js` с честным декодером PNG через `zlib`.
4. **Выполнение `tasks/TASK-03-openai-and-smart-gating.md`**:
   - Подключить реальный OpenAI API через `platform/ai-provider.js` с жёстким соблюдением контрактов длины/Present Perfect и неблокирующим `tutorHint`.
5. **Выполнение `tasks/TASK-04-server-deploy-docker.md`**:
   - Подготовить `Dockerfile` / `docker-compose.yml` и развернуть сервер в облаке.

## Краткая история (последние записи)
- **29.10.2026:** Проведён глубокий аудит реорганизации: в `Main/` возвращены `curriculum/` и `rehearsal/assets/`, создан паспорт `docs/SYSTEM_INVARIANTS.md`, синхронизированы 6 учеников в `classes.json`, исправлены технические ТЗ в `TASK-01..03`.
- **28.10.2026:** Первичная очистка проекта для GitHub и создание очереди `tasks/TASK-01..05`.
