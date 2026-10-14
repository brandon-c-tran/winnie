# Winnie animation sources

Generated with OpenAI image generation on 2026-10-13 for the pose list in
`ASTRA_HANDOFF.md`. These are source sheets, not runtime assets. The existing
Winnie, room and portrait originals were preserved.

References: `public/photos/winnie-pixel-v2.png` for Winnie and
`public/photos/snuggle-puppy.png` for his plush toy.

Generation brief: match the existing apricot cavapoo's pixel style, palette,
dark outline, proportions and blue gingham bandana. Transparent background,
separate evenly spaced poses, no text or scenery, consistent feet baseline.
Winnie should always appear calm, happy, curious, sleepy or silly.

- `winnie-poses-a.png`: three columns by three rows. Belly up, rolling onto his
  side, play bow; two ear-scratch poses and head tilt; jumping and two shake poses.
- `winnie-poses-b.png`: three columns by two rows. Head down at a red bowl,
  chewing, greeting; two walking poses carrying Snuggle Puppy, chin resting on
  the toy. A subsequent background-removal generation produced this transparent
  source while preserving the six poses.

Run `node scripts/pack-poses.mjs` to pack these with the existing 15 room frames
into `public/photos/winnie-room-v3.png`. The script finds each silhouette,
uses nearest-neighbor sampling with an alpha threshold, and aligns all 30
frames on the room's 64-pixel grid. The generated sheets have higher resolution
than the requested grid; retain them here for future refinements.

Runtime behavior lives in `public/room.js`: scratch, tilt, bow, roll, jump,
shake, eating, greeting and carrying/resting with the toy. Interruptions clear
transient offsets and toy state; reduced motion settles to a still logged state.

## Harness accessory

`winnie-harness.png` is the generated transparent six-pose source for Winnie's
cream harness with red/yellow straps and green hardware. The generation prompt,
reference handling and output sizes are recorded in [harness-prompt.md](harness-prompt.md).
The personal clothing reference photograph is not bundled or published.

Run `node scripts/pack-harness.mjs` using [the harness packer](../../scripts/pack-harness.mjs)
to produce `public/photos/winnie-harness-v1.png`. It aligns each generated pose
to the corresponding existing 64px room frame using nearest-neighbour sampling
and preserves the source sheet. `public/app/services.js` loads both room and
harness sheets; `public/room.js` shows the harness for the current pee/poop
acknowledgment, then restores the bandanna. Interruptions and reduced motion
clear the accessory; loading failure retains the normal Winnie sprite.
