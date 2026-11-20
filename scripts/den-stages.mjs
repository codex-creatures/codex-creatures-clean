// The Den's upgrade stages as prop recipes (the user, 2026-11-20: "I also need 3D models of each - use the current as
// the baseline"): each stage built from the model the Den draws now, so they keep its look, for review in the prop
// builder and /lab/propreview before the Den uses them. 🧪 Samples, to approve.
// - the cage: the old cell (1; wooden, lashed with rope), the iron cage (3: today's), the reinforced cage (5: bigger,
//   iron-banded, more bars);
// - the Training Pit: 2 and 3 slots (today's with a second and third dummy, a weapon rack, then banners);
// - the bookcase: the old shelf (5), crooked (15), sturdy (30: today's bookcase), carved (50);
// - the storehouse (the Inventory): a weapon rack by the door (60), a lean-to (75), iron bands (85), a stone
//   footing and an iron-bound door (100).
// node scripts/den-stages.mjs  →  lib/props/recipes/*.json and its index (then lay them out as the prop builder's Save
// does, formatRecipe in lib/props/recipe.ts: tests/propSave.test.ts checks it)
import fs from "fs";

const R = "lib/props/recipes/";
const read = (id) => JSON.parse(fs.readFileSync(R + id + ".json", "utf8"));
const write = (r) => fs.writeFileSync(R + r.id + ".json", JSON.stringify(r, null, 2) + "\n");
const clone = (x) => JSON.parse(JSON.stringify(x));
const r3 = (v) => Math.round(v * 1e6) / 1e6;
const grow = (p, k) => ({ ...p, at: p.at.map((v) => r3(v * k)), size: p.size.map((v) => r3(v * k)) });
const recipe = (id, name, parts, extra = {}) => ({ format: 1, id, name, setting: "den", ...extra, parts });

const WOOD = "/sprites/den3d/storehouse-front.png", WOOD_CROP = [2, 3, 30, 17];
const wood = (tint) => ({ src: WOOD, crop: WOOD_CROP, ...(tint ? { tint } : {}) });
const flat = (colour) => ({ colour });
const box = (id, at, size, faces, more = {}) => ({ id, kind: "box", at, size, faces, ...more });
const cyl = (id, at, size, faces, more = {}) => ({ id, kind: "cylinder", at, size, faces, ...more });
const sprite = (id, at, size, front) => ({ id, kind: "sprite", at, size, faces: { front } });

// ── The cage ─────────────────────────────────────────────────────────
const cage = read("cage");
{
  // The old cell: today's frame in rough wood, its bars wooden poles, rope at the corners, no iron on top.
  const iron = /^(post-cap|post-foot|rail-low|rail-top|strap|strap-2|top-bar-.*|hinge.*)$/;
  const parts = cage.parts.filter((p) => !/^(ring|strap-2|top-bar-w1|top-bar-e1)$/.test(p.id)).map((p) => {
    const q = clone(p);
    if (/^bar-/.test(p.id)) q.faces = { side: wood("#8a6a48"), top: flat("#6a4a2a"), bottom: flat("#3a2416") };
    else if (iron.test(p.id)) q.faces = { "*": wood("#7a5634"), top: wood("#9a7450") };
    if (p.id === "lock") q.faces = { "*": flat("#b49a5a"), front: flat("#d0b878") }; // (a knot of rope, not a lock)
    return q;
  });
  parts.push(...[0.43, -0.43].flatMap((x, i) => [0.43, -0.43].map((z, j) => box(`rope-${i}${j}`, [x, 1.0, z], [0.18, 0.06, 0.18], { "*": flat("#b49a5a"), top: flat("#d0b878") }))));
  write(recipe("cage-cell", "Cage: the old cell (holds 1)", parts.map((p) => grow(p, 0.92)), { ref: cage.ref }));
}
{
  // The reinforced cage: a size up, two more bars a side, iron bands round it at mid height, and studded corners.
  const k = 1.3;
  const parts = cage.parts.filter((p) => !/^bar-\d$/.test(p.id)).map((p) => grow(clone(p), k));
  const bar = cage.parts.find((p) => p.id === "bar-1");
  [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36].forEach((x, i) => parts.push(grow({ ...clone(bar), id: `bar-${i + 1}`, at: [x, bar.at[1], bar.at[2]], faces: { ...bar.faces, top: flat("#8a8aa8") } }, k)));
  const band = { "*": flat("#26263c"), top: flat("#4a4a68") };
  parts.push(grow(box("band", [0, 0.78, 0.43], [0.84, 0.07, 0.07], band, { four: true }), k));
  for (const y of [0.42, 0.78, 1.14]) parts.push(grow(box(`stud-${y}`, [0.43, y, 0.43], [0.19, 0.05, 0.19], { "*": flat("#6a6a8a"), top: flat("#9a9ab8") }, { four: true }), k));
  const lock = parts.find((p) => p.id === "lock");
  lock.faces = { "*": flat("#7a6a2a"), front: flat("#e0c060") };
  lock.size = lock.size.map((v) => r3(v * 1.3));
  write(recipe("cage-reinforced", "Cage: reinforced (holds 5)", parts, { ref: cage.ref }));
}

