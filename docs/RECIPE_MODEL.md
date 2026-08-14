# Recipe Model

## Goals

- Support internal and external recipes.
- Keep ingredients structured for future shopping integration.

## Tables

- `recipes`
- `recipe_ingredients`
- `ingredients`
- `ingredient_aliases`

## Source types

- `internal`: full instructions + ingredients
- `external`: title + URL
- `hybrid`: both URL and internal notes/adjustments

## v1 limits

No advanced scraping or AI parsing in first release.
