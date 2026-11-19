// lib/props/recipes/index.ts
// 🧪 Every prop recipe (lib/props/recipe.ts), bundled as JSON so a recipe needs no fetching and works offline.
// Not drawn by the game yet: /lab/propbuilder only (world/art-pipeline.md §6.6 has how the game will use them).
// Written by the prop builder's Save (./indexFile.ts): add a recipe by saving it there, or list it here by hand.

import altar from "./altar.json";
import board from "./board.json";
import cage from "./cage.json";
import pit from "./pit.json";
import pool from "./pool.json";
import shack from "./shack.json";
import sparring from "./sparring.json";
import storehouse from "./storehouse.json";
import tavern from "./tavern.json";
import training from "./training.json";

export const RECIPE_FILES: Record<string, unknown> = { altar, board, cage, pit, pool, shack, sparring, storehouse, tavern, training };
