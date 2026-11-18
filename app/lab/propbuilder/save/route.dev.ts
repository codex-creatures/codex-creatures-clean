// app/lab/propbuilder/save/route.dev.ts — 🧪 dev only (next.config.ts: `.dev.ts` is seen by `next dev` alone, so
// no build has it): the prop builder's Save. A recipe POSTed here is read (lib/props/recipe.ts readRecipe: one that
// won't read isn't written), written to lib/props/recipes/<id>.json as formatRecipe lays it out, and the index
// (lib/props/recipes/index.ts) rewritten to list every recipe there. Elsewhere (the offline copy, the site) the
// builder downloads the file instead.

import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readRecipe, formatRecipe, type RecipeSpec } from "@/lib/props/recipe";
import { recipeIndex } from "@/lib/props/recipes/indexFile";

const DIR = path.join(process.cwd(), "lib", "props", "recipes");

export async function POST(req: Request) {
  let json: unknown;
  try { json = await req.json(); } catch { return Response.json({ ok: false, errors: ["not JSON"] }, { status: 400 }); }
  const read = readRecipe(json);
  if (!read.ok) return Response.json({ ok: false, errors: read.errors }, { status: 400 });
  const spec = json as RecipeSpec, file = path.join(DIR, `${spec.id}.json`);
  if (path.dirname(file) !== DIR) return Response.json({ ok: false, errors: ["bad id"] }, { status: 400 });
  await writeFile(file, formatRecipe(spec));
  const ids = (await readdir(DIR)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
  await writeFile(path.join(DIR, "index.ts"), recipeIndex(ids));
  return Response.json({ ok: true, file: `lib/props/recipes/${spec.id}.json` });
}
