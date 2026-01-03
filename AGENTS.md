# AGENTS.md

## Project Overview

Personal recipe web app with LLM-powered import. See [overview.md](overview.md) for full documentation including features, configuration, API reference, and project structure. Make sure to update overview.md and AGENTS.md as appropriate after making substantial changes, to ensure that it's still up to date.

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

## Issue tracking

Use Beads (`bd`) for issue tracking.

```bash
# Create new issues
bd create "Add user authentication"
bd create "Create LLM integration" -d "Description of what and why" -t feature -p 0

# View all issues
bd list

# View issue details
bd show <issue-id>

# Create dependencies between tasks
bd dep add <child> <parent>

# Update issue status
bd update <issue-id> --status in_progress
bd update <issue-id> --status done
```
