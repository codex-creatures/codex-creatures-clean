// lib/props/recipes/index.ts
// 🧪 Every prop recipe (lib/props/recipe.ts), bundled as JSON so a recipe needs no fetching and works offline.
// Not drawn by the game yet: /lab/propbuilder only (world/art-pipeline.md §6.6 has how the game will use them).

import altar from "./altar.json";

export const RECIPE_FILES: Record<string, unknown> = { altar };
