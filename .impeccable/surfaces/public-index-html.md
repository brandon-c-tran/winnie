---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/app.js","public/styles.css"]
---

# Winnie app shell and Today

Scope: the whole PWA shell (Today, Plans, History, Photos, Settings sheet), led by Today. Mode: Operate. Phone-first, one-handed, checked outdoors in daylight and in bed at night.

Audience and job: Brandon and Kim check what was recorded and log care in one tap; coordinate plans; revisit photos. Success: the latest care, who logged it, and any active sleep or walk are readable in seconds; logging is one deliberate tap with visible Undo; opening the app makes them smile.

Constraints: every existing capability and record survives (see PRODUCT.md). Winnie's state is shown only from recorded facts: no sad, hungry, or needy poses, nothing inferred from gaps in the log, no streaks or scores. Animation never blocks the next action or hides Undo. Reduced motion gets still poses.

Copy decision (user-delegated, Oct 12 2026): label-maker voice. No copy that explains how the interface works (Brandon, Oct 13 2026). Nouns, verbs, times, names; sentence case; no taglines, no "our / together / moments / story / little", no exclamation marks, no em dashes, no rhetorical questions. Winnie never speaks words; he emotes in pixel bubbles (♥ ! z nom ?). Personality lives in the room, motion, and the family's own words.

## Direction contract

THESIS: Today opens on Winnie's Room, a small living pixel diorama where pixel Winnie acts out only what has been recorded (asleep in his bed during an active sleep, gone through the door during an active walk, trotting to his bowl after a meal is logged) under the real San Francisco sky. Big labeled buttons log care below it. Refuses the pastel card-grid pet dashboard with a hero photo and a serif headline.

OWN-WORLD: A 16-bit game bedroom in Winnie's bandana colors. Blue gingham (his bandana) as the signature pattern; apricot Winnie; navy ink outlines (#22264a family) instead of brown; honey-wood floor; periwinkle wallpaper; one saturated color per care type (pee sun-yellow, poop caramel, meal mint, sleep periwinkle, walk grass, photo pink) used identically everywhere. Pixel-edged stepped-corner buttons that press down 3px. Pixelify Sans for short labels and numbers, Rubik for UI text. True pixel art on one grid: 1 art px = 2 CSS px.

STORY: They glance and know what is happening with him and who did what; they tap once to log and watch him react; the partner's activity arrives as Winnie greeting it; pending or conflicting changes show as a visible envelope plus words.

FIRST VIEWPORT: Full-bleed room (about 224 CSS px tall) with a HUD (name, SF time, sync chip, person avatar for settings). One status line under it stating the room's state in words. Two big log buttons, Pee and Poop, each showing last time, age, and who (sleep and walks are logged unreliably, so they moved to More and the room's bed and door). A row of four: Meal (with time and age), Photo, Earlier, More. While a walk or sleep runs, the status line names it with a Finish or End button. Up next card begins at the fold. Navy bottom tab bar (Today, Plans, History, Photos) with a gingham square behind the active icon.

FORM: Winnie's Room, the model's own grounded candidate built from the family's pixel companion, chosen by the user over the dealt bolder hand; seed key b2c162d2. Signature interaction: log a care action and Winnie performs it in the room while the toast offers Undo, Add photo, Add note. Motion grammar: stepped (steps()) pixel motion, 1 art px moves, 150-200ms sprite frames, springy 3px button press.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Real-life room objects from the family's notes (Snuggle Puppy, caterpillar toy, CGC ribbon) need the family's confirmation before shipping.
- Extra sprite poses (eating, looking up, rolling) need source art; v1 derives motion from the six existing frames.
