# Recipe app

This is a recipes web app, for personal use. Generally bias towards avoiding unnecessary complexity since it's just for personal use.

## Technologies

### Core Stack

- **Backend**: TypeScript with Express
- **Frontend**: TypeScript with Preact (lightweight React alternative, ~3kb, familiar JSX syntax)
- **Database**: SQLite via better-sqlite3 (synchronous API, simpler than async alternatives)
- **Build**: Vite for frontend bundling, tsx for backend dev server

### LLM Integration

- LLM-agnostic design with a common interface:
  ```typescript
  interface LLM {
    complete(prompt: string): Promise<string>;
    completeWithImage(prompt: string, imageBase64: string): Promise<string>;
  }
  ```
- Implementations for: Google (Gemini 3 Flash (`gemini-3-flash-preview`), Gemini 3 Pro Image (`gemini-3-pro-image-preview`)), with model selection via environment variable
- Structured output parsing using JSON mode where available, with fallback regex extraction

### Other Key Technologies

- **HTTP client**: Native fetch for URL recipe extraction
- **Styling**: Plain CSS with CSS variables for theming (no framework needed for personal use)
- **State management**: Preact signals for simple reactive state
- **Routing**: preact-router for frontend navigation
- **Fuzzy search**: Fuse.js for client-side fuzzy matching

### Development

- Monorepo structure with shared types
- No separate ORM - raw SQL with typed wrappers
- Configuration via YAML files:
  - `config.yml` - main config (database path, LLM model selection, etc.) at fixed path `./config.yml`
  - Secrets file (API keys) - path configured via `SECRETS_FILE` env var, defaults to `./secrets.yml`

### Deployment

- **Docker**: Single-stage Dockerfile for production
  - Node.js Alpine base image
  - Builds frontend, bundles with backend
  - Exposes single port (default 3000)
  - Expects config volume mount and `SECRETS_FILE` env var
  - SQLite database file mounted as volume for persistence

## Workflows & UX

### Adding new recipes

#### Input Methods

Three options presented as large buttons on the "Add Recipe" screen:

1. **Photo capture**

   - Camera button opens device camera (or file picker on desktop)
   - Support multiple photos (e.g., ingredients on one page, method on another)
   - Show thumbnails of selected images with ability to remove/reorder
   - "Extract Recipe" button sends to vision LLM for OCR/extraction
   - Photos are not stored - only the extracted text is saved

2. **URL import**

   - Text input for URL
   - "Import" button fetches page HTML, sends entire document to LLM for extraction
   - Show loading state with "Fetching page..." then "Extracting recipe..."

3. **Paste text**
   - Large textarea for pasting recipe text
   - "Process" button sends directly to LLM

#### Processing Pipeline

Once raw text is obtained (from any method):

1. **Extraction**: LLM parses into structured format:

   - Title
   - Description/intro
   - Servings/yield
   - Prep time, cook time
   - Ingredients (name, quantity, unit)
   - Steps with inline markers:
     - Quantities: `{{qty:1}}` references ingredient by index (0-based)
     - Timers: `{{timer:15}}` for 15-minute timer (supports multiple per step)
   - Suggested tags from categories: cuisine (pasta, indian, mexican), meal type (main, side, dessert, snack), characteristics (quick, vegetarian, one-pot, make-ahead)

2. **Normalisation**: Same LLM call also:

   - Converts to metric units
   - Converts to fan oven temperatures
   - Uses British ingredient names (eggplant → aubergine, cilantro → coriander, etc.)

3. **Review screen**: User sees parsed recipe with ability to:
   - Edit title and description
   - Adjust ingredients (quantities, names)
   - Edit steps
   - Add/remove tags
   - "Save Recipe" or "Cancel"

#### Storage

- Raw source text stored for potential re-processing (for photos, this is the OCR/extracted text from the vision LLM)
- Source metadata:
  - Type: photo, url, or text
  - Source context: user-provided description of the source (e.g., "Ottolenghi Simple, p.42" or "Grandma's recipe"). For URL imports, defaults to the URL but can be edited
- Photos themselves are not stored - only the extracted text

---

