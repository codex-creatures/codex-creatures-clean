# Sprites ↔ PixelLab gallery

Every PNG in `public/sprites/` is saved, exactly as the game uses it (trimmed,
facing left), in the PixelLab Creator gallery. Search the gallery for
**CODEX FINAL** to see them all. The raw generations they came from are in the
gallery too, under their original prompts.

Not all of them actually face left: Mr Shadows (and Klutz) are drawn facing
right, and are marked `faces: "right"` in `lib/sprites/creatures.ts`
(FACING_RIGHT) so fights and rooms turn them the right way. Look at each new
creature's PNG (scaled up: a 73px figure is easy to misread) and add it there
if it faces right.

To update a sprite in both places: fix it, then
`save_to_asset(image=..., target="gallery:<id>")` with the id below, and copy
the PNG here.

| File | Gallery |
|---|---|
| creatures/amber_wasp.png | gallery:8e760486-daef-4018-b3be-a15a4e0b4d6e |
| creatures/aurelius.png | gallery:c29d5316-b647-4268-b754-884ace94a837 |
| creatures/baby_cyclops.png | 6cfa1a7f-0a25-528b-861c-ba59c7a8e9e5 (with his club, 2026-11-20: edit_image_pro_flash of gallery:e7451478-247f-4c4e-bec7-754d61156141, the one with the box) |
| creatures/minotaur.png | a5c89281-70fe-4fc1-930b-9203be9c9868 (the user's pick of the samples, 2026-11-21: create_image_pixen 128×128, side view, trimmed). The other samples, in art/minotaur-samples/: 2 c65d0cb5-3b4e-4d85-92e6-3e38497b4252 (two axes), 3 e728aedd-e3b7-424b-b87c-15c2570f6b7f (head lowered) |
| creatures/bellow_toad.png | gallery:2dd08335-9bf9-51b7-bc63-20ddbefcd7e5 (raw generation; trimmed + mirrored here) |
| creatures/cave_bat.png | gallery:7a5a21a3-4c74-533e-9d12-c6efc97b48ed (the Cave Goblin, sample 11 of 16; raw generation; trimmed + mirrored here. The old Cave Bat: gallery:054e1aad-2c7f-4370-8ba2-bae183383893) |
| creatures/crystal_golem.png | gallery:39cc6f47-8738-4a8f-8a88-c5e05ee6ad7b |
| creatures/crystalback.png | gallery:537af213-0666-448e-a72d-cb308fe90489 |
| rooms/dire_wolf_scene.png | gallery:84c2ddf7-7185-40dd-9d54-9a0f7cecb83d (the Dire Wolf's art, creatures/dire_wolf.png until the Mythiclaw took its id, 2026-11-26) |
| creatures/dreadpox.png | gallery:72f0d447-6a3d-5c80-8c41-38fa82810610 (raw generation; trimmed + mirrored here) |
| creatures/flame_imp.png | gallery:e935d6b5-f3df-5889-a93d-4f6bb8758262 (raw generation; trimmed + mirrored here) |
| creatures/glob.png | gallery:e423893e-fd95-5b08-b974-79be7cbda576 (raw generation; trimmed + mirrored here) |
| creatures/gleamling.png | gallery:e677034e-9f2c-4c89-ba55-117a51c50eee (raw generation; trimmed + mirrored here) |
| creatures/plague_rat.png | gallery:5b422641-093d-4ce6-a738-293427afdebc (raw generation; trimmed + mirrored here) |
| creatures/rotgut_fly.png | gallery:3c6195d0-db24-4a67-9f83-4e6c05c09d0d (raw generation; trimmed + mirrored here) |
| creatures/skinwing.png | job 3e823d01-1037-4ffb-8965-7e7d14313dd4 (pixen 128×128, gallery 3466f4c4-4cbc-5b33-ab97-d84e37178e2b; trimmed + mirrored here; the user's picks of 2026-11-26, all in art/creature-candidates) |
| creatures/gutsnout.png | job d72f507b-1599-4268-9175-9472f8d9b418 (pixen 128×128, gallery f5bbb7c6-24b9-5991-aa31-209b4fd4677b) |
| creatures/grub_keeper.png | job 1e3e105d-8c94-4204-aa9f-22b83c2e958a (pixen 128×128, gallery d862a2ec-cbb9-5ee2-a42a-e1f35a6a4c6b) |
| creatures/mole_hag.png | job 8224be28-54bf-481c-8dbf-8bbcfedde471 (pixen 128×128, gallery 6b6de202-3f79-5e72-b018-c862f6f88ac9) |
| creatures/gloom_gnome.png | edit_image_pro_flash 174c4c39-4a64-41a6-8d8f-34b3dd9a1d4f (an orb for the mushroom on his staff) of pixen f18e7693-1393-48cb-be46-393ed5762bcb |
| creatures/cinder_husk.png | edit_image_pro_flash cd055d97-d525-4be1-b9de-88c2b1cf873d (smoke from the eyes) of pixen 7af42792-cb0f-405a-8e91-f36216c0f3e4 |
| creatures/troglodyte_brute.png | job 67ed269a-ca13-4765-83fe-b35df2944608 (pixen 128×128, gallery c335fd01-ea0d-5785-9bb3-faf5f7481f87) |
| creatures/gravewarden.png | job 8cd2d3c2-fcb0-40b4-a98b-b79505ae73b1 (pixen 128×128, gallery bde346e7-3644-5a5e-bdd9-8584e533f2a6) |
| creatures/hexed_puppet.png | edit_image_pro_flash 54cf04de-84a8-4d7d-b7e3-9524eba3d90e (a whole marionette cross) of pixen cc79a273-a6d2-476f-ad22-1e19d5242628 |
| creatures/dire_wolf.png | the Mythiclaw, the user's pick (2026-11-26; the Dire Wolf's art moved to rooms/dire_wolf_scene.png): a clean redraw, pixflux img2img 8bfef652-beb5-4b22-a3d5-7323626b6f0b (keep 200) plus a 1px outline in code (finals/mythiclaw_crisp_A.png), of their pick cleaned by reduce_colors acc458c9-723d-46d1-8f78-ae445f1eb536 (40 colours) and a 1px #1a1418 outline added in code (it had lost its outline in the edits); of edit_image_pro_flash dc199782-3504-41c5-b438-1f37f8f5f58a (heavy claws, by the user's reference image) of 73ddf64f-9ba9-473c-bf27-38dfdc6278c9 (thin glowing horn) of 0cdac18a-04e7-4dae-99ae-5bf7e993f0c3 (the reference's look) of the rearing edit ea24f831-e781-43a5-8db0-5b98067ff58f of pixen 2b5c7fd7-f338-461e-8b08-ac3a2933bdab; art/new-creatures-2026-11-26/finals/second-look/mythiclaw_C.png |
| creatures/labyrinth_sprite.png | edit_image_pro_flash c5ece9ed-93db-4bfb-ac56-76ac7a1ec93c (white-gold glowing eyes) of pixen 399499dc-a679-4dc3-8a3d-d87dc22c41ad; option C, the user's pick (2026-11-26) |
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
| den/chest.png (removed 2026-11-24 with the old Den) | gallery:6af3a023-a3e5-4062-8e27-dd1643038f7d |
| den/crate.png | gallery:1a7655fe-70cc-4ae0-9da0-1bfa9d08d2b8 |
| den/crates.png (removed 2026-11-24 with the old Den) | gallery:4ce15207-fe28-41a1-9e6d-38c857add95b |
| den/lectern.png | gallery:c6707841-7037-4c8b-a5ba-4c819cbf8f83 |
| den/merchant.png | gallery:0f753be3-f60e-472c-b679-31b8ed31c859 |
| den/shelves.png (removed 2026-11-24 with the old Den) | gallery:83baaff4-1eef-4329-bf8f-2d0b62081222 |
| props/treasure_chest_open.png | gallery:89cd6782-5a1e-4b57-8267-9888fae07572 |
| props/treasure_chest.png | gallery:2df0068e-66c1-4280-939c-886481ebfc23 |
| props/chest3d/front.png | pro job 03cbe4bb-df94-4871-b722-a0a5a057eff3, asset 664e3b36-974d-5d56-9ebd-f5d6d1edbba6: candidate 7 of 16 (the 3D chest draft's front face; 2 pale columns cropped off each side, widened back to 60) |
| props/chest3d/top.png | pro job 95e7bbe3-13d8-4b45-b41f-a505e2f6c13a, asset 07757305-c5b7-5a0b-9702-985c8035698d: candidate 1 of 25 (the 3D chest draft's lid top; its pale left column replaced by the right edge's dark one) |
| props/chest3d/inside.png | pro job 72bdbefa-ff8e-4df4-8a6f-432c077d328c, asset f838724d-9e42-58a7-9482-8bb55a6561f8: candidate 0 of 25 (looking down into the open chest: its rim, gold and gems) |
| props/chest3d/side.png | pro job beba8142-abc7-49da-9a88-ccb38f5e5307, asset 676a9d99-74e7-579e-bfee-260a7d9ce658: candidate 4 of 64 (the 3D chest draft's ends; moved down a row so its lid seam meets the front's) |
| props/chest3d/front-lit.png, side-lit.png, top-lit.png, under.png | made from front.png, side.png and top.png: the lit edges (front and side rows 0 and 6, the top's front row 32) ×1.4, and the lid's underside (the top ×0.35) |
| props/bookcase3d/front.png | pro job d3f0bbbd-1f3d-4631-a828-846c5aeab40c, asset ec6375b6-baf8-57d6-8826-14d0aed889e8: candidate 1 of 16 (brown oak, 60 × 48; replaced the first try, a071a685…, reddish and short) |
| props/bookcase3d/side.png | pro job d3c856a3-26bb-4771-a256-1cb58b19c1b2, asset a5e472fe-a221-596c-80bb-dffc75237992: candidate 19 of 64, resized to 24 × 48 and turned browner (hue +11, ×1.2) to match the front |
| props/bookcase3d/top.png | pro job add29372-497b-45fc-80a1-f44b7fafc807, asset e1dd1b27-4653-5e1d-bb5f-33b6dedbefbd: candidate 0 of 16, resized to 60 × 21 and turned browner (hue +11, ×1.06) |
| props/bookcase3d/*-lit.png | made from those: the top row of the front and side, and the top's front (last) row, ×1.4 |
| props/sack3d/wine.png | edit_image job 4cb0092c-7827-499b-a308-7e4c5f019ddd of props/sack3d/burlap.png (the money stash's 3D sack: the burlap dyed wine red, a gold-stitched seam; the user's pick of look B, 2026-11-23) |
| props/money_sack.png, props/money_sack_open.png | edit_image jobs 2fbded44-cd32-4d38-8c22-5d6d282ebd81 and e470bcb9-be6a-42f7-ba9f-0e2787df91e2 of burlap_sack.png and burlap_sack_open.png (look B; look A, a gold coin on the burlap, is in art/money-stash-samples) |
| props/sack3d/burlap.png | pro job 838108d6-42b2-46d1-892e-6f3c89bf0adf, asset c8cc9e27-0fe3-5efe-a5ef-f5f4145c7534: candidate 0 of 25 (the 3D sack's cloth, repeated round it) |
| props/table3d/front.png | pro job 34326a4c-c7c3-4b57-b211-c4bd1241b877, asset d5e1ab9f-a41d-5632-9e77-264a9fd7ad07: candidate 0 of 16 (the table from the front, its X-braced legs; the dungeon palette, chest3d/front.png as the style image; the 3D table's slab edge, legs and brace, and the 2D view's picture) |
| props/table3d/top.png | pro job 569aeb76-cb67-4530-80f0-3d109ce9f007, asset dabc180e-e744-51c1-b330-7cdc972495a7: candidate 11 of 25 (the table's top, iron-banded planks; the dungeon palette, chest3d/top.png as the style image) |
| props/table3d/deck.png | pro job f2cf8649-4e2a-456e-86fa-8534cfe315d3, asset 6ed014e3-7b8d-5665-8f6f-1a3215bf54fc: candidate 1 of 64, trimmed to 16 × 20 (the deck face down, purple and bronze; props/card_deck.png as the style image) |
| props/bookcase3d/broken-front.png | pro job acc38b99-8ae1-4b8d-85a5-e89db3ccb0da, asset caca05fd-33f6-5997-96b6-b66390fbe327: candidate 14 of 16, trimmed to 54 × 44 and set on the bookcase's dark back (bookcase3d/front.png as the style image) |
| props/campfire3d/rim.png | pro job 6f315d82-f074-4f25-b036-ea7424675144, asset 6a75356b-d9c3-5a2a-9a74-b566f15490be: candidate 0 of 64 (the stone rim, laid round the campfire and the gem's plinth; the palette's stones) |
| props/campfire3d/top.png | pro job e42d7009-8d81-4df9-880a-51ff102a303c, asset 7fbd9b74-3004-5c9f-bf0e-c747434de3a9: candidate 0 of 25 (the fire pit from above, no flames; walk/campfire.png as the style image) |
| walk/samples/3d/strongbox/front.png, side.png | pro job 925043a7-6964-44bb-bf80-897c1f8026af, asset af4e5799-9c29-55da-9dda-aec6372c0f6d: candidate 0 of 4, its 72 columns of box widened to 90 (the strongbox's front; the dungeon palette, props/warden_strongbox.png as the style image); side.png its first 58 columns. Lab draft |
| walk/samples/3d/strongbox/top.png, under.png | pro job a871e52b-dadb-4d9f-84a8-dfb91c289a72, asset 4837d727-c1c2-55f4-87e4-101e52795233: candidate 0 of 9 (its lid); under.png the top ×0.35. Lab draft |
| walk/samples/3d/lectern/post.png | pro job 4f6158dc-8899-4b9d-a046-e140eb9df3ab, asset 65d1c860-1589-5e17-900d-7adb585c1352: candidate 2 of 64 (the lectern's carved post; den/lectern.png as the style image). Lab draft |
| walk/samples/3d/lectern/top.png | pro job 3b30787b-e3c5-4437-b9e6-02c7698eba11, asset af1a21de-d100-5b4c-bf76-0a160717482c: candidate 6 of 64 (its desk, the open book, from above; chest3d/top.png as the style image). Lab draft |
| props/klutz_box.png | gallery:2b204dad-def9-42f7-9e8b-6c13e649ad52 |
| den/pit.png (removed 2026-11-24 with the old Den) | gallery:327af24a-1fd8-4dcc-b3dc-8c0aa111d955 |
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
| den/pvp-portal-4.png (removed 2026-11-24 with the old Den) | image:177c5e5b-8cbe-5a03-8ddf-19b7a053e92c (edit_image_pro_flash over map-object:02800b31-d374-4103-b75c-20af31a2d807, a flat front-on arch, relit so its light comes from the portal: inner edges lit, outer rim dark), slanted here onto the back-left wall by script (each column up ½px per px across) to 96×176, then recoloured here by script to the cave's colours (the stones the walls' blue-grey, the flame a muted moss-green). The number in the name changes with each new version so phones fetch it fresh |
| den/tavern.png (removed 2026-11-24 with the old Den) | gallery:9d6fa7cb-85e7-5c36-9aff-b09642a17d19 (raw 512px edit of a code block-out, seed 11; colours warmed + trimmed here) |
| npcs/merchant-walk.png | job 1eeed771-59ac-433f-9244-67ec3f5c3882 (animate_image_pixminimax, 8 frames on a 96×96 canvas from npcs/merchant.png; the still sits at 9, 3 in each frame) |
| npcs/collector.png | image:e31cefc4-f858-5180-bf74-39d4b7e0d05a (create_image_pro_flash 96×96, seed 37, the merchant as style image; trimmed here to 76×92 from 7, 2) |
| npcs/collector-walk.png | job a0336eb3-ce1b-4d18-9457-a799cdff9638 (animate_image_pixminimax, 8 frames on a 96×96 canvas from the untrimmed still; the still sits at 7, 2) |
| npcs/librarian-walk.png | job a6b3df74-0905-40ed-bdf3-b9bf9e297034 (animate_image_pixminimax, 8 frames on a 96×96 canvas from npcs/librarian.png; the still sits at 3, 5) |

## Back views

`creatures/back/<id>.png`: each creature seen from behind, for your side of a
fight. Made with `edit_image_pro_flash` (text method) from the front sprite,
padded to multiples of 4; trimmed here. The first 13 approved by the user on 2026-11-03;
the other 33 redone 2026-11-27 with a sheet for each of what shows from behind
(art/back-views-2026-11/, which keeps every candidate; docs/design/art.md §11). Each job's image downloads from
`https://api.pixellab.ai/mcp/images/<job>/download`.

| File | PixelLab job |
|---|---|
| creatures/back/amber_wasp.png | 8e66710c-d4ca-48bb-b7ad-6a03e823309e |
| creatures/back/cave_bat.png | 2a38b5a3-9a8c-459b-85a5-04eaf259d0ec |
| creatures/back/crystal_golem.png | dd86c394-f667-4bc7-a20f-5466339a6625 |
| creatures/back/deep_angler.png | b8f0101c-b993-49d1-8c47-53f38808e9d8 |
| creatures/back/dreadpox.png | 71bfc212-9f58-4300-ac1d-58cbe3752aa5 |
| creatures/back/dust_sprite.png | e09dc271-6ecc-400a-99cd-48d95dd7603e |
| creatures/back/flame_imp.png | 489b2317-8c9b-4247-9194-45aa323b8b68 |
| creatures/back/glob.png | 04a463e9-89ae-4c28-9bbc-90090add79c5 |
| creatures/back/ironhide.png | b4f50c71-8ba0-4630-bea7-1a7ada942abb |
| creatures/back/mr_shadows.png | dec14e5a-8449-4d90-a683-443a1a643940 |
| creatures/back/swamp_witch.png | 9cc9a155-a861-4a5b-92b2-7a5ca71b0a1a |
| creatures/back/thicket_archer.png | bd86c67c-29ab-4af7-9dd3-59fb3c651a1a |
| creatures/back/thunderhead.png | 6d17eb42-6d74-4ed5-9133-5a8104c6dd26 |
| creatures/back/aurelius.png | bd0b6ba7-c303-44ea-a81c-0ee20d54200c then by script: the far forearm/fist clipped (x34-46,y24-46 of c4) and re-outlined |
| creatures/back/bellow_toad.png | 79c9534a-eed4-4856-9e4d-5add4ddd5d2e |
| creatures/back/cinder_husk.png | 569922e9-980f-4c6d-bc10-9c19f9de75f9 |
| creatures/back/crystalback.png | 13b5efc5-9c27-42fe-92be-644c68d0d682 |
| creatures/back/dire_wolf.png | 96b45aae-99b5-4fac-ac7e-08882e23ebe7 |
| creatures/back/dustwraith.png | 8d3b4f85-0ff9-4b20-9405-bf36f8919f86 |
| creatures/back/flicker_wisp.png | 63d01b55-6c9f-475f-96b9-159671491847 (round 2, edit of c2: longer tendrils) |
| creatures/back/gleamling.png | 834d9c40-14a8-461d-bee2-87dd15fec323 |
| creatures/back/gloom_gnome.png | 19b98e50-b452-4205-845d-8c7ee33cb4af |
| creatures/back/gravewarden.png | e9bc959d-6021-4721-b913-4a856286166f then by script: the shield inside red bars recoloured to dark leather (x79-96,y26-63) |
| creatures/back/grub_keeper.png | a4330471-5b13-438c-baf2-e0f3fa69593e |
| creatures/back/gutsnout.png | 405e2948-406f-4149-9621-e08cb7ce9d3c |
| creatures/back/hexed_puppet.png | 9a8a97d7-2db5-4ab6-89bf-35246f04855b |
| creatures/back/hollow_matriarch.png | f665790b-0180-49f9-90a1-bd7709d53007 |
| creatures/back/klutz.png | 8869464b-851c-423d-88c4-156f92492c8c (round 2, edit of c2: bigger head) |
| creatures/back/labyrinth_sprite.png | 72427d6a-09a4-4725-81fd-ba7e5065d56d (round 2, edit of c2: bigger head) |
| creatures/back/leafblade_scout.png | 69ecb32c-0c09-43d5-aab6-5483a9a9def5 (round 2) |
| creatures/back/mole_hag.png | e94f9635-3862-4b56-ad9f-9729c1dd3930 |
| creatures/back/moss_wolf.png | 9649c8f7-4ad4-4cd6-b7ad-537848290e5f (fix of c2) |
| creatures/back/pale_rider.png | a79cf9bd-6e92-4f09-862d-1743326720d1 (round 2, edit of c3: peaked hood) |
| creatures/back/plague_rat.png | 379afd44-1478-489e-a224-96f2d4e4ac27 (round 2, edit of c3: head dome + ears) |
| creatures/back/rattlebones.png | fb1491ae-d005-440d-89a3-977ea197fb2e (round 2, edit of c2: bigger skull) |
| creatures/back/rotgut_fly.png | 9bcdf29c-48ef-40f4-86f2-09078a2c35e4 |
| creatures/back/rust_beetle.png | 37f7c1cc-d53b-4f53-9b24-b4b5190c0d07 |
| creatures/back/shambler.png | ca1c1c08-f869-4347-8bd7-1f8280e36716 (round 2, edit of c2: bigger head) |
| creatures/back/skinwing.png | 00d8b0a8-3207-4a45-bea3-cce2cafacc0d (round 2) |
| creatures/back/storm_phoenix.png | 1bbf9733-94d2-429a-8dee-787eb5bae9c4 |
| creatures/back/sylvaran.png | 44fdc4ab-545f-432c-bb2d-a28e2ae67087 (inpaint of c1 cloak centre) |
| creatures/back/the_watcher.png | 73cd33a7-3b6e-4011-b6d4-3e42bd229e80 (round 2) |
| creatures/back/troglodyte_brute.png | 50fae7c4-1f21-43c3-b212-17780adb1a67 |
| creatures/back/tunnel_wyrm.png | 2e146729-e606-45a5-a469-e7a798523ab8 (regen seed11, arched neck) |
| creatures/back/veilstalker.png | 3ef56132-2144-401d-a6a0-9d1ea9239a9d (round 2) |
| creatures/back/void_serpent.png | 35cb4299-fb7f-4f3b-b400-8a2f113a7d2e (inpaint of c3 neck stripe) |

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
| walk/floor-life/puddle.png, rat.png, mouse-hole-cut.png | in the game (2026-11-14): copies of the samples below (the cut hole is the sample's hole cut out) |
| walk/hero-8/<direction>.png | the 3D walk's hero (approved 2026-11-14, the user: an 8-direction hero, torch held out in front): character 67704aec-5021-4953-9d03-565e1e9ddb74, Pro Flash 96×96 low top-down, 8 directions, the game's hero (b15f91c8 south) as the style image, seed 7. Figure 48 px tall (as today's, so 32 a unit, not 48). Stills only, no walk yet. In /lab/hero |
| walk/samples/floor-life/puddle.png | sample 2, the sewer puddle (2026-11-13, the user: bluer, with green moss): object f2d3cda7-a565-4538-8151-5a12e7ebf3d5, Pro Flash 64×48 high top-down, the dungeon's stone plus sewer blues and moss greens as the palette, kit E floor as style image (outline, detail, shading), seed 88 |
| walk/samples/floor-life/puddle-1.png | sample 1 (2026-11-13, too grey: redone): object f9db9d3e-3d74-433b-98b7-39fea1979e5a, Pro Flash 64×48 high top-down, dungeon palette, kit E floor as style image, seed 41 |
| walk/samples/floor-life/rat.png | sample (2026-11-13): object 93f900f1-50cf-47a9-9b41-c40fa169b18d, Pro Flash 48×36 side (came out from above), kit E floor as style image, seed 7 |
| walk/samples/floor-life/mouse-hole.png | sample (2026-11-13): image 7a0b5963-15af-5117-96e7-464024c0d0e9, Pro Flash 48×48, dungeon palette, a 48×48 crop of kit E's north wall as style image, seed 13 |
| items/tools/gold_key.png | the Gold Key's icon, in the game (2026-11-14): a copy of the sample below |
| walk/samples/floor-life/cobweb.png | sample (2026-11-15): image 9c95f2b5-3cc9-5a76-8191-2982db3c9819, Pro Flash 48×48, dungeon stone and wax palette, kit E floor as style image (outline, detail, shading), seed 21 |
| walk/kit-f-floor-moss.png | in the game (2026-11-15, the user: "additional texture added to the current art"): kit F's floor with moss in its cracks: image b1f12b73-3eba-5414-80cc-defea8e1d2c2, Pro Flash inpaint of kit-f-floor.png, its middle (4,3 40×30) only, seed 7 |
| walk/kit-f-north-hole.png | in the game (2026-11-15): kit F's north wall with a mouse hole at its foot: image 5dbb4dfc-a452-5447-8f23-9c63bbf8eb8b, Pro Flash inpaint of kit-f-north.png's rows 3–87 (inpaint wants sizes in 4s), the mask 14,64 20×20, seed 13; pasted back over the full tile here |
| walk/kit-f-north-web-a/b/c/d.png | in the game (2026-11-15): kit F's north wall with the cobweb sample (walk/samples/floor-life/cobweb.png, its top-left 32×32) laid in at a room's top corner, split across the two repeats it falls in (a, b: a left corner; c, d: a right one, mirrored), by script here. Two Pro Flash inpaints of a web onto the wall (images b2c7bfb6-…, 0c0b035d-…) drew next to nothing, so weren't used |
| walk/samples/tiles/room-preview.png | the above together, as the lab shows them (a top wall with both corners and the hole, a row of floor with one mossy tile), made here |
| walk/samples/floor-life/moss-1.png | sample 1 (2026-11-15, a solid square, dropped for the tile above): object 9ef2b1bf-1c6a-4436-97c8-fc8bde967b12 |
| walk/samples/floor-life/gold-key.png | sample (2026-11-13): image 66d26819-9c64-5c5b-befd-08f4b0768313, Pro Flash 64×64, the Void Scythe as style image (outline, detail, shading), seed 5 |

## The placeholder drafts (2026-11-16; samples only, shown in /lab/art)

All Pro Flash, seed 7 unless noted. Item icons and crates 64×64 with the Void Scythe as style image (outline, detail, shading; not its colours); race, status and UI glyphs 32×32 styled on race_beast.png / status_poison.png; the Enchantress 80×96 on the collector; the standing torch 32×64 on the wall torch (its colours too); the golden chest on treasure_chest.png; the fireplace 128×128 on den/chest.png. Download: `https://api.pixellab.ai/mcp/images/<job>/download`.

| File (walk/samples/drafts/) | Job |
|---|---|
| essence.png | 5a7e2102-f071-4171-a30f-8b866a46ac88 |
| soul-toxic-skin.png | 63848a15-319c-4e21-831e-24c65e6b49bb |
| soul-haunting-presence.png | 2910e794-fc7d-4d5e-89f5-bc313a75a043 |
| soul-unstoppable-force.png | f1dcd13d-8b6b-4829-8fb1-a3c7f4dc739b |
| soul-perfectionist.png | 45774e2e-61ba-4c1d-96dd-cede17c80748 |
| soul-trickster.png | 8d38e3cc-721c-4460-b6ad-b523c17c63fe |
| soul-revitalise.png | 446f0051-8e6c-4e2c-be56-568a305b48e5 |
| klutz-pack.png | c54fd8e0-2a10-4363-bcbf-177baa360238 |
| locator-merchant-map.png | d17de2b5-6dfc-444f-8786-0321157c72a3 |
| locator-crystal-ball.png | 7295c24d-67ec-4a21-b68d-f60b1e2ac5c1 |
| locator-librarian.png | 71b6435d-a76d-418c-9542-06d27098a592 |
| crate-materials.png | eaafa916-ea5e-40d0-8f61-34cafd083631 |
| crate-gear.png | 4059e519-98f4-45e7-9fa8-27ee06177775 |
| crate-codex.png | afad6a35-b970-41d4-aad3-35674df0cee1 |
| crate-supplies.png | 3c79232a-7829-4e75-8fb8-972ca407a41c |
| cyclops-head.png | 7f3a035f-92b8-4c0a-8d23-ad772cea5891 |
| golden-chest.png | 8d6d6a9c-82b1-41ac-8974-5b92533c79bc |
| enchantress.png | 61fe0751-50bf-4918-929f-aea3a9d4f57e |
| standing-torch.png | e9f9651c-b526-4510-8a62-23c816765725 |
| den-fireplace.png | 0b4709d4-5e1a-4b24-9348-1c8873f3a7eb |
| race-underkin.png | 24caadbc-e170-4bb5-b243-24b7aa91c9cd |
| race-toxic.png | 8d63b7ad-e770-4150-8d71-d254b98a205f |
| status-haste.png | a8982ce9-aee1-47cf-b601-954ae93f811b |
| status-mirage.png | b5807f2b-de9c-4bbf-a703-7620f0a352c6 |
| status-corpse.png | 40d828e6-88d3-4994-881d-3bc0a66c393d |
| status-seal.png | 8c573927-964f-4ae2-a671-c885113f4f30 |
| status-soak.png | 08e75d8e-7fb8-4c48-b9e7-ee05e1cab0a9 |
| status-brace.png | 0b597171-4080-4ab4-9de9-97df2760ec38 |
| status-boost.png | f02cebaa-542f-41bb-9b04-ba75efc4f57d |
| status-bleed.png | f2d7796a-2ebe-490f-81b4-91de2165a4b4 |
| status-weaken.png | 437a750f-ed5c-44ee-bba0-73ea41e8ba02 |
| status-ward.png | fc28b084-61f7-47c8-ae7e-213d388abbbb |
| status-flame.png | 1cb0c06d-c628-4fc8-9563-510d118365b1 |
| status-charged.png | 173f3b59-4375-491f-a47f-1ecee5de8b9e |
| dynamite.png | ab272907-13ee-4031-a708-8d499848e668 |
| ui-settings.png | 783fe412-22f7-4774-b86b-c93f0a3127ca |
| ui-creatures.png | 81f13bf4-1b4a-4806-9cd7-e8c08f8b3f52 |
| ui-items.png | 6738a79d-adc8-43d5-9f39-9314cb2660c2 |
| ui-campaign.png | 468098a4-f8fe-4108-9a14-1eb1c404e127 |
| ui-quests.png | c646032b-bf09-40ab-9d66-7c2849b885c2 |
| ui-leaderboards.png | e9e4f29c-c106-4e5c-97ce-ebc6226760fd |
| (dynamite.png) | seed 3, the third wording: the first two ("dynamite", "blasting charge") were refused by the content filter |

## The placeholder drafts, round 2 (2026-11-16; shown in /lab/art and /lab/chest)

Same recipes as round 1 unless noted. The golden chest faces: Pro Flash edit (text) of chest3d/front, top and side padded to 64×32, 64×36 and 40×32, cut back to 60×19, 60×33 and 38×19 (the front on a solid ground: on a clear one the dark wood was taken for background), lit edges and underside made as chest3d's. Cyclops Head and fireplace: Pro Flash edit of a flat block-out at the 2:1 angle. Enchantress: styled on npcs/merchant.png (its palette too). Crates: styled on den/crate.png (its palette too). Small icons styled on the approved ui_items / status_flame / race_toxic.

| File (walk/samples/drafts/) | Job |
|---|---|
| den-fireplace-2.png | fbd1dfe6-2e87-48f4-9c12-72fdbeade224 |
| enchantress-2.png | f4daf3a4-fb7b-49b6-a357-c46deafd5da7 |
| ui-settings-2.png | e2b7c2f9-b237-4719-99a2-c5a2dd499aa9 |
| ui-creatures-2.png | c99dde9d-818e-4271-a529-4d5d98d52697 |
| race-underkin-2.png | 7adf085c-e6ce-4896-ad7d-04a5ab2050ef |
| status-soak-2.png | ae02ec3b-f764-43f4-8439-d80de6600c93 |
| status-brace-2.png | 2857c2ca-b442-4faa-8419-0823de593e05 |
| status-charged-2.png | dabc778b-2564-44cc-8756-f11700bb5c1e |
| locator-merchant-map-2.png | dae4a404-5c4d-4bb0-b3ac-623f77e1016c |
| crate-materials-2.png | 215c9594-964e-4287-ab88-d0e1687d5c28 |
| crate-gear-2.png | 244bcd89-3160-4641-9abb-d9c31fc1a9aa |
| crate-codex-2.png | d24bdaaa-791c-46d1-9421-8b5f2b362d84 |
| crate-supplies-2.png | f888cfe4-f535-4eaa-8f40-73e5762685a8 |
| cyclops-head-3.png | a8637cd5-13b6-4a0e-a3f8-ce30876cc68c |
| stone.png | e393a09d-666b-4fa4-a3aa-21b7d7678a2b |
| golden-chest3d/*.png | from jobs 3e2ce112-0b8d-4d95-abb0-3ef2f87b059c (front), 89fe7170-92bb-4610-9e7b-305ed05534f9 (top), a99210b5-c4d4-4947-b6ba-3480d1376547 (side) |

In the game since 2026-11-16 (copies of the approved round-1 drafts above): icons/status_{corpse,mirage,bleed,boost,flame,ward,weaken,seal,haste}.png, icons/race_toxic.png, icons/ui_{items,campaign,quests,leaderboards}.png, items/stones/<key>.png, items/materials/essence.png (the Essence crystal; the old gem, materials/essence_stones.png, is no longer used), items/tools/{klutz_pack,crystal_ball,librarian_locator}.png, props/dynamite.png, walk/standing-torch.png (trimmed to 17×52).

## Round 3 (2026-11-16)

The crate as a 3D draft (walk/samples/drafts/crate3d/): Pro Flash edit (text) of chest3d/front, side and top padded as for the golden chest, and of chest3d/inside.png padded to 64×36 for each kind's contents, all on a solid ground, cut back to the chest's sizes; lit edges and underside made as chest3d's. Underkin round 3 styled on race_toxic.png. In the game now: props/chest3d-gold/ (the golden chest), items/materials/stone.png, items/tools/merchant_map.png, icons/ui_settings.png, icons/ui_creatures.png.

| File | Job |
|---|---|
| crate3d-front-pad | 76ff2e90-f82d-45f2-a1f0-476319cf45d5 |
| crate3d-top-pad | 677d9d2f-e427-4df2-9ea1-cf73c1d1a691 |
| crate3d-inside-materials-pad | c2016047-e92e-4592-bdbb-502365cedd82 |
| crate3d-inside-gear-pad | 33d8e71b-5e2b-4842-95f1-e71e0cfec873 |
| crate3d-inside-codex-pad | 7179614b-5aec-4b38-9693-dd9beeef1d95 |
| crate3d-inside-supplies-pad | 69ca883c-0d8a-4827-92e9-ff3f857e3b57 |
| race-underkin-3 | 3e36142d-5c56-42eb-a782-0426158797b7 |
| crate3d-side-pad | 05dd23ba-014d-43af-9c91-3c66a0c5f672 |

## Round 4 (2026-11-16)

| File (walk/samples/drafts/) | Job |
|---|---|
| enchantress-small | 082be149-e542-4110-a3ae-e5ebd40915fe |
| barrel-side | 72ade5a4-bd44-47da-913a-78600c562aff |
| barrel-top | 36963145-79f1-403a-a9b7-2201c1519be8 |
| barrel-items | 7268a1a3-241a-4c27-87ef-5b1e650246eb |
| enchantress-3.png | the smaller Enchantress: enchantress-2 scaled to 60×76 (nearest) on a 64×80 canvas, cleaned up by Pro Flash edit (job 082be149-e542-4110-a3ae-e5ebd40915fe) |
| enchantress-3-walk.png | job f9b7ac16-b9ba-4d06-b47e-941a63d329a1 (animate_image_pixminimax, 8 frames on a 96×96 canvas, the still at 16, 14) |
| barrel3d/side.png, top.png, items.png | jobs 72ade5a4-bd44-47da-913a-78600c562aff, 36963145-79f1-403a-a9b7-2201c1519be8, 7268a1a3-241a-4c27-87ef-5b1e650246eb |

In the game since: icons/race_underkin.png (race-underkin-3), icons/status_soak.png (status-soak-2).
| enchantress-3-walk-a.png, -b.png | jobs 5dd86b64-583d-4eb2-8ba2-ca47f918ae96 (seed 21) and c390e4e6-a737-4af5-8ee7-9bbb504ea658 (seed 33): the walk redone with clear alternating steps (the first, f9b7ac16…, only swayed: dropped) |

## The dungeon props in 3D, drafts (2026-11-16)

walk/samples/drafts/decor3d/, Pro Flash, seed 41, each styled on the flat decor picture it would replace (palette too); the barrel lid on props/barrel3d/top.png, the backpack front on items/backpack.png, the dynamite paper on props/dynamite.png. Enchantress: npcs/enchantress.png and -walk.png are enchantress-3 and walk B mirrored to face left (frame by frame).

| File | Job |
|---|---|
| barrel-lid.png | 6ee3049e-d497-4a24-949a-ea77476cef2d |
| bones-floor.png | c4203cc3-501d-4bf8-92b1-fbd7998edc9c |
| pillar-end.png | fcc1b8e1-c857-4e2e-984a-d3dca2317668 |
| nest-top.png | 1a551d9f-c4bd-4bee-852c-478218793608 |
| pot-side.png | b4dc84f5-631b-4732-836f-efe5da044119 |
| skull-face.png | 85279242-d412-4f72-ba4c-ab0d48d1e989 |
| pillar-side.png | 63a1105e-4634-43b3-b94c-4b5ae9f13090 |
| nest-rim.png | 9704964c-41d8-46f1-8037-07e59e47ce9c |
| pot-top.png | 5642408e-43cf-43f2-b782-8c51691f9172 |
| backpack-front.png | 87fdb46c-c30c-4f6e-8fd1-f53ca8c39297 |
| dynamite-paper.png | 58a626d7-5efa-4b1d-9ad4-e21174c2101c |
| decor3d/pack-leather.png, pack-bedroll.png, pack-pocket.png | jobs 249e8816-925a-4d1c-8ec1-664104af91a1, 694e9889-9a72-4bf0-8f72-d3edff76cb41, b02070f9-6d7e-47a8-9ebe-8d6ded3c7f57 (seed 51, styled on items/backpack.png): the backpack round 2 |
| npcs/collector-walk.png | replaced 2026-11-17: job 455188f1-eaa0-4dbf-a24b-af76a160c43f (animate_image_pixminimax, seed 51, "exaggerated walk", from the still at 7, 2): the old one (a0336eb3…) barely moved |
| npcs/collector-walk.png | 2026-11-17: the same frames in reverse order (played forwards he moonwalked) |

## The new Den, samples (2026-11-18; in the new Den behind Settings → New Den, and /lab/den)

Drawn for the Labyrinth's camera, square on screen at 48 art pixels a unit (lib/den3d/art.ts). All Pro Flash, the
Den palette (art/palettes/den.json: the dungeon's plus warm woods, sandstone, straw and lamplight) where named, and
an approved picture as the style image. Samples till the user approves them.

| File | Source |
|---|---|
| den3d/kit-*.png | the Labyrinth's kit F, every pixel kept, recoloured to warm sandstone walls and a warm earth floor by scripts/den-kit-warm.mjs (no generation) |
| den3d/shack-front.png | job e5618e47-50c5-4a9d-9e1a-34bb56f0c5e9 (156 × 48, Den palette, bookcase3d/front.png as style, seed 11) |
| den3d/storehouse-front.png | job 17541c9a-7f40-4122-b59d-7b883b54be58 (164 × 48, Den palette, bookcase3d/front.png as style, seed 12) |
| den3d/tavern-front.png | job 24bca767-0c4f-41a5-96b6-378b8570f27b (232 × 48, Den palette, bookcase3d/front.png as style, seed 13) |
| den3d/tavern-broken-front.png | job c95ba0d3-7257-4eac-978b-9efca3a2e7d1 (edit_image_pro_flash of tavern-front.png: boarded up, seed 25) |
| den3d/shack-roof.png | job ad54bee3-def9-47c0-89f6-2b4e23b19dc0 (156 × 80 thatch, Den palette, shack-front.png as style, seed 21) |
| den3d/storehouse-roof.png | job 8f544b49-2c62-4d9c-b133-8a821373cec2 (164 × 84 shingles, the Den's woods, shack-front.png as style, seed 41; the first, ba186087…, came out slate) |
| den3d/tavern-roof.png | job 5d8764eb-aa9f-4552-b2fc-82e6f41428ac (232 × 96 clay tiles, Den palette, tavern-front.png as style, seed 23) |
| den3d/board.png | job df570608-baa3-43f4-9bbe-21e72b09ea61 (64 × 48, the quest notes, bookcase3d/front.png as style, seed 24; trimmed to 53 × 39) |
| den3d/altar.png | job 3584425f-09cc-40e8-818f-c4fefdc084c2 (128 × 128, den/altar.png as style: the Soul Altar seen from the front, seed 31; trimmed to 105 × 122) |
| den3d/pit-top.png | job 7256423b-67b0-4dee-bcac-df0ed95f2a06 (224 × 144, den/pit.png as style, from above, seed 32; trimmed to 125 × 115) |
| den3d/sparring-top.png | job 97bcbdc7-52f9-41da-b239-f2708bd31b27 (224 × 144, den/training-pit.png as style, from above, seed 33; trimmed to 125 × 129) |
| den3d/portal.png | job 94a95c96-5d6a-420a-bbe5-348159121f05 (80 × 88, a crop of the first try, 32bd4366…, as style, itself styled on den/pvp-portal-4.png; seed 37; trimmed to 76 × 81) |
| den3d/arch.png | job 4db8075f-31ea-4c08-a00d-7d4de4ccc0c3 (128 × 80, a crop of the first try, f8e841e9…, as style, styled on den3d/kit-north.png; seed 36): it came back cut off on the left, so its right half was mirrored here into a whole arch, 138 × 73 |
| den3d/pool-top.png | job ed93c744-cf91-4fc9-ad4d-4bcd6881be8e (124 × 68, props/healing_pool.png as style, from above, seed 42; trimmed to 95 × 63) |
| items/labyrinth_stone.png | job f8f43cae-30a6-4ac5-a10d-d01d6e43166f (64 × 64, the Void Scythe as style, seed 51): the Labyrinth Stone (2026-11-19: Klutz's quest find, in place of the dynamite); also the 2D walk view's picture of the find (`DYNAMITE_ART`) |
| den3d/parts/dummy.png | job 265546f2-1b15-480d-a4a3-f47663c53ade (32 × 64, a crop of den/training-pit.png's dummy as style, seed 52; trimmed to 30 × 56) |
| den3d/parts/stone-bricks.png, stone-blocks.png, stone-bricks-3.png, stone-runes.png | tiles pro 111e5ed2-b2a4-4e35-a5a0-f8523996f605 (16 square top-down tiles at 48 px, seed 7, segmentation, a palette of the altar drawing's stone lifted a step lighter for lit rendering): tiles 9, 2, 14 and 6 (the rest showed a light grey edge line when tiled). For the prop recipes (lib/props/recipes), 2026-11-19; bricks, blocks and runes then lifted 18% brighter for lit rendering (a level change, no repaint) |
| den3d/parts/*.png (the rest), den3d/portal-arch.png | cut from approved pictures by scripts/den-parts.mjs (no generation): the altar's fire, skull and lantern, the pool's water, the sand, the Labyrinth's grey stone; the portal's arch is den3d/arch.png mirrored and turned green |
