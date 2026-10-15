---
name: Winnie
description: Winnie's shared care log, set in a 16-bit bedroom where pixel Winnie acts out what was recorded.
colors:
  ink: "#22264a"
  text: "#1d2146"
  muted: "#555c88"
  ground: "#eef1fb"
  surface: "#ffffff"
  sunk: "#e3e7f6"
  line: "#d3d8ee"
  edge: "#22264a"
  btn: "#ffffff"
  drop: "rgb(34 38 74 / 0.26)"
  pee: "#ffd84a"
  poop: "#eaa56d"
  meal: "#7fe0a6"
  sleep: "#aabcff"
  walk: "#a2e36f"
  photo: "#ff9ec2"
  care: "#d3b8ff"
  groom: "#8fe3e0"
  sick: "#d6eaa0"
  plain: "#ffffff"
  alert: "#e8505b"
  ok: "#3fbf6a"
  amber: "#ffc23d"
  sticky-yellow: "#ffe066"
  sticky-rose: "#ff9ec2"
  pending-paper: "#ffe08a"
  review-paper: "#ffadb2"
  gingham-blue: "rgb(92 122 214 / 0.55)"
  gingham-paper: "#f6f7ff"
  focus-pink: "#ff6fae"
  toast-rim: "#070818"
  tabbar-text: "#c9d1ff"
  dark-text: "#eef0ff"
  dark-muted: "#a9b0dc"
  dark-ground: "#11143a"
  dark-surface: "#1c2150"
  dark-sunk: "#171b46"
  dark-line: "#2d3470"
  dark-edge: "#3d4594"
  dark-btn: "#e2e7ff"
  dark-drop: "rgb(0 0 0 / 0.42)"
  room-wall: "#e9e2d6"
  room-wainscot: "#e0d8c9"
  room-wood: "#a98061"
  room-seam: "#866349"
  room-bed: "#d9aca7"
  room-door: "#eee9df"
  room-sofa: "#c8bcaa"
  room-crate-cover: "#ecd59e"
  room-gingham: "#5c7ad6"
typography:
  display:
    fontFamily: "Pixelify Sans, ui-monospace, SF Mono, monospace"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.1
  headline:
    fontFamily: "Pixelify Sans, ui-monospace, SF Mono, monospace"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "Pixelify Sans, ui-monospace, SF Mono, monospace"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.1
  numeral:
    fontFamily: "Pixelify Sans, ui-monospace, SF Mono, monospace"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.05
    fontFeature: "tnum"
  label:
    fontFamily: "Pixelify Sans, ui-monospace, SF Mono, monospace"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1
  body:
    fontFamily: "Rubik, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.42
  body-small:
    fontFamily: "Rubik, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.3
  input:
    fontFamily: "Rubik, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 400
rounded:
  none: "0px"
spacing:
  gut: "16px"
  gut-narrow: "12px"
  xs: "6px"
  sm: "8px"
  md: "12px"
  tile-gap: "14px"
  card-gap: "18px"
  block-gap: "26px"
components:
  button-pixel:
    backgroundColor: "{colors.btn}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "9px 12px 8px"
    height: "36px"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "9px 12px 8px"
    height: "36px"
  button-primary-dark:
    backgroundColor: "{colors.pee}"
    textColor: "{colors.ink}"
  log-tile-pee:
    backgroundColor: "{colors.pee}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "11px 12px 13px"
    height: "128px"
  log-tile-poop:
    backgroundColor: "{colors.poop}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "11px 12px 13px"
    height: "128px"
  log-chip-meal:
    backgroundColor: "{colors.meal}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "9px 2px 8px"
    height: "64px"
  log-chip-photo:
    backgroundColor: "{colors.photo}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "9px 2px 8px"
    height: "64px"
  log-chip-plain:
    backgroundColor: "{colors.btn}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "9px 2px 8px"
    height: "64px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "12px 13px 13px"
  sticky-note:
    backgroundColor: "{colors.sticky-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "15px 10px 9px"
    height: "92px"
  sticky-note-rose:
    backgroundColor: "{colors.sticky-rose}"
    textColor: "{colors.ink}"
  hud-pill:
    backgroundColor: "rgb(255 255 255 / 0.92)"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "6px 9px 5px"
    height: "28px"
  hud-pill-pending:
    backgroundColor: "{colors.pending-paper}"
  hud-pill-review:
    backgroundColor: "{colors.review-paper}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.none}"
    padding: "6px 4px 6px 12px"
  toast-undo:
    backgroundColor: "{colors.pee}"
    textColor: "{colors.ink}"
    height: "40px"
  sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "8px 16px 24px"
  tabbar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.tabbar-text}"
    padding: "6px 10px 8px"
    height: "52px"
  tab-active-icon:
    backgroundColor: "{colors.gingham-paper}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    typography: "{typography.input}"
    rounded: "{rounded.none}"
    padding: "10px 11px"
    height: "44px"
---

# Design System: Winnie

## Overview

**Creative North Star: "Winnie's Room"**

The app opens onto a 16-bit room inspired by Winnie's familiar belongings: warm cream walls and sofa, medium warm wood floor, a yellow-covered crate and blush pink bed, with apricot Winnie and his blue gingham bandanna. The top of Today is a living pixel diorama in which pixel Winnie acts out only what the shared log has recorded, under the real San Francisco sky. Everything below it keeps the periwinkle-and-navy game UI: big pixel-edged buttons that press down, square HUD pills, cards drawn with a 2px ink line, sticky notes pinned with a square magnet. Nothing is rounded.

Density is phone-first and one-handed. Today starts with the room, one status line, two big log tiles, a row of four chips, then permanent Care rows, inside a 560px column. Colour is loud but disciplined: each care type owns exactly one saturated colour and that colour means that type everywhere it appears (tile, chip, timeline square, strip tick, chart bar, sheet button). UI neutrals are cool periwinkle-tinted paper and navy ink; warm cream, wood and fabric colours belong to the room's physical objects.

Personality lives in the room, the motion, and the family's own words. The interface copy is a label maker. Winnie never speaks; he emotes in pixel bubbles. Rejected and retired: the pastel card-grid pet dashboard with a hero photo and serif headline, and warm taglines ("our good boy", "His story", "A life worth remembering").

