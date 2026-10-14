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
and preserves the source sheet. This six-pose v1 sheet is retained as an input
to the full outfit packer below.

## Current runtime outfits

The room loads `public/photos/winnie-room-v3.png`,
`public/photos/winnie-harness-v2.png` and `public/photos/winnie-stripes-v2.png`
through `public/app/services.js`. All three sheets are 192×640px: three columns
by ten rows of 64px cells, with identical pose coordinates and animation timing.
Both clothing choices include all toy, eating, scratching, rolling, bowing,
jumping and shaking poses.

Run `node scripts/pack-outfits.mjs` to rebuild the two v2 clothing sheets from
`winnie-harness-full.png` and `winnie-stripes-full.png`. The packer preserves the
first six poses from each released v1 sheet byte-for-byte and fits the remaining
24 generated silhouettes to the bandanna grid using nearest-neighbor sampling
and an alpha threshold of 220. Generated sources remain untouched. Generation
prompts, references and source sizes are in
[full-outfits-prompt.md](full-outfits-prompt.md); the original striped-shirt
source is documented in [stripes-prompt.md](stripes-prompt.md).

`public/room.js` uses the selected clothing for every action. A missing or
incomplete clothing sheet uses the corresponding bandanna pose. The temporary
pee/poop harness acknowledgment restores the selected shared outfit afterward;
interruptions clear the temporary override, and reduced motion settles directly
into the logged state. Personal clothing reference photographs are not bundled
or published.
