-- Core recipe table
CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    servings INTEGER,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    rating TEXT CHECK(rating IN ('meh', 'good', 'great')),

    -- Source information
    source_type TEXT NOT NULL CHECK(source_type IN ('photo', 'url', 'text')),
    source_text TEXT,
    source_context TEXT,

    -- Variant relationship
    parent_recipe_id INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
    -- 'portion' = same recipe, different serving size
    -- 'content' = different ingredients/method (e.g., vegetarian version)
    -- NULL = standalone recipe (not a variant)
    variant_type TEXT CHECK(variant_type IN ('portion', 'content')),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ingredients for each recipe
CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_ingredients_recipe ON ingredients(recipe_id, position);

-- Method steps
CREATE TABLE IF NOT EXISTS steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    instruction TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_steps_recipe ON steps(recipe_id, position);

-- Tags for filtering
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    is_auto_generated BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_tags_recipe ON tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);

-- Chat history lives in the browser's localStorage, not here. Databases created
-- before that decision still carry an unused chat_messages table; it is left
-- alone rather than dropped.
