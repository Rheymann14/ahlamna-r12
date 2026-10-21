# Art pipeline: making characters and buildings for AHlam Na! XII

The game draws simple placeholder characters and buildings in code so it always runs.
Real art made in 3D software **replaces them automatically**. Nobody has to change game code;
you export a file, drop it in a folder and add one line to a list.

## Tools (all free)

| Tool | Use it for |
|---|---|
| **Blender** (blender.org) | Modelling characters, buildings, jeepneys, props. Exports glTF directly. |
| **Mixamo** (mixamo.com, free Adobe account) | Auto-rigging a character and adding Idle / Walk / Run animations. |
| **Free CC0 asset packs**: Quaternius (quaternius.com), KayKit (kaylousberg.com), Kenney (kenney.nl) | Ready-made low-poly characters, houses, trees and vehicles. CC0 means free for any use, including government projects, with no credit required. |
| **VRoid Studio** (optional) | Anime-style character creator with sliders. Export VRM and convert it to glTF in Blender. |
| **gltf-transform** (`npx @gltf-transform/cli`) | Shrinks files so they load fast on phones. |

Recommended starting point: take a CC0 low-poly character pack, restyle the clothes and colours in
Blender to look local (barong, baro't saya, T'nalak patterns, school uniforms, nurse uniform,
Muslim and IP attire), then animate it in Mixamo.

## Character workflow

1. **Model or pick** a character in Blender. Keep it low-poly: **under 5,000 triangles**, one material,
   and one texture of at most 1024×1024.
2. **Rig and animate** it in Mixamo. Upload it as FBX, auto-rig it, then download these animations:
   - `Idle` (standing)
   - `Walk`
   - `Run`

   Choose "In Place" for Walk and Run so the game, not the animation, moves the character.
3. **Combine them in Blender**: import the character and the animations, and name the actions
   `Idle`, `Walk` and `Run`. The game finds clips by name: anything containing "idle", "walk"
   or "run"/"jog".
4. **Export** with File → Export → glTF 2.0:
   - Format: **glTF Binary (.glb)**
   - Include: selected objects; Transform: **+Y up**
   - Animation: enabled, with "Group by NLA track" on
   - The character must **face +Z (forward)** and stand on the ground at the origin.
     Height doesn't matter; the game scales every character to 1.8 m.
5. **Optimise** it:
   ```bash
   npx @gltf-transform/cli optimize nurse.glb nurse.opt.glb --compress meshopt --texture-compress webp
   ```
   Aim for **under 500 KB per character**.
6. **Install**: copy the file into `public/models/characters/` and list it in `public/models/manifest.json`.

## Buildings and props

These are the same steps without animation. Export at real size in meters, with the door facing **+Z**,
centred on the origin and sitting on the ground. Budget: under 10,000 triangles and 1 MB.
Put the files in `public/models/buildings/`.

### Landmarks

The "best spots" of the region (Koronadal Roundabout, Koronadal City Hall, Regional Prime Center,
GenSan Fish Port, Seven Falls, and so on) are built in code in `resources/js/play/world/LandmarkModels.tsx`.
A Blender model replaces one the same way: export it facing **+Z**, centred on the origin at real size,
put it in `public/models/landmarks/`, and list it under `landmarks` using the landmark slug from
`resources/js/play/world/landmarks.ts`. Keep it inside the landmark's footprint there (its collision boxes),
or the player will walk through walls. Budget: under 20,000 triangles and 2 MB.

## The manifest

`public/models/manifest.json` says which model to use where. The keys are:

- `player`: the player's character
- `npc_default`: used for any NPC without its own model
- a **location slug** from the database for a specific NPC or building, for example `loc_health_center`
  (the nurse) or `loc_school`

```json
{
    "characters": {
        "player": "characters/student.glb",
        "npc_default": "characters/villager.glb",
        "loc_health_center": "characters/nurse.glb",
        "loc_school": "characters/teacher.glb"
    },
    "buildings": {
        "loc_school": "buildings/school.glb",
        "loc_health_center": "buildings/health-center.glb"
    },
    "landmarks": {
        "koronadal-city-hall": "landmarks/koronadal-city-hall.glb"
    }
}
```

Location slugs currently in use: `loc_school`, `loc_health_center`, `loc_home`, `loc_plaza`,
`loc_lake_sebu`, `loc_gensan_port`, `loc_isulan_youth`, `loc_alabel_capitol`, `loc_kidapawan_hub`.

If a file is missing or broken, the game logs a warning in the browser console and keeps the placeholder.

## Checklist before handing art over

- [ ] Opens and plays its animations at https://gltf-viewer.donmccurdy.com
- [ ] Faces +Z and stands on the ground at the origin
- [ ] Clip names contain Idle / Walk / Run (characters only)
- [ ] Optimised, and within the triangle and file-size budget
- [ ] License allows use in a free government app (CC0, your own work, or Mixamo)
