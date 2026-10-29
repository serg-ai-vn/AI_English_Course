# Текущее состояние

0.6.0, pilot-1. Владелец разрешил изменения в исходном Main и загрузку очищенного проекта в serg-ai-vn/AI_English_Course. По последнему запросу репозиторий приватный.

Читать AGENTS, tasks/00-BACKLOG, SYSTEM_INVARIANTS; маршруты в CONTEXT_MAP. Research Фазы 0/4.1 локально в curriculum/research; SOURCES/DECISIONS различают обзор, принятое решение и гипотезу.

Реализованы локальные исправления аудита: экспорт и безопасность, гейты, точечные коррекции с журналом, schema/course/revision, Node builder, mock/live-адаптер, лимиты, backup/restore, tests/CI, Docker/VPS-runbook. Исходный прогресс владельца сохранён.

Независимая приёмка кода 7dcd350: PASS, 6/6 тестов и отдельная проверка Chrome. Протокол docs/ACCEPTANCE.md. После объединения PR #1 рабочая ветка main; следующая работа — реальные API и открытые проверки из docs/IMPLEMENTATION_STATUS.md. Live API, Docker/VPS и учебный пилот не считать пройденными без фактических результатов.
