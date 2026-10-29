# Архитектура и состояние 0.6.1

Node 24 + sharp, один процесс, JSON DATA_DIR. settings читает .env, storage пишет атомарно и не перезаписывает повреждение. AI_PROVIDER=mock/openai выбирается явно; live не подменяется demo при сбое.

| Слой | Источник истины и связь |
|---|---|
| Методика / зачем | curriculum/DECISIONS, SOURCES и Lesson_N. Причины, гипотезы, допустимость изменения правил. |
| Исполняемый урок | platform/config/lesson-N.json. Типы полей, рубежи, банк слов, число итераций; согласовать со Spec. |
| Решения сервера | validate + server: проверка правил, доступа, состояния и очередь записи ученика. UI не может обойти гейт. |
| Действия пользователя | public/app, teacher, login и CSS: один активный этап, явная ошибка, сохранение черновика формы, названия полей/версий. |
| Долговременная работа | storage и DATA_DIR: schema/course/revision, прежние итерации, corrections, одноразовые grants, l1Checks. |
| Результат | site-builder/fill-slots/template: один самостоятельный HTML. Коррекция отзывает built/published/audit до повторной проверки и сборки. |

Тесты, CONTRACT и эксплуатация проходят через все слои. При смене количества попыток прочитать методику и проверить все затронутые слои. Для цвета кнопки достаточно UI/стилей и её пользовательского пути; расширить контекст, если обнаружилась межурочная зависимость.

| Машина состояния | Маршрут |
|---|---|
| L2 About Me | A1 prompt → draft/evaluation → A2 improved prompt → draft/evaluation → A3 manual edit/publish → done |
| L2 hobby | B1 prompt/draft → publish либо manual edit + reason/bonus → done |
| L3 avatar/background | prompt → image → pros/cons → повтор в рамках config → разные best/worst + причины → accept → done |
| L4 hobby images | prompt → image → publish либо изменённая структура + причина → новая версия в пределах config → publish |
| L4 theme | option1 → option2 → choose → comparative design justification → done |
| L5 | checklist + 6 reflections + общий словарный гейт → teacher export |
| Коррекция | done → одноразовое разрешение учителя → валидная новая версия и причина → done с corrections; reflection-* без разрешения |

Старые изображения без version выбираются по прежнему порядку итераций (1-based); сохранённая история не переписывается. Старый ai-cycle читается/показывается; неиспользуемая запись /api/save-edit удалена. Checklist не корректируется этим маршрутом, он перепроверяется после изменения контента.

Teacher overview возвращает completedFields всех уроков, включая обычные direct-поля и активные editGrants. POST /api/teacher/allow-correction {studentId,field,reason}; POST /api/correct-field {field,text,reason}. Учитель ограничен своим классом. POST /api/teacher/l1-ready {studentId,ready:boolean} сохраняет мягкую отметку бумажной работы; она не блокирует L2 и не требует миграции старых профилей.

GET /api/health: ok — процесс отвечает; liveChecked/readiness — успешные text/image проверки текущего ключа/моделей за 24 часа без последующего сбоя соответствующего типа. Это кэш, не вызов API и не гарантия урока. Ошибки 401/403/404/429 провайдера, таймаут, отказ и невалидный результат имеют понятные коды. Учебная попытка сохраняется только при успешном ответе; бюджет учитывает и неуспешные обращения.

Cookie HttpOnly/SameSite=Strict, Secure по HTTPS-транспорту/явному PUBLIC_ORIGIN; HTTP локально работает и в pilot. Forwarded-заголовок принимается только от явно доверенного адреса. Прокси и Origin: DEPLOY_RUNBOOK. Ограничения запросов: на учётную запись/маршрут 120 в минуту, login IP 60, общий IP 600, неверные попытки 10 на аккаунт/IP в минуту; это настройки малого пилота, не нагрузочная гарантия.
