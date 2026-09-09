# Winnie 3.1

Quick care now opens a photo choice after pee or poop, and a food picker before saving a meal. The initial food choices are Chicken, Duck, Lamb, Beef, Pork, and Sardine. Custom food choices are reused from saved meals; the entry editor supports multiple foods. Existing meals are never assigned a food retroactively.

Today shows attached photos directly. His story has Photos, Insights, and All entries; photo collections live inside Photos. Captions use the saved note or factual event/time information. Insights summarize recorded meals, potty signals, completed nights, confirmed training visits, and photos, with coverage and source-entry links. These are deterministic summaries, not LLM claims or medical conclusions.

The main sleep action follows San Francisco sunrise/sunset, including the pre-dawn hours. Active sleeps keep their original type until ended, and More care allows an explicit override. Solar calculations run offline with [SunCalc 2.0.2](https://github.com/mourner/suncalc), vendored with its BSD license.

Calendar snapshots store planned trainer visits in the private household profile, separately from care events. A visit is logged only after its end and explicit confirmation, using a stable event ID across devices. Imports are validated, previewed, versioned, and cannot delete existing care events. This release has a manual snapshot import, not live Google OAuth/webhook synchronization. Calendar exports remain private and are excluded from the public repository.

Settings check the current browser subscription, notification permission, and the household's saved subscription each time the menu opens. Enable/disable refreshes that state. Removed the optional walk-mode and quiet-presentation switches; ongoing walks remain finishable and historical walks remain available. Shared routine notes are presented as a simple handoff note. Previously saved learning notes remain readable and preserved.

App chrome cannot be accidentally text-selected; text fields, saved notes, and exports remain selectable. Mobile date constraints are retained. The service-worker shell includes the new offline modules and a fresh cache version.

Validation: 30 automated tests cover existing reliability behavior plus seasonal solar boundaries, food persistence/validation, planned-visit separation, notification reconciliation, and summary coverage. Local phone-width walkthroughs cover standard/custom meals, immediate photo choice, inline photos, calendar import/confirmation, and switching among Photos/Insights/All entries. Physical iOS notification delivery and native camera capture still require an actual phone; desktop tests do not establish those outcomes.