// ── The Training Pit ─────────────────────────────────────────────────
const training = read("training");
{
  const dummy = training.parts.find((p) => p.id === "dummy");
  const rack = (x, z) => [
    box("rack-post-l", [x - 0.32, 0.03, z], [0.08, 0.7, 0.08], { "*": wood("#7a5634") }),
    box("rack-post-r", [x + 0.32, 0.03, z], [0.08, 0.7, 0.08], { "*": wood("#7a5634") }),
    box("rack-bar", [x, 0.6, z], [0.76, 0.06, 0.06], { "*": wood("#9a7450") }),
    ...[-0.18, 0, 0.18].map((dx, i) => box(`rack-staff-${i}`, [x + dx, 0.03, z + 0.05], [0.04, 0.72, 0.04], { "*": flat(i === 1 ? "#8a8e9c" : "#5a3a24") }, { turn: [8, 0, 0] })),
  ];
  // 2 slots: two dummies side by side, a weapon rack at the back.
  const two = training.parts.filter((p) => p.id !== "dummy").map(clone);
  two.push({ ...clone(dummy), id: "dummy", at: [-0.8, 0.03, -0.1] }, { ...clone(dummy), id: "dummy-2", at: [0.8, 0.03, -0.1] }, ...rack(0, -1.6));
  write(recipe("training-2", "Training Pit: 2 slots", two, { ref: training.ref }));
  // 3 slots: three dummies, the rack, and banners on poles at the back corners.
  const three = training.parts.filter((p) => p.id !== "dummy").map(clone);
  three.push({ ...clone(dummy), id: "dummy", at: [-1.2, 0.03, 0] }, { ...clone(dummy), id: "dummy-2", at: [0, 0.03, -0.3] }, { ...clone(dummy), id: "dummy-3", at: [1.2, 0.03, 0] }, ...rack(0, -1.6));
  for (const [i, x] of [-1.85, 1.85].entries()) three.push(
    box(`banner-pole-${i}`, [x, 0.03, -1.85], [0.07, 1.6, 0.07], { "*": wood("#5a3a24") }),
    sprite(`banner-${i}`, [x, 0.75, -1.8], [0.62, 0.83], { src: "/sprites/walk/decor/banner.png", crop: [0, 0, 32, 43], fit: "fill" }),
  );
  write(recipe("training-3", "Training Pit: 3 slots", three, { ref: training.ref }));
}

