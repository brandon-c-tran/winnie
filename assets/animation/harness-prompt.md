# Winnie’s harness — 14 October 2026

Generated with the built-in OpenAI image generation tool, transparent PNG edit mode.
References: existing `public/photos/winnie-pixel-v2.png` six poses and the user’s
front-facing photograph of Winnie wearing his cream/red/yellow/green harness.
The personal reference photograph is not bundled or published.

Prompt:

> Edit target image 1: the existing six-frame pixel-art Winnie sprite sheet. Image 2 is clothing reference only. Preserve exactly the same six poses, their arrangement (three columns, two rows), apricot cavapoo identity, curly fur, face, proportions, pixel-art style, baseline and transparent background. Replace ONLY the blue gingham bandanna in every pose with Winnie's real harness from image 2: cream padded chest piece, golden-yellow vertical chest strap, red upper straps, a small green loop/hardware. No bandanna under harness. For side walking poses wrap the cream harness naturally behind his shoulder with yellow top strap and red shoulder strap, without changing leg positions. Keep all six dogs separated inside equal square cells, ample transparent margin, no overlaps, no text, no outlines around cells, no props or shadow. This is production sprite art; poses and scale must match target. Transparent PNG.

Source: `assets/animation/winnie-harness.png` (1536 × 1024, RGBA).
Runtime: `public/photos/winnie-harness-v1.png` (192 × 128).
Rebuild: `node scripts/pack-harness.mjs`. The packer preserves six poses and aligns
each silhouette to the corresponding existing 64px room frame with nearest-neighbour sampling.