**Key Characteristics:**
- One pixel diorama at the top of Today, drawn on an integer art-pixel grid, scaled nearest-neighbour; the wall photograph fills its frame with a centered crop and gentle pixel texture sampled at two pixels per room art pixel.
- One colour per care type, identical everywhere.
- Square corners only; pixel edges drawn with four 3px ink box-shadow sides.
- Pressable things sit on a 7px ledge and press down 3px; flat things (cards, lists) do not.
- Pixelify Sans for short labels and numbers, Rubik for running UI text, both self-hosted.
- Stepped motion (`steps()`) throughout; no eased tweens.
- Light and dark schemes; the care colours and ink do not change between them.

## Colors

A warm cream-and-wood room above a cool periwinkle-and-navy interface, with saturated care colours.

### Primary
- **Bandana Navy Ink** (`ink`): the outline of every pixel button, tile, chip, pill, magnet and icon square; the toast and tab bar fill; the primary button fill in light mode; text on every coloured surface. Also the outline colour inside the room art (`C.ink`, same hex). Ink does not change in dark mode.

### Secondary: care-type colours (one per type, used identically everywhere)
The map lives in `public/icons.js` (`TYPES`), resolved through `typeColor(type)` to `var(--<token>)`.
- **Sun Yellow** (`pee`): pee. Also the app's "selected / yes" fill: dark-mode primary button, selected person radio, selected reaction, selected place, map pin, Undo, the settings avatar, text selection.
- **Caramel** (`poop`): poop; the poop timing chart bars.
- **Mint** (`meal`): meal.
- **Periwinkle** (`sleep`): nap and night sleep.
- **Grass** (`walk`): walk and outing; the running-activity bar.
- **Bubblegum Pink** (`photo`): photo and moment; photo-choice buttons; clustered map pins.
- **Lilac** (`care`): medication, training, appointment, travel, care cover, care-plan icons.
- **Aqua** (`groom`): grooming (bath, nails, brush, teeth, ears, haircut).
- **Lime Wash** (`sick`): vomit and episode.
- **Plain** (`plain`): notes, and any type without its own colour.

### Tertiary: paper and status
- **Sticky Yellow** (`sticky-yellow`) and **Sticky Rose** (`sticky-rose`): the two fridge note papers, and their saved-drawer versions.
- **Pending Paper** (`pending-paper`): the sync pill while changes wait to send, and the notice banner.
- **Review Paper** (`review-paper`): the sync pill when changes need review or the phone is offline.
- **Alarm Red** (`alert`): errors, danger text, the "now" marker on the day strip, the caret colour, the yellow note's magnet; in the room, the bowl, leash and error badge.
- **Signal Green** (`ok`): the sync dot when up to date.
- **Amber** (`amber`): overdue care-plan icons; pending marker text in dark mode.
- **Focus Pink** (`focus-pink`): the 3px focus ring on everything.

### Neutral
- **Periwinkle Ground** (`ground`): page background and input fill.
- **Paper White** (`surface`): cards, lists, the sheet.
- **Sunk Periwinkle** (`sunk`): photo placeholders, pills, comparison wells.
- **Hairline** (`line`): 1px dividers between rows inside a bordered list.
- **Edge** (`edge`): the 2px border on cards and lists (equals ink in light mode, lifts to `dark-edge` in dark).
- **Midnight Text** (`text`) and **Dusk Muted** (`muted`): body and secondary text.
- **Gingham** (`gingham-blue` over `gingham-paper`): Winnie's bandana. Two crossed `repeating-linear-gradient` stripes, 6px on/6px off (4px in the active tab square, 10px at 8% alpha on the desktop page backdrop).

### Room materials
- **Warm Cream** (`room-wall`, `room-wainscot`, `room-door`): walls, quiet panel shading, door and the room's HUD background.
- **Warm Wood** (`room-wood`, `room-seam`): medium warm floor planks, short grain marks and their material joints.
- **Cream Sofa** (`room-sofa`): the low sofa behind Winnie, with a rust throw and sage pillow.
- **Blush Bed** (`room-bed`): the rectangular bolster bed inside the crate.
- **Yellow Cover** (`room-crate-cover`): the crate cover with a stepped cream lattice.
- **Gingham Blue** (`room-gingham`): retained artwork colour, not a requirement to put checks on the furniture. The flat blue CGC ribbon has its own blue and gold material palette.

### Dark scheme
`prefers-color-scheme: dark` swaps only the neutrals: `dark-ground`, `dark-surface`, `dark-sunk`, `dark-line`, `dark-edge`, `dark-text`, `dark-muted`, `dark-btn` (plain buttons become pale periwinkle), `dark-drop`, and `plain` becomes `dark-btn`. The primary button and selected segments switch from ink fill to Sun Yellow fill with ink text. Care colours, sticky papers, ink, the toast, the tab bar and the room art are the same in both schemes; natural room lighting follows the real sky, with a device-local Room lights override for warm interior illumination. Neither follows the colour scheme, and the window keeps the real sky.

### Named Rules
**The One Colour Per Care Type Rule.** A care type has exactly one colour token and it appears wherever that type does. Never give a type a second colour, and never borrow a care colour for decoration unrelated to that type (Sun Yellow as the "selected" fill is the one established exception).

**The Navy Ink Rule.** UI outlines and text on colour use navy ink (`ink`). Room controls retain that ink; physical furniture, wood joints, fabric edges and the ribbon use their own darker material shades.

## Typography

**Display / Label Font:** Pixelify Sans (with ui-monospace, SF Mono, monospace), self-hosted at `/fonts/pixelify-sans-latin.woff2`, weights 400-700.
**Body Font:** Rubik (with system-ui, -apple-system, Segoe UI, sans-serif), self-hosted at `/fonts/rubik-latin.woff2`, weights 300-800.

Both are preloaded in `index.html` with `font-display: swap`, and `font-synthesis: none` is set on the root.

