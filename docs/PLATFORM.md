# Фактическая реализация 0.6.0

Node 24, sharp; JSON-хранилище одного процесса. settings.js читает .env до запуска; storage.js создаёт только отсутствующие demo-данные, пишет атомарно и не скрывает повреждение. server.js содержит существующие стейт-машины и общий router с проверкой доступа/состояния/очередью. ai-provider.js разделяет mock/live без скрытой подмены.

Основные API: login/logout/me; save-direct, prompt/save-eval/submit-text; image-prompt/eval/best/worst/accept/regenerate/publish; theme-prompt/second/choose/justify; teacher overview/unlock-lesson/build-site/export-site. POST /api/teacher/allow-correction {studentId,field,reason} даёт одно разрешение; POST /api/correct-field {field,text,reason} сохраняет прежний результат в corrections и отзывает старые сборки. reflection-* можно корректировать без повторного разрешения.

GET /api/health сообщает версию, mode и aiProvider. Pilot запрещает DEMO и mock; production credentials создаются вне репозитория. Сессии имеют TTL; cookie HttpOnly/SameSite=Strict, в pilot Secure. Bearer поддерживается для тестов/API. Учитель ограничен своим классом. Reset сервером отключён по умолчанию.

Нет загрузки фото L1, Supabase, универсального редактора уроков и ИИ-тьютора. Mock не оценивает методику и не отражает изменения промпта визуально. Реальные API и Docker/VPS требуют отдельной приёмки, указанной в IMPLEMENTATION_STATUS.md.
