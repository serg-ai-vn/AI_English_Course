---
title: "Background prompt templates (Preset v3) - каркасы промптов фона для сервера"
created: 2026-07-21
updated: 2026-07-21
tags: [english, task]
status: active
related: [../16_source_theme_presets.md, PLAN.md]
---

# Background prompt templates (Preset v3)

Для серверного пайплайна: фон генерируется так, чтобы быть **одновременно**
в мире выбранного пресета и личным для ученика.

Формула промпта:

```
[каркас темы из таблицы ниже] + [слова ученика из описания настроения, Занятие 4, дословно]
```

Технические требования к результату (добавлять в каждый промпт):
`abstract background, soft and muted, no text, no people, no faces, suitable as a calm website backdrop with text on top, 1600x900`

## Каркасы по темам

| Пресет | Каркас промпта фона |
|---|---|
| Sunny Day | Soft warm pastel gradient background, gentle sunshine tones, subtle paint splashes and soft light blobs, airy and friendly |
| Ocean Calm | Gentle sea-inspired gradient background, soft blue-green tones, faint water rings and light ripples, peaceful and airy |
| Forest Explorer | Warm earthy gradient background, soft beige and moss tones, subtle leaf and rhombus shapes scattered lightly, natural and grounded |
| Comic Pop | Bold flat background, clean white base with playful red and yellow comic shapes and halftone dots, energetic but uncluttered |
| Comet Trail | Soft lavender-grey background with glowing violet and teal geometric shapes floating, futuristic, gentle depth |
| Deep Focus | Pure black background with a faint constellation of small violet and amber triangular particles drifting, subtle, cinematic |

## Пример сборки (Rex, репетиция)

Вход от ученика (L4): *"I want my site to feel cool and futuristic, like outer space and technology."*
Тема: Comet Trail.

Итоговый промпт:
> Soft lavender-grey background with glowing violet and teal geometric shapes floating, futuristic, gentle depth; inspired by: "cool and futuristic, like outer space and technology". Abstract background, soft and muted, no text, no people, no faces, suitable as a calm website backdrop with text on top, 1600x900.

## Правила

- Слова ученика вставляются дословно после `inspired by:` - это его голос, но внутри твоего каркаса.
- Если слова ученика конфликтуют с темой (троллинг, "make it ugly") - каркас темы имеет приоритет, слова добавлять только если они нейтральны/позитивны. Проверка - кодом по стоп-листу, не ИИ.
- Фон никогда не содержит людей, текста и логотипов.
