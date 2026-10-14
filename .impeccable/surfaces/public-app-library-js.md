---
version: 1
slug: "public-app-library-js"
primary_target: "public/app/library.js"
related_targets: ["public/app/nav.js","public/index.html","public/styles.css","public/story-album.js","public/app/story-album-view.js","public/app/photo-picker.js","public/app/recollections.js","public/app/photos.js","public/room.js"]
---

# One Story

Mode: Experience for Memories → Highlights. Existing surface extension, code-led; other Story views retain their task-oriented controls.

THESIS: Monthly photos and Brandon's and Kim's own words lead the first-year story. One Story destination keeps Timeline, Photos, Places and Memories together; Insights remains the separate analytical destination.

OWN-WORLD: Preserve Pixelify headings, Rubik body, flat rows, pixel buttons, palette and light/dark tokens. This is an ordinary expansion of the incumbent world, with no comp, reseed or redesign.

STORY: Story → Memories → Highlights opens the first-year album. Birthday-based chapters run from each 25th to the next, beginning July 25, 2025; selected Winnie photos and individually chosen care keepsakes retain their source records. Empty chapters remain honest gaps. The postcard, On this day, trips and collapsed care totals follow the album; By age remains a separate Memories view.

FIRST VIEWPORT: Retain the Story heading, Add photos and the four stable exploration controls. Highlights introduces the album title and year choice, distinct first/last photo bookends when available, a horizontal age-month strip and one active cover. Saved date/place, caption and caregiver words follow the photograph. Initial chapter selection prefers the two-month chapter when it has photos, then the first populated chapter, then the first elapsed chapter.

FORM: Real photographs remain contained in the album and picker. Square month controls, quiet attribution, wrapping actions and preserved prose line breaks inherit the established palette and typography. No new tagline or invented memories.

INTERACTION: Choose cover saves a shared profile choice. Each caregiver edits their own recollection (up to 1,200 characters) without replacing the caption or the other person's words; both are visible in the household. Recollections and covers use existing pending synchronization. The postcard picker searches the full selected library; chapter pickers search the selected chapter. Calendar-month filters and full supplied-collection search precede 24-photo pages. Import selections accept up to 100 files with an explicit over-limit message; larger collections require repeated batches, not simultaneous loading of thousands of images.

EXPORT: Save this album creates a self-contained HTML file for the selected year with up to 12 cover images and saved captions, dates, places, caregiver words and confirmed chapter milestones. Coverless chapters are omitted. The saved file reads offline and prints or saves to PDF; generating it requires each cover photo to be available.

CONTINUITY: Switching Story views retains search and collection choices; returning from Today or Insights restores Story. Calendar stays within Timeline; source-entry and date-range links retain the common shell. Today's room retains its world: a physical rocker beside the door uses a transparent 44px accessible overlay and device-local lighting preference; the wall photo fills its opening with a centered crop, sampled at two pixels per room art pixel for gentle pixelation.

FINISH: Documentation is grounded in public/story-album.js, public/app/story-album-view.js, public/app/photo-picker.js, public/app/recollections.js, public/app/photos.js, public/room.js, public/styles.css and public/index.html, with shared persistence checked in public/sync.js and netlify/lib/core.mjs. Preserve mobile, narrow dark and desktop behavior, source attribution and existing records. No production metrics or performance claims are established by this brief.