**Character:** Pixelify Sans is the room's voice on the UI: every heading, button, tile name, time and count. Rubik carries anything that reads as a sentence or a name list, so the pixel face never has to set a paragraph.

### Hierarchy
- **Display** (Pixelify 700, 34px, 1.1): view titles on Plans, Story and Insights. The join screen uses the same face at 52px.
- **Headline** (Pixelify 700, 22px): the day heading in the Today log; sheet titles at 24px.
- **Title** (Pixelify 700, 17-20px): card heads (18px), section heads (19px), tile names (20px), status line lead (17px), empty-state heads (17px).
- **Numeral** (Pixelify 700, 30px, 1.05, tabular figures): the last-time on the Pee and Poop tiles (26px under 370px wide). Entry times in the timeline use Pixelify 600 13.5px, tabular.
- **Label** (Pixelify 600, 12.5-14px, line-height 1): buttons, chips, HUD pills, tab labels, form labels, legends.
- **Body** (Rubik 400, 15px, 1.42): running text, row titles at weight 600.
- **Body small** (Rubik 400, 12-13px): meta lines (elapsed, who), fine print, captions.
- **Input** (Rubik 400, 16px): every input, select and textarea (16px avoids iOS zoom).

### Named Rules
**The Short Words Rule.** Pixelify Sans sets words and numbers, never sentences. If it wraps to a second line of prose, it should be Rubik.

**The Sentence Case Rule.** All UI text is sentence case. No all-caps labels.

## Layout

A single phone column, `max-width: 560px`, centred. Above 640px the page behind the column shows a faint gingham backdrop and the column gets 3px ink rails left and right; nothing else changes at desktop width.

The side gutter is `gut` (16px), dropping to `gut-narrow` (12px) under 370px. Vertical rhythm on Today: 12px above the log rows, 14px between the two big tiles and 12px between the four chips, 18px above each card, 26px above the day log. Inside cards, 10px gaps; rows use a three-column grid of icon square, flexible text, trailing action.

**Today's order, top to bottom:** the room's full-bleed HUD ledge (64 CSS px plus the top safe area), followed by its canvas (112 art px tall, about 224 CSS px on a phone) with a physical Room lights rocker beside the door; the status line; pending and active-care notices when present; the two big log tiles (Pee, Poop) in a 2-column grid; the optional post-poop controls; the four-chip row (Meal, Photo, Earlier, More); permanent Care rows; Also today when present; Up next; Notes; On this day when present; and the day log. The room wrapper includes both ledge and canvas height. The tab bar is fixed to the bottom and the shell pads `76px + safe-area` under it. Safe-area insets are respected at the top of the room and the bottom of the tab bar, toast and sheet.

Grids elsewhere: 3-column type and food grids in sheets (14px gap), 2-column notes, 2-column photo grid (3 columns at 520px and up).

## Elevation & Depth

The UI is flat paper with one depth device borrowed from game UI: the **ledge**, a hard, un-blurred drop under things you can press or pick up. Cards, lists and the day strip sit flat with a 2px border and no shadow. The sheet and toast are drawn above the page by a solid ink edge, not a blur. There are no blurred shadows anywhere.

### Shadow Vocabulary
- **Pixel edge** (`0 -3px 0 0 ink, 0 3px 0 0 ink, -3px 0 0 0 ink, 3px 0 0 0 ink`): the four-sided 3px outline that gives buttons, tiles, chips and the running-activity bar their notched pixel corners. A 2px version draws icon squares.
- **Ledge** (`0 7px 0 0 drop`): rest depth under every pressable pixel button. Pressed: `0 4px 0 0 drop` with a `translateY(3px)`.
- **Bevel** (`inset 0 -4px 0 0 rgb(34 38 74 / 0.15), inset 0 3px 0 0 rgb(255 255 255 / 0.5)`): the lit top and shaded bottom inside a pixel button; the bottom bevel shrinks to 2px when pressed.
- **Paper ledge** (`0 3px 0 drop` on sticky notes, `0 4px 0 drop` on photo memory cards): physical paper and prints sit slightly off the surface.
- **Sheet lip** (`0 -3px 0 0 ink`) and **tab bar lip** (`0 -3px 0 #0b0d24`): a single hard line where a surface rises over the page.

### Named Rules
**The Press Is The Depth Rule.** A ledge means "this moves when touched" (or is a paper object). Cards and lists never get one.

## Shapes

Every corner is square (`rounded.none`). Pixel buttons get their notched, stepped corners from four offset box-shadows rather than a border, so the corner pixel is missing exactly as in sprite art. Cards, lists, inputs, pills and sheets use a plain 2px solid border. Dashed 2px borders mark empty or add slots (empty states, Add note). Dotted 2px rules separate a hint inside a tile. Icons are 1-bit bitmaps rendered as SVG with `shape-rendering: crispEdges` in `currentColor`, sized 16, 22 or 30px. The room and the join-screen Winnie use `image-rendering: pixelated`.

## Components

### Pixel buttons
Chunky, physical, satisfying to press.
- **Shape:** square, pixel-edged (3px ink sides), 3px margin so the edge has room, ledge underneath.
- **Plain:** `btn` fill, ink text, Pixelify 600 14px, `9px 12px 8px`, min height 36px. Small: 13px, `7px 10px 6px`, 30px.
- **Primary:** ink fill, white text in light; Sun Yellow fill, ink text in dark.
- **Press:** `translateY(3px)`, ledge 7px to 4px, `60ms steps(2)`. Hover (pointer devices only): `brightness(1.04) saturate(1.05)`. Disabled: 55% opacity.
- **Text button:** Pixelify 600 14px, underlined 2px thick at 4px offset, no box. Used for card-head actions ("All plans", "Saved (0)", "Close").
- **Segmented:** a row of plain pixel buttons; the selected one takes the primary fill.

### Log tiles (Pee, Poop)
The biggest targets on Today.
- Pixel button filled with the care colour, min height 128px, `11px 12px 13px`.
- Top row: 22px icon, name (Pixelify 700 20px), and a "+ Log" tag pushed right (Pixelify 600 12px, white 70% fill, 2px ink border).
- Then the last time as a numeral (30px), or "None yet"; a date instead of a clock when the last one was not today.
- Meta line: elapsed age and who logged it (Rubik 13px, ink at 86%); "not sent" appended while pending. Poop may carry a dotted-rule hint below.
- On log: `pop 420ms steps(6)` and the "+ Log" tag inverts to ink.

