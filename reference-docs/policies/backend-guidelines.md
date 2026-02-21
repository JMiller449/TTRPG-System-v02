# Backend Guidelines (FastAPI/WebSocket)

## Stack
- API layer: FastAPI.
- Transport: WebSocket endpoint for intent ingestion and state sync.
- State: in-memory singleton with persisted dev dump (`state_dumpy.json`) during local development.

## Responsibilities
- Validate incoming intents.
- Execute all rule-driven calculations and outcome resolution.
- Emit authoritative incremental patches and error responses.
- Gate GM-only actions behind a server-side GM password toggle.

## Contract Discipline
- Keep request/response `type` values stable and version-aware.
- Update schema types, handlers, and tests together in one change set.
- Favor explicit error payloads for invalid intents and rule violations.

## Reliability
- On connect: send full snapshot.
- On update: send incremental patch operations.
- On client desync: provide forced snapshot resync path.

## Rules Authority
- Use `Chip TTRPG System_2-20-26.pdf` as source of truth.
- If a rule is not explicit, add a TODO and defer implementation detail until clarified.
