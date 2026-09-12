import {
  clockMinute as time,
  durationLabel as duration,
} from "./insights.js?v=3.10";
const date = (day) =>
  new Date(day + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const span = (a, b) => `${date(a)} – ${date(b)}`;
const evidence = (key, label = "See the entries") =>
  `<button class="text-button evidence-link" data-evidence="${key}">${label} <span aria-hidden="true">↗</span></button>`;
const band = (range, formatter) =>
  `${formatter(range.low)}–${formatter(range.high)}`;
const roundTime = (minute) => time(Math.round(minute / 5) * 5);

function distribution(p, topic) {
  const max = Math.max(1, ...p.bins.map((b) => b.ids.length));
  return `<div class="rhythm-chart" role="img" aria-label="${topic === "pee" ? "Pee" : "Poop"} entries by two-hour window, San Francisco time. ${p.bins.map((b) => `${time(b.start)} to ${time(b.start + 120)}: ${b.ids.length}`).join("; ")}">
    ${p.bins.map((b) => `<span class="rhythm-bar ${p.concentrated && b === p.peak ? "peak" : ""}" style="--bar:${(100 * b.ids.length) / max}%"><span></span></span>`).join("")}
  </div><div class="rhythm-axis" aria-hidden="true"><span>12am</span><span>6am</span><span>Noon</span><span>6pm</span><span>12am</span></div>`;
}

function pottyView(d, topic) {
  const p = d.potty[topic],
    old = d.pastPotty[topic],
    a = d.afterMeals;
  const heading = p.concentrated
    ? `His busiest window is ${time(p.peak.start)}–${time(p.peak.start + 120)}.`
    : p.gapEnough
      ? `About ${duration(Math.round(p.gap.median / 5) * 5)} between daytime breaks.`
      : p.enough
        ? `His ${topic} breaks are spread through the day.`
        : `A little more history will help with timing.`;
  const body = p.concentrated
    ? `${p.peak.ids.length} of ${p.count} recorded ${topic} breaks fall in this window. It’s a useful time to keep in mind when planning his day.`
    : p.gapEnough
      ? `That’s the median of ${p.gaps.length} recorded gaps. Breaks are spread through the day, so their spacing tells you more than a particular time.`
      : p.enough
        ? `There isn’t one clear two-hour window in the recent log. His usual spacing may be more useful than the clock.`
        : `There are ${p.count} timed ${topic} entries across ${p.days} days here. A timing pattern needs at least 10 entries across 5 days.`;
  let below = "";
  if (topic === "poop") {
    const useful = a.enough && a.representative;
    below += `${a.enough ? '<section class="rhythm-question">' : '<details class="rhythm-question rhythm-unready"><summary>Does a meal help predict his next poop?</summary>'}<p class="eyebrow">AFTER A MEAL</p>${a.enough ? `<h3>${useful ? `Often ${duration(a.low)}–${duration(a.high)} later.` : "Meal timing is still too patchy to plan around."}</h3>` : ""}
    <p>${
      a.enough
        ? `${a.pairs.length} of ${a.meals} meals were followed by a recorded poop within four hours. Among those pairs, the middle half were ${duration(a.low)}–${duration(a.high)} apart.${!a.representative ? " Most meals have no matching poop in that window, so this is too patchy to plan around." : " This gives you a starting window for his next break."}`
        : `${a.pairs.length} of ${a.meals} meals have a recorded poop within four hours. That is too little evidence for a reliable meal-to-poop window yet.`
    }</p>
    ${a.enough ? `<div class="lag-scale" role="img" aria-label="Middle half of matched intervals: ${duration(a.low)} to ${duration(a.high)}; median ${duration(a.median)}"><span style="left:${(a.low / 240) * 100}%;width:${Math.max(1, ((a.high - a.low) / 240) * 100)}%"></span><i style="left:${(a.median / 240) * 100}%"></i></div><div class="rhythm-axis"><span>Meal</span><span>2h</span><span>4h</span></div>` : ""}
    ${a.pairs.length ? evidence("meals", `See ${a.pairs.length} matched pairs`) : ""}${a.enough ? "</section>" : "</details>"}`;
  }
  if (p.gapEnough) {
    const difference = old.gapEnough
      ? Math.round(p.gap.median - old.gap.median)
      : null;
    below += `<section class="rhythm-question"><p class="eyebrow">BETWEEN DAYTIME BREAKS</p><h3>Usually ${duration(p.gap.low)}–${duration(p.gap.high)} in the log.</h3>
    <p>The middle half of ${p.gaps.length} recorded daytime gaps fall in this range.${difference !== null ? ` The median is ${duration(p.gap.median)}, ${Math.abs(difference) < 15 ? "close to" : `${duration(Math.abs(difference))} ${difference > 0 ? "longer" : "shorter"} than`} the previous ${d.days} days (${duration(old.gap.median)}).` : ""}</p>
    <p class="fine">An unlogged break can make a gap look longer. This isn’t a target for how long he should wait.</p>${evidence("gaps", "See the gaps")}</section>`;
  }
  return `<article class="rhythm-answer"><p class="eyebrow">${topic.toUpperCase()} TIMING</p><h3>${heading}</h3><p>${body}</p>
    ${p.count ? distribution(p, topic) : ""}<div class="rhythm-source"><span>${p.count} entries · ${p.days} days</span>${p.count ? evidence("times", "Explore times") : ""}</div></article>${below}`;
}

function nightView(d) {
  const n = d.night,
    old = d.oldNight;
  if (!n.enough)
    return `<article class="rhythm-answer"><p class="eyebrow">NIGHT ROUTINE</p><h3>Fewer logs don’t mean less sleep.</h3><p>There are completed night entries across ${n.days} ${n.days === 1 ? "night" : "nights"} in this period. Five nights are needed to describe a routine.${d.days < 90 ? " Try 90 days to look further back." : " His older entries are still in the full history."}</p><p class="fine">Crate naps are kept in the history, but aren’t added up as his total sleep.</p>${n.count ? evidence("nights", "See recorded nights") : ""}</article>`;
  const shift = d.pastNight.enough
    ? n.bed.median - d.pastNight.bed.median
    : null;
  return `<article class="rhythm-answer"><p class="eyebrow">${n.days} RECORDED NIGHTS</p><h3>Bed around ${roundTime(n.bed.median)}.<br>Up around ${roundTime(n.wake.median)}.</h3>
    <p>${shift === null ? "This is the middle of his completed night entries in this period." : Math.abs(shift) < 15 ? `His median bedtime is within 15 minutes of the previous ${d.days} days.` : `His median bedtime is ${duration(Math.round(Math.abs(shift) / 5) * 5)} ${shift > 0 ? "later" : "earlier"} than the previous ${d.days} days.`}</p>
    <div class="night-range"><div><span>Usual bedtime window</span><strong>${band(n.bed, roundTime)}</strong></div><div><span>Usual wake-up window</span><strong>${band(n.wake, roundTime)}</strong></div></div>
    <p class="fine">Windows show the middle half of logged start and end times. These are recorded intervals, not measured sleep.</p>
    <div class="rhythm-source"><span>${n.count} entries · ${n.days} nights</span>${evidence("nights", "Explore nights")}</div></article>
    ${old.enough ? `<section class="rhythm-question"><p class="eyebrow">THEN & NOW</p><h3>See how his nights have changed.</h3><div class="night-comparison"><div><span>${span(d.first, d.firstEnd)}</span><strong>${roundTime(old.bed.median)} → ${roundTime(old.wake.median)}</strong><small>${old.count} completed entries</small>${evidence("early-nights", "Earlier nights")}</div><div><span>${span(d.start, d.end)}</span><strong>${roundTime(n.bed.median)} → ${roundTime(n.wake.median)}</strong><small>${n.count} completed entries</small>${evidence("nights", "Recent nights")}</div></div><p class="fine">Median start → end times. This compares the first and latest ${d.days}-day periods in his history.</p></section>` : ""}
    ${d.pastNight.enough ? `<section class="rhythm-question"><p class="eyebrow">LAST PERIOD</p><p>${span(d.previousStart, d.previousEnd)}: bed around ${roundTime(d.pastNight.bed.median)}, up around ${roundTime(d.pastNight.wake.median)}, from ${d.pastNight.count} completed entries.</p>${evidence("past-nights", "Check the comparison")}</section>` : ""}`;
}

export function insightsView(d, topic) {
  return `<div class="rhythm-toolbar"><div class="rhythm-topics" role="group" aria-label="Routine to explore">${[
    ["poop", "Poop"],
    ["pee", "Pee"],
    ["nights", "Nights"],
  ]
    .map(
      ([key, label]) =>
        `<button data-rhythm="${key}" aria-pressed="${topic === key}" class="${topic === key ? "selected" : ""}">${label}</button>`,
    )
    .join(
      "",
    )}</div><label><span class="sr-only">Insight time window</span><select id="pattern-window">${[7, 28, 90].map((n) => `<option value="${n}" ${n === d.days ? "selected" : ""}>${n} days</option>`).join("")}</select></label></div>
    <p class="rhythm-period">${span(d.start, d.end)} · San Francisco time</p>
    <div class="rhythm-content">${topic === "nights" ? nightView(d) : pottyView(d, topic)}</div>
    <details class="rhythm-method"><summary>What goes into these insights</summary><p>${d.total} entries across ${d.activeDays} of ${d.days} days in this period. Missing logs never count as missed care. Future and deleted entries are excluded.</p><p>${topic === "nights" ? `${d.night.omitted} night entries were excluded because they are unfinished, have uncertain times, or have an invalid interval. Naps are excluded. No gaps are filled in.` : "Clock patterns use timed entries. Daytime spacing compares consecutive entries on the same day between 6am and 10pm, excluding gaps under 15 minutes or over 8 hours."}</p>${topic === "poop" ? `<p>Meal pairing uses the first poop after the most recent meal, within four hours, once per meal. Meals from the last four hours wait until their full window has passed (${d.afterMeals.waiting} waiting). An unmatched meal does not mean he didn’t poop.</p>` : ""}</details>
    <div class="rhythm-footer"><span>${d.allCount.toLocaleString()} entries in his history</span><button class="text-button" data-act="all-history">All entries ↗</button></div>`;
}
