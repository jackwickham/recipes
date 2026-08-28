/**
 * Reduce a fetched web page to just the recipe before it reaches the LLM.
 *
 * Most recipe sites publish schema.org/Recipe as JSON-LD, which is exact and free
 * to read, so we use it when it is there and fall back to stripped page text when
 * it is not. Either way the model sees a few kilobytes rather than the several
 * hundred a modern recipe page weighs, and the result is what we store as the
 * recipe's source text.
 */

export interface ExtractedSource {
  text: string;
  /** How the text was obtained. Surfaced in progress messages and asserted in tests. */
  kind: "json-ld" | "text";
}

/** Upper bound on fallback page text handed to the model. */
const MAX_TEXT_CHARS = 40_000;

/** How deep to search parsed JSON-LD for a Recipe node. */
const MAX_JSON_LD_DEPTH = 6;

const LD_JSON_BLOCK =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export function extractRecipeSource(html: string): ExtractedSource {
  const recipe = findRecipeNode(html);
  if (recipe) {
    return { text: formatRecipe(recipe), kind: "json-ld" };
  }
  return { text: htmlToText(html), kind: "text" };
}

type JsonObject = Record<string, unknown>;

function findRecipeNode(html: string): JsonObject | null {
  for (const [, body] of html.matchAll(LD_JSON_BLOCK)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCdata(body));
    } catch {
      continue; // A malformed block is no reason to give up on the others.
    }

    for (const node of walk(parsed, 0)) {
      if (isRecipe(node)) return node;
    }
  }
  return null;
}

/** Yield every object in a parsed JSON-LD document, depth-first. */
function* walk(value: unknown, depth: number): Generator<JsonObject> {
  if (depth > MAX_JSON_LD_DEPTH) return;

  if (Array.isArray(value)) {
    for (const item of value) yield* walk(item, depth + 1);
    return;
  }

  if (value && typeof value === "object") {
    const obj = value as JsonObject;
    yield obj;
    for (const child of Object.values(obj)) {
      if (child && typeof child === "object") yield* walk(child, depth + 1);
    }
  }
}

function isRecipe(node: JsonObject): boolean {
  const type = node["@type"];
  if (typeof type === "string") return type.toLowerCase() === "recipe";
  if (Array.isArray(type)) {
    return type.some((t) => typeof t === "string" && t.toLowerCase() === "recipe");
  }
  return false;
}

function formatRecipe(node: JsonObject): string {
  const fields: Record<string, unknown> = {
    title: text(node.name),
    description: text(node.description),
    servings: joinList(node.recipeYield),
    prepTimeMinutes: durationToMinutes(node.prepTime),
    cookTimeMinutes: durationToMinutes(node.cookTime),
    totalTimeMinutes: durationToMinutes(node.totalTime),
    ingredients: textList(node.recipeIngredient),
    instructions: flattenInstructions(node.recipeInstructions),
    category: textList(node.recipeCategory),
    cuisine: textList(node.recipeCuisine),
    keywords: textList(node.keywords),
  };

  const present = Object.entries(fields).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0)
  );

  return JSON.stringify(Object.fromEntries(present), null, 2);
}

/**
 * Instructions come as a string, a list of strings, a list of HowToStep objects,
 * or HowToSection objects wrapping their own step lists. Flatten all of them,
 * prefixing section headings so the model keeps the structure.
 */
function flattenInstructions(value: unknown, depth = 0): string[] {
  if (depth > 3) return [];

  if (typeof value === "string") {
    return splitParagraphs(stripTags(value));
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenInstructions(item, depth + 1));
  }

  if (value && typeof value === "object") {
    const node = value as JsonObject;

    if (node.itemListElement) {
      const heading = text(node.name);
      const steps = flattenInstructions(node.itemListElement, depth + 1);
      return heading ? [`${heading}:`, ...steps] : steps;
    }

    const step = text(node.text) ?? text(node.name);
    return step ? [step] : [];
  }

  return [];
}

function splitParagraphs(value: string): string[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function text(value: unknown): string | undefined {
  if (typeof value === "string") {
    const cleaned = stripTags(value).trim();
    return cleaned || undefined;
  }
  if (typeof value === "number") return String(value);
  return undefined;
}

function textList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : [value];
  return items.map(text).filter((item): item is string => !!item);
}

function joinList(value: unknown): string | undefined {
  const items = textList(value);
  return items.length ? items.join(", ") : undefined;
}

/** Convert an ISO 8601 duration such as PT1H30M to whole minutes. */
export function durationToMinutes(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;

  const match = value.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  );
  if (!match) return undefined;

  const [, days, hours, minutes, seconds] = match;
  const total =
    Number(days ?? 0) * 1440 +
    Number(hours ?? 0) * 60 +
    Number(minutes ?? 0) +
    Number(seconds ?? 0) / 60;

  return total > 0 ? Math.round(total) : undefined;
}

const BLOCK_TAGS =
  /<\/?(?:p|div|br|li|ul|ol|tr|h[1-6]|section|article|header|footer|table)\b[^>]*>/gi;

const DROPPED_ELEMENTS =
  /<(script|style|noscript|svg|iframe|template)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Best-effort page-to-text for sites that publish no JSON-LD. */
export function htmlToText(html: string): string {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const body = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(DROPPED_ELEMENTS, " ")
    .replace(BLOCK_TAGS, "\n");

  const parts = [title ? decodeEntities(stripTags(title)).trim() : "", stripTags(body)];

  const cleaned = decodeEntities(parts.filter(Boolean).join("\n\n"))
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > MAX_TEXT_CHARS
    ? `${cleaned.slice(0, MAX_TEXT_CHARS)}\n[truncated]`
    : cleaned;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, " ");
}

function stripCdata(value: string): string {
  return value.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
};

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&([a-z0-9]+);/gi, (match, name) => {
      const replacement = NAMED_ENTITIES[name.toLowerCase()];
      return replacement ?? match;
    });
}