### Chips (Today row and More sheet)
- **Log chips:** pixel buttons, min 64px tall, centred icon over a Pixelify 600 13px label, optional Rubik 11px small lines (Meal shows clock, age, who). Coloured by care type; Earlier and More are plain.
- **Sheet type grid:** the same construction at 70px, three across, grouped under small muted Pixelify section labels (Grooming; Walks and sleep; Health and training).
- **Also today chips:** inline pixel buttons in Aqua; pressed state (done today) swaps to Grass with a check icon.
- **Pills and reaction chips:** flat 2px-ink-bordered squares; selected fills Sun Yellow.

### Cards / Containers
- **Corner Style:** square.
- **Background:** `surface`.
- **Border:** 2px `edge`.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** `12px 13px 13px`, 10px internal gap; head row of title plus a text button.
- Lists and the timeline share the card shell with 1px `line` dividers between rows. Care rows may lead with a 26-32px icon square filled with the care colour and a 2px ink outline; signed log records use the inline author treatment documented below.

### Sticky notes (Notes card)
Paper on the fridge.
- Two across, min 92px, Sticky Yellow or Sticky Rose, ink text 14px, clamped to four lines, author and date in 12px below.
- Authored notes use a frameless 28×28px full portrait in the byline below the note, beside separate author and date elements. The byline stays in normal flow with an 8px gap; author/date text wraps without bullet separators. The decorative top magnet is hidden when this portrait is present. Notes without a portrait retain the small decorative top magnet.
- Paper ledge underneath. The add slot is a 2px dashed box with a plus icon.

### Status line
One line under the room that states the room's state in words.
- Idle: "**Awake**" (Pixelify 700 17px) plus "last log 12m ago · Kim" in muted Rubik.
- While a walk or sleep runs: a 30px care-colour icon square, "Out on a walk" / "Napping" / "Asleep for the night", duration and who, and a pixel button that ends it ("Finish walk", "End nap", "End sleep").
- `aria-live="polite"`; the room canvas label mirrors it.

### HUD pills
Square labels on the room's dedicated top ledge, clear of the wall photograph: white at 92%, 2px ink border, Pixelify 600 13px, min 28px tall. Name ("Winnie", 15px 700), SF clock, the sync pill (8px square dot: green up to date, amber on Pending Paper while waiting, red on Review Paper for review or offline), and the person initial on Sun Yellow, which opens Settings. Room lights is a physical rocker beside the door inside the canvas, with a transparent 44×44px target aligned to its position. The target exposes the Room lights accessible name and pressed state and shows a keyboard focus outline; the rocker itself indicates on or off.

### People (Brandon and Kim)
Their own Stardew-style portraits, restored to true pixel art (`scripts/clean-portrait.mjs`). All placements use the existing full-bust `brandon-pixel.png` and `kim-pixel.png` artwork. Today, Care log and Care photos contain the whole portrait in a frameless 24×24px area inline beside the author's name, below the event, result and optional note. Entry details retain a 64×64px portrait area beside the title and logger attribution. Portraits use `object-fit: contain`, a bottom baseline and pixelated rendering; the close-cropped head assets are not used.
- Other placements retain the full artwork: `xs` and `sm` occupy 28×32px, Notes byline portraits occupy 28×28px, `md` occupies 44×52px, and the room's Settings portrait occupies 32×32px, centred inside its 44×44px target. Names remain separate text and portraits are decorative.
- **Dialogue box.** When the other phone logs something, a game dialogue box rises over the bottom of the room: the 48px full portrait, the name in Pixelify 700, "Logged meal 12:40 PM" in Rubik. Cream paper, 3px ink edge, gold inner rim. Tap opens the entry; it leaves on its own after 7 seconds. It replaces the old "Kim logged" toast.
- The weekly postcard puts both faces on the footer line with each person's count for the week.

### Food card (Plans) and Order food (Up next)
- Each food is a row: meal-green icon square, name, "8 meals · eaten Tue", a 8px stock meter (green, amber when the total supply is low), then Reorder (the Amazon link, opens Amazon), "+ Bag" and Edit.
- Card head shows "about 6 days left". Footer: Add food and "Delivery: 3 days".
- Up next gets "Order food · about 4 days left · Beef lowest" with Reorder and Ordered when the supply will not outlast delivery plus two days. Once ordered it reads "Food ordered" with the face and name of who ordered, and Arrived opens a sheet of "+ Bag" buttons.
- The meal sheet orders foods by rotation (eaten longest ago first) and adds "3d ago · 8 left" under each.

### Poop quality
Right after a poop, a bar under the tiles: poop icon, the time, and Firm, Soft and Loose pixel buttons in poop colour. One tap tags the poop and the bar goes. It stays for 30 minutes, then gives up. The entry sheet carries the same three choices. Insights, on the Poop topic, shows "Poop by food": one bar per food (firm in poop brown, soft in amber, loose in sick green), from the first poop within a day after each meal.

### Toast
The receipt after every action.
- Ink bar, white Rubik 14px, the event name in Pixelify 700 15px, a 3px darker rim (`toast-rim`) as a pixel edge.
- Actions are flat white squares in Pixelify 600 13px, min 40px tall ("+ Photo", "+ Note"); Undo is Sun Yellow; a 44px close cross.
- Sits above the tab bar; enters with `toast-in 220ms steps(5)` from below. Never covers the tab bar.

### Bottom sheet (the one dialog)
Every form and detail opens in the same native `<dialog>` as a bottom sheet: full column width, max 90dvh, `surface`, 3px ink lip on top, a 44x5px grab bar and a "Close" text button, backdrop `rgb(10 12 36 / 0.5)`. Opens with `sheet-up 220ms steps(6)`. Title in Pixelify 700 24px.

