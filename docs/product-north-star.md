# Winnie: product north star

Status: proposed redesign direction, September 7, 2026. The current production app is unchanged.

## The north star

**Feel closer to Winnie, and know what to do without being taught.**

The user's explicit priorities are to **maximize delight** and **maximize intuitiveness**, with intuitiveness defined as minimum time to understand how to fully use the app without written instructions.

For Winnie, delight means affection for him, confidence that his people are in sync, and pleasure in seeing his life accumulate. Intuitiveness means visible, familiar actions; understandable results; easy recovery; and a product small enough to learn as a whole. Labels are part of the interface. Tutorials, explanation walls, hidden gestures, and unlabeled symbols are not substitutes for an understandable design.

Success is not more taps, longer sessions, or more logs. A notification that resolves “Has someone recorded dinner?” without opening the app can be a successful product moment.

## A coherent product leap

**Winnie becomes a shared care companion and a living family story.**

One real-world care action creates three kinds of value:

1. **Immediate:** the record is visible, recoverable, and accompanied by a small expressive response from Winnie.
2. **Shared:** the other person receives a push notification and sees the same updated day.
3. **Lasting:** useful care history remains available, while selected moments and optional photos become a story worth revisiting.

These should feel like one loop: **care → both people know → Winnie's day grows**. They should not become three unrelated subsystems that each need to be learned.

## Three connected product bets

### 1. A shared day that keeps both people in sync

Today should answer: “What was last logged, when, and by whom?” It should also make explicitly started activities visible: a walk in progress, an active sleep, or a person who has volunteered to take over.

- Partner push notifications are a **required feature**, not an optional alternative to a digest. Each new saved care action should notify the other person. Do not substitute periodic summaries for this requirement.
- Notification copy describes the record: **“Kim logged a meal · 7:30am.”** Logging a trainer's care must not imply Kim personally performed it.
- Tapping a notification opens the exact entry or active activity. A person should not have to search a timeline to discover what the push referred to.
- Show named people and explicitly recorded state. Do not infer responsibility, hunger, sleep, or wellbeing from silence in the log.
- Add a lightweight handoff, such as **“I'm with Winnie”** or **“Taking over,”** if it proves useful. A formal shift system should not be required for ordinary logging.

The step change is that care creates shared awareness automatically. The second person's benefit no longer depends on remembering to open the app or asking what happened.

### 2. A little world that responds to actual care

Winnie should be the emotional center of the app. Use the family's actual photos as the reference for his illustrated identity, with restrained, nonblocking responses to what people record. His likeness should preserve his shaggy cream/apricot coat, long hanging ears, dark eyes and nose, and longer muzzle and legs. Avoid turning him into a generic round baby puppy. An explicitly active sleep can show a resting scene.

- Keep controls familiar and labeled. Put personality in imagery, transitions, sound/haptics where supported, and completion feedback.
- A response must not delay the next action, hide Undo, or convey an unsupported health judgment.
- No care scores, punishment for missed logs, sad-pet reactions, competitive leaderboards, or streak pressure.
- Offer an expressive and a quiet presentation without changing how the product works.

Treat **Start walk → log pee/poop → Finish walk** as an optional experiment. The user clarified that start/finish outing logging is a new behavior for this household. The prototype currently gives that unvalidated habit too much prominence. Ordinary care logging must remain immediately available without starting a session. A walk mode must earn its extra taps through useful partner awareness or simpler logging; grouping records alone is insufficient justification. Starting and finishing remain explicit, individual records stay editable, and a forgotten finish must not block later care or imply a known duration.

The step change is that using the app feels like participating in Winnie's day. It should provide both practical reassurance and an affectionate response to ordinary care.

### 3. A story that becomes more personal over time

His story should combine inspectable care history with occasional memorable moments. One optional photo, caption, or **Keep this moment** action can make a day meaningful without requiring diary writing.

- Preserve a complete care history, but do not turn every bathroom entry into a sentimental highlight.
- Assemble factual day/week pages from actual records and user-selected moments. Use the person's own caption when available.
- Do not invent milestones, emotions, photos, causes, or memories. A first recorded event is not necessarily a real-world first.
- Surface older moments gently. Do not make a daily photo or journaling streak a new obligation.
- Let a person move from a story to its underlying events, and find exceptions such as medications or accidents.
- Provide **Add a moment** independently of care logging. A photo can stand alone or optionally attach to an existing entry; it never requires starting a walk, creating a duplicate care event, or writing a caption.
- After saving care, an optional **Add photo** action can enrich the entry without interrupting the completed save or delaying the required partner notification. Handle a later photo attachment as an update to that same entry.

