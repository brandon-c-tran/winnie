# Pixel Winnie: blink, wander, app icon

Generated with the built-in image-generation tool. Existing photographs and the v1 sprite are preserved.

## Assets

- `public/photos/winnie-pixel-v2.png`: three columns, two rows. Awake / blink / sleeping; walk A / walk B / happy. Actual transparency verified after background extraction.
- `assets/winnie-icon-v2.png`: generated icon master.
- `assets/winnie-sprite-v2.png`: generated sprite master. The delivered sheet is a 384×256 nearest-neighbor export (128×128 per frame) to keep the animation light on phones.
- `public/icons/winnie-v2-{32,180,192,512}.png`: standard-size PNG exports, using nearest-neighbor sampling to keep the pixel edges crisp.

Winnie sits beside the wordmark in the existing masthead. There are no reserved walking rows and no overlay over care controls or photographs. He blinks at varied intervals, does a small five-pixel shuffle, pauses for form focus and dialogs, and curls up during a logged sleep. Reduced-motion and hidden-page states stop automatic movement. None of these interactions creates or changes care records.

The manifest keeps its existing start URL. Versioned icon paths are supplied for browser tabs, home screens, and notifications. The icon's face and ears are inset for the [maskable icon safe zone](https://web.dev/articles/maskable-icon).

## Sprite prompt

Use case: precise-object-edit. Edit the supplied pixel Winnie sprite artwork into a production animation sprite sheet. Keep EXACTLY the same apricot/cream Cavapoo character, curly round head, floppy caramel ears, dark nose, tiny dark eyes, blue-and-white gingham bandana, warm pixel palette and crisp blocky pixel style. The source is the appearance/style reference. Output one transparent PNG at 1536x1024, exactly a grid of THREE columns by TWO rows, six 512x512 cells, no gutters. All characters centered within each cell, fully contained with 12% transparent margins and aligned foot baseline at 86% cell height. Row 1 from left: (1) sitting awake with open eyes, relaxed mouth, matching source left dog; (2) identical sitting pose and body outline as frame 1, ONLY eyes shut for a blink, no tongue, everything else unchanged; (3) curled up asleep with eyes shut, matching source sleeping dog. Row 2 from left: (4) side view facing RIGHT, walking with front right paw forward and opposite back paw forward; (5) exactly same side view body/head position facing RIGHT, opposite paw stride to make a two-frame walking cycle; (6) sitting happily with eyes smiling and a tiny tongue, matching source happy dog. Walking frames must be same size as sitting character, consistent limb anatomy and silhouette. No drawn checkerboard, no background, no props, no floor, no shadows, no text, no labels, no cell outlines. Genuine transparent alpha outside the dogs. This is a small animated companion to existing real photos; retain the source dog's likeness and do not redesign him.

## Transparency correction

Use case: background-extraction. Edit this exact 1536x1024 six-frame sprite sheet. Remove ALL gray/white checkerboard background pixels and replace them with genuine zero-alpha transparency. The checkerboard is currently baked into the input and must be completely removed. Preserve all six existing Winnie dog sprites, their exact position, exact scale, exact pixels, colors and composition; do not redraw or move any part of the dogs. Keep the output canvas exactly 1536x1024. Do not draw a replacement checkerboard or black or white background. Return a transparent RGBA PNG, fully transparent everywhere except the six dog characters. Ensure no gray checkerboard remains in gaps between paws, under tails, or around curly ears.

## Icon prompt

Use case: precise-object-edit. Create a square app icon featuring the same pixel Winnie in the supplied reference. Preserve this specific male apricot Cavapoo's recognizable pixel-art design: rounded cream curls, long caramel floppy ears, friendly dark eyes, black button nose and blue-and-white gingham bandana. Use a close portrait of his HEAD and upper chest, facing forward, relaxed smiling mouth, no tongue. The dog is the only subject, centered; do not include the other poses. Crisp chunky pixel art, warm limited palette, no smooth vector shapes. Canvas 1024x1024 with a completely opaque flat warm ivory background #f7f5ee, full bleed to all four square corners. Keep ALL ears, curls, face and bandana within the central safe circle whose radius is 38% of the canvas width, leaving generous ivory space for phone icon masking. No rounded-square boundary drawn in the image, no circle outline, no frame, no shadows, no words or letters, no extra symbols. This is the recognizable face of the existing sprite as an app icon, not a redesign of the character.
