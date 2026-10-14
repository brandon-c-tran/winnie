---
version: 1
slug: "public-app-library-js"
primary_target: "public/app/library.js"
related_targets: ["public/app/life-timeline-view.js","public/life-timeline.js","public/app/memories-view.js","public/app/nav.js","public/index.html","public/styles.css"]
---

# Winnie's life timeline

Mode: Experience. Code-led restructure inside the established pixel world; no new raster assets.

## Direction contract
THESIS: His life unfolds in one continuous chronological scroll. Replace the chapter-at-a-time album as the default; keep photo filters and export tools secondary.
OWN-WORLD: Pixelify age headings and square date markers, Rubik captions, actual uncropped Winnie photos, the existing navy/paper palette and light/dark modes. A fine timeline spine conveys chronology.
STORY: Begin at birth, move through homecoming and photo days, see exact ages, places, saved milestones and named trips in context. Jump to an age or the latest memories; continue scrolling with bounded loading. Add recollections on their source memories.
FIRST VIEWPORT: Story's single row now starts with Life. A compact age-jump/Latest toolbar leads to dated life markers and the first real photos. No chapter tabs, cover picker or yearly comparison blocks interrupt the primary scroll.
FORM: Photo-led chronology with daily photo arrangements, age transitions and source-linked milestone markers. Chosen care photos enter naturally; routine log rows remain in Journal. No invented event, visit or milestone claims. Album/export lives in an explicit secondary tool.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

User rejected the prior chapter album's clunky browsing. Preserve its cover choices and export, shared recollections, capture dates, selected-care semantics and existing source detail actions. Bound initial DOM/photo requests for thousands of uploads; preserve place on paging, source details and sync refresh. Review390px,320px dark,1440px; fresh independent review because the user rejected previous work. Room/harness photos inform next-feature recommendations only in this release.