The step change is lasting emotional value beyond puppyhood. The app can remain meaningful even if comprehensive care tracking eventually becomes unnecessary.

## Information architecture

Keep two obvious destinations:

- **Today:** Winnie, the latest care facts, quick actions, explicitly active sleep, and recent shared activity. Partner awareness is built into this screen. Show an active walk only if the optional walk experiment is enabled and someone explicitly starts one.
- **His story:** moments plus searchable care history. Dates and event types make the complete record discoverable without a third analytics destination.

Use a small person/settings surface for identity, the shared log, and notification preferences. Joining should use an invitation and a person choice, with technical setup details kept out of the normal product.

Primary interaction vocabulary: **Log pee, Log poop, Log meal, Start sleep, End sleep, Earlier, Edit, Undo, Add a moment, Add photo.** The visible label must describe the action, including whether it starts, finishes, or records something that already happened. **Start walk / Finish walk** belong to the optional experiment, not the required everyday flow.

Advanced fields appear in the context of a relevant event. A meal edit should not begin with all 15 event types and a wall of disabled bathroom tags.

## Partner notification contract

The user specifically requested notification whenever someone logs an event so the other person knows.

- Each committed new care action produces a push to the other person's subscribed devices, never to the actor's own devices by default.
- Sleep start and finish are meaningful care actions; keep their semantics clear rather than relying on a single record's changing shape. Apply the same contract to walk start/finish if that optional feature ships.
- Retried saves and background sync must not generate duplicate pushes. Failed/offline writes remain visibly pending and must not appear as shared successes.
- A late-synced entry includes its original occurrence time. Do not label an old care event as having happened “just now” merely because it arrived now.
- Correction and undo behavior must be specified: update the in-app history and avoid leaving an obsolete notification as the only visible truth. Do not send a stream of duplicate new-event pushes for ordinary edits.
- Notification preferences and OS permission remain under each person's control. Do not silently replace the requested per-event behavior with a daily digest.
- Push is an awareness aid, not the source of truth. Delivery can be delayed or suppressed by the OS, network, or user settings; the shared record remains authoritative.

The current PWA can support Web Push. On iPhone/iPad, WebKit documents support for Home Screen web apps on iOS/iPadOS 16.4+, with permission requested in response to a direct user action. Treat installation and OS permission as a short, explicit setup flow; do not promise silent or automatic permission grants. Sources: [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Apple developer documentation](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).

## Operationalizing the north star

The following are **proposed design targets**, not measured results or external benchmarks:

| What a first-time user should understand/do | Initial target |
|---|---|
| Identify the latest relevant care and who logged it | Within 5 seconds of seeing Today |
| Record an event happening now | One deliberate tap; understood confirmation within 3 seconds |
| Recover from an accidental entry | Find and complete Undo within 5 seconds |
| Record an earlier event | Within 10 seconds, with no facilitator help |
| Understand the complete first-release capability set | Within 2 minutes of uncoached exploration and task completion |
| Understand what the partner notification means | Correctly identify actor, action, occurrence time, and how to open the record |
| Feel good about continued use | After a week, both people prefer the redesign and can name a concrete helpful or enjoyable moment |

“Complete first-release capability set” means checking shared care, logging now/earlier, correcting/undoing, starting/ending the supported activities, finding a record or memory, and understanding partner updates. If the product grows beyond what can reasonably be learned, shrink or clarify the feature set rather than hiding essential behavior.