### Inputs / Fields
- **Style:** `ground` fill, 2px `edge` border, square, Rubik 16px, `10px 11px`, min 44px; textarea min 92px.
- **Labels:** Pixelify 600 14px above the field.
- **Focus:** 3px Focus Pink ring at 0 offset, border goes to ink.
- **Person radios:** hidden native radio over a bordered Pixelify label; checked fills Sun Yellow.
- **Containment:** dialog content and forms use `minmax(0, 1fr)` tracks; labels, forms and controls allow shrinking with `min-width: 0`. Controls occupy their column with `width: 100%` and `max-width: 100%`. Native date and date-time inputs use `appearance: none` (including the WebKit prefix), `min-inline-size: 0` and `max-inline-size: 100%`; WebKit values align left and hide overflow. Preserve native date editing and 16px field text at 320px, 390px and 560px widths.

### Permanent Care and Plans rows
Care uses a two-column divided list inside Today's card. Each row aligns an icon, a flexible text column and a 44px-minimum Done target. Rubik carries the task name and smaller underlined last-entry age; missing history reads “Not logged yet.” Below 370px, the gap narrows and the icon hides so text and actions retain room.

Plans orders Supplies, Winnie’s calendar and Reminders as flat sections. Supplies pair a Rubik name and stock state with right-aligned update and optional reorder actions; food inventory follows within the same section. The Heartgard dose-reminder link is separate from its stock state. The calendar shows connection status and up to three upcoming entries. Its rows align a Pixelify month/day block with a flexible Rubik title, separate date, time and location lines, and the available action or state beneath. Thin dividers keep the agenda flat. Reminder rows use thin bottom dividers and separate due date, cadence and owner placement.

Reminder creation uses a two-column named-task chooser. Known tasks omit the entry-kind selector; custom reminders label it Kind. Stock editing uses a two-column radio grid with a distinct selected border and sunk fill. These extensions reuse the incumbent palette, square edges and type families.

### Navigation (tab bar)
Fixed bottom bar, ink fill, four equal tabs (Today, Plans, Story, Insights), 24px pixel icons over Pixelify 600 12.5px labels in pale periwinkle (`tabbar-text`), min 52px. The current tab's label turns white and its icon sits in a gingham square with a 2px white outline. Story restores its last view when returning from another bottom tab.

### Day strip
A 52px bordered lane per day: care spans and ticks as small care-colour blocks with 2px ink borders, a red "now" post with a square flag, and Pixelify 10px hour labels (12a, 6a, 12p, 6p, 12a).

### Winnie's Room (signature)
A canvas diorama, the centre of the identity. Care behavior follows recorded facts; the sky follows San Francisco time and weather, and Room lights is a separate device-local presentation preference.

**Art grid.** The scene is painted at art resolution, 112 art px tall and `W` art px wide, then blitted with nearest-neighbour scaling. The scale `k` is an integer number of device pixels per art pixel chosen so `W` lands near 220 (between about 180 and 260); on a phone this is about 2 CSS px per art pixel. The layout anchors door, leash hook, lamp, crate and bed to the right edge so the room holds from 184 to about 260 art px wide. Light falloff and the sky use a 4x4 Bayer dither, never smooth gradients. The runtime Winnie sprite sheet is `public/photos/winnie-room-v3.png`; the harness and striped-shirt sheets are `public/photos/winnie-harness-v2.png` and `public/photos/winnie-stripes-v2.png`. All three are 192×640px, with the same 3x10 grid of 64 art px cells.

**Palette.** Room colours live in `C` in `public/room.js`: warm cream walls (`room-wall`) and wainscot (`room-wainscot`), pale rail and baseboard, medium warm wood floor planks (`room-wood` with highlight, shade and `room-seam` joints), cream sofa (`room-sofa`) with rust throw and sage pillow, a yellow crate cover (`room-crate-cover`) with cream lattice, a blush rectangular bolster bed (`room-bed`), and a cream door (`room-door`) with a grey knob. The doormat is muted olive; the bowl and leash remain red. Material shading defines furniture edges, while controls retain navy ink. The sky is keyed to real solar altitude in `SKY` (night navy through dusk rose and sunrise apricot to day blue). With Room lights off, the room is multiplied by `TINT` (cool blue at night, apricot at golden hour, white by day), with dimming for grey weather. Room lights on applies a warm interior tint and restores the unaltered sky in the window. The photograph receives the same interior tint as its surroundings.

