# Meal Planning Domain

## v1 behavior

- Dinner planning is driven from calendar UI.
- `meal_plans` keeps truth per date.
- Meal can reference recipe, free text title, or external URL.

## Why separate meals domain

Middag vises i kalenderen, men skal ikke blandes med kalenderhendelser i lagringslaget.

## Core flow

1. User chooses date in calendar.
2. Creates or updates dinner entry.
3. Optionally links recipe.
4. Calendar day view renders meal as contextual block.

## Future link to shopping

`meal_plans` + `recipes` + `recipe_ingredients` will later power shopping suggestions.
