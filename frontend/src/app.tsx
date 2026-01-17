import Router from "preact-router";
import { Home } from "./pages/Home";
import { RecipeDetail } from "./pages/RecipeDetail";
import { AddRecipe } from "./pages/AddRecipe";
import { EditRecipe } from "./pages/EditRecipe";
import { CookingList } from "./pages/CookingList";
import { FilterProvider } from "./contexts/FilterContext";

export function App() {
  return (
    <FilterProvider>
      <Router>
        <Home path="/" />
        <RecipeDetail path="/recipe/:id" />
        <AddRecipe path="/add" />
        <EditRecipe path="/edit/:id" />
        <CookingList path="/list" />
      </Router>
    </FilterProvider>
  );
}
