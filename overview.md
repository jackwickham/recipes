# Recipe App

A personal recipe web app with LLM-powered import, quantity scaling, and cooking timers.

## Features

- **Smart Import**: Add recipes from photos, URLs, or pasted text - the LLM extracts and structures everything
- **Automatic Normalisation**: Converts to metric units, fan oven temperatures, and British ingredient names
- **Quantity Scaling**: Adjust servings and all quantities update in real-time
- **Cooking Timers**: Start timers directly from recipe steps with audio alerts
- **Screen Wake Lock**: Keep your screen on while cooking
- **Recipe Chat**: Ask questions about a recipe or request modifications (make it vegetarian, substitute ingredients, etc.)
- **Fuzzy Search**: Find recipes by title, ingredients, or tags
- **Cooking List**: Save recipes you're planning to make

## Getting Started

### Prerequisites

- Node.js 20+
- A Google API key with access to Gemini models

### Development

```bash
# Install dependencies
npm install

# Create config files
cp config.example.yml config.yml
cp secrets.example.yml secrets.yml

# Edit secrets.yml to add your Google API key

# Start development servers (frontend + backend)
npm run dev
```

The app will be available at http://localhost:5173 (frontend) with API proxied to http://localhost:3000 (backend).

### Production with Docker

```bash
# Build and run
docker-compose up --build

# Or build manually
docker build -t recipes .
docker run -p 3000:3000 \
  -v ./config.yml:/app/config.yml:ro \
  -v ./secrets.yml:/app/secrets.yml:ro \
  -v recipes-data:/data \
  -e SECRETS_FILE=/app/secrets.yml \
  recipes
```

## Configuration

### config.yml

```yaml
port: 3000

database:
  path: ./data/recipes.db

llm:
  provider: google
  textModel: gemini-2.0-flash       # For recipe parsing and chat
  imageModel: gemini-2.0-flash      # For photo OCR
```

### secrets.yml

```yaml
google:
  apiKey: your-google-api-key-here
```

Set the `SECRETS_FILE` environment variable to specify a custom path (defaults to `./secrets.yml`).

---

## Technology Stack

- **Backend**: TypeScript, Express, SQLite (better-sqlite3)
- **Frontend**: TypeScript, Preact, Vite
- **LLM**: Google Gemini via @google/genai SDK
- **Search**: Fuse.js for client-side fuzzy matching

### Key Design Decisions

1. **Monorepo with npm workspaces** - Simple dependency management with shared types
2. **No authentication** - Personal use only, run on local network or behind auth proxy
3. **Synchronous SQLite** - Simpler code, adequate for single-user scenario
4. **No photo storage** - Photos processed by vision LLM, only extracted text stored
5. **Client-side filtering** - All recipes loaded at once, filtered in browser
6. **Local Storage for User State** - Chat history and cooking lists are stored in the browser, keeping the backend stateless and simple

---

## Recipe Markers

Recipes use special markers in step instructions that enable interactive features:

### Quantity Markers

Format: `{{qty:VALUE:UNIT}}` - Scales with serving adjustments

```
Add {{qty:500:g}} flour          → "Add 500g flour" (or "Add 1kg flour" at 2x)
Beat {{qty:3:}} eggs             → "Beat 3 eggs" (no unit for countable items)
Pour in {{qty:200:ml}} milk      → "Pour in 200ml milk"
```

### Timer Markers

Format: `{{timer:MINUTES}}` - Renders a "Start Timer" button

```
Simmer for {{timer:15}}          → Shows a 15-minute timer button
Bake for {{timer:45}}            → Shows a 45-minute timer button
```

---

## API Reference

### Recipes

```
GET    /api/recipes              # List all recipes (with ingredients, tags)
GET    /api/recipes/:id          # Get single recipe with full details
POST   /api/recipes              # Create new recipe
PUT    /api/recipes/:id          # Update recipe
DELETE /api/recipes/:id          # Delete recipe
PATCH  /api/recipes/:id/rating   # Update rating only
```

### Import

```
POST   /api/import/url           # Import from URL (fetches page, extracts recipe)
POST   /api/import/photos        # Import from photos (base64 images)
POST   /api/import/text          # Import from pasted text
```

### Chat

```
POST   /api/recipes/:id/chat     # Send message with history, get response
```

### Tags

```
GET    /api/tags                 # List all unique tags
```

---

## Project Structure

```
recipes/
├── backend/
│   └── src/
│       ├── index.ts              # Express app entry point
│       ├── routes/
│       │   ├── recipes.ts        # Recipe CRUD endpoints
│       │   ├── import.ts         # LLM-powered import
│       │   └── chat.ts           # Recipe chat endpoints
│       ├── services/
│       │   ├── llm/              # LLM interface and providers
│       │   ├── recipe-parser.ts  # Parsing prompts
│       │   └── config.ts         # YAML config loading
│       └── db/
│           ├── schema.sql        # Database schema
│           └── queries.ts        # Typed query functions
│
├── frontend/
│   └── src/
│       ├── app.tsx               # Router setup
│       ├── api/client.ts         # API client
│       ├── pages/
│       │   ├── Home.tsx          # Recipe list with search/filter
│       │   ├── RecipeDetail.tsx  # Recipe view with scaling/timers
│       │   ├── AddRecipe.tsx     # Import flow
│       │   ├── EditRecipe.tsx    # Edit form
│       │   └── CookingList.tsx   # Saved recipes
│       ├── components/
│       │   ├── RecipeCard.tsx    # Grid card
│       │   ├── RecipeForm.tsx    # Add/edit form
│       │   ├── ScalingControls.tsx
│       │   ├── Timer.tsx
│       │   └── ChatModal.tsx
│       ├── hooks/
│       │   ├── useTimer.ts       # Timer state management
│       │   ├── useWakeLock.ts    # Screen wake lock API
│       │   └── useCookingList.ts # localStorage persistence
│       └── utils/
│           └── scaling.ts        # Quantity scaling logic
│
├── shared/
│   └── types.ts                  # Shared TypeScript interfaces
│
├── Dockerfile
├── docker-compose.yml
├── config.example.yml
└── secrets.example.yml
```

---

## Database Schema

```sql
-- Core recipe table
CREATE TABLE recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    servings INTEGER,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    rating TEXT CHECK(rating IN ('meh', 'good', 'great')),
    source_type TEXT NOT NULL CHECK(source_type IN ('photo', 'url', 'text')),
    source_text TEXT,
    source_context TEXT,
    parent_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ingredients, steps, and tags tables
-- See backend/src/db/schema.sql for full schema
```
