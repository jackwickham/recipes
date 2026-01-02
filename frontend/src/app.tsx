import Router from "preact-router";
import { Home } from "./pages/Home";
import { RecipeDetail } from "./pages/RecipeDetail";
import { AddRecipe } from "./pages/AddRecipe";
import { CookingList } from "./pages/CookingList";

export function App() {
  return (
    <Router>
      <Home path="/" />
      <RecipeDetail path="/recipe/:id" />
      <AddRecipe path="/add" />
      <CookingList path="/list" />
    </Router>
  );
}
