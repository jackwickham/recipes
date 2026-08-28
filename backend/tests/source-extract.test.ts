import { describe, it, expect } from "vitest";
import {
  extractRecipeSource,
  durationToMinutes,
  htmlToText,
} from "../src/services/source-extract.js";

function page(head: string, body = "<p>page body</p>"): string {
  return `<!doctype html><html><head><title>A Recipe Site</title>${head}</head><body>${body}</body></html>`;
}

function ldScript(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

const RECIPE_LD = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Lemon Drizzle Cake",
  description: "A tangy loaf cake",
  recipeYield: "8 slices",
  prepTime: "PT20M",
  cookTime: "PT45M",
  totalTime: "PT1H5M",
  recipeIngredient: ["225g butter", "225g caster sugar", "4 eggs"],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Cream the butter and sugar." },
    { "@type": "HowToStep", text: "Beat in the eggs." },
  ],
  recipeCategory: "Dessert",
  recipeCuisine: "British",
  keywords: "cake, lemon",
};

describe("JSON-LD extraction", () => {
  it("pulls the recipe out of a schema.org block", () => {
    const result = extractRecipeSource(page(ldScript(RECIPE_LD)));

    expect(result.kind).toBe("json-ld");
    const data = JSON.parse(result.text);
    expect(data.title).toBe("Lemon Drizzle Cake");
    expect(data.servings).toBe("8 slices");
    expect(data.prepTimeMinutes).toBe(20);
    expect(data.cookTimeMinutes).toBe(45);
    expect(data.totalTimeMinutes).toBe(65);
    expect(data.ingredients).toHaveLength(3);
    expect(data.instructions).toEqual([
      "Cream the butter and sugar.",
      "Beat in the eggs.",
    ]);
    expect(data.cuisine).toEqual(["British"]);
  });

  it("finds a recipe nested inside @graph", () => {
    const html = page(
      ldScript({
        "@context": "https://schema.org",
        "@graph": [{ "@type": "WebSite", name: "Site" }, RECIPE_LD],
      })
    );

    const result = extractRecipeSource(html);

    expect(result.kind).toBe("json-ld");
    expect(JSON.parse(result.text).title).toBe("Lemon Drizzle Cake");
  });

  it("accepts an array-valued @type", () => {
    const html = page(ldScript({ ...RECIPE_LD, "@type": ["Recipe", "NewsArticle"] }));

    expect(extractRecipeSource(html).kind).toBe("json-ld");
  });

  it("flattens sectioned instructions and keeps the headings", () => {
    const html = page(
      ldScript({
        ...RECIPE_LD,
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "For the cake",
            itemListElement: [
              { "@type": "HowToStep", text: "Cream the butter." },
              { "@type": "HowToStep", text: "Fold in the flour." },
            ],
          },
          {
            "@type": "HowToSection",
            name: "For the drizzle",
            itemListElement: [{ "@type": "HowToStep", text: "Mix juice and sugar." }],
          },
        ],
      })
    );

    expect(JSON.parse(extractRecipeSource(html).text).instructions).toEqual([
      "For the cake:",
      "Cream the butter.",
      "Fold in the flour.",
      "For the drizzle:",
      "Mix juice and sugar.",
    ]);
  });

  it("handles instructions given as one HTML string", () => {
    const html = page(
      ldScript({
        ...RECIPE_LD,
        recipeInstructions: "<p>Cream the butter.</p>\n<p>Beat in the eggs.</p>",
      })
    );

    expect(JSON.parse(extractRecipeSource(html).text).instructions).toEqual([
      "Cream the butter.",
      "Beat in the eggs.",
    ]);
  });

  it("skips a malformed block and uses a later valid one", () => {
    const html = page(
      `<script type="application/ld+json">{ not json }</script>${ldScript(RECIPE_LD)}`
    );

    const result = extractRecipeSource(html);

    expect(result.kind).toBe("json-ld");
    expect(JSON.parse(result.text).title).toBe("Lemon Drizzle Cake");
  });

  it("omits fields the page does not publish", () => {
    const html = page(
      ldScript({ "@type": "Recipe", name: "Toast", recipeIngredient: ["bread"] })
    );

    const data = JSON.parse(extractRecipeSource(html).text);

    expect(data).toEqual({ title: "Toast", ingredients: ["bread"] });
  });

  it("ignores non-recipe structured data", () => {
    const html = page(ldScript({ "@type": "Article", name: "Not a recipe" }));

    expect(extractRecipeSource(html).kind).toBe("text");
  });
});

describe("page text fallback", () => {
  it("strips markup, scripts and styles", () => {
    const html = page(
      "<style>.a{color:red}</style>",
      `<script>var tracking = 1;</script>
       <nav><a href="/">Home</a></nav>
       <h1>Lemon Drizzle Cake</h1>
       <p>225g butter &amp; 225g sugar</p>`
    );

    const result = extractRecipeSource(html);

    expect(result.kind).toBe("text");
    expect(result.text).toContain("Lemon Drizzle Cake");
    expect(result.text).toContain("225g butter & 225g sugar");
    expect(result.text).not.toContain("var tracking");
    expect(result.text).not.toContain("color:red");
    expect(result.text).not.toContain("<");
  });

  it("keeps the page title", () => {
    expect(extractRecipeSource(page("", "<p>hi</p>")).text).toContain(
      "A Recipe Site"
    );
  });

  it("decodes numeric and named entities", () => {
    expect(htmlToText("<p>180&deg;C &#189; tsp caf&#233;</p>")).toBe(
      "180°C ½ tsp café"
    );
  });

  it("collapses whitespace instead of emitting blank pages", () => {
    expect(htmlToText("<div>\n\n  a  \n\n\n\n  b  \n</div>")).toBe("a\n\nb");
  });

  it("truncates very long pages", () => {
    const huge = `<p>${"padding ".repeat(20_000)}</p>`;

    expect(htmlToText(huge).length).toBeLessThan(41_000);
    expect(htmlToText(huge)).toContain("[truncated]");
  });

  it("shrinks a realistic page by an order of magnitude", () => {
    const bloat = Array.from(
      { length: 400 },
      (_, i) => `<div class="widget-${i}"><span data-x="${i}">Related recipe ${i}</span></div>`
    ).join("");
    const html = page(ldScript(RECIPE_LD), bloat);

    const result = extractRecipeSource(html);

    expect(result.kind).toBe("json-ld");
    expect(result.text.length).toBeLessThan(html.length / 10);
  });
});

describe("durationToMinutes", () => {
  it.each([
    ["PT30M", 30],
    ["PT1H", 60],
    ["PT1H30M", 90],
    ["PT2H15M", 135],
    ["P1DT2H", 1560],
    ["PT90S", 2],
  ])("converts %s", (input, expected) => {
    expect(durationToMinutes(input)).toBe(expected);
  });

  it.each([["", undefined], ["30 minutes", undefined], [null, undefined], [42, undefined]])(
    "returns undefined for %s",
    (input, expected) => {
      expect(durationToMinutes(input)).toBe(expected);
    }
  );
});