// ── The bookcase ─────────────────────────────────────────────────────
// Today's bookcase (components/Props3D.tsx Bookcase): its front, sides and top pictures on a box 1.25 × 1 × 0.5.
const BC = "/sprites/props/bookcase3d/";
const caseFaces = (tint) => ({
  front: { src: BC + "front.png", crop: [0, 0, 60, 48], fit: "fill", ...(tint ? { tint } : {}) },
  back: { src: BC + "side.png", crop: [0, 0, 24, 48], ...(tint ? { tint } : {}) },
  left: { src: BC + "side.png", crop: [0, 0, 24, 48], fit: "fill", ...(tint ? { tint } : {}) },
  right: { same: "left" },
  top: { src: BC + "top.png", crop: [0, 0, 60, 21], fit: "fill", ...(tint ? { tint } : {}) },
  bottom: flat("#1a120c"),
});
{
  // The old shelf: two rough uprights and three boards, the top one sagging, a few books. (Each stage is taller than
  // the last, so its front shows more from the game's camera.)
  write(recipe("bookcase-shelf", "Bookcase: the old shelf (holds 5)", [
    ...[-0.42, 0.42].map((x, i) => box(`upright-${i}`, [x, 0, 0], [0.07, 0.9, 0.3], { "*": wood("#7a5634"), top: wood("#9a7450") }, { outline: true })),
    ...[0.04, 0.44].map((y, i) => box(`board-${i}`, [0, y, 0], [0.9, 0.05, 0.3], { "*": wood("#8a6a48"), top: wood("#a08060") }, { outline: true })),
    box("board-top", [0, 0.85, 0], [0.92, 0.05, 0.3], { "*": wood("#8a6a48"), top: wood("#a08060") }, { outline: true, turn: [0, 0, 3] }),
    box("books", [-0.16, 0.49, 0.02], [0.4, 0.3, 0.22], { front: { src: BC + "front.png", crop: [6, 4, 20, 14], fit: "fill" }, "*": flat("#5a3424"), top: flat("#7a5034") }),
    box("book-lying", [0.22, 0.49, 0.02], [0.28, 0.06, 0.22], { "*": flat("#3a4a6a"), top: flat("#5a6a8a") }, { turn: [0, 12, 0] }),
    box("book-leaning", [0.12, 0.09, 0.02], [0.08, 0.3, 0.22], { "*": flat("#6a2e2a"), top: flat("#8a4a3a") }, { turn: [0, 0, -18] }),
  ]));
  // The crooked bookcase: the broken bookcase's front, leaning a little, wedged level at one foot.
  write(recipe("bookcase-crooked", "Bookcase: crooked (holds 15)", [
    box("case", [0, 0, 0], [1.15, 1.05, 0.45], { ...caseFaces("#e0d0c0"), front: { src: BC + "broken-front.png", crop: [0, 0, 54, 44], fit: "fill" } }, { turn: [0, 0, -4], outline: true }),
    box("wedge", [0.5, 0, 0.1], [0.12, 0.05, 0.3], { "*": wood("#6a4a2a") }),
  ]));
  // The sturdy bookcase: today's bookcase, taller, on a plinth, with a cornice.
  write(recipe("bookcase-sturdy", "Bookcase: sturdy (holds 30)", [
    box("plinth", [0, 0, 0], [1.31, 0.08, 0.54], { "*": wood("#5a3a24"), top: wood("#7a5634") }, { outline: true }),
    box("case", [0, 0.08, 0], [1.25, 1.2, 0.5], caseFaces(), { outline: true }),
    box("cornice", [0, 1.28, 0], [1.35, 0.08, 0.56], { "*": wood("#6a4a2a"), top: wood("#8a6a48") }, { outline: true }),
  ]));
  // The carved bookcase: two of today's side by side, taller still, columns standing out at its sides, and a
  // carved pediment with a gilt crest across its front.
  const gilt = { "*": flat("#a88a3a"), top: flat("#e0c060") };
  write(recipe("bookcase-carved", "Bookcase: carved (holds 50)", [
    box("plinth", [0, 0, 0], [2.16, 0.1, 0.62], { "*": wood("#4a2e1c"), top: wood("#6a4a2a") }, { outline: true }),
    box("case-l", [-0.5, 0.1, 0], [1, 1.45, 0.5], caseFaces(), { outline: true }),
    box("case-r", [0.5, 0.1, 0], [1, 1.45, 0.5], caseFaces(), { outline: true }),
    ...[-1, 1].map((s, i) => cyl(`column-${i}`, [s * 1.0, 0.1, 0.26], [0.16, 1.45, 0.16], { side: wood("#7a5634"), top: flat("#a88a3a"), bottom: flat("#3a2416") }, { outline: true })),
    ...[-1, 1].map((s, i) => box(`capital-${i}`, [s * 1.0, 1.5, 0.26], [0.22, 0.06, 0.22], gilt)),
    box("cornice", [0, 1.55, 0], [2.2, 0.1, 0.64], { "*": wood("#5a3a24"), top: wood("#7a5634") }, { outline: true }),
    box("trim", [0, 1.55, 0.31], [2.2, 0.04, 0.03], gilt),
    box("pediment", [0, 1.65, 0.24], [1.5, 0.26, 0.1], { "*": wood("#6a4a2a"), top: wood("#8a6a48") }, { outline: true }),
    box("crest", [0, 1.67, 0.3], [0.3, 0.22, 0.04], gilt),
  ]));
}

