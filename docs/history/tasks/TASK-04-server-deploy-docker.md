> HISTORICAL SNAPSHOT 2026-10-29. Not instructions for current development.

# TASK-04: Подготовка к деплою на облачный Linux-сервер (Docker / Railway / Render / VPS)

## Контекст задачи
После выполнения `TASK-01`, `TASK-02` и `TASK-03` приложение полностью отвязано от Windows PowerShell и готово к запуску на внешнем сервере для тестирования с реальными учениками.

Цель этой задачи — добавить в репозиторий конфигурацию контейнеризации (`Dockerfile`, `.dockerignore`, `docker-compose.yml`), эндпоинт проверки здоровья `/api/health` и поддержку прослушивания внешнего интерфейса `0.0.0.0` с настраиваемым портом `process.env.PORT`.

## Файлы для чтения и изменения
1. `platform/server.js`
2. `Dockerfile` (создать в корне)
3. `.dockerignore` (создать в корне)
4. `docker-compose.yml` (создать в корне)

---

## Пошаговый план реализации

### 1. Обновить запуск сервера и добавить `/api/health` в `platform/server.js`
1. Добавить маршрут `GET /api/health` (без авторизации), который возвращает `200 OK`:
   ```json
   {
     "ok": true,
     "version": "0.5.0",
     "aiProvider": "mock",
     "uptime": 123
   }
   ```
2. Убедиться, что сервер слушает `const HOST = process.env.HOST || '0.0.0.0'` и `const PORT = Number(process.env.PORT) || 3000`, чтобы облачные платформы (Railway, Render, Fly.io, DigitalOcean App Platform) могли пробрасывать трафик в контейнер.

### 2. Создать `Dockerfile` и `docker-compose.yml`
- Базовый образ: `node:20-alpine` (легковесный Linux-образ ~45 МБ).
- Рабочая директория: `/app`.
- Тома (Volumes) в `docker-compose.yml` для сохранения прогресса учеников и собранных сайтов при перезапуске контейнера:
  - `./platform/data:/app/platform/data`
  - `./dist:/app/dist`
  - `./platform/public/generated:/app/platform/public/generated`
- Настроить `HEALTHCHECK` в `Dockerfile` через обращение к `http://localhost:3000/api/health`.

---

## Критерии приёмки (Acceptance Criteria)
1. Запрос `GET http://localhost:3000/api/health` возвращает `200 OK` с JSON-статусом.
2. Приложение успешно запускается с переменной окружения `PORT=4000` и слушает `0.0.0.0:4000`.
3. Конфигурации `Dockerfile` и `docker-compose.yml` валидны и готовы к деплою в 1 клик на Railway / Render / VPS.