**Scene objects and what they mean.**
- **Window:** the real San Francisco sky from solar position (suncalc): sun arc and drifting clouds by day, stars and the actual moon phase at night, a dark skyline with Sutro Tower and lit windows after dusk. Live San Francisco weather from Open-Meteo (cached 20 minutes, optional): overcast greys the sky and hides the sun, fog drifts in over the skyline and Sutro Tower, rain and snow fall in the glass; grey days dim the room and drop the sunbeam. During an active walk a tiny Winnie trots across the skyline. Tapping it toasts the weather, sunrise and sunset.
- **Door, leash and doormat:** the walk. The leash hangs on its hook unless a walk is active. Tapping the door logs a walk, or finishes the active one.
- **Sofa and crate:** a low cream sofa with rust throw and sage pillow sits behind Winnie. The yellow-covered crate has an open front and cream lattice detailing, with the pink bed inside; these belongings are set dressing, not new care controls.
- **Bed:** sleep. The pink rectangular bolster bed holds Winnie only during an active nap or night sleep, breathing one art px, with z particles. Its front rim paints over Winnie only in that in-bed state; when he is awake or walking, the complete bed paints before him. Tapping logs sleep.
- **Bowl:** meal. Fills with kibble when a meal is logged and empties as he eats. Tapping logs a meal.
- **Fridge:** shared notes; shows up to two sticky notes matching the live note count. Tapping opens notes.
- **Calendar:** today's SF date in a 3x5 pixel font; a red corner dot when care is due today; flashes when a plan is done. Tapping opens Plans.
- **Picture frame:** the pinned fridge photo fills the opening with a centered crop, sampled at two pixels per room art pixel and enlarged without smoothing for slight pixelation that retains recognizable detail. The wooden pixel frame begins at art coordinates (94, 13), is 32 art px tall, and varies from 28 to 42 art px wide with the available space before the door; its inner opening has a 2 art px inset. The ribbon sits below. Tapping retains the existing pinned-photo picker.
- **Room lights:** a small physical rocker is drawn beside the door. A transparent 44×44px button tracks its canvas position, with an accessible name, pressed state and visible keyboard focus outline. The rocker changes position and color with the local lighting preference; it does not add an external labeled control below the room.
- **Envelope at the door:** pending changes. Shows a red count when more than one is waiting and a yellow envelope with "!" when changes need review; it lifts away when everything sends.
- **Wall sconce:** switches on after dusk (dithered warm pool of light) unless Winnie is asleep for the night. Room lights on illuminates the full interior and lights the sconce even during recorded sleep, without changing that sleep state.
- **Sunbeam:** a dithered beam from the window across the floor by day, leaning with the time of day; a faint cool beam at night.
- **Plant, toy caterpillar:** set dressing; the toy is an idle sniffing spot.
- **Snuggle Puppy:** his real plush, in the bed. He sleeps with it, carries it when he plays, and tapping it starts a play. Hidden from the bed while he holds it or sleeps.
- **CGC ribbon:** a long flat blue ribbon with gold marks under the picture, drawn at 9x20 art px. Its transparent touch and keyboard target opens the Canine Good Citizen keepsake. The sheet contains the full photograph (`object-fit: contain`, maximum height 52svh), recorded date and age, original note, caregiver recollections and a link to the original entry. The photograph is linked to that shared entry, never copied into a new milestone; absent evidence does not establish a graduation date.
- **Closet:** a wood wardrobe with a small hanger sign and transparent 44×52px touch and keyboard target. Its sheet presents three actual 64px sprite previews in equal columns: blue bandanna, adventure harness and striped shirt. Each choice exposes its selected state and a visible “Wearing now” label; the selection uses Sticky Yellow paper with navy text and border. The gap narrows from 12px to 6px below 360px. Shared clothing is a presentation preference, separate from care state.
- **Rug, arch lamp and plant box:** cream-and-ochre botanical blocks sit below every actor; the black arch lamp has a tiered wooden shade, and a wood box frames the plant above the wardrobe. These are physical room materials, not additional care colours or controls.
- **Trophy shelf:** one trophy per milestone from the last 30 days, up to three; no shelf when there are none. Tapping opens Timeline.
- **Seasons:** a pumpkin by the door in October (its face glows after dark), string lights along the rail from December 1 to January 6, flowers on the plant in spring.

**Poses.** The sheet is `public/photos/winnie-room-v3.png`, packed by `scripts/pack-poses.mjs` from the existing 15 frames and generated scratch, tilt, bow, roll, jump, shake, eating, greeting and toy poses. The harness replaces the bandanna with a cream chest piece, red and yellow straps and green hardware, either as the shared outfit or during the bathroom acknowledgment. The striped shirt is cream and blue with broad cream trim and a red collar. Both clothing sheets cover the same 30-cell pose grid as the bandanna, including fetching, carrying, resting with and returning Snuggle Puppy. `scripts/pack-outfits.mjs` preserves the six released base poses in each v1 sheet and packs the 24 generated extensions with matching silhouettes and baselines; `assets/animation/full-outfits-prompt.md` records their provenance. The original six-pose sources and prompts remain documented in `assets/animation/harness-prompt.md` and `assets/animation/stripes-prompt.md`. Personal clothing reference photographs are not bundled or published. All outfits use the same frame coordinates and timing; an unavailable or incomplete clothing sheet falls back to the corresponding bandanna pose. Idle time mixes wandering, wagging, sniffing, playing with the plush, and an evening yawn; night sleep starts with a yawn.

**State machine.** Recorded inputs are `sleep` (active nap or night sleep), `walk` (active walk), note count, pending count, review error, and due today; SF time and weather supply ambient conditions. The independent `lights` preference is restored from `localStorage` key `winnie:room-lights` and saved as `on` or `off`. It defaults to natural lighting and remains usable without persistence when storage is unavailable; it neither writes a care record nor changes sleep or walk state. With nothing running he is awake in the room. Starting sleep: he walks to the bed and settles ("z"). Ending it: he hops out ("!") and wags. Starting a walk: he walks to the door, the leash comes off, the door opens and he fades out through it; while out he is absent from the room. Ending it: the door opens, he walks back in leaving fading paw prints, hops ("!") and wags.

**Reactions to logs.** Pee or poop: while awake and home, he puts on the harness, walks toward the door, sparkles in a happy pose, walks back to his prior spot, sits, then returns to the shared outfit. This acknowledgment does not delay saving or start a walk record. Interrupted sequences clear the temporary harness override; if its image is unavailable, the normal sprite remains visible. Meal: kibble appears, he walks to the bowl ("nom"), eats head-down with crumbs, hops (heart). Photo: white flash, he looks back ("!"). Plan done: calendar flashes, he walks to it, hops. Partner logged something: he goes to the door to greet it ("!"), then acts out a partner meal at the bowl. Bath: he shakes off (rows jitter, water drops), then sits in his striped towel with darkened fur before a hop. Other grooming: sparkles and a hop. Reaction or pat: hearts. Undo: "?". While he is out on a walk, logs show as sparkles or hearts at the door instead; while asleep, a log gets a "z", a pat gets hearts. Reduced motion skips the harness sequence and settles directly into the logged state.

**Idle.** Every 3-7 seconds he picks one neutral action: wander, wag, turn around, or go sniff the toy ("?"). He blinks occasionally.

**Emotes.** Pixel bubbles drawn in a white box with an ink outline and tail: `z`, `!`, `?`, `~`, `nom`, and a red heart. No words.

**Reduced motion.** Every state change settles instantly into its final pose, sleep breathing and the skyline walker are off, and CSS animations collapse to 0.01ms.