Test Brandon and Kim separately without explaining the interface. Give situations (“He just peed,” “You tapped the wrong thing,” “You're taking over care”) rather than navigation instructions. Include one unfamiliar person to expose assumptions the existing household has already learned. Time silent task performance; ask for reasoning afterward. Evaluate installation/OS permission separately from the app's ordinary interaction time.

Measure first actions, wrong turns, hesitation, assistance requests, recognition of success, and confidence. For delight, look for specific repeated moments of affection, relief, or easy coordination after real use; a positive reaction to a polished demo is insufficient.

Evaluate the optional walk flow separately over a week: whether each person chooses it voluntarily, whether it resolves coordination questions, whether it adds effort or causes missed entries, and how often a finish is forgotten. Give it prominent placement only if its practical benefit supports the behavior change. A photo saved afterward must remain a complete alternative for preserving a memory.

## Redesign scope and order

1. **Trust foundation:** scope and implement reliable two-phone mutations, offline recovery, stable identities, and push delivery after successful persistence. Preserve existing records and make old clients safe during migration.
2. **Complete experience slice:** pair both people, record a care action, see Winnie's response, receive the partner push, open its shared record, correct it, and see the day/history update consistently.
3. **Living story:** add optional moments/photos and factual day pages using the same care data. Keep the full record easy to inspect.
4. **Validate:** measure unaided learning and repeated delight before expanding routines, prediction, or richer storytelling.

The backend reliability upgrade belongs in this redesign. A playful reaction and a successful-looking push must never hide a lost event or conflicting history. See the [backend reliability plan](backend-reliability-plan.md) for the technical scope.

## Refinement from Winnie's chat history

Winnie is a boy. His full name is **Winnie Bernard**: Bernard was his breeder name, and Winnie was inspired by Winnie the Pooh. The family has described a playful, expressive dog with particular habits, favorite comfort toys, beach outings, and growing independence. User-reported details, rather than generic breed assumptions, should shape the experience.

The research supports three additions to the proposed direction:

1. **A shared learning goal.** The doorbell-before-harness problem recurs over several months. Let both people follow one agreed practice and optionally record whether he asked himself, was prompted, or was taken out by a person. Keep ordinary logging immediate. Goals come from the family or trainer; old chat advice is not imported automatically. Preserve real milestones such as the reported CGC pass at nine months without inventing rankings or credentials.
2. **His current routine and what changed.** The family has discussed office versus home days, an adult-food transition, grooming at home, and temporary recovery care. A small current-plan card should make relevant context visible, distinguish planned from completed care, and retire temporary instructions explicitly. Food/routine changes can be dated beside observed patterns without claiming causation. Old schedules and treatment plans are not automatically current.
3. **A story specific to Winnie.** Favorite toys include his Snuggle Puppy and caterpillar; the family has described beach outings, morning wake-ups, and under-the-couch games. Optional photos and selected moments should preserve those details. Familiar objects and places can enrich the illustration while controls retain ordinary labels. The desired tone is warm, polished, and a little mischievous.

The chats describe Winnie settling more around one year old. Let the app remain useful as care becomes routine: reliable coordination, a reusable guide to what works for him, and a personal history. Lower logging volume is not automatically lower value. Keep precise tracking available without making rest, independent play, or missed logs look like failures.

These additions live within Today and His story. Start with one learning card and personal moments after the reliable shared-care slice. A sitter view can later reuse approved current instructions and favorites. Do not add a separate navigation destination for every new capability.

Keep historical measurements and assertions dated. The chats contain differing breed percentages, and this review does not independently establish his exact birthday, current weight, or current care plan. Private human health or financial history must not flow into the shared app merely because it appeared in a conversation about Winnie.

## Refinement from the family's six photo references

These are real visual references supplied September 7, 2026; that is not their capture date. The photos do not establish an existing outing-logging habit.

- **Photo 1, smiling indoors:** strongest reference for a welcoming portrait and his recognizable face. Keep the main care actions visible without scrolling past a large hero photo.
- **Photo 4, blue Canine Good Citizen ribbon:** a meaningful milestone image, consistent with the previously reported CGC pass. Use the family's confirmed date and wording rather than inferring either from the upload.
- **Photo 6, blue gingham bandana on grass:** a strong warm cover for His story or a keepsake. His actual expression, coat, and familiar accessories can carry much of the delight.
- **Photos 2, 3, and 5:** useful variety for selected memories and full-body illustration references. Let the family supply place, date, and caption; do not turn visual guesses into recorded care facts.

Use photos at different scales for different jobs: a compact familiar face on Today, larger selected memories in His story, and a restrained illustrated likeness for feedback. Avoid rotating large images, decorative motion, or playful language that makes controls harder to understand. A simple optional moment and a partner's reaction are feature hypotheses; neither should create a new required journaling routine.
