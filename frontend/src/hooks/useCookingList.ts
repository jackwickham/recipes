import { useState, useEffect } from "preact/hooks";

const STORAGE_KEY = "cooking-list";

export interface CookingListItem {
  id: number;
  title: string;
  addedAt: number;
  servings?: number;
}

export function useCookingList() {
  const [items, setItems] = useState<CookingListItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save to localStorage when items change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage errors
    }
  }, [items]);

  function addRecipe(id: number, title: string, servings?: number) {
    setItems((prev) => {
      // Don't add if already in list
      if (prev.some((item) => item.id === id)) {
        return prev;
      }
      return [...prev, { id, title, servings, addedAt: Date.now() }];
    });
  }

  function updateServings(id: number, servings: number) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, servings } : item))
    );
  }

  function removeRecipe(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function isInList(id: number): boolean {
    return items.some((item) => item.id === id);
  }

  function clearList() {
    setItems([]);
  }

  return {
    items,
    count: items.length,
    addRecipe,
    updateServings,
    removeRecipe,
    isInList,
    clearList,
  };
}
