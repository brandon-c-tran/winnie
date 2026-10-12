# Pixel Winnie: new poses

Pixel Winnie lives in the room on Today. Right now he has six frames: sit, blink, sleep, two walk frames, and happy. This is the spec for the next set, made in Astra 6 and cleaned into the room's pixel grid with `scripts/clean-sprite.mjs`.

## What to generate

One sheet per prompt keeps the style consistent. Use `public/photos/winnie-pixel-v2.png` as the reference image in Astra 6 every time.

**Sheet layout:** 4 columns x 2 rows, each cell 128 x 128 px (whole sheet 512 x 256), transparent background, Winnie centered in each cell with his feet on the same baseline about 8 px from the bottom, same size as in the reference.

### Sheet A: everyday

Prompt:

> Pixel art sprite sheet of the same dog as the reference image: a small apricot cavapoo with a fluffy tail, long wavy ears, dark eyes, and a blue and white gingham bandana. Match the reference exactly: same pixel size, same palette, same outline, same proportions, same three-quarter view. Transparent background. 4 columns by 2 rows of 128 by 128 pixel cells, dog centered in each cell, feet on the same baseline. Top row, left to right: eating from a bowl with head lowered (frame 1), eating with head slightly raised and chewing (frame 2), sniffing the floor with nose down, sitting and looking up with ears perked. Bottom row: lying on his back with paws in the air, front-legs-down stretch with tail up, sitting and scratching his ear with a back paw, sitting with a small tan plush dog toy in his mouth. No text, no shadows on the ground, no background.

### Sheet B: reactions

Prompt:

> Pixel art sprite sheet of the same dog as the reference image (apricot cavapoo, blue and white gingham bandana), matching its pixel size, palette, outline, and three-quarter view exactly. Transparent background. 4 columns by 2 rows of 128 by 128 pixel cells, dog centered, feet on one baseline. Top row: tail wag frame 1 (tail left), tail wag frame 2 (tail right), head tilt to the side with one ear up, mid-jump with all four paws off the ground. Bottom row: shaking off water with fur fluffed out, wet after a bath with flattened fur and a small towel on his head, curled asleep holding a small tan plush dog toy, yawning with mouth open. No text, no ground shadows, no background.

## If a frame comes out wrong

- **Different size or view than the reference:** regenerate that sheet. The room breaks if his size jumps between frames.
- **Off by a few pixels on the baseline:** fine. The room aligns each frame's feet automatically.
- **A soft or blurry look:** fine. The cleanup script re-pixelates to the room's grid.

## Cleaning a sheet

```
node scripts/clean-sprite.mjs path/to/sheet-a.png public/photos/winnie-room-a.png 64
```

That halves each 128 px cell into true 64 px pixel art with a 64-color palette, which keeps the bandana blue. Look at the output zoomed in before using it.

## Where the new poses go in the room

| Pose | When it plays |
| --- | --- |
| Eating (2 frames) | A meal is logged |
| Sniffing | Idle, and after pee or poop is logged |
| Looking up | Greeting, when the other person logs something |
| Belly up, stretch, scratch | Idle variety |
| Toy in mouth, asleep with toy | Idle and napping, with his Snuggle Puppy |
| Wag (2 frames) | Pats, and after any log |
| Head tilt | Undo |
| Jump | Plan done, photo added |
| Shake off, wet with towel | A bath is logged |
| Yawn | Before night sleep |

Every pose still follows the room's one rule: he only acts out what was logged or the time of day, and never looks hungry, sad, or impatient.
