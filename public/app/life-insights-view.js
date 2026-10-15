import { lifetimeInsights } from "../life-insights.js?v=4.29";
import { ageAt, ERAS } from "../lifetime.js?v=4.29";
import { facts } from "./services.js?v=4.29";
import { $, esc } from "./format.js?v=4.29";
import { openHistory } from "./nav.js?v=4.29";

let chart = "bathroom",
  horizon = "all",
  rhythm = "pee",
  selected = "";
const label = (m) =>
  new Date(m + "-15T12:00Z").toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
const num = (n) => (n === null ? "—" : Number(n.toFixed(1)).toLocaleString());
const monthButton = (m) =>
  `<button class="text-button" data-insight-month="${m.month}" aria-pressed="${selected === m.month}">${label(m.month)}</button>`;
function plot(months, series, unit) {
  const W = 520,
    H = 190,
    left = 34,
    bottom = 154,
    top = 15,
    step = (W - left - 16) / Math.max(1, months.length - 1);
  const max = Math.max(
      1,
      ...months.flatMap((m) => series.map((s) => s.value(m) || 0)),
    ),
    cap = Math.ceil(max);
  const x = (i) => (months.length === 1 ? (W + left) / 2 : left + i * step),
    y = (n) => bottom - (n / cap) * (bottom - top);
  const ticks = [0, cap / 2, cap];
  return `<p class="plot-unit">${esc(unit)}</p><svg class="life-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unit)} by month. Exact values and source entries below.">
  ${ticks.map((t) => `<line x1="${left}" x2="${W - 10}" y1="${y(t)}" y2="${y(t)}" class="plot-grid"/><text x="${left - 8}" y="${y(t) + 4}" text-anchor="end">${num(t)}</text>`).join("")}
  ${months.map((m, i) => `${i === 0 || m.era !== months[i - 1].era ? `<line x1="${x(i)}" x2="${x(i)}" y1="${top}" y2="${bottom}" class="plot-era"/>` : ""}${i === 0 || i === Math.floor((months.length - 1) / 2) || i === months.length - 1 ? `<text x="${x(i)}" y="178" text-anchor="${i === 0 ? "start" : i === months.length - 1 ? "end" : "middle"}">${label(m.month)}</text>` : ""}`).join("")}
  ${series.map((s) => months.map((m, i) => (s.value(m) === null ? "" : `<circle cx="${x(i)}" cy="${y(s.value(m))}" r="5" fill="${s.count(m) < 5 ? "var(--ground)" : `var(--${s.color})`}" stroke="var(--${s.color})" stroke-width="${s.count(m) < 5 ? 3 : 1}"><title>${label(m.month)}: ${s.name} ${num(s.value(m))} ${unit}</title></circle>`)).join("")).join("")}</svg>`;
}
const table = (months, columns) =>
  `<details class="chart-data"><summary>Values and source entries</summary><div class="chart-table"><table><thead><tr><th>Month</th>${columns.map((c) => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${months.map((m) => `<tr><th>${monthButton(m)}</th>${columns.map((c) => `<td>${esc(String(c[1](m)))}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
export function lifeInsightsHTML() {
  const data = lifetimeInsights(facts());
  let months = data.months;
  if (horizon !== "all") months = months.slice(-Number(horizon));
  const photoMax = Math.max(1, ...months.map((m) => m.photos.length)),
    placeMax = Math.max(1, ...months.map((m) => m.cumulativePlaces));
  const rows = months.flatMap((m) => m.rows),
    photoCount = months.reduce((n, m) => n + m.photos.length, 0);
  if (!months.some((m) => m.month === selected))
    selected = months.at(-1)?.month || "";
  return `<div class="life-insights"><div class="insight-filters"><label>Show<select id="life-chart">${[["bathroom","Bathroom"],["sleep","Sleep"],["memories","Photos & places"]].map(([key,title]) => `<option value="${key}" ${chart === key ? "selected" : ""}>${title}</option>`).join("")}</select></label><label>Period<select id="life-horizon"><option value="all" ${horizon === "all" ? "selected" : ""}>Whole life</option><option value="12" ${horizon === "12" ? "selected" : ""}>Last 12 months</option><option value="6" ${horizon === "6" ? "selected" : ""}>Last 6 months</option></select></label></div><div class="insights-range"><p>${label(months[0].month)} – ${label(months.at(-1).month)}<span>${rows.length.toLocaleString()} saved records</span></p></div>
  ${!rows.length ? '<p class="empty">Add photos or care records to begin. Months without records stay blank.</p>' : ""}
  <section class="insight-section" ${chart !== "bathroom" ? "hidden" : ""}><h2>Bathroom breaks as he grew</h2>
  ${plot(
    months,
    [
      {
        name: "Pee",
        color: "pee",
        count: (m) => m.pee.counts.size,
        value: (m) => m.pee.median,
      },
      {
        name: "Poop",
        color: "poop",
        count: (m) => m.poop.counts.size,
        value: (m) => m.poop.median,
      },
    ],
    "records per logged day",
  )}
  <div class="chart-key"><span><i style="background:var(--pee)"></i>Pee</span><span><i style="background:var(--poop)"></i>Poop</span><span>Hollow dots: fewer than 5 logged days</span><span>Dashed lines: logging era changes</span></div>
  <p class="fine">Median records on days that activity was logged. Separate dots keep missing months and changing logging habits visible.</p>
  ${table(months, [
    ["Pee", (m) => num(m.pee.median)],
    ["Pee days", (m) => m.pee.counts.size],
    ["Poop", (m) => num(m.poop.median)],
    ["Poop days", (m) => m.poop.counts.size],
  ])}</section>
  <section class="insight-section" ${chart !== "bathroom" ? "hidden" : ""}><div class="chart-heading"><h2>When his breaks happen</h2><label><span class="sr-only">Rhythm activity</span><select id="life-rhythm"><option value="pee" ${rhythm === "pee" ? "selected" : ""}>Pee</option><option value="poop" ${rhythm === "poop" ? "selected" : ""}>Poop</option></select></label></div><p class="fine">Share of each month’s timed entries, in recorded local time. Compare each two-hour window using the share key below. Unknown clocks are excluded.</p>
  <div class="heat-key" aria-label="Share of timed records"><span>Share</span>${[0, 0.1, 0.2, 0.4].map((n) => `<span><i style="--heat:${n / 0.4}"></i>${n * 100}%${n === 0.4 ? "+" : ""}</span>`).join("")}</div>
  <div class="heat-axis"><span></span><span>12a</span><span>6a</span><span>12p</span><span>6p</span></div><div class="life-heatmap">${months.map((m) => `<div class="heat-row"><span>${label(m.month)}</span><div role="img" aria-label="${label(m.month)}, ${m[rhythm].timed} timed entries. ${m[rhythm].bins.map((n, i) => `${i * 2}:00: ${n}`).join("; ")}">${m[rhythm].timed ? m[rhythm].bins.map((n) => `<span style="--heat:${Math.min(1, n / m[rhythm].timed / 0.4)}" title="${n} of ${m[rhythm].timed} timed entries (${Math.round((n / m[rhythm].timed) * 100)}%)"></span>`).join("") : `<span class="heat-missing">No timed records</span>`}</div></div>`).join("")}</div></section>
  <section class="insight-section" ${chart !== "bathroom" ? "hidden" : ""}><h2>Learning where to go</h2><p class="fine">Indoor, outdoor and unlabeled bathroom records. Indoor use is not an accident; only explicit accident notes count.</p><div class="chart-key"><span><i style="background:var(--text)"></i>Outdoor</span><span><i style="background:var(--muted)"></i>Indoor</span><span><i style="background:var(--sunk);border:1px solid var(--muted)"></i>Unknown</span></div>
  <div class="training-plot">${months
    .map((m) => {
      const total = m.indoor + m.outdoor + m.unknown;
      return `<div class="training-row"><span>${label(m.month)}</span><div class="training-stack" role="img" aria-label="${m.outdoor} outdoor, ${m.indoor} indoor, ${m.unknown} unlabeled">${total ? `<span style="width:${(m.outdoor / total) * 100}%;background:var(--text)"></span><span style="width:${(m.indoor / total) * 100}%;background:var(--muted)"></span><span style="width:${(m.unknown / total) * 100}%;background:var(--sunk)"></span>` : ""}</div><span class="fine">${total || "—"}</span></div>`;
    })
    .join("")}</div>
  ${table(months, [
    ["Outdoor", (m) => m.outdoor],
    ["Indoor", (m) => m.indoor],
    ["Unlabeled", (m) => m.unknown],
    ["Accidents noted", (m) => m.accidents],
  ])}</section>
  <section class="insight-section" ${chart !== "sleep" ? "hidden" : ""}><h2>Recorded nights</h2><p class="fine">Median length of completed night-sleep records, with naps excluded. This is recorded sleep, not his total sleep; open or invalid intervals stay out. Hollow dots have fewer than 5 completed records.</p>${plot(months, [{ name: "Night", color: "sleep", count: (m) => m.nights.length, value: (m) => m.nightMedian }], "hours")}${table(
    months,
    [
      ["Hours", (m) => num(m.nightMedian)],
      ["Completed records", (m) => m.nights.length],
    ],
  )}</section>
  <section class="insight-section" ${chart !== "memories" ? "hidden" : ""}><h2>His life in photographs</h2><p>${photoCount.toLocaleString()} selected photos in this period.</p><p class="fine">Photos use capture dates. The lower marks show days with care records, making gaps in both histories visible.</p><div class="photo-coverage">${months.map((m) => `<div class="coverage-row"><span>${label(m.month)}</span><div><div class="photo-volume" style="width:${(m.photos.length / photoMax) * 100}%"></div><div class="care-coverage" style="width:${(m.days.size / Math.max(1, m.elapsedDays)) * 100}%"></div></div><span>${m.photos.length}</span></div>`).join("")}</div><div class="chart-key"><span><i style="background:var(--photo)"></i>Photos</span><span><i style="background:var(--muted)"></i>Care-day coverage</span></div>${table(
    months,
    [
      ["Photos", (m) => m.photos.length],
      ["Care days", (m) => `${m.days.size}/${m.elapsedDays}`],
    ],
  )}</section>
  <section class="insight-section" ${chart !== "memories" ? "hidden" : ""}><h2>Places in his world</h2><p class="fine">Distinct destinations accumulated in the available records. Each place enters at its earliest saved day, not necessarily his first visit.</p><div class="place-growth">${months.map((m) => `<div class="coverage-row"><span>${label(m.month)}</span><div><div class="place-volume" style="width:${(m.cumulativePlaces / placeMax) * 100}%"></div></div><span>${m.cumulativePlaces}</span></div>`).join("")}</div>${table(
    months,
    [
      ["Places so far", (m) => m.cumulativePlaces],
      ["Newly recorded", (m) => m.places.map((p) => p.name).join(", ") || "—"],
    ],
  )}</section>
  <section class="insight-section month-inspector"><h2>Explore a month</h2><label>Month<select id="insight-month">${months.map((m) => `<option value="${m.month}" ${selected === m.month ? "selected" : ""}>${label(m.month)}</option>`).join("")}</select></label><div id="insight-month-detail"></div></section>
  <details class="insight-method"><summary>Read the history behind the charts</summary><p>These charts describe saved records. More logging is not necessarily more activity. Recent photo uploads can fill earlier months; unrecorded days remain unknown.</p>${ERAS.map(([d, title, body]) => `<p><strong>${esc(title)}</strong><br><time>${d}</time><br>${esc(body)}</p>`).join("")}</details></div>`;
}
export function bindLifeInsights(render) {
  $("life-chart").onchange = e => { chart=e.target.value; render(); $("life-chart").focus(); };
  const describe = () => {
    const m = lifetimeInsights(facts()).months.find(
      (m) => m.month === selected,
    );
    if (!m) return;
    $("insight-month-detail").innerHTML =
      `<p class="month-age">${m.month === "2025-07" ? "Born July 25" : ageAt(m.month + "-15") + " at mid-month"}</p><dl class="month-facts"><div><dt>Care days recorded</dt><dd>${m.days.size} of ${m.elapsedDays}</dd></div><div><dt>Selected photos</dt><dd>${m.photos.length}</dd></div><div><dt>Accidents explicitly noted</dt><dd>${m.accidents}</dd></div></dl><p class="fine">${esc(m.era)}${m.places.length ? `<br>Newly recorded places: ${esc(m.places.map((p) => p.name).join(", "))}` : ""}</p><button class="secondary" id="insight-records">Read this month’s entries</button>`;
    $("insight-records").onclick = () =>
      openHistory({
        from: m.month + "-01",
        to:
          m.month +
          "-" +
          new Date(
            Number(m.month.slice(0, 4)),
            Number(m.month.slice(5)),
            0,
          ).getDate(),
      });
  };
  $("life-horizon").onchange = (e) => {
    horizon = e.target.value;
    render();
    $("life-horizon").focus();
  };
  $("life-rhythm").onchange = (e) => {
    rhythm = e.target.value;
    render();
    $("life-rhythm").focus();
  };
  $("insight-month").onchange = (e) => {
    selected = e.target.value;
    describe();
  };
  document.querySelectorAll("[data-insight-month]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.insightMonth;
        $("insight-month").value = selected;
        describe();
        $("insight-month").focus();
        $("insight-month").scrollIntoView({
          block: "center",
          behavior: "instant",
        });
      }),
  );
  describe();
}