### Finding a recipe

#### Main List View (Home Screen)

- Header with app title and "Add Recipe" button
- Search bar at top (searches title, ingredients, tags)
- Filter chips below search:
  - Rating filter (show all / good+ / great only)
  - Tag filter (dropdown/modal with available tags)
  - Ingredient filter ("contains:" text input)
- Recipe cards in a responsive grid:
  - Recipe title
  - Key info (cook time, servings)
  - Rating indicator (colour dot or icon)
  - First 2-3 tags as small chips
- Default sort: random (reshuffled on page load)
- "Surprise me" button picks a random recipe from the currently filtered results and navigates directly to it
- Pull-to-refresh on mobile reshuffles the random order

#### Search Behaviour

- Instant filter as user types (client-side for simplicity given small dataset)
- Fuzzy search (via Fuse.js) across: title, description, ingredient names, tags
- No results state: "No recipes found" with suggestion to adjust filters

---

### Viewing a recipe

#### Recipe Detail Screen

**Header section:**

- Back button (returns to list, preserving scroll position)
- Recipe title (large)
- Description/intro text
- Metadata row: prep time | cook time | servings
- Rating buttons (three options: meh/good/great, current selection highlighted)
- Action buttons row:
  - "Keep Awake" toggle (uses Screen Wake Lock API, shows indicator when active)
  - "Add to List" (adds to cooking list stored in localStorage)
  - "Chat" (opens chat modal)

**Scaling controls:**

- Servings adjuster: minus/plus buttons around current serving count
- Or: dropdown to scale by specific ingredient ("Scale to 500g flour")
- Scaling updates all quantities in real-time

**Ingredients section:**

- Checkbox list of ingredients
- Each shows: quantity, unit, ingredient name
- Checking off helps track progress while cooking
- Quantities update when scaling (formatted nicely: "1.5kg" not "1500g" where sensible)

**Method section:**

- Numbered steps
- Inline quantities rendered with current scale applied (via `{{qty:N}}` markers)
- Steps with durations show a "Start Timer" button
- Timer appears inline below the step when active, with audio alert on completion

**Variants section (if any):**

- List of linked variant recipes with "View" buttons

---

### Chat with Recipe

#### Chat Modal

- Slide-up modal with chat interface
- Pre-filled context includes the current recipe (full structured data)
- Example prompts as suggestion chips:
  - "What can I substitute for X?"
  - "Make this vegetarian"
  - "Double the quantities"
- User types question, LLM responds with structured output:
  - `message`: The conversational response shown to the user
  - `updatedRecipe` (optional): Full structured recipe data if modifications were made (same format as import parsing, with all markers)
- When `updatedRecipe` is present, show action buttons:
  - "Save as new recipe" button
  - "Replace current recipe" button (with confirmation)
  - "Save as variant" button (links to original)

---

### Cooking List

#### List View (separate tab/screen)

- Simple list of recipe titles added from detail view
- Tap to navigate to recipe
- Swipe to remove, or X button
- "Clear all" button
- Persisted in localStorage
- Badge on tab icon showing count

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

    -- Source information
    source_type TEXT NOT NULL CHECK(source_type IN ('photo', 'url', 'text')),
    source_text TEXT,                   -- Raw extracted/pasted text, fetched HTML, or OCR output from photos
    source_context TEXT,                -- User description of source (book name, URL, etc.)

    -- Variant relationship
    parent_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ingredients for each recipe
CREATE TABLE ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,          -- For ordering
    name TEXT NOT NULL,
    quantity REAL,                      -- Numeric quantity (nullable for "to taste")
    unit TEXT,                          -- g, ml, tsp, etc. (nullable for countable items)
    notes TEXT                          -- e.g., "finely chopped", "optional"
);

CREATE INDEX idx_ingredients_recipe ON ingredients(recipe_id, position);

-- Method steps
CREATE TABLE steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    instruction TEXT NOT NULL           -- Contains {{qty:N}} and {{timer:M}} markers
);

CREATE INDEX idx_steps_recipe ON steps(recipe_id, position);

