> HISTORICAL SNAPSHOT 2026-10-29. Not instructions for current development.

# Очередь задач разработки (Master Backlog)

> **Инструкция для ИИ-агента:** Выполняй задачи строго по очереди (сверху вниз). Перед началом задачи убедись, что ты прочитал `docs/SYSTEM_INVARIANTS.md`, измени статус задачи на `IN_PROGRESS`, прочитай соответствующий файл `tasks/TASK-XX-...md`, внеси изменения, прогони тесты приёмки, сделай атомарный git-коммит и переведи статус в `DONE`.

## Таблица задач

| ID | Файл задачи | Приоритет | Статус | Краткая суть |
| :--- | :--- | :--- | :--- | :--- |
| **TASK-01** | `tasks/TASK-01-critical-bugs-and-security.md` | **P0 / P1** | `TODO` | Починка потери текстов L2 при экспорте (`server.js:1197`), починка `SyntaxError` в `motion.js:44`, белый список `/preview/` с `rehearsal/assets/` (`T01`), безопасный `<p>` для `about-me` и защита от XSS в `fill-slots.js` (`T03`), серверная проверка `unlockedLessons` (`T04`), закрытие пропуска `pros/cons` в L3 и атомарная запись JSON (`T06`). |
| **TASK-02** | `tasks/TASK-02-linux-portable-builder.md` | **P0 (Server)** | `TODO` | Полный отказ от Windows PowerShell (`export-site.ps1` и `sample-particles.ps1`). Создание кроссплатформенного модуля `tools/site-builder.js` на чистом Node.js с реальным декодером пикселей PNG через `zlib` (`luminance 0..255` по контракту `docs/CONTRACT.md`). |
| **TASK-03** | `tasks/TASK-03-openai-and-smart-gating.md` | **P1 (AI Core)** | `TODO` | Подключение реального OpenAI API (`gpt-4o-mini` + `dall-e-3`) через `platform/ai-provider.js` с жёстким соблюдением контрактов длины и Present Perfect (`docs/SYSTEM_INVARIANTS.md` §3), страховочным пост-чеком, неблокирующим ИИ-тьютором (`tutorHint`) и починкой регулярки `hasPresentPerfect` + дублей в `lesson-2.json`. |
| **TASK-04** | `tasks/TASK-04-server-deploy-docker.md` | **P1 (Deploy)** | `TODO` | Подготовка к деплою на Linux VPS / Railway / Render: эндпоинт `/api/health`, `Dockerfile`, `docker-compose.yml`, настройка персистентных папок `platform/data` и `dist`. |
| **TASK-05** | `tasks/TASK-05-supabase-migration-plan.md` | **P2 (Scale)** | `TODO` | Архитектура и готовая SQL-миграция для перевода хранилища с локальных JSON-файлов на **Supabase (PostgreSQL + Supabase Storage)** на втором этапе масштабирования. |