### Motion grammar
All motion is stepped. CSS uses `steps()` timing only: button press `60ms steps(2)`, tile log `pop 420ms steps(6)`, toast `220ms steps(5)`, sheet `220ms steps(6)`, fresh timeline row highlight `900ms steps(6)` from Sun Yellow, running-activity stripes `1.2s steps(8)`, join-screen blink `4s steps(1)`. The room runs a fixed 33ms tick, moves whole art pixels, swaps walk frames every 4 ticks (about 130ms), hops along a 7-frame arc (0, 3, 5, 6, 5, 3, 0 art px), and quantises fades to quarter steps. The room loop pauses when the canvas is off-screen or the page is hidden. Animation never blocks the next tap or hides Undo.

## Do's and Don'ts

### Do:
- **Do** colour every appearance of a care type with its one token from `TYPES` in `public/icons.js` (`typeColor(type)`), in tiles, chips, icon squares, strip ticks and charts.
- **Do** draw pressable controls with the pixel edge, the 7px ledge and the 3px press; draw cards and lists flat with a 2px `edge` border.
- **Do** keep every corner square.
- **Do** set short labels, headings, times and counts in Pixelify Sans and sentences in Rubik; set inputs at 16px.
- **Do** write copy like a label maker: nouns, verbs, times and names in sentence case ("Pee logged · 4:07 PM", "Finish walk", "None yet", "Nothing planned"). Buttons name exactly what they do.
- **Do** let Winnie respond to a log with an action in the room while the toast offers Undo.
- **Do** derive care behavior in the room from recorded facts: an active sleep, an active walk, a logged meal, pending changes, notes on the fridge, a plan due. Keep device-local lighting separate from care state and preserve the real sky.
- **Do** use `steps()` timing and whole-pixel moves for any new motion, and give reduced motion a still, settled pose.
- **Do** retain gingham in Winnie's bandanna, the active tab square and the desktop backdrop; render the room's furniture in its observed cream, pink and yellow materials.
- **Do** use navy ink for UI outlines and text on coloured surfaces; use darker material shades where the room's physical objects need edges.

### Don't:
- **Don't** show Winnie sad, hungry, needy or waiting, or infer any state from gaps in the log. No streaks, scores or guilt.
- **Don't** give Winnie words; he only emotes (`z ! ? ~ nom` and a heart).
- **Don't** add a second colour for a care type or reuse a care colour for an unrelated meaning.
- **Don't** round UI corners or use blurred shadows (pixel art draws its own curves on the grid).
- **Don't** use eased or springy CSS curves; use stepped timing.
- **Don't** use taglines, "our / together / moments / little", exclamation marks, em dashes or rhetorical questions in UI copy. Story is the functional destination label for the combined history and photo views; warm abstractions such as "His story" remain retired.
- **Don't** write copy that explains how the interface works: no hint lines, tutorials, or sentences about what a tap does, where something will show up, or how a date is worked out ("One tap logs it", "Shows up here when it's due", "Tap a group to zoom"). Labels and results speak for themselves. Keep a sentence only when it states a fact the person cannot see and that changes what they do: an error and its fix, when a code expires, that nothing is tracked between logs.
- **Don't** set paragraphs in Pixelify Sans or use all-caps labels.
- **Don't** smooth-scale pixel art or draw it off the art grid; scale by integers with `image-rendering: pixelated`.
- **Don't** replace navy UI outlines with brown or black; room material shading is separate from the UI palette.
- **Don't** lead with a hero photo or a pastel card grid; the room is the top of Today.

## Story, insights and reactions

Do not flatten metadata into strings separated by bullets or middle dots.
Use placement and hierarchy: the row's useful result has its own line,
timestamps have their own alignment, notes are prose, and portraits sit with
author names. Consistency and place have separate sections in detail sheets,
which also use labeled date/time fields. Prefer concise
sentences when a relationship genuinely needs prose. This is a standing user
preference for future interfaces as well as the care log.

Story owns Timeline, Photos, Places and Care log beneath one shared heading.
Timeline is the initial view. Search, type and date filters belong to Care log;
Timeline's More menu opens Milestones & dates with Back to Timeline. The drilldown
uses the same flat sections, Pixelify labels and Rubik reading text for source search,
monthly photos and recorded days, milestones and source notes. Its age label explicitly
describes age at mid-month. Insights is an independent bottom destination with a
Recent, Over time and Compare navigation row. Recent is the initial view, with
Activity and Period filters followed by the answer and chart, then supporting
counts and relevant meal information. Over time shows one chart group at a time:
Bathroom, Sleep or Photos & places, beside the Whole life, Last 12 months or
Last 6 months period selector. The month inspector and source history remain below.
Compare presents two month selectors and an activity selector, with training history
below the comparison. Source entries open Care log; Back to Insights restores the
chosen view, controls and scroll position.
Calendar opens from Plans with Back to Plans and reuses the agenda rows beneath month headings. Upcoming and Past use
pressed-state buttons; the visit-kind selector wraps beside them, with search and
the cancelled/removed checkbox below. Past Will counts and scheduled hours share
a compact wrapping summary. Source status and refresh controls follow the
results; cancelled and removed states use muted text with explicit labels.
The extension keeps the incumbent palette, square controls and type families.
Daily-log entries are grouped by day as compact signed records. The text column contains
the event, one useful result when recorded (such as stool consistency, food or
duration), an optional note limited to two visible lines, then a frameless 24px
square full-bust portrait inline with the author's name. Time aligns at the top
right and reactions at the bottom right in the same row, with a photo-count link
when applicable. Reaction targets remain at least 44×44px. Place, tags and
full notes belong in the entry detail. Last-care counters live in an expandable
summary.

Today uses the same signed records and displays the first attached photo beside
the details, before the right-hand time and reaction column. The contained preview
is 80×88px, reducing to 64×80px at widths of 360px or less. Rows use 12px padding
and gaps, reducing to 10px horizontal padding and 8px gaps at that breakpoint.
A count overlays the preview when there are multiple photos; opening it leads
to the entry details. Care log uses the same compact preview for standalone moments
with photos; care records retain their compact photo-count links.

After a quick poop log saves, an optional Poop photo sheet opens with Take photo,
Choose photo, Consistency and Not now. Consistency updates in place so the photo
choices stay available; a successful photo attachment closes the sheet. Not now
or dismissing the sheet preserves the saved log. The prompt does not replace an
already-open dialog, and pee and earlier logging retain their existing flow.