-- Tags for filtering
CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    is_auto_generated BOOLEAN DEFAULT FALSE  -- True if suggested by LLM
);

CREATE INDEX idx_tags_recipe ON tags(recipe_id);
CREATE INDEX idx_tags_tag ON tags(tag);

-- Chat history for recipe conversations
CREATE TABLE chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_recipe ON chat_messages(recipe_id, created_at);
```

### Type Definitions (shared)

```typescript
interface Recipe {
  id: number;
  title: string;
  description: string | null;
  servings: number | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  rating: "meh" | "good" | "great" | null;
  sourceType: "photo" | "url" | "text";
  sourceText: string | null; // Raw text, fetched HTML, or OCR output
  sourceContext: string | null; // User description of source
  parentRecipeId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Ingredient {
  id: number;
  recipeId: number;
  position: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

interface Step {
  id: number;
  recipeId: number;
  position: number;
  instruction: string; // Contains {{qty:N}} and {{timer:M}} markers
}

interface Tag {
  id: number;
  recipeId: number;
  tag: string;
  isAutoGenerated: boolean;
}

// Full recipe with relations (for API responses)
interface RecipeWithDetails extends Recipe {
  ingredients: Ingredient[];
  steps: Step[];
  tags: Tag[];
  variants?: Recipe[]; // Child recipes
}
```

---

## Code Organisation

```
recipes/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app entry point
│   │   ├── routes/
│   │   │   ├── recipes.ts        # CRUD endpoints for recipes
│   │   │   ├── import.ts         # Recipe import (URL fetch, photo OCR, text paste)
│   │   │   └── chat.ts           # Chat endpoints
│   │   ├── services/
│   │   │   ├── llm/
│   │   │   │   ├── interface.ts  # LLM interface
│   │   │   │   ├── google.ts     # Google Gemini implementation
│   │   │   │   └── index.ts      # Factory function based on config
│   │   │   ├── recipe-parser.ts  # LLM prompts for parsing recipes
│   │   │   └── config.ts         # YAML config loading
│   │   ├── db/
│   │   │   ├── index.ts          # Database connection
│   │   │   ├── schema.sql        # Schema definition
│   │   │   └── queries.ts        # Typed query functions
│   │   └── middleware/
│   │       └── error-handler.ts  # Global error handling
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── index.tsx             # App entry point
│   │   ├── app.tsx               # Root component with router
│   │   ├── api/
│   │   │   └── client.ts         # API client functions
│   │   ├── components/
│   │   │   ├── RecipeCard.tsx    # Recipe card for list view
│   │   │   ├── RecipeForm.tsx    # Add/edit recipe form
│   │   │   ├── IngredientList.tsx
│   │   │   ├── StepList.tsx
│   │   │   ├── ScalingControls.tsx
│   │   │   ├── Timer.tsx
│   │   │   ├── ChatModal.tsx
│   │   │   └── FilterBar.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx          # Recipe list view
│   │   │   ├── RecipeDetail.tsx  # Single recipe view
│   │   │   ├── AddRecipe.tsx     # Import flow
│   │   │   ├── EditRecipe.tsx    # Edit existing recipe
│   │   │   └── CookingList.tsx   # Saved recipes to make
│   │   ├── hooks/
│   │   │   ├── useWakeLock.ts    # Screen wake lock
│   │   │   ├── useTimer.ts       # Timer logic
│   │   │   └── useCookingList.ts # localStorage list management
│   │   ├── utils/
│   │   │   ├── scaling.ts        # Quantity scaling logic
│   │   │   └── formatting.ts     # Display formatting
│   │   └── styles/
│   │       ├── global.css        # Global styles, CSS variables
│   │       └── components.css    # Component-specific styles
│   ├── index.html
│   ├── package.json
│   └── tsconfig.json
│
├── shared/
│   ├── types.ts                  # Shared TypeScript interfaces
│   └── package.json
│
├── overview.md                   # This file
├── package.json                  # Root package.json for workspaces
├── Dockerfile                    # Production container build
├── config.example.yaml           # Example configuration
└── secrets.example.yaml          # Example secrets file
```

### Key Architectural Decisions

1. **Monorepo with npm workspaces**: Simple dependency management, shared types
2. **Backend serves frontend**: In production, Express serves the built frontend static files
3. **No authentication**: Personal use only, assumed to run on local network or behind auth proxy
4. **Synchronous SQLite**: Simpler code, adequate for single-user scenario
5. **No photo storage**: Photos are processed by vision LLM on upload, only extracted text is stored
6. **Client-side filtering**: Load all recipes on home page, filter in browser (fast enough for hundreds of recipes)
7. **YAML configuration**: Main config at fixed path, secrets file path via env var for flexible deployment

---

## API Endpoints

```
# Recipes
GET    /api/recipes              # List all recipes (with ingredients, tags)
GET    /api/recipes/:id          # Get single recipe with full details
POST   /api/recipes              # Create new recipe
PUT    /api/recipes/:id          # Update recipe
DELETE /api/recipes/:id          # Delete recipe
PATCH  /api/recipes/:id/rating   # Update rating only

# Import
POST   /api/import/url           # Import from URL
POST   /api/import/photos        # Import from photos (multipart) - extracts text via vision LLM
POST   /api/import/text          # Import from pasted text
POST   /api/import/parse         # Re-parse raw source text

# Chat
GET    /api/recipes/:id/chat     # Get chat history
POST   /api/recipes/:id/chat     # Send message, get response

# Tags
GET    /api/tags                 # List all unique tags (for filter dropdown)
```

---

## Implementation Plan

### Phase 1: Foundation

- [ ] Set up monorepo structure with npm workspaces
- [ ] Configure TypeScript for backend, frontend, and shared packages
- [ ] Set up Vite for frontend with Preact
- [ ] Set up Express backend with basic routing
- [ ] Create YAML config loading (config.yaml + secrets file)
- [ ] Create SQLite database with schema
- [ ] Implement basic database query functions
- [ ] Create shared type definitions

### Phase 2: Core Recipe CRUD

- [ ] Implement recipe list API endpoint
- [ ] Implement single recipe API endpoint
- [ ] Build home page with recipe grid
- [ ] Build recipe detail page (read-only)
- [ ] Implement manual recipe creation form
- [ ] Implement recipe editing
- [ ] Implement recipe deletion

### Phase 3: LLM Integration

- [ ] Create LLM interface
- [ ] Implement Google Gemini provider (text + vision)
- [ ] Build recipe parsing prompts (with qty/timer markers, British units, tag suggestions)
- [ ] Implement URL import flow (fetch HTML → send to LLM → parse response)
- [ ] Implement text paste import flow
- [ ] Implement photo import flow (send to vision LLM → store extracted text)
- [ ] Build review/edit screen for imported recipes

### Phase 4: Recipe Viewing Features

- [ ] Implement quantity scaling logic
- [ ] Build scaling controls UI (servings adjuster + ingredient-based scaling)
- [ ] Implement inline quantity rendering with `{{qty:N}}` markers
- [ ] Implement inline timer rendering with `{{timer:M}}` markers
- [ ] Add timer functionality with audio alerts
- [ ] Implement Screen Wake Lock API toggle
- [ ] Implement rating system
- [ ] Add ingredient checkboxes

### Phase 5: Search & Filtering

- [ ] Implement fuzzy search with Fuse.js (title, description, ingredients, tags)
- [ ] Build filter UI (rating, tags, ingredients)
- [ ] Implement random sorting
- [ ] Add "Surprise me" random recipe picker (respects current filters)
- [ ] Tag management (add/remove tags)

### Phase 6: Additional Features

- [ ] Implement cooking list (localStorage)
- [ ] Build chat modal interface
- [ ] Implement chat API with structured output (message + optional updatedRecipe)
- [ ] Add "save as variant" functionality
- [ ] Recipe variants display and navigation
- [ ] Chat history persistence

### Phase 7: Deployment & Polish

- [ ] Create Dockerfile for production build
- [ ] Responsive design refinements
- [ ] Loading states and error handling
- [ ] Empty states
- [ ] Mobile-friendly touch interactions
- [ ] PWA basics (manifest, offline-capable for viewed recipes)
