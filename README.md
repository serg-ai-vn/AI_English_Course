# AI English Course — 0.6.1

Пилот English + AI Literacy: 5 занятий, 10–14 лет, A2–B1. L1 на бумаге; L2–L5 в платформе. Проект подготовлен для локальной репетиции и последующей проверки реального API/VPS. Это ещё не принятый внешний пилот.

## Локальный запуск

Нужен Node.js 24.

```text
npm ci
npm run seed
npm run build
npm run check
npm test
npm start
```

Открыть http://127.0.0.1:3000 . Demo teacher: DEMO / 0000; ученики Lumi/1111, Ziggy/2222, Neo/3333, Khoa/4444, Nia/5555, Rex/6666. Это открытые синтетические fixtures; pilot запрещает DEMO. Существующий platform/data сохраняется, seed не сбрасывает его. Тесты создают отдельный временный DATA_DIR. Reset выключен; точечную коррекцию разрешает преподаватель, рефлексия редактируется напрямую.

Конфигурация: скопировать .env.example в .env и изменить нужные параметры. По умолчанию mock без интернета; его картинки не реагируют на промпт и не служат оценкой обучения. Live требует ключ/доступ к моделям и отдельный контроль бюджета.

Контекст: AGENTS.md, SESSION.md, docs/CONTEXT_MAP.md. Методика: curriculum/DECISIONS.md, SOURCES.md и Lesson_N.md. Форматы: docs/CONTRACT.md. Деплой/backup: docs/DEPLOY_RUNBOOK.md. Готовность и открытые проверки: docs/IMPLEMENTATION_STATUS.md. Новые уроки: docs/ADD_LESSON.md. Перенос: GITHUB_SETUP_AND_AGENT_GUIDE.md.

Проверка выводов другого агента: docs/AUDIT_DISPOSITION_2026-10-29.md. Работа с ветками: GITHUB_SETUP_AND_AGENT_GUIDE.md. Для проверки без рабочего сервера: npm run smoke:isolated. Для браузерного теста нужен Chrome на Windows или установленный Playwright Chromium на Linux.

Backup при остановленном приложении: npm run backup -- ABSOLUTE_NEW_SNAPSHOT_DIRECTORY. Restore в новый пустой DATA_DIR: npm run restore -- ABSOLUTE_SNAPSHOT_DIRECTORY. Примеры и проверки в DEPLOY_RUNBOOK.
