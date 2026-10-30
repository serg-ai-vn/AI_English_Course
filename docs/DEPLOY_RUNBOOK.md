# Один процесс: репетиция, запуск и восстановление

Node24 → npm ci → npm run seed → npm run build → npm run check → npm test → npm run test:ui → npm start. Windows UI-test использует установленный Chrome; Linux/CI предварительно npx playwright install --with-deps chromium. UI_PORT можно задать для параллельной независимой проверки. Тесты создают свой DATA_DIR и не используют рабочий сервер3000. npm run smoke:isolated проверяет HTTP на собственном порту.

Без .env demo запускается на http://127.0.0.1:3000. Для локального pilot используются APP_MODE=pilot, AI_PROVIDER=openai, рабочий ключ и новые classes.json в отдельном абсолютном DATA_DIR. PUBLIC_ORIGIN=http://127.0.0.1:3000 или фактический LAN origin; на HTTP cookie без Secure. Не включать TRUST_PROXY ради исправления обычного localhost.

Сервера/домена пока нет. Для VPS: Dockerfile + compose.yaml, один процесс Node24 и volume /data. Порт привязан только к localhost VPS. В .env задать APP_MODE=pilot, AI_PROVIDER=openai, ключ/модели/лимиты, PORT=3000 (либо4000), PUBLIC_ORIGIN=https://YOUR_DOMAIN. Compose сопоставляет тот же PORT с приложением. Прокси, например Caddy, направляет домен на 127.0.0.1:PORT. TRUST_PROXY оставить пустым при явном PUBLIC_ORIGIN; если origin вычисляется из forwarded, доверять только явно перечисленным адресам или loopback. true означает только loopback, не весь интернет. Не использовать localhost как trusted proxy адрес контейнерного bridge по догадке.

Перед pilot вручную provision /data/classes.json по синтетической схеме fixtures: новый код класса, уникальные slug id, псевдонимы, новые PIN (рекомендуются ≥6 цифр). DEMO/0000 не допускаются. Файл и .env доступны только владельцу процесса; реальные имена хранятся отдельно. Учительский override: для PILOT-A использовать TEACHER_PIN_PILOT_A; регистр нормализуется, дефис заменяется underscore. Неоднозначные коды с одним настроенным env-ключом отвергаются.

Перед занятием: npm run check:live -- --text --image. Это явные платные запросы (до2 text и1 image), сохраняют usage/синтетическую картинку и проверку текущих моделей в DATA_DIR; ключ и ученические данные не печатаются. Без флагов вызовов нет. Сверить usage с актуальным прайсом и фактическими расходами аккаунта. Quality задаётся OPENAI_IMAGE_QUALITY (default medium); AI_*_REQUEST_LIMIT — количество обращений включая ошибки, не долларовый бюджет. Health ok проверяет процесс; liveChecked — кэш успешных проверок, не обещание будущего ответа. Ошибки интерфейс показывает без подмены mock.

docker compose up -d --build запускает подготовленную конфигурацию. CI node tools/check-container.js проверяет образ, PORT4000 и сохранение сессии/прогресса при пересоздании собственного тестового контейнера/volume. Это не VPS-приёмка.

Перед обновлением остановить приложение и сделать согласованный snapshot, не полагаться на Git для ученического прогресса. Текстовые примеры PowerShell (пути заменить):

~~~powershell
$env:DATA_DIR='D:\CourseData'
npm run backup -- 'D:\CourseBackups\before-update-001'
# Восстановление только в НОВЫЙ пустой DATA_DIR:
$env:DATA_DIR='D:\CourseRestoreCheck'
npm run restore -- 'D:\CourseBackups\before-update-001'
~~~

Sessions в backup не входят. При восстановлении сверяются SHA-256; непустой DATA_DIR/пересекающиеся каталоги отвергаются. Запустить восстановленную копию с тем же courseVersion/schemaVersion и проверить вход, прогресс, изображения и результат. Для Docker копировать volume при остановленном app и восстанавливать в новый volume с владельцем node. Снимки вне Git с ограниченным доступом. Старые данные сохранять до приёмки копии.

Откат кода: предыдущий проверенный tag/образ; при необходимости связанный совместимый snapshot. Общую main не переписывать. Перед внешней группой отдельно проверить HTTPS, отказ demo, private preview, новый PORT, пересоздание контейнера, restore на новом volume с замером времени, весь маршрут на выбранном устройстве. VPS/HTTPS/физическое устройство NOT_RUN до фактического запуска.
