# TASK-05: План и архитектура миграции на Supabase (Этап 2 — Масштабирование)

> **Статус:** Отложенная задача Этапа 2 (выполнять ТОЛЬКО после проведения первого пилота на файловом движке из `TASK-01..04`).

## Контекст задачи
Для первого пилота (1–2 группы по 4–8 учеников) локального JSON-хранилища с атомарной записью (`TASK-01`) и Linux-сборщика (`TASK-02`) более чем достаточно.
Когда проект перейдёт к одновременной работе нескольких групп, онлайн-потоков и постоянному облачному хостингу детских сайтов по коротким ссылкам для родителей в Zalo, хранилище переводится на **Supabase (PostgreSQL + Supabase Storage)**.

---

## Архитектура миграции

### 1. Схема таблиц PostgreSQL в Supabase (`supabase/schema.sql`)

```sql
-- 1. Таблица учебных классов (групп)
create table public.classes (
  code text primary key,
  teacher_pin_hash text not null,
  unlocked_lessons int[] not null default '{2}',
  created_at timestamptz not null default now()
);

-- 2. Таблица учеников и их прогресса
create table public.students (
  id uuid primary key default gen_random_uuid(),
  class_code text not null references public.classes(code) on delete cascade,
  student_slug text not null,
  display_name text not null,
  current_lesson int not null default 2,
  unlocked_lessons int[] not null default '{2}',
  fields jsonb not null default '{}'::jsonb,
  complete boolean not null default false,
  built boolean not null default false,
  published_url text,
  updated_at timestamptz not null default now(),
  unique (class_code, student_slug)
);

-- 3. Таблица активных сессий
create table public.sessions (
  token text primary key,
  class_code text not null references public.classes(code) on delete cascade,
  role text not null check (role in ('student', 'teacher')),
  student_slug text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
```

### 2. Supabase Storage (Бакеты для картинок и готовых сайтов)
1. **`student-assets` (Public Bucket)**: хранит сгенерированные OpenAI картинки (`<class_code>/<student_slug>/<field_id>-v<n>.png`), чтобы они не пропадали при пересоздании контейнера.
2. **`published-sites` (Public Bucket)**: хранит собранные HTML-файлы учеников (`<class_code>/<student_slug>/index.html`), раздавая их по быстрой мобильной ссылке для родителей в Zalo с возможностью удаления в 1 клик из консоли учителя.

### 3. Паттерн внедрения в `platform/server.js`
- Выделить чтение/запись состояния в модуль `platform/storage.js` с единым асинхронным интерфейсом:
  - `await storage.getClasses()`
  - `await storage.getStudentProgress(classCode, studentSlug)`
  - `await storage.saveStudentProgress(classCode, studentSlug, progress)`
  - `await storage.getSession(token)` / `await storage.createSession(...)`
- Переключение между локальными JSON-файлами и Supabase осуществляется одной переменной в `.env`: `STORAGE_DRIVER=json` или `STORAGE_DRIVER=supabase`.
