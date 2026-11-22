// lib/props/recipes/indexFile.ts
// 🧪 The recipe index (./index.ts) as the prop builder's Save writes it (app/lab/propbuilder/save): every recipe
// file in this folder, imported as JSON, by id. Kept here so a test can check the index is what Save would write.

const name = (id: string) => id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase()).replace(/^(\d)/, "_$1");

export function recipeIndex(ids: string[]): string {
  const sorted = [...ids].sort();
  return [
    "// lib/props/recipes/index.ts",
    "// 🧪 Every prop recipe (lib/props/recipe.ts), bundled as JSON so a recipe needs no fetching and works offline.",
    "// The new Den draws its places from them (components/Den3DPlaces.tsx); world/art-pipeline.md §6.6 has the rest.",
    "// Written by the prop builder's Save (./indexFile.ts): add a recipe by saving it there, or list it here by hand.",
    "",
    ...sorted.map((id) => `import ${name(id)} from "./${id}.json";`),
    "",
    `export const RECIPE_FILES: Record<string, unknown> = { ${sorted.map((id) => (name(id) === id ? id : `"${id}": ${name(id)}`)).join(", ")} };`,
    "",
  ].join("\n");
}
