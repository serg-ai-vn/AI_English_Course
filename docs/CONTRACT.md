# Контракт сайта и данных

Версия прогресса schemaVersion=1, courseVersion=pilot-1. Старый JSON без версии читается как pilot-1 без обнуления; при следующей записи получает метки. До первого обновления сохранён проверенный snapshot; неизвестная версия отвергается. revision растёт при записи. Один процесс; операции ученика и учительские изменения того же ученика сериализованы.

SITE_DATA: theme (id из lesson-4), pageTitle (plain text), slots (plain text, включая About Me), images ({src,alt}). В About Me DOM-обёртка p создаётся fill-slots; сырой HTML не принимается. Legacy внешняя p-обёртка снимается при экспорте. JSON экранирует <; title HTML-экранирован.

Вход tools/site-builder: rootDir, dataDir, config/configPath, outPath. Ассеты: demo-assets/, rehearsal/assets/ или runtime/ (относительно DATA_DIR). В выдаче только embedded image data URI. Самостоятельный файл содержит CSS/JS/изображения/частицы; Google Fonts остаются внешними, без сети используются локальные fallback-шрифты.

Аватар нормализуется 256×256, alpha<128 пропускается, step=4, точки [x,y,luminance0…255]. Частицы кэшируются по SHA-256 содержимого и параметрам, лежат в DATA_DIR/particles. Для нового аватара старый силуэт не используется. Изображения нормализует sharp с закреплённой версией, собственный PNG-кодек не нужен.

Runtime: classes/progress/sessions/generated/particles/sites/published/export-configs в DATA_DIR. Fixtures синтетические и отдельно. Черновой HTML /preview/dist/id.html требует авторизации владельца/учителя своего класса и действующей метки built. Публикация копирует immutable HTML под случайным токеном /published/token.html; это доступ по ссылке, не публичный список. Коррекция отзывает ссылку; старые файлы можно удалить при очистке по срокам хранения.
