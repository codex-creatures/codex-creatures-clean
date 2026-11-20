// lib/props/recipes/index.ts
// 🧪 Every prop recipe (lib/props/recipe.ts), bundled as JSON so a recipe needs no fetching and works offline.
// Not drawn by the game yet: /lab/propbuilder only (world/art-pipeline.md §6.6 has how the game will use them).
// Written by the prop builder's Save (./indexFile.ts): add a recipe by saving it there, or list it here by hand.

import altar from "./altar.json";
import altarBroken from "./altar-broken.json";
import arch from "./arch.json";
import board from "./board.json";
import cage from "./cage.json";
import pit from "./pit.json";
import pool from "./pool.json";
import portal from "./portal.json";
import shack from "./shack.json";
import shackBroken from "./shack-broken.json";
import socket from "./socket.json";
import sparring from "./sparring.json";
import storehouse from "./storehouse.json";
import tavern from "./tavern.json";
import tavernBroken from "./tavern-broken.json";
import training from "./training.json";

export const RECIPE_FILES: Record<string, unknown> = { altar, "altar-broken": altarBroken, arch, board, cage, pit, pool, portal, shack, "shack-broken": shackBroken, socket, sparring, storehouse, tavern, "tavern-broken": tavernBroken, training };
