# Sprites ↔ PixelLab gallery

Every PNG in `public/sprites/` is saved, exactly as the game uses it (trimmed,
facing left), in the PixelLab Creator gallery. Search the gallery for
**CODEX FINAL** to see them all. The raw generations they came from are in the
gallery too, under their original prompts.

Not all of them actually face left: the Leafblade Scout (and Klutz) are drawn
facing right, and are marked `faces: "right"` in `lib/sprites/creatures.ts`
(FACING_RIGHT) so fights and rooms turn them the right way. Look at each new
creature's PNG and add it there if it faces right.

To update a sprite in both places: fix it, then
`save_to_asset(image=..., target="gallery:<id>")` with the id below, and copy
the PNG here.

| File | Gallery |
|---|---|
| creatures/amber_wasp.png | gallery:8e760486-daef-4018-b3be-a15a4e0b4d6e |
| creatures/aurelius.png | gallery:c29d5316-b647-4268-b754-884ace94a837 |
| creatures/baby_cyclops.png | gallery:e7451478-247f-4c4e-bec7-754d61156141 |
| creatures/bellow_toad.png | gallery:2dd08335-9bf9-51b7-bc63-20ddbefcd7e5 (raw generation; trimmed + mirrored here) |
| creatures/cave_bat.png | gallery:7a5a21a3-4c74-533e-9d12-c6efc97b48ed (the Cave Goblin, sample 11 of 16; raw generation; trimmed + mirrored here. The old Cave Bat: gallery:054e1aad-2c7f-4370-8ba2-bae183383893) |
| creatures/crystal_golem.png | gallery:39cc6f47-8738-4a8f-8a88-c5e05ee6ad7b |
| creatures/crystalback.png | gallery:537af213-0666-448e-a72d-cb308fe90489 |
| creatures/dire_wolf.png | gallery:84c2ddf7-7185-40dd-9d54-9a0f7cecb83d |
| creatures/dreadpox.png | gallery:72f0d447-6a3d-5c80-8c41-38fa82810610 (raw generation; trimmed + mirrored here) |
| creatures/flame_imp.png | gallery:e935d6b5-f3df-5889-a93d-4f6bb8758262 (raw generation; trimmed + mirrored here) |
| creatures/glob.png | gallery:e423893e-fd95-5b08-b974-79be7cbda576 (raw generation; trimmed + mirrored here) |
| creatures/gleamling.png | gallery:e677034e-9f2c-4c89-ba55-117a51c50eee (raw generation; trimmed + mirrored here) |
| creatures/plague_rat.png | gallery:5b422641-093d-4ce6-a738-293427afdebc (raw generation; trimmed + mirrored here) |
| creatures/rotgut_fly.png | gallery:3c6195d0-db24-4a67-9f83-4e6c05c09d0d (raw generation; trimmed + mirrored here) |
| creatures/deep_angler.png | gallery:aa6e8bcd-c214-4545-8890-8c9f9b18fcb7 (raw generation; trimmed + mirrored here) |
| creatures/tunnel_wyrm.png | gallery:6b352516-6423-470d-8f0c-1b50394f10a9 (raw generation; trimmed + mirrored here) |
| creatures/thunderhead.png | gallery:7903642a-e4f1-49e8-892f-9f8df1cbc2cb (raw generation; trimmed + mirrored here) |
| creatures/pale_rider.png | gallery:88bc5a9c-e3b2-4440-aac3-3811721fb379 (raw generation; trimmed + mirrored here) |
| creatures/dust_sprite.png | gallery:edc1b68b-8559-4d7c-89f3-11fc1602d302 |
| creatures/dustwraith.png | gallery:f09aeb9b-7692-4ff2-b7fc-d311a5d12a1a |
| creatures/flicker_wisp.png | gallery:175612f3-f343-46fb-a8d3-16501002997e |
| creatures/hollow_matriarch.png | gallery:33ca76b5-df94-4448-9108-2b82b2536b05 |
| creatures/ironhide.png | gallery:f1abf558-845a-4fd9-a7a0-981361629e6b |
| creatures/klutz.png | gallery:7613b7fe-5887-47b7-8220-51d4c33e246a |
| creatures/klutz-walk.png | gallery:b8e7eb1c-9a8f-440a-a8b7-59bcd701fed8 |
| creatures/leafblade_scout.png | gallery:98d5d66f-6d18-42e3-bc5f-32b26de80423 |
| creatures/moss_wolf.png | gallery:a9aa18c8-cd63-4491-91b6-15f70d87813b |
| creatures/mr_shadows.png | gallery:ac8442e1-69bc-4ae5-96e7-183341f38d8c |
| creatures/rattlebones.png | gallery:5b472bc2-c66b-4847-94cc-5e508e6dcd0a |
| creatures/rust_beetle.png | gallery:500c8fad-725d-41be-8e27-f4090dad2964 |
| creatures/shambler.png | gallery:62d71b30-2600-4e5b-9303-63e274bea3f4 |
| creatures/storm_phoenix.png | gallery:d99800fc-6c78-40da-b40f-d142d1ceb501 |
| creatures/swamp_witch.png | gallery:37f64877-7669-4e2d-a86c-9f50d0971ee0 |
| creatures/sylvaran.png | gallery:e9e85a19-7c22-4b93-acc7-fd297b66fafb |
| creatures/the_watcher.png | gallery:4921fe94-c1ba-4026-89e5-0fe154d49dc1 |
| creatures/thicket_archer.png | gallery:5314bf2a-ad13-4573-b277-3b8469662812 |
| creatures/veilstalker.png | gallery:ddb7e74e-e341-4a8f-b9f1-c330b0d95fe3 |
| creatures/void_serpent.png | gallery:8add8412-7c6e-4706-b996-f778f94ba8d9 |
| creatures/hydra/hydra-*.png | The Hydra (2026-11-04), built in code from: the body, pixen job 546b0c16-c71b-40ec-8ce1-810dc4762dde (gallery asset 01366ab9-3c22-541d-9b91-0678a4f57b3a), its middle head's drip repainted purple (inpaint job de4abff7-2386-4758-a03a-f141d3e22382, then 7 green pixels recoloured); each head cut to a stump by inpaint: Spitter dbb84d68-3e02-446f-bfb1-84110cca63b2 (area x4 y16 48×68), Hex fabffde1-c573-4707-a1d9-568499c9d0db (x52 y4 40×58), Fang 986b7ede-f98d-4a96-ad4e-cfd7968e4f71 (x96 y18 48×50, stray teeth at x118–136 y66–74 erased). Each file pastes the cut areas named 1 onto the body. |
| den/altar.png | gallery:a0615cd8-f9cb-4d00-88dc-d9607567863a |
| den/altar-anim.png | gallery:cac5c3e3-2e2e-4a17-8555-620a4ddaadf9 |
| den/chest.png | gallery:6af3a023-a3e5-4062-8e27-dd1643038f7d |
| den/crate.png | gallery:1a7655fe-70cc-4ae0-9da0-1bfa9d08d2b8 |
| den/crates.png | gallery:4ce15207-fe28-41a1-9e6d-38c857add95b |
| den/lectern.png | gallery:c6707841-7037-4c8b-a5ba-4c819cbf8f83 |
| den/merchant.png | gallery:0f753be3-f60e-472c-b679-31b8ed31c859 |
| den/shelves.png | gallery:83baaff4-1eef-4329-bf8f-2d0b62081222 |
| props/treasure_chest_open.png | gallery:89cd6782-5a1e-4b57-8267-9888fae07572 |
| props/treasure_chest.png | gallery:2df0068e-66c1-4280-939c-886481ebfc23 |
| props/chest3d/front.png | pro job 03cbe4bb-df94-4871-b722-a0a5a057eff3, asset 664e3b36-974d-5d56-9ebd-f5d6d1edbba6: candidate 7 of 16 (the 3D chest draft's front face; 2 pale columns cropped off each side, widened back to 60) |
| props/chest3d/top.png | pro job 95e7bbe3-13d8-4b45-b41f-a505e2f6c13a, asset 07757305-c5b7-5a0b-9702-985c8035698d: candidate 1 of 25 (the 3D chest draft's lid top) |
| props/chest3d/front-lit.png, top-lit.png, under.png | made from front.png and top.png: the lit edges (front rows 0 and 6, the top's front row 32) ×1.4, and the lid's underside (the top ×0.35) |
| props/klutz_box.png | gallery:2b204dad-def9-42f7-9e8b-6c13e649ad52 |
| den/pit.png | gallery:327af24a-1fd8-4dcc-b3dc-8c0aa111d955 |
| den/bookcase-2.png | gallery:7c56b09e-b67f-46ae-abe7-e2ab98275292 |
| items/aether_shield.png | gallery:49708af5-5ae3-4cf7-8118-68c3fae8151f |
| items/basalt_bulwark.png | gallery:f869f819-ff25-4614-99ef-5d9e06e4736e |
| items/chainbound_aegis.png | gallery:e36dc079-3597-4ff1-8715-f127921bb376 |
| items/chaos_orb.png | gallery:ef186772-d9dd-408d-9f63-2da5f0c86c6e |
| items/frostspire_staff.png | gallery:8ddfea47-8cb9-4729-a37d-4dba65858bf4 |
| items/ironfang_guard.png | gallery:a0499dbd-8108-444a-9b11-82a589708506 |
| items/klutz_club.png | gallery:b37d4bbf-85c1-4923-ae4b-211a2ee19448 |
| items/lightning_trident.png | gallery:e26f49b0-6b47-463a-b490-fe5bb7d135c1 |
| items/serrated_fanblade.png | gallery:ba1c4c0f-639d-4308-ad34-16dd4b512f38 |
| items/soul_storm.png | gallery:be3e21c4-4ca8-4db1-8cf7-61247b9771e5 |
| items/stormlash_whip.png | gallery:214d7797-81e8-4439-a7d1-19ad6e5e2ad7 |
| items/temporal_maul.png | gallery:8adaf146-d462-4c1f-9656-640c8eaa3ee9 |
| items/thunderhead_crossbow.png | gallery:3db30c0e-b7f1-4570-b0f0-160376389ba5 |
| items/void_scythe.png | gallery:a9be5a55-fec4-4883-84ab-30058c0d3483 |
| items/materials/planks.png | gallery:cc2bd7c7-ed6e-5e7c-9c38-ed9d42157cdc |
| items/materials/nails.png | gallery:77106efa-394b-5c56-8070-516efb2810da |
| items/materials/metal_bars.png | gallery:290aace3-eeb7-5814-81e4-9b86a415eaf6 |
| icons/stat_hp.png | gallery:c1a3fb1d-d4f7-5af3-bdf1-46e9056b6e0c (raw generation) |
| icons/stat_atk.png | gallery:42cf644c-dd0e-5ea3-9170-0e90de16a123 (raw generation) |
| icons/stat_mag.png | gallery:92986e76-7cea-5997-9b20-4db0c44f9d37 (raw generation) |
| icons/stat_agil.png | gallery:e779c541-6df4-5891-8f95-21a680977548 (raw generation) |
| icons/race_undead.png | gallery:670a08ae-16d6-555a-a000-a8d2985b53e6 (raw generation) |
| icons/race_divine.png | gallery:96176052-6271-5c57-98b9-d741ae82c47a (raw generation) |
| icons/race_beast.png | gallery:7a6ec297-fb7c-5708-82e0-241ae1efef1f (raw generation) |
| icons/race_geo.png | gallery:e2b834cf-5874-5b94-9a19-84c62ffc4fab (raw generation) |
| icons/race_humanoid.png | gallery:27143d20-b0a3-552a-a7f7-e15f7b1f88bb (raw generation) |
| icons/neutral.png | gallery:a870bc05-533f-5cec-b287-b5313fa31da7 (raw generation) |
| icons/status_cripple.png | gallery:b4ec072f-c2fc-5211-a612-1ce1cb287823 (raw generation) |
| icons/status_poison.png | gallery:10bf5126-af65-5542-8f1d-2dd52281669e (raw generation) |
| items/materials/essence_stones.png | gallery:22ccee17-61ab-51c2-80c3-af84130cc1d8 (raw generation) |
| items/tools/flare.png | gallery:2379ccba-f7ac-5b96-8240-47e59573144d (raw generation) |
| items/tools/clairvoyance.png | gallery:e9f3a64f-46f4-5c92-9728-e90ad2d2b4e7 (raw generation) |
| items/tools/revival.png | gallery:adf990a7-3261-543f-a6fb-8e44c6def47c (raw generation) |
| items/codex.png | gallery:8902cc6d-8084-5b37-b0a8-36ce0765d35a (raw generation) |
| items/xp_scroll.png | gallery:9ea8c346-c1f8-5d2e-b56f-8029b2d6db61 (raw generation) |
| items/schematic.png | gallery:2f688333-4c9c-563d-be82-bd8986cad691 (raw generation) |
| items/weeping_greatbow.png | gallery:b5ff76e0-5df4-4ac2-a924-a694a85e5592 |
| items/armor/chest_arcane_nullifier.png | gallery:3f9fe357-3b21-4bf9-91d4-36eae197226b |
| items/armor/chest_arrowward_mantle.png | gallery:95b8f15d-e64f-4a26-93c9-a2dc10e9b3d0 |
| items/armor/chest_colossal_shellarmor.png | gallery:c16627b0-686b-4b37-bc0c-17ebdadbe785 |
| items/armor/chest_dragonscale_tunic.png | gallery:f3566bf4-cf9f-4987-a04b-513afa9041d3 |
| items/armor/chest_frontiers_mail.png | gallery:1ed43a9d-be04-4434-a0dc-12accadec4a8 |
| items/armor/chest_juggernaut_platemail.png | gallery:e1fbf9f9-5709-4d78-bf32-4d3b08e37e52 |
| items/armor/chest_polished_chainbolster.png | gallery:31250124-22e1-4d82-b111-88196730ce5a |
| items/armor/helmet_arcane_nullifier.png | gallery:21db0276-b89b-41a5-bf42-d6d4ca503916 |
| items/armor/helmet_arrowward_mantle.png | gallery:89ae9392-927a-413a-8604-a1c41f83248a |
| items/armor/helmet_colossal_shellarmor.png | gallery:b8e06b93-7cf4-47e3-9179-3a86f89ab5fb |
| items/armor/helmet_dragonscale_tunic.png | gallery:4194e8f8-8080-4f3d-a90e-27127d8c4543 |
| items/armor/helmet_frontiers_mail.png | gallery:55ae4e2b-d47f-45cb-82eb-e84ec49c1d95 |
| items/armor/helmet_juggernaut_platemail.png | gallery:f97b2f39-dd21-48da-9443-4e0da5b55876 |
| items/armor/helmet_polished_chainbolster.png | gallery:46d4b40e-6fa0-47dc-9a13-6c5668a162cc |
| items/armor/legs_arcane_nullifier.png | gallery:a5938c3a-2b2f-4608-9920-eff6f6c6f4d2 |
| items/armor/legs_arrowward_mantle.png | gallery:a25b29ae-d033-4cc8-a608-001e69e16d6d |
| items/armor/legs_colossal_shellarmor.png | gallery:e943602b-c787-4c88-a316-5ab885eccb87 |
| items/armor/legs_dragonscale_tunic.png | gallery:bf350d3a-e3ed-4080-be25-c6404ef31533 |
| items/armor/legs_frontiers_mail.png | gallery:c5084e5d-6ac5-4674-8776-e7e28dc0011e |
| items/armor/legs_juggernaut_platemail.png | gallery:23d01b82-b6bf-4f70-aad8-46776d5a98d7 |
| items/armor/legs_polished_chainbolster.png | gallery:bf2659e1-5f8f-41e0-8e01-0d32cccd761f |
| den/training-pit.png | map-object:ea26cf7d-8b3d-45e5-b795-3b0d0e1183fb (the pit), with the dummy cut from image:f23beab8-35f4-4abe-ad45-ee1d00d6d669 (an img2img pass over a code block-out on the room grid) and set in the back corner by hand |
| den/sparring-pit-3.png | image:abee38b2-54c4-554a-bccb-b56750325141 (edit_image_pro_flash, two passes over the first Sparring Pit, which was den/training-pit.png with the rim and spears taken out: golden sand in a ring of grey stones, the same dummy), with its orange sand recoloured to tan here by script (the stones and dummy untouched). The number in the name changes with each new version so phones fetch it fresh |
| den/pvp-portal-4.png | image:177c5e5b-8cbe-5a03-8ddf-19b7a053e92c (edit_image_pro_flash over map-object:02800b31-d374-4103-b75c-20af31a2d807, a flat front-on arch, relit so its light comes from the portal: inner edges lit, outer rim dark), slanted here onto the back-left wall by script (each column up ½px per px across) to 96×176, then recoloured here by script to the cave's colours (the stones the walls' blue-grey, the flame a muted moss-green). The number in the name changes with each new version so phones fetch it fresh |
| den/tavern.png | gallery:9d6fa7cb-85e7-5c36-9aff-b09642a17d19 (raw 512px edit of a code block-out, seed 11; colours warmed + trimmed here) |
| npcs/merchant-walk.png | job 1eeed771-59ac-433f-9244-67ec3f5c3882 (animate_image_pixminimax, 8 frames on a 96×96 canvas from npcs/merchant.png; the still sits at 9, 3 in each frame) |
| npcs/collector.png | image:e31cefc4-f858-5180-bf74-39d4b7e0d05a (create_image_pro_flash 96×96, seed 37, the merchant as style image; trimmed here to 76×92 from 7, 2) |
| npcs/collector-walk.png | job a0336eb3-ce1b-4d18-9457-a799cdff9638 (animate_image_pixminimax, 8 frames on a 96×96 canvas from the untrimmed still; the still sits at 7, 2) |
| npcs/librarian-walk.png | job a6b3df74-0905-40ed-bdf3-b9bf9e297034 (animate_image_pixminimax, 8 frames on a 96×96 canvas from npcs/librarian.png; the still sits at 3, 5) |

## Back views (not used in the game yet)

`creatures/back/<id>.png`: each creature seen from behind, for your side of a
fight. Made with `edit_image_pro_flash` (text method) from the front sprite,
padded to multiples of 4; trimmed here. Approved by the user on 2026-11-03.
Still to redo (the plain prompt kept details you couldn't see from behind): the
other 22, Klutz included. Each job's image downloads from
`https://api.pixellab.ai/mcp/images/<job>/download`.

| File | PixelLab job |
|---|---|
| creatures/back/amber_wasp.png | 8e66710c-d4ca-48bb-b7ad-6a03e823309e |
| creatures/back/cave_bat.png | 2a38b5a3-9a8c-459b-85a5-04eaf259d0ec |
| creatures/back/crystal_golem.png | dd86c394-f667-4bc7-a20f-5466339a6625 |
| creatures/back/deep_angler.png | b8f0101c-b993-49d1-8c47-53f38808e9d8 |
| creatures/back/dire_wolf.png | 962ce9cb-4cd1-4852-92f7-a2a0d1c0d885 |
| creatures/back/dreadpox.png | 71bfc212-9f58-4300-ac1d-58cbe3752aa5 |
| creatures/back/dust_sprite.png | e09dc271-6ecc-400a-99cd-48d95dd7603e |
| creatures/back/flame_imp.png | 489b2317-8c9b-4247-9194-45aa323b8b68 |
| creatures/back/glob.png | 04a463e9-89ae-4c28-9bbc-90090add79c5 |
| creatures/back/ironhide.png | b4f50c71-8ba0-4630-bea7-1a7ada942abb |
| creatures/back/mr_shadows.png | dec14e5a-8449-4d90-a683-443a1a643940 |
| creatures/back/swamp_witch.png | 9cc9a155-a861-4a5b-92b2-7a5ca71b0a1a |
| creatures/back/thicket_archer.png | bd86c67c-29ab-4af7-9dd3-59fb3c651a1a |
| creatures/back/thunderhead.png | 6d17eb42-6d74-4ed5-9133-5a8104c6dd26 |

## The walkable Labyrinth: art samples (2026-11-06, samples only, not in the game)

Three-quarter top-down, for `/lab/walk` (its Art toggle). PixelLab ids, not gallery ids
(these weren't saved to the gallery). 12 generations in all.

| File | PixelLab |
|---|---|
| walk/tiles-a.png | topdown tileset 31c22104-5815-4968-8823-e962e2b820d5 (cobbled floor, mossy grey brick wall faces; 16px, 25 tiles, transition 1.0) |
| walk/tunnel-a.png | topdown tileset f515821d-f430-4daa-a15a-bf4743ca3a5b (earth tunnel floor, sharing tiles-a's wall top, base tile c993edd4-eb98-4f2a-9265-42ac447db477) |
| walk/tiles-b.png | topdown tileset 35cd2e41-bae7-41f9-a85e-20372127e592 (dark flagstones, ivy-covered old stone blocks; used for tunnels too) |
| walk/hero-a.png | character 781432c6-ac9f-4329-9fb4-3ee2f6f2e8f5 (hooded ranger, standard 4-direction, 48px canvas) + walk group 7b1f4dd5-ff35-4e15-9879-d4f3fb3995a2 (walking-6-frames: south, north, east) |
| walk/hero-b.png | character e4d97738-0343-4f41-bbbe-7d3eeb4d1c1d (red-haired torchbearer) + walk group 94f4ecb4-70e3-41e3-bdd5-dd73e07de700 (same) |
| walk/hero-c.png | character d70abd54-d794-4b47-abdd-81ee40ec6f0a (sturdy adventurer with a torch, chibi; standard 4-direction, 68px canvas; no walk yet). Sheet: south, east, north, west stacked |
| walk/hero-d.png | character ed2ffa26-adf2-4f89-b659-1ae5f8fe4655 (stout bearded delver in an iron cap, with a torch, cartoon; same) |
| walk/hero-e.png | character b15f91c8-28aa-4912-83c7-891f3ee607ea (small cloaked torchbearer, chibi; the game's hero, 2026-11-06) + walk group 6f5624ac-cceb-4e77-a55b-24b9bc1ebf27 (v3 custom, "walking steadily while holding a burning torch up", 6 frames: south, east, north; the template walk group 0aea752b-… dropped the torch, unused). Sheet: 80px cells, a row per facing (west = east mirrored), the standing pose then the walk, feet at 70 |
| walk/kit-e-*.png | **The game's walls since 2026-11-09 (the user's pick, "E").** Building kit 9fb0ee56-6d06-4f3c-9566-1ac5f10bac2a (square_topdown, 48px, walls 2 tiles, **grid** layout, seed 4202; walls "old crumbling labyrinth wall of rough irregular fieldstones… very dark grey stone with muted umber-brown and cold grey tones… capped with large uneven worn stones; evenly lit"). Cut from its 76×129 piece canvases: north = tile 1 (14,10 48×87), cap = its top 15 rows, east = tile 2 (42,10 20×36), west = tile 4 (14,10 20×36). Corners nw/ne (20×87) and sw/se (20×15) cut from a small room laid out of those pieces (the side strip run up the wall to the cap; PixelLab's blend of the joints was rejected for its colours). Floor = tile 5 of tiles-pro 2d5b0bfe-dbd5-4596-a5ed-af3ae0dbf2e7 (style mode, kit E's own floor as the style tile; 16 cobble variants, the user picked this one), its seams repaired: rolled by half, inpaint job 24f57faf-8de9-419c-8d95-ac1b1667aa4e over the cross, rolled back |
| walk/kit-f-*.png | **The game's walls from 2026-11-09 (to try):** kit E's pieces with the wall tops' stone toned to 75% brightness and fading to 12% of that away from the floor (north's top 21 rows to their top, the dark gap under them lifted ×1.3; cap to its bottom; west/east to their outer side; the corners both ways), floor unchanged. Edges: kit-f-edge-n / edge-w are overlays (the floor's changed pixels only) cut from inpaints of the floor beside kit E's walls: n from a 96×159 composite (two north faces over floor), inpaint 795a57a4-02b8-4dda-9c5c-c2cee808d41a (seed 911) over the floor's top rows, rolled half a tile and its seam inpainted 0819342b-69e0-42b6-9c20-f1baa178eb0c (914); w from a 68×108 composite (the west strip beside floor), inpaint be9e5180-6139-43dc-9de5-27d12e64e9ad (912), seam 75a9c58e-3d47-46c4-8612-c3097e168265 (913). Both repeat seamlessly along their wall |
| walk/scroll-frame.png | the scroll's paper (2026-11-09, the user: classic tea-stained, looks like a scroll): create_image_pixflux 21af8bff-4b8b-4bcd-9ec6-ffecf73c58ca (seed 1202, "an unrolled parchment scroll, front view, curled rolled paper at the top and at the bottom… classic tea-stained old paper"), cropped to 152×219. Drawn nine-sliced round the scroll (edges 36, 12, 34, 12 px) |
| walk/wall-torch.png | the wall torch (round 3): PixelLab Pro Flash with the dungeon palette and a kit E style crop (d2d6d66c…), 24×48, unlit; its flame is drawn in code at its head (4 px down) |
| walk/candles.png | the floor candles (round 3, as the torch: 98bf773b…), three candles in wax, 32×40, unlit; flames drawn in code on the wicks |
| walk/kit-a-*.png | building kit fde7c218-f55e-4339-b5cd-5406ef04d6cb (square_topdown, 32px, walls 2 tiles, materials layout): floor = tile 0 (10,55 32×24), north = tile 1 (10,7 32×57), cap = tile 1 (10,7 32×15), east = tile 2 (30,7 12×24), west = tile 4 (10,7 12×24) |

The tile sheets are PixelLab's own sheets as downloaded (the layout: `WANG_TILES` in
lib/dungeon/tileArt.ts, the same for all three). A hero sheet is packed here: 48px cells,
rows south, east, north, west (west is east mirrored: no west walk was generated), column 0
standing, 1–6 the walk.

## The walkable Labyrinth: in the game (2026-11-06)

| File | PixelLab |
|---|---|
| walk/cage.png | map object 2993e921-4097-485c-90b2-a3a29e0d9f62 (rusty iron cage on a wooden base, shut; 48×48, low top-down) |
| walk/cage-open.png | edit_image job 8988f748-0612-4341-948a-b8058ee6c88c (walk/cage.png edited: the door swung open, the padlock gone; 48×48) |
| walk/healing-pool.png | map object 0736470c-48bb-49d8-8a03-aed56954346b (round pool in a ring of grey stones, pale blue water; 64×48; its faint glow is drawn in code) |
| walk/witch.png | character 0d2cdbab-c9e6-41f9-9069-e4954e12fa0b (old crone card witch with a walking stick, chibi, v3, 64px; the first, younger one 866b0221-662d-4516-81ba-c070d8c31f32 was dropped: the user wanted her old) + walk group 58576660-f2a7-4a0f-857f-703e834f9cb3 (v3 custom, "hobbling slowly forward, leaning on her walking stick", 6 frames: south, east, north; the template walk group d79da682-… dropped her cards, unused). Sheet: 67px cells, each frame trimmed and stood on one baseline, rows south, east, north (west = east mirrored), the standing pose then the walk, feet at 65 |
| walk/campfire.png | map object 74195636-9d23-4f32-b337-9ef76928f9a9 (logs stacked in a teepee in a ring of grey stones, burning; 48×48, low top-down; asked for unlit, came lit, used as the burning fire) |
| walk/campfire-out.png | edit_image job a30d45a9-9cb2-49ce-9db3-8f041e5afa63 (walk/campfire.png edited: the fire out, charred logs, ash, a few embers) |
| walk/candle-lit.png | map object 025fa733-ac4b-4ed1-9f7a-3b4cdb337db7 (a candle in an iron holder; asked unlit, came lit; style-matched to the kit floor; trimmed) |
| walk/candle.png | walk/candle-lit.png with its flame cleared and a dark wick drawn (by script) |
| walk/floor-worn-0…11.png | edit_image job 38ca44d5-5fd9-4e4d-ac6e-78c534a200da (a 2×2 block of the kit's floor, worn: cracks, chips, moss; 3 results, each cut into 4 tiles) |
| walk/wall-worn-0…2.png | edit_image job 9071583c-6e7e-4536-a627-3569a558915b (two of the kit's north wall faces side by side, worn: cracks, cobwebs, ivy; 64×57 each) |

### Decor samples (2026-11-06, /lab/newrun only, for the user to pick)

Map objects style-matched to the kit's floor (a 64×64 floor patch as background, oval inpainting), trimmed.

| File | PixelLab |
|---|---|
| walk/decor/barrels.png | map object d6030990-1ee7-42a9-919e-1bb89f7ab418 |
| walk/decor/crates.png | map object 5ca2eba4-c73d-4e00-a191-7095bb2bce0c (plain, not style-matched: the matched one came back floor only) |
| walk/decor/bones.png | map object 8cc795fe-9333-4762-b318-094c233e5674 (asked for a bone pile, gave a skull) |
| walk/decor/nest.png | map object 4654fb62-bae6-4e63-ab19-6e3ac1f559ed (a straw nest, with eggs) |
| walk/decor/pots.png | map object ecb63ca3-b767-4e85-9ce4-d60d46f4ba08 |
| walk/decor/pillar.png | map object b7d2deb6-f4db-4f46-826b-76ac45883636 (asked for a broken pillar, gave a heap of mossy blocks) |
| walk/decor/banner.png | map object 08687f45-ed98-459e-aab3-18571baba923 (side view) |

## Reskin comparisons (2026-11-07): not used by the game or the lab

The first tries at the warm reskin after the user's reference ("Dungeon art style.png"), made
before the art standard existed (docs/world-spec.md). The user judged them not on brief and
not matching our walls; kept only to compare against. Nothing in lib/sprites points at them.
Side by side: docs/ideas/reskin-samples-2026-11-07.png.

| File | PixelLab |
|---|---|
| walk/samples/kit-b-*.png | Sample 1 (orange brick): building kit 863964ab-53a4-452e-b1a2-2269156ac5f3 (square_topdown, 32px, walls 2 tiles, materials; walls "warm terracotta and reddish-brown dungeon brick… framed by thick squared grey stone blocks", floor "worn brick paving… a shade darker"), cut as kit-a. $0.08 in credits each |
| walk/samples/kit-c-*.png | Sample 2 (grey-brown brick): building kit 83855ea1-4060-4061-b2e2-369a46992d45 (same settings; walls "muted brown-grey bricks… band of squared charcoal-grey stone", floor "dark worn grey-brown brick paving") |
| walk/samples/kit-d-*.png | Sample 3 (red brick, dark slabs): building kit ab054945-22ab-46c4-9a71-d2f6fbbbbf56 (same settings; walls "desaturated reddish-brown bricks weathered toward grey… slate-grey stone blocks at the top", floor "large worn charcoal-grey stone bricks… much darker than the walls") |
| walk/samples/pillar-stone.png | map object b4127d8a-06fe-4359-8aba-9cf1f7a1646b (chunky square pillar of stacked charcoal-grey stone blocks; 64×96 low top-down, trimmed) |
| walk/samples/pillar-brick.png | map object cc954d9c-ab8a-4527-a31d-8522f0787fae (chunky square pillar of brown-grey brick, grey stone base and cap; same) |