Entry details pair an uncropped full portrait in a 64px area with the event title
in Pixelify Sans 700 at 24px and logger attribution. Labeled date/time fields,
full notes, recorded facts, consistency, place and photos follow. Logger and
care-provider attribution remain distinct.

Timeline, Photos, Places and Care log share a stable primary navigation row beneath
the Story heading. Flat, equal-width controls use an ink underline and sunk fill
for the selected view. Care log offers Add entry in the header; photo-led views
offer Add photos, changing to Attach photos in Care photos. Timeline's secondary
tools sit in More; the month drilldown has an explicit back action.
All memory photos, Care photos and named collections share one subordinate selector
shown only within Photos; returning to Photos restores the selected collection.
Search and images lead the library. Collections & photo tools is initially collapsed,
keeping scan setup, label review, Then & now suggestions and collection editing quiet.
Switching Story views preserves their filters. All memory photos groups images by
their capture month in a two-column album, including individually selected care
keepsakes. Care photos groups care entries by day, using the same signed
record heading with a large uncropped photo below. The `fullPhoto` entry option
keeps the image across the full row with `object-fit: contain`, automatic height
and a 300px maximum height. Its type filter offers All care photos, Poop photos and Meal
photos.

Adding Winnie photos opens a photo-first composer: choose photos or take a
photo, review each removable preview's date and place summary and expandable
Date & place fields, then enter an optional caption before saving. Each photo
keeps its own capture metadata; missing dates open for review. From Care photos,
adding opens a searchable picker of existing
poop and meal entries so each photo stays attached to its care record. Entry
detail sheets also offer Take photo and Choose photo beside the Photos heading.

Timeline uses a continuous chronological photo stream in the existing Pixelify,
Rubik, ink and paper vocabulary. A wrapping toolbar holds Jump to an age, Latest
and More. More opens Make an album, Make a postcard and Milestones & dates;
it closes on selection, outside click, Escape or navigation. Birthday-based age
headings use square markers beside a fine
vertical chronology line; each dated group pairs its date with the age calculated
from that day. Birth, homecoming, saved milestones and named trips remain in context.
The lead photo spans the stream, followed by subordinate pairs, all contained
without cropping against the sunk ground. Dates, age headings and places use Pixelify;
captions and attributed recollections use Rubik. Each photo opens its source entry.
Age headings are 28px, reducing to 25px at 360px and below; the stream inset reduces
from 24px to 18px, and date/age rows wrap. Photo presses move two whole pixels with
stepped timing and settle without that motion when reduced motion is requested.
Eight dated groups and three photos per day bound the initial display; further
days and photos expand incrementally, with Earlier memories after a jump beyond
the current window. The existing 560px desktop column and light/dark palettes remain.

Make a yearly album is a secondary disclosure below the stream, opened directly
by More → Make an album. It retains the age-chapter album: when distinct photos exist, the first and last
selected photos form a two-column bookend row with age labels. A horizontally
scrollable month strip precedes one active chapter cover, its date and place,
saved caption and separately attributed caregiver words. Covers and bookends
contain the original photograph; this differs from the room's filled wall frame.
Recollections use readable Rubik text with preserved line breaks and a quiet
author line. The picker uses three columns, reducing to two at 360px and below,
with month/search fields and explicit Previous and Next controls. The album title
and year selector wrap on narrow phones. These are surface-specific additions,
not a new type ramp or visual system.

Make a postcard and Saved trips & destinations follow as square, flat disclosures.
The latter contains the Add trip action, recorded-day counts and source-linked collection details. These
lifetime additions extend the incumbent controls and typography; they introduce
no new visual identity or token set. Their behavioral limits are recorded in
PRODUCT.md and `.impeccable/surfaces/public-app-library-js.md`.

Places leads with region controls and a bordered local atlas beneath the Story heading
and the Timeline / Photos / Places / Care log row. Natural Earth geography uses restrained
land and water fills; pink destination markers, square map controls and Pixelify
labels connect it to the incumbent world. Selected destinations and dated replay
appear below the map, followed by a horizontal outing list and a divided directory.
The directory initially shows six destinations per region, with expansion and full
search. Flat rows align the first-saved age and date with a recorded-day count.

Replay pairs the date and age with labeled previous/next icon controls and a strip
of contained photos. Outing covers and selected care photos use the original
images; care keepsakes retain their source attachment. Saved-trip photo-only days
remain visible without invented map pins. Photo capture dates and locations take
priority when present. Suggested outings are labeled; replay draws no travel route.

Selecting a destination retains the Story heading, Add photos and primary navigation and opens
its age, first/latest dates, selected photos, optional named-spot selector and
expandable recorded days with original signed entry rows. Back to places restores
the previous view and scroll position. City map opens an external map, while source
entries retain their saved-pin links. Named places without pins stay separate.
First saved refers to the available records, never a first-ever visit; year-filtered
views say Earliest shown. This extension introduces no new identity or token set.

Over time in Insights uses full-width, divided sections within the selected chart
group, with Pixelify headings and Rubik
chart labels, units, legends and values. Separate monthly dots preserve gaps in
bathroom and recorded-night data; hollow dots mark fewer than five samples, with
dashed logging-era lines explained by the key and source-history disclosure.
The two-hour heatmap uses a neutral ink-to-sunk scale with a numeric share key and
explicit No timed records rows. Setting bars use text, muted and sunk tones for
outdoor, indoor and unknown; they do not borrow care colors. Pee, poop, night sleep
and photos retain their existing care colors, while destination growth stays neutral.
Photo-volume bars pair with thin care-day coverage marks. Values and source entries
open in overflow-safe tables with month buttons leading to a month inspector.
Visible units and responsive SVG label sizing keep axes readable on phones.
These are chart treatments within the incumbent world, not new global tokens.

There is one reaction picker owned by the exact entry button that opens it.
Within a sheet it belongs to that dialog and uses the popover top layer. Escape
closes the picker first; opening another surface dismisses it. Keep 44px minimum
reaction targets and keyboard navigation through the three choices.