// ── The storehouse (the Inventory's boxes) ───────────────────────────
const store = read("storehouse");
{
  const sword = { src: "/sprites/items/void_scythe.png", crop: [0, 0, 64, 64], fit: "fill" };
  const shield = { src: "/sprites/items/ironfang_guard.png", crop: [0, 0, 64, 64], fit: "fill" };
  // 60: a weapon rack by the door.
  const rack = [
    box("rack-post-l", [1.0, 0.145, 1.36], [0.07, 0.8, 0.07], { "*": wood("#6a4a2a") }),
    box("rack-post-r", [1.44, 0.145, 1.36], [0.07, 0.8, 0.07], { "*": wood("#6a4a2a") }),
    box("rack-bar", [1.22, 0.78, 1.36], [0.54, 0.06, 0.06], { "*": wood("#8a6a48") }),
    sprite("rack-sword", [1.12, 0.2, 1.4], [0.42, 0.62], sword),
    sprite("rack-shield", [1.36, 0.2, 1.42], [0.36, 0.36], shield),
  ];
  // 75: a lean-to on its east side.
  const leanTo = [
    box("lean-body", [2.3, 0, 0.2], [1.1, 1.3, 1.6], { "*": { src: WOOD, crop: [130, 2, 26, 34] }, front: { src: WOOD, crop: [130, 2, 26, 34] }, top: wood(), bottom: flat("#1a120c") }, { outline: true }),
    box("lean-roof", [2.3, 1.3, 0.25], [1.25, 0.08, 1.8], { "*": flat("#24170e"), top: { src: "/sprites/den3d/storehouse-roof.png", crop: [60, 30, 24, 24] } }, { turn: [0, 0, -8] }),
    box("lean-door", [2.3, 0, 1.01], [0.6, 1.0, 0.04], { "*": wood("#5a3a24") }),
  ];
  // 85: iron bands on its corner beams and across its door.
  const iron = (id, at, size) => box(id, at, size, { "*": flat("#2e2e3a"), top: flat("#55557a") });
  const bands = [
    ...[0.5, 1.4].flatMap((y) => [-1.6283, 1.6283].map((x, i) => iron(`band-${y}-${i}`, [x, y, 1.025], [0.13, 0.1, 0.13]))),
    iron("door-band-1", [-0.04, 0.5, 1.17], [1.2, 0.07, 0.03]),
    iron("door-band-2", [-0.04, 1.3, 1.17], [1.2, 0.07, 0.03]),
  ];
  // 100: a stone footing and studs on the door.
  const stone = [
    box("footing", [0.55, 0, 0], [4.7, 0.3, 2.4], { "*": { src: "/sprites/den3d/parts/stone-blocks.png", crop: [0, 0, 48, 48] }, top: { src: "/sprites/den3d/pit-top.png", crop: [5, 24, 17, 62] } }, { outline: true }),
    ...[-0.5, -0.04, 0.42].flatMap((x) => [0.5, 1.3].map((y) => box(`stud-${x}-${y}`, [x, y - 0.02, 1.19], [0.06, 0.06, 0.03], { "*": flat("#9a9ab8") }))),
  ];
  const lift = (parts, dy) => parts.map((p) => (p.id === "footing" ? p : { ...p, at: [p.at[0], r3(p.at[1] + dy), p.at[2]] }));
  const base = store.parts.map(clone);
  const stages = [
    ["storehouse-60", "Storehouse: a weapon rack (60)", [...base, ...rack]],
    ["storehouse-75", "Storehouse: a lean-to (75)", [...base, ...rack, ...leanTo]],
    ["storehouse-85", "Storehouse: iron bands (85)", [...base, ...rack, ...leanTo, ...bands]],
    ["storehouse-100", "Storehouse: stone and iron (100)", [...stone, ...lift([...base, ...rack, ...leanTo, ...bands], 0.3).filter((p) => p.id !== "sill")]],
  ];
  for (const [id, name, parts] of stages) write(recipe(id, name, parts, { ref: store.ref }));
}

// The index, as the prop builder's Save writes it (lib/props/recipes/indexFile.ts).
const ids = fs.readdirSync(R).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
const name = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase()).replace(/^(\d)/, "_$1");
fs.writeFileSync(R + "index.ts", [
  "// lib/props/recipes/index.ts",
  "// 🧪 Every prop recipe (lib/props/recipe.ts), bundled as JSON so a recipe needs no fetching and works offline.",
  "// Not drawn by the game yet: /lab/propbuilder only (world/art-pipeline.md §6.6 has how the game will use them).",
  "// Written by the prop builder's Save (./indexFile.ts): add a recipe by saving it there, or list it here by hand.",
  "",
  ...ids.map((id) => `import ${name(id)} from "./${id}.json";`),
  "",
  `export const RECIPE_FILES: Record<string, unknown> = { ${ids.map((id) => (name(id) === id ? id : `"${id}": ${name(id)}`)).join(", ")} };`,
  "",
].join("\n"));
console.log("wrote", ids.length, "recipes' index");
