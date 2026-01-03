# AGENTS.md

## Project Overview

Personal recipe web app with LLM-powered import. See [overview.md](overview.md) for full documentation including features, configuration, API reference, and project structure.

## Commands

```bash
# Development (runs both frontend and backend)
npm run dev

# Build all packages (must be in order: shared → frontend → backend)
npm run build

# Run production server (after build)
npm run start
```

## Architecture

**Monorepo with npm workspaces**: `shared/`, `backend/`, `frontend/`

- **shared**: TypeScript types used by both backend and frontend (`@recipes/shared`)
- **backend**: Express server with SQLite database, serves the built frontend in production
- **frontend**: Preact SPA with Vite, proxies API calls to backend in development

**Data flow for recipe import**:

1. User provides input (photo/URL/text) → `frontend/src/pages/AddRecipe.tsx`
2. Frontend calls `/api/import/*` → `backend/src/routes/import.ts`
3. Backend sends to LLM for parsing → `backend/src/services/recipe-parser.ts`
4. LLM returns structured JSON with markers → frontend shows review screen
5. User confirms → recipe saved to SQLite

**Key patterns**:

- LLM interface in `backend/src/services/llm/interface.ts` - add new providers here
- Database queries are synchronous (better-sqlite3) in `backend/src/db/queries.ts`
- Frontend state is local component state, no global store
- Cooking list persisted to localStorage via `useCookingList` hook

## Recipe Markers

Step instructions contain markers that the frontend renders interactively:

- `{{qty:VALUE:UNIT}}` - Scalable quantity (e.g., `{{qty:500:g}}` for 500g)
- `{{timer:MINUTES}}` - Timer button (e.g., `{{timer:15}}` for 15 min)

Parsing: `frontend/src/utils/scaling.ts`
Generation: `backend/src/services/recipe-parser.ts` (LLM prompt)

## Configuration

- `config.yml` - Database path, LLM models (loaded from fixed path `./config.yml`)
- `secrets.yml` - API keys (path via `SECRETS_FILE` env var, defaults to `./secrets.yml`)
- See `config.example.yml` and `secrets.example.yml` for format

## Conventions

- Preact uses `class` not `className` in JSX
