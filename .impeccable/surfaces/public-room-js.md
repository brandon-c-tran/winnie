---
version: 1
slug: "public-room-js"
primary_target: "public/room.js"
related_targets: ["public/app/today.js", "public/app/services.js", "public/index.html", "public/styles.css"]
---

# Winnie's real room

Mode: Experience inside the existing Operate Today screen. Care controls remain immediate.

THESIS: Make opening the app feel like coming home to their actual dog and familiar belongings.

OWN-WORLD: Preserve the established integer-pixel diorama, sprite scale, dynamic sky and lighting. Use the user's reference photographs to replace generic gingham furniture with cream walls and sofa, light wood floor, a rust throw, sage pillow, the yellow-covered crate with blush pink rectangular bolster bed, and a long flat blue CGC ribbon with gold marks. This personalizes the existing code-native room; the rest of the app keeps its identity.

STORY: After a current pee/poop log, Winnie briefly wears his cream harness with red/yellow straps and green hardware, walks toward the door and returns to his bandanna. Sleep and walk state, reduced motion, interruptions and offline logging retain their behavior. The acknowledgment never delays saving. No graduation date or new care record is inferred from a reference photograph.

FIRST VIEWPORT: Keep the room HUD, photo frame, functional calendar/fridge, door, embedded light switch and log buttons. The sofa sits behind Winnie; crate and pink bed anchor right. The room photo continues to fill its wooden frame with light pixelation. All controls retain narrow-phone hit targets and keyboard alternatives.

FORM: Extend the existing native canvas objects, generated sprite artwork only for Winnie's new clothing. No concept roll or composition replacement: the user's photographs specify these changes. Inspect 320px, 390px and desktop, awake, sleeping, lights at night, and harness. Reduced motion settles immediately; hidden tabs pause animation.

FINISH: Fresh finish review plus documented room palette and asset provenance required before shipping.

## October 14: graduation keepsake and closet

THESIS: Familiar real belongings become useful, playful ways to revisit his life and dress him.
OWN-WORLD: Extend the same canvas room with the reference home's medium warm wood planks, cream/ochre botanical rug, black arch lamp with tiered wood shade, plant boxes, and a wood wardrobe. Preserve all care controls and the saved photo frame. New striped cream/blue shirt uses generated sprites matching Winnie; source personal photos stay private.
STORY: Ribbon opens a photo-led CGC memory with its original entry and separate caregiver recollections. A shared pointer binds the photo; absent dates are never guessed. Closet offers bandanna, harness and striped shirt. Shared outfit survives reload; temporary bathroom harness returns to the chosen outfit. Clothing never creates a care event.
FIRST VIEWPORT: Room objects retain direct touch and keyboard hit targets; wardrobe has a hanger sign. The photo remains uncropped in the graduation sheet. Outfit picker previews the actual sprites, three choices with explicit selected state.
FORM: Pinned extension of the existing world, no concept replacement. Verify phone 320/390 and desktop, day/night, wardrobe selected state, full photo, empty keepsake, sleep and bathroom outfit transitions. New private-photo hydration follows the authenticated blob pipeline.

## October 14: full outfit animation parity

THESIS: Choosing clothes must never take away Winnie's personality or play.
OWN-WORLD: Preserve the existing room, pixel artwork, character scale and released six base poses. Extend both harness and striped shirt to the original 30-cell animation grid with matching silhouettes and baselines.
STORY: Every outfit fetches, carries, naps with and returns Snuggle Puppy, eats, scratches, rolls, bows, jumps and shakes using the same timing. A missing or incomplete outfit image uses the original pose artwork, never an unrelated sitting pose. Shared clothing selection and temporary bathroom harness behavior remain intact.
FIRST VIEWPORT: The same familiar room and closet; new artwork appears naturally during actions. No new navigation or extra controls.
FORM: Pinned bug fix, no concept roll or replacement composition. Verify all named frame coordinates in both outfits and actual toy sequence on WebKit and Chrome; inspect phone 320/390 and desktop. Reduced motion and interrupted actions retain existing cleanup.
