// lib/props/recipes/index.ts
// 🧪 Every prop recipe (lib/props/recipe.ts), bundled as JSON so a recipe needs no fetching and works offline.
// Not drawn by the game yet: /lab/propbuilder only (world/art-pipeline.md §6.6 has how the game will use them).
// Written by the prop builder's Save (./indexFile.ts): add a recipe by saving it there, or list it here by hand.

import altar from "./altar.json";
import altarBroken from "./altar-broken.json";
import arch from "./arch.json";
import board from "./board.json";
import bookcaseCarved from "./bookcase-carved.json";
import bookcaseCrooked from "./bookcase-crooked.json";
import bookcaseShelf from "./bookcase-shelf.json";
import bookcaseSturdy from "./bookcase-sturdy.json";
import cage from "./cage.json";
import cageCell from "./cage-cell.json";
import cageReinforced from "./cage-reinforced.json";
import pit from "./pit.json";
import pool from "./pool.json";
import portal from "./portal.json";
import shack from "./shack.json";
import shackBroken from "./shack-broken.json";
import socket from "./socket.json";
import sparring from "./sparring.json";
import storehouse from "./storehouse.json";
import storehouse100 from "./storehouse-100.json";
import storehouse60 from "./storehouse-60.json";
import storehouse75 from "./storehouse-75.json";
import storehouse85 from "./storehouse-85.json";
import tavern from "./tavern.json";
import tavernBroken from "./tavern-broken.json";
import training from "./training.json";
import training2 from "./training-2.json";
import training3 from "./training-3.json";

export const RECIPE_FILES: Record<string, unknown> = { altar, "altar-broken": altarBroken, arch, board, "bookcase-carved": bookcaseCarved, "bookcase-crooked": bookcaseCrooked, "bookcase-shelf": bookcaseShelf, "bookcase-sturdy": bookcaseSturdy, cage, "cage-cell": cageCell, "cage-reinforced": cageReinforced, pit, pool, portal, shack, "shack-broken": shackBroken, socket, sparring, storehouse, "storehouse-100": storehouse100, "storehouse-60": storehouse60, "storehouse-75": storehouse75, "storehouse-85": storehouse85, tavern, "tavern-broken": tavernBroken, training, "training-2": training2, "training-3": training3 };
