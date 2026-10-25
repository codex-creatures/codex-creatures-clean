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
| creatures/cave_bat.png | gallery:054e1aad-2c7f-4370-8ba2-bae183383893 |
| creatures/crystal_golem.png | gallery:39cc6f47-8738-4a8f-8a88-c5e05ee6ad7b |
| creatures/crystalback.png | gallery:537af213-0666-448e-a72d-cb308fe90489 |
| creatures/dire_wolf.png | gallery:84c2ddf7-7185-40dd-9d54-9a0f7cecb83d |
| creatures/dreadpox.png | gallery:72f0d447-6a3d-5c80-8c41-38fa82810610 (raw generation; trimmed + mirrored here) |
| creatures/flame_imp.png | gallery:e935d6b5-f3df-5889-a93d-4f6bb8758262 (raw generation; trimmed + mirrored here) |
| creatures/glob.png | gallery:e423893e-fd95-5b08-b974-79be7cbda576 (raw generation; trimmed + mirrored here) |
| creatures/dust_sprite.png | gallery:edc1b68b-8559-4d7c-89f3-11fc1602d302 |
| creatures/dustwraith.png | gallery:f09aeb9b-7692-4ff2-b7fc-d311a5d12a1a |
| creatures/flicker_wisp.png | gallery:175612f3-f343-46fb-a8d3-16501002997e |
| creatures/hollow_matriarch.png | gallery:33ca76b5-df94-4448-9108-2b82b2536b05 |
| creatures/ironhide.png | gallery:f1abf558-845a-4fd9-a7a0-981361629e6b |
| creatures/klutz.png | gallery:7613b7fe-5887-47b7-8220-51d4c33e246a |
| creatures/klutz-walk.png | gallery:b8e7eb1c-9a8f-440a-a8b7-59bcd701fed8 |
| creatures/leafblade_scout.png | gallery:98d5d66f-6d18-42e3-bc5f-32b26de80423 |
| creatures/monkey_mage.png | gallery:94f0b638-48cd-48de-953f-04e695f372c3 |
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
| den/tavern.png | gallery:9d6fa7cb-85e7-5c36-9aff-b09642a17d19 (raw 512px edit of a code block-out, seed 11; colours warmed + trimmed here) |
