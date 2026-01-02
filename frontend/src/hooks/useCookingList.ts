import { useState, useEffect } from "preact/hooks";

const STORAGE_KEY = "cooking-list";

export interface CookingListItem {
  id: number;
  title: string;
  addedAt: number;
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

  function addRecipe(id: number, title: string) {
    setItems((prev) => {
      // Don't add if already in list
      if (prev.some((item) => item.id === id)) {
        return prev;
      }
      return [...prev, { id, title, addedAt: Date.now() }];
    });
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
    removeRecipe,
    isInList,
    clearList,
  };
}
