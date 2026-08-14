# Children Domain

## Scope in v1

- Child profile CRUD
- Measurements (height, weight minimum)
- Quotes (from child profile and from calendar)
- Notes
- Basic timeline via read model

## Why children is a first-class domain

Barn er et sentralt domeneobjekt med egen historikk, og skal ikke modelleres som en generell personrad uten domeneatferd.

## Aggregate roots

- `children`
- `child_measurements`
- `child_quotes`
- `child_notes`
- `child_milestones`

## Timeline strategy

Ingen dobbel lagring av sitater i egen timeline-tabell i v1. Tidslinjen bygges som sammensatt read model.

## Role policy

- `owner`/`adult`: opprette/redigere/arkivere barn.
- `member`: lese barnedata og registrere hendelser etter policy.

## Medical boundary

Domene er familiehistorikk og praktisk hverdag, ikke medisinsk journal.
