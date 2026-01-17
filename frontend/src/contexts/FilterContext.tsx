import { createContext } from "preact";
import { useContext, useState, useEffect } from "preact/hooks";
import type { ComponentChildren } from "preact";

export type RatingFilter = "all" | "good+" | "great";

export interface FilterState {
  searchQuery: string;
  ratingFilter: RatingFilter;
  selectedTags: Set<string>;
  ingredientFilter: string;
}

export interface FilterContextType extends FilterState {
  setSearchQuery: (query: string) => void;
  setRatingFilter: (filter: RatingFilter) => void;
  setSelectedTags: (tags: Set<string>) => void;
  toggleTag: (tag: string) => void;
  setIngredientFilter: (filter: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const STORAGE_KEY = "recipe-filters";

const defaultFilters: FilterState = {
  searchQuery: "",
  ratingFilter: "all",
  selectedTags: new Set(["main"]),
  ingredientFilter: "",
};

// Load filters from localStorage
function loadFiltersFromStorage(): FilterState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        searchQuery: parsed.searchQuery || "",
        ratingFilter: parsed.ratingFilter || "all",
        selectedTags: new Set(parsed.selectedTags || ["main"]),
        ingredientFilter: parsed.ingredientFilter || "",
      };
    }
  } catch (err) {
    console.error("Failed to load filters from localStorage:", err);
  }
  return defaultFilters;
}

// Save filters to localStorage
function saveFiltersToStorage(filters: FilterState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        searchQuery: filters.searchQuery,
        ratingFilter: filters.ratingFilter,
        selectedTags: Array.from(filters.selectedTags),
        ingredientFilter: filters.ingredientFilter,
      })
    );
  } catch (err) {
    console.error("Failed to save filters to localStorage:", err);
  }
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ComponentChildren }) {
  const [filters, setFilters] = useState<FilterState>(loadFiltersFromStorage);

  // Persist to localStorage whenever filters change
  useEffect(() => {
    saveFiltersToStorage(filters);
  }, [filters]);

  const setSearchQuery = (query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  };

  const setRatingFilter = (filter: RatingFilter) => {
    setFilters((prev) => ({ ...prev, ratingFilter: filter }));
  };

  const setSelectedTags = (tags: Set<string>) => {
    setFilters((prev) => ({ ...prev, selectedTags: tags }));
  };

  const toggleTag = (tag: string) => {
    setFilters((prev) => {
      const next = new Set(prev.selectedTags);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return { ...prev, selectedTags: next };
    });
  };

  const setIngredientFilter = (filter: string) => {
    setFilters((prev) => ({ ...prev, ingredientFilter: filter }));
  };

  const clearFilters = () => {
    setFilters({
      searchQuery: "",
      ratingFilter: "all",
      selectedTags: new Set(),
      ingredientFilter: "",
    });
  };

  const hasActiveFilters = !!(
    filters.searchQuery ||
    filters.ratingFilter !== "all" ||
    filters.selectedTags.size > 0 ||
    filters.ingredientFilter
  );

  return (
    <FilterContext.Provider
      value={{
        ...filters,
        setSearchQuery,
        setRatingFilter,
        setSelectedTags,
        toggleTag,
        setIngredientFilter,
        clearFilters,
        hasActiveFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterContextType {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error("useFilters must be used within a FilterProvider");
  }
  return context;
}
