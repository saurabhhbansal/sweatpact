// Builds the personalized Scriptable widget script for the iOS home-screen
// widget. The script mirrors the dashboard's visual language: near-black
// background, glass cards, white streak ring, emerald/red status tones.
//
// The generated code intentionally avoids template literals so this builder
// can stay a plain string concatenation without escaping headaches.

export function buildWidgetScript({
  userId,
  secret,
  baseUrl,
}: {
  userId: string;
  secret: string;
  baseUrl: string;
}): string {
  return `// SweatPact — home screen widget for Scriptable (iOS)
// Shows your week streak, weekly goal progress, this week's day strip,
// and pending money in both directions. Supports small, medium and large.
//
// Setup: paste this into a new Scriptable script named "SweatPact",
// then add a Scriptable widget to your home screen and pick this script.

const USER_ID = ${JSON.stringify(userId)};
const SECRET = ${JSON.stringify(secret)};
const BASE_URL = ${JSON.stringify(baseUrl)};

// ── Design tokens (match the web app) ─────────────────────────────────────
const C = {
  bg: new Color("#0a0a0a"),
  card: new Color("#ffffff", 0.05),
  cardBorder: new Color("#ffffff", 0.12),
  white: new Color("#ffffff"),
  dim55: new Color("#ffffff", 0.55),
  dim45: new Color("#ffffff", 0.45),
  dim35: new Color("#ffffff", 0.35),
  dim20: new Color("#ffffff", 0.2),
  emerald: new Color("#10b981", 0.9),
  emeraldText: new Color("#6ee7b7"),
  emeraldBorder: new Color("#34d399"),
  red: new Color("#ef4444", 0.15),
  redBorder: new Color("#ef4444", 0.7),
  redText: new Color("#fca5a5"),
  black: new Color("#000000"),
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

// ── Data ──────────────────────────────────────────────────────────────────

const fm = FileManager.local();
const cachePath = fm.joinPath(fm.cacheDirectory(), "sweatpact-widget.json");

async function fetchData() {
  const req = new Request(BASE_URL + "/api/widget");
  req.method = "POST";
  req.headers = { "content-type": "application/json" };
  req.body = JSON.stringify({ user_id: USER_ID, secret: SECRET });
  req.timeoutInterval = 15;
  const data = await req.loadJSON();
  if (!data || !data.ok) throw new Error(data && data.error ? data.error : "bad_response");
  fm.writeString(cachePath, JSON.stringify(data));
  return data;
}

function cachedData() {
  try {
    if (fm.fileExists(cachePath)) return JSON.parse(fm.readString(cachePath));
  } catch (e) {}
  return null;
}

// ── Pieces ────────────────────────────────────────────────────────────────

// Approximate a circular arc as a polyline (Scriptable's Path has no arc API).
function arcPath(cx, cy, r, startDeg, endDeg) {
  const path = new Path();
  const steps = Math.max(8, Math.ceil(Math.abs(endDeg - startDeg) / 6));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((startDeg + ((endDeg - startDeg) * i) / steps) * Math.PI) / 180;
    pts.push(new Point(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  path.addLines(pts);
  return path;
}

// Lock screen circular: weekly-progress arc around the streak number.
// Lock screen renders tinted, so everything is white + alpha.
function accessoryRing(streak, frac) {
  const s = 120; // 2x for sharpness
  const ctx = new DrawContext();
  ctx.size = new Size(s, s);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const lw = 8;
  const r = s / 2 - lw;

  // Track: full dim ring.
  ctx.setStrokeColor(new Color("#ffffff", 0.3));
  ctx.setLineWidth(lw);
  ctx.strokeEllipse(new Rect(lw, lw, s - lw * 2, s - lw * 2));

  // Progress arc, from 12 o'clock clockwise.
  if (frac > 0) {
    ctx.setStrokeColor(C.white);
    ctx.setLineWidth(lw);
    ctx.addPath(arcPath(s / 2, s / 2, r, -90, -90 + 360 * Math.min(1, frac)));
    ctx.strokePath();
  }

  ctx.setTextAlignedCenter();
  ctx.setTextColor(C.white);
  ctx.setFont(Font.boldSystemFont(40));
  ctx.drawTextInRect(String(streak), new Rect(0, s / 2 - 30, s, 48));
  ctx.setFont(Font.mediumSystemFont(15));
  ctx.setTextColor(new Color("#ffffff", 0.7));
  ctx.drawTextInRect("wk", new Rect(0, s / 2 + 16, s, 20));
  return ctx.getImage();
}

// White ring with the streak number inside — the dashboard's centerpiece.
// Matches the app: hairline white ring, pure-black disc (subtly lifted off the
// near-black widget background), bold number, dim caption.
function streakRing(streak, sizePt) {
  const s = sizePt * 2; // draw at 2x for sharpness
  const ctx = new DrawContext();
  ctx.size = new Size(s, s);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const lw = Math.max(3, Math.round(s * 0.018));
  ctx.setFillColor(C.black);
  ctx.fillEllipse(new Rect(lw, lw, s - lw * 2, s - lw * 2));
  ctx.setStrokeColor(C.white);
  ctx.setLineWidth(lw);
  ctx.strokeEllipse(new Rect(lw / 2, lw / 2, s - lw, s - lw));
  ctx.setTextAlignedCenter();
  ctx.setTextColor(C.white);
  const numFont = Math.round(s * 0.34);
  ctx.setFont(Font.boldSystemFont(numFont));
  ctx.drawTextInRect(String(streak), new Rect(0, s / 2 - numFont * 0.72, s, numFont * 1.3));
  ctx.setFont(Font.mediumSystemFont(Math.round(s * 0.085)));
  ctx.setTextColor(C.dim55);
  ctx.drawTextInRect("week streak", new Rect(0, s / 2 + numFont * 0.42, s, s * 0.18));
  return ctx.getImage();
}

// Today's status as a compact tinted chip, like the dashboard StatusBadge.
function statusChip(parent, status) {
  const map = {
    verified: { label: "Checked in", text: C.emeraldText, bg: new Color("#10b981", 0.15) },
    unverified: { label: "Unverified", text: C.emeraldText, bg: new Color("#10b981", 0.1) },
    missed: { label: "Missed", text: C.redText, bg: new Color("#ef4444", 0.15) },
    rejected: { label: "Missed", text: C.redText, bg: new Color("#ef4444", 0.15) },
    rest_day: { label: "Rest day", text: C.dim55, bg: new Color("#ffffff", 0.08) },
    sick_day: { label: "Sick day", text: C.dim55, bg: new Color("#ffffff", 0.08) },
    gym_closed: { label: "Rest day", text: C.dim55, bg: new Color("#ffffff", 0.08) },
    period_day: { label: "Period day", text: C.dim55, bg: new Color("#ffffff", 0.08) },
  };
  const tone = map[status] || { label: "Pending", text: C.dim45, bg: new Color("#ffffff", 0.06) };
  const chip = parent.addStack();
  chip.centerAlignContent();
  chip.cornerRadius = 9;
  chip.backgroundColor = tone.bg;
  chip.setPadding(3, 8, 3, 8);
  const t = chip.addText(tone.label);
  t.font = Font.semiboldSystemFont(9);
  t.textColor = tone.text;
  return chip;
}

// Small colored marker dot for the money line.
function moneyDot(parent, color) {
  const dot = parent.addStack();
  dot.size = new Size(5, 5);
  dot.cornerRadius = 2.5;
  dot.backgroundColor = color;
  return dot;
}

// Colors for a day cell, mirroring the dashboard check-in strip.
function dayTone(status) {
  switch (status) {
    case "verified":
      return { bg: C.emerald, border: null, text: C.black };
    case "unverified":
      return { bg: null, border: C.emeraldBorder, text: C.emeraldText };
    case "missed":
    case "rejected":
      return { bg: C.red, border: C.redBorder, text: C.redText };
    case "rest_day":
    case "sick_day":
    case "gym_closed":
    case "period_day":
      return { bg: new Color("#ffffff", 0.06), border: new Color("#ffffff", 0.15), text: C.dim55 };
    case "future":
      return { bg: null, border: new Color("#ffffff", 0.06), text: C.dim20 };
    default: // pending — today, still time
      return { bg: null, border: new Color("#ffffff", 0.1), text: new Color("#ffffff", 0.4) };
  }
}

// One Mon→Sun row of day pills with weekday letters above.
function addWeekStrip(parent, weekDays, cell, gap) {
  const row = parent.addStack();
  row.layoutHorizontally();
  for (let i = 0; i < weekDays.length; i++) {
    const d = weekDays[i];
    const tone = dayTone(d.status);
    const col = row.addStack();
    col.layoutVertically();
    col.size = new Size(cell, 0);

    const letterWrap = col.addStack();
    letterWrap.layoutHorizontally();
    letterWrap.addSpacer();
    const letter = letterWrap.addText(DOW[d.dow]);
    letter.font = Font.mediumSystemFont(Math.round(cell * 0.34));
    letter.textColor = d.is_today ? C.white : C.dim35;
    letterWrap.addSpacer();

    col.addSpacer(3);

    const pill = col.addStack();
    pill.size = new Size(cell, Math.round(cell * 1.12));
    pill.cornerRadius = cell / 2;
    pill.centerAlignContent();
    if (tone.bg) pill.backgroundColor = tone.bg;
    if (d.is_today) {
      pill.borderWidth = 2;
      pill.borderColor = C.white;
    } else if (tone.border) {
      pill.borderWidth = 1;
      pill.borderColor = tone.border;
    }
    const num = pill.addText(String(d.day_of_month));
    num.font = Font.semiboldSystemFont(Math.round(cell * 0.44));
    num.textColor = tone.text;

    if (i < weekDays.length - 1) row.addSpacer(gap);
  }
  return row;
}

// "3/4 · goal met" progress line.
function addProgress(parent, data, sizePt) {
  const line = parent.addStack();
  line.layoutHorizontally();
  line.bottomAlignContent();
  const done = line.addText(String(data.this_week_checkins));
  done.font = Font.boldSystemFont(sizePt);
  done.textColor =
    data.this_week_checkins >= data.current_week_goal ? C.white : new Color("#ffffff", 0.85);
  const goal = line.addText("/" + data.current_week_goal);
  goal.font = Font.semiboldSystemFont(Math.round(sizePt * 0.62));
  goal.textColor = C.dim35;
  line.addSpacer(6);
  const met = data.this_week_checkins >= data.current_week_goal;
  const label = line.addText(met ? "goal met" : "days done");
  label.font = Font.mediumSystemFont(Math.round(sizePt * 0.52));
  label.textColor = met ? C.emeraldText : C.dim35;
  return line;
}

// ₹ with Indian digit grouping (12,34,567).
function formatRupees(cents) {
  const r = Math.round((Number(cents) || 0) / 100);
  const s = String(Math.abs(r));
  const grouped =
    s.length > 3
      ? s.slice(0, -3).replace(/\\B(?=(\\d{2})+(?!\\d))/g, ",") + "," + s.slice(-3)
      : s;
  return (r < 0 ? "-\\u20B9" : "\\u20B9") + grouped;
}

function caps(parent, text) {
  const t = parent.addText(text.toUpperCase());
  t.font = Font.semiboldSystemFont(9);
  t.textColor = C.dim45;
  return t;
}

function prettyDate(dayStr) {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dt.getUTCDay()];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  return wd + ", " + mo + " " + d;
}

// ── Layouts ───────────────────────────────────────────────────────────────

function buildSmall(w, data) {
  w.setPadding(12, 12, 12, 12);
  const body = w.addStack();
  body.layoutVertically();
  body.addSpacer();
  const ringRow = body.addStack();
  ringRow.layoutHorizontally();
  ringRow.addSpacer();
  const img = ringRow.addImage(streakRing(data.week_streak, 86));
  img.imageSize = new Size(86, 86);
  ringRow.addSpacer();
  body.addSpacer(8);
  const progRow = body.addStack();
  progRow.layoutHorizontally();
  progRow.addSpacer();
  addProgress(progRow, data, 18);
  progRow.addSpacer();
  body.addSpacer();
}

function buildMedium(w, data) {
  w.setPadding(14, 16, 14, 16);
  const root = w.addStack();
  root.layoutHorizontally();
  root.centerAlignContent();

  const img = root.addImage(streakRing(data.week_streak, 96));
  img.imageSize = new Size(96, 96);

  root.addSpacer(18);

  const right = root.addStack();
  right.layoutVertically();

  const head = right.addStack();
  head.layoutHorizontally();
  head.centerAlignContent();
  caps(head, "This week");
  head.addSpacer();
  statusChip(head, data.today_status);

  right.addSpacer(2);
  addProgress(right, data, 22);
  right.addSpacer(8);
  addWeekStrip(right, data.week_days, 20, 5);
  right.addSpacer(9);
  addMoneyLine(right, data, 11);
}

// "• You owe ₹120  ·  • Owed ₹80" — colored marker dots keep the two sides
// scannable without shouting; settled state stays quiet like the app.
function addMoneyLine(parent, data, fontSize) {
  const money = parent.addStack();
  money.layoutHorizontally();
  money.centerAlignContent();
  if ((data.owes_cents || 0) === 0 && (data.owed_cents || 0) === 0) {
    const ok = money.addText("All settled up");
    ok.font = Font.mediumSystemFont(fontSize);
    ok.textColor = C.dim55;
    return;
  }
  const owesActive = (data.owes_cents || 0) > 0;
  const owedActive = (data.owed_cents || 0) > 0;
  moneyDot(money, owesActive ? C.redText : C.dim20);
  money.addSpacer(5);
  const owe = money.addText("You owe " + formatRupees(data.owes_cents));
  owe.font = Font.semiboldSystemFont(fontSize);
  owe.textColor = owesActive ? C.redText : C.dim35;
  money.addSpacer(10);
  moneyDot(money, owedActive ? C.emeraldText : C.dim20);
  money.addSpacer(5);
  const owed = money.addText("Owed " + formatRupees(data.owed_cents));
  owed.font = Font.semiboldSystemFont(fontSize);
  owed.textColor = owedActive ? C.emeraldText : C.dim35;
}

function buildLarge(w, data) {
  w.setPadding(18, 18, 18, 18);
  const root = w.addStack();
  root.layoutVertically();

  const head = root.addStack();
  head.layoutHorizontally();
  caps(head, "SweatPact");
  head.addSpacer();
  const date = head.addText(prettyDate(data.today));
  date.font = Font.mediumSystemFont(10);
  date.textColor = C.dim35;

  root.addSpacer(10);

  const mid = root.addStack();
  mid.layoutHorizontally();
  mid.centerAlignContent();
  const img = mid.addImage(streakRing(data.week_streak, 116));
  img.imageSize = new Size(116, 116);
  mid.addSpacer(18);
  const midRight = mid.addStack();
  midRight.layoutVertically();
  caps(midRight, "This week");
  midRight.addSpacer(2);
  addProgress(midRight, data, 26);
  midRight.addSpacer(7);
  const chipRow = midRight.addStack();
  chipRow.layoutHorizontally();
  statusChip(chipRow, data.today_status);
  chipRow.addSpacer();

  root.addSpacer(14);
  addWeekStrip(root, data.week_days, 26, 8);
  root.addSpacer(14);

  // Owe / owed split card — same composed ledger as the dashboard.
  const ledger = root.addStack();
  ledger.layoutHorizontally();
  ledger.cornerRadius = 20;
  ledger.backgroundColor = C.card;
  ledger.borderWidth = 1;
  ledger.borderColor = C.cardBorder;
  ledger.setPadding(12, 14, 12, 14);

  const left = ledger.addStack();
  left.layoutVertically();
  caps(left, "You owe");
  left.addSpacer(3);
  const owes = left.addText(formatRupees(data.owes_cents));
  owes.font = Font.boldSystemFont(18);
  owes.textColor = (data.owes_cents || 0) > 0 ? C.redText : C.white;
  left.addSpacer(2);
  const owesSub = left.addText(
    (data.owes_people || 0) === 0
      ? "all clear"
      : "to " + data.owes_people + (data.owes_people === 1 ? " person" : " people")
  );
  owesSub.font = Font.mediumSystemFont(9);
  owesSub.textColor = C.dim45;

  ledger.addSpacer();

  // Hairline divider between the two halves, like the app's composed ledger.
  const divider = ledger.addStack();
  divider.size = new Size(1, 52);
  divider.backgroundColor = new Color("#ffffff", 0.1);

  ledger.addSpacer();

  const rightCol = ledger.addStack();
  rightCol.layoutVertically();
  caps(rightCol, "Owed to you");
  rightCol.addSpacer(3);
  const owed = rightCol.addText(formatRupees(data.owed_cents));
  owed.font = Font.boldSystemFont(18);
  owed.textColor = (data.owed_cents || 0) > 0 ? C.emeraldText : C.white;
  rightCol.addSpacer(2);
  const owedSub = rightCol.addText(
    (data.owed_people || 0) === 0
      ? "all clear"
      : "from " + data.owed_people + (data.owed_people === 1 ? " person" : " people")
  );
  owedSub.font = Font.mediumSystemFont(9);
  owedSub.textColor = C.dim45;

  root.addSpacer();
}

// ── Lock screen layouts ───────────────────────────────────────────────────

function weekFraction(data) {
  const goal = Math.max(1, data.current_week_goal || 1);
  return Math.min(1, (data.this_week_checkins || 0) / goal);
}

function buildAccessoryCircular(w, data) {
  w.addAccessoryWidgetBackground = true;
  w.setPadding(0, 0, 0, 0);
  const row = w.addStack();
  row.layoutHorizontally();
  row.addSpacer();
  const img = row.addImage(accessoryRing(data.week_streak, weekFraction(data)));
  img.imageSize = new Size(54, 54);
  row.addSpacer();
}

function buildAccessoryRectangular(w, data) {
  w.setPadding(0, 0, 0, 0);
  const root = w.addStack();
  root.layoutVertically();

  const line1 = root.addStack();
  line1.layoutHorizontally();
  line1.bottomAlignContent();
  const streak = line1.addText(String(data.week_streak));
  streak.font = Font.boldSystemFont(16);
  streak.textColor = C.white;
  line1.addSpacer(3);
  const streakLabel = line1.addText("week streak");
  streakLabel.font = Font.mediumSystemFont(11);
  streakLabel.textColor = new Color("#ffffff", 0.7);

  root.addSpacer(1);
  const line2 = root.addText(
    data.this_week_checkins + "/" + data.current_week_goal + " this week"
  );
  line2.font = Font.mediumSystemFont(11);
  line2.textColor = new Color("#ffffff", 0.7);

  root.addSpacer(4);

  // Mini Mon→Sun dots: filled = counted check-in, half = missed, outline = rest.
  const dots = root.addStack();
  dots.layoutHorizontally();
  for (let i = 0; i < data.week_days.length; i++) {
    const d = data.week_days[i];
    const dot = dots.addStack();
    const size = 7;
    dot.size = new Size(size, size);
    dot.cornerRadius = size / 2;
    if (d.status === "verified" || d.status === "unverified") {
      dot.backgroundColor = C.white;
    } else if (d.status === "missed" || d.status === "rejected") {
      dot.backgroundColor = new Color("#ffffff", 0.35);
    } else {
      dot.borderWidth = 1;
      dot.borderColor = new Color("#ffffff", d.is_today ? 0.9 : 0.35);
    }
    if (i < data.week_days.length - 1) dots.addSpacer(4);
  }
  root.addSpacer();
}

function buildAccessoryInline(w, data) {
  const t = w.addText(
    data.week_streak + "wk \\u00B7 " + data.this_week_checkins + "/" + data.current_week_goal + " this week"
  );
  t.font = Font.mediumSystemFont(12);
}

function buildError(w, message) {
  w.setPadding(16, 16, 16, 16);
  const body = w.addStack();
  body.layoutVertically();
  body.addSpacer();
  const title = body.addText("SweatPact");
  title.font = Font.semiboldSystemFont(13);
  title.textColor = C.white;
  body.addSpacer(4);
  const msg = body.addText(message);
  msg.font = Font.mediumSystemFont(11);
  msg.textColor = C.dim55;
  body.addSpacer();
}

// ── Main ──────────────────────────────────────────────────────────────────

const widget = new ListWidget();
widget.backgroundColor = C.bg;
widget.url = BASE_URL + "/dashboard";
widget.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

let data = null;
let fetchError = null;
try {
  data = await fetchData();
} catch (e) {
  fetchError = e;
  data = cachedData();
}

if (!data) {
  buildError(widget, fetchError ? "Couldn't load. Check your connection." : "No data yet.");
} else {
  const family = config.widgetFamily || "medium";
  if (family === "small") buildSmall(widget, data);
  else if (family === "large" || family === "extraLarge") buildLarge(widget, data);
  else if (family === "accessoryCircular") buildAccessoryCircular(widget, data);
  else if (family === "accessoryRectangular") buildAccessoryRectangular(widget, data);
  else if (family === "accessoryInline") buildAccessoryInline(widget, data);
  else buildMedium(widget, data);
}

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
`;
}
