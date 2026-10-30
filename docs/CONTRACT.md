# Контракт сайта и данных

Версия прогресса schemaVersion=1, courseVersion=pilot-1. Старый JSON без версии читается как pilot-1 без обнуления; при следующей записи получает метки. До первого обновления сохранён проверенный snapshot; неизвестная версия отвергается. revision растёт при записи. Один процесс; операции ученика и учительские изменения того же ученика сериализованы.

SITE_DATA: theme (id из lesson-4), pageTitle (plain text), slots (plain text, включая About Me), images ({src,alt}). В About Me DOM-обёртка p создаётся fill-slots; сырой HTML не принимается. Legacy внешняя p-обёртка снимается при экспорте. JSON экранирует <; title HTML-экранирован.

Вход tools/site-builder: rootDir, dataDir, config/configPath, outPath. Ассеты: demo-assets/, rehearsal/assets/ или runtime/ (относительно DATA_DIR). В выдаче только embedded image data URI. Самостоятельный файл содержит CSS/JS/изображения/частицы; Google Fonts остаются внешними, без сети используются локальные fallback-шрифты.

Аватар нормализуется 256×256, alpha<128 пропускается, step=4, точки [x,y,luminance0…255]. Частицы кэшируются по SHA-256 содержимого и параметрам, лежат в DATA_DIR/particles. Для нового аватара старый силуэт не используется. Изображения нормализует sharp с закреплённой версией, собственный PNG-кодек не нужен.

Runtime: classes/progress/sessions/generated/particles/sites/published/export-configs в DATA_DIR. Fixtures синтетические и отдельно. Черновой HTML /preview/dist/id.html требует авторизации владельца/учителя своего класса и действующей метки built. Публикация копирует immutable HTML под случайным токеном /published/token.html; это доступ по ссылке, не публичный список. Коррекция отзывает ссылку; старые файлы можно удалить при очистке по срокам хранения.

## Дополнение 0.6.1 (без смены courseVersion)

Teacher overview добавляет completedFields всех уроков (id/label/input/lesson/grant) и l1Ready. Teacher-only POST /api/teacher/l1-ready {studentId,ready:boolean} пишет l1Checks/l1Ready; отметка мягкая, старые профили не блокируются. Checklist не принимает edit-grant. Старый /api/save-edit удалён, чтение старого ai-cycle сохраняется.

Provider failure: {ok:false,code,error,errors:[{rule,hint}]} с HTTP422 для refusal/demo_context, HTTP429 для локального group_budget, HTTP503 для доступа/модели/rate limit/timeout/network, HTTP502 для невалидного ответа. После максимум одного repair прогресс не меняется при отказе. /api/health ok — liveness, liveChecked/readiness — кэш текущего fingerprint за24ч. Readiness не вызывает провайдера. ai-readiness.json приватен; usageTotals суммирует числовые поля usage всех полученных ответов текущей конфигурации, включая неудачный repair, не является суммой в долларах.
