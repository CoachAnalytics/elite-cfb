
const $ = id => document.getElementById(id);
const BAR = filterBar(() => render());
const IMAGES = new Map();
let PLAYS = null, POINTS = [], LAST = null;

// ---------------------------------------------------------------- presets
// Pairings worth starting from: each one is a question the chart answers.
const PRESETS = [
  { id: 'sticks', label: 'Early downs vs 3rd down distance',
    title: 'Converting on Early Downs and 3rd Down Manageability',
    x: { metric: 'stick', sit: 'early' }, y: { metric: 'dist', sit: 'third', invert: true } },
  { id: 'quality', label: 'Offense vs defense (EPA)', title: 'Who Is Good, and at Which End',
    x: { metric: 'epa' }, y: { metric: 'epa', side: 'defense', invert: true } },
  { id: 'boom', label: 'Consistency vs explosiveness', title: 'Grinders and Big-Play Offenses',
    x: { metric: 'success' }, y: { metric: 'explosive' } },
  { id: 'tendency', label: 'Early-down run rate vs early-down EPA',
    title: 'Does the Early-Down Plan Pay?',
    x: { metric: 'run_rate', sit: 'early' }, y: { metric: 'epa', sit: 'early' } },
  { id: 'protection', label: 'Sack rate vs dropback EPA', title: 'Protection and Production',
    x: { metric: 'sack', invert: true }, y: { metric: 'db_epa' } },
  { id: 'trenches', label: 'Stuff rate vs rush success', title: 'Winning the Line of Scrimmage',
    x: { metric: 'stuff', invert: true }, y: { metric: 'rush_success' } },
  { id: 'finishing', label: 'Reaching the red zone vs finishing it',
    title: 'Getting There and Finishing',
    x: { metric: 'drive_rz' }, y: { metric: 'drive_rz_td' } },
  { id: 'drives', label: 'Three-and-outs vs touchdown drives', title: 'Drive Health',
    x: { metric: 'drive_three_out', invert: true }, y: { metric: 'drive_td' } },
  { id: 'clutch', label: 'EPA with a lead vs trailing', title: 'Built to Play From Behind?',
    x: { metric: 'epa', when: 'lead' }, y: { metric: 'epa', when: 'behind' } },
  { id: 'luck', label: 'Turnover rate vs EPA', title: 'Process and Turnovers',
    x: { metric: 'turnover', invert: true }, y: { metric: 'epa' } },
  { id: 'defense_third', label: 'Defense on third down', title: 'Getting Off the Field',
    x: { metric: 'stick', sit: 'third', side: 'defense', invert: true },
    y: { metric: 'dist', sit: 'third', side: 'defense' } },
];

// ------------------------------------------------------------------ setup
function fillMenus() {
  const groups = METRIC_GROUPS.map(g =>
    `<optgroup label="${g}">` + METRICS.filter(m => m.group === g)
      .map(m => `<option value="${m.id}">${m.label}</option>`).join('') + '</optgroup>').join('');
  const wheres = SITUATIONS.filter(s => !s.when)
    .map(s => `<option value="${s.id}">${s.label}</option>`).join('');
  const whens = '<option value="">Any time</option>' + SITUATIONS.filter(s => s.when)
    .map(s => `<option value="${s.id}">${s.label}</option>`).join('');
  for (const axis of ['x', 'y']) {
    $(axis + '-metric').innerHTML = groups;
    $(axis + '-sit').innerHTML = wheres;
    $(axis + '-when').innerHTML = whens;
  }
  $('preset').innerHTML = '<option value="">Start from a preset…</option>' +
    PRESETS.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
}

/** What one axis is asking for, read off its controls. */
function axisSpec(axis) {
  const metric = METRIC[$(axis + '-metric').value] || METRICS[0];
  const side = $(axis + '-side').value;
  const sit = SITUATION[$(axis + '-sit').value];
  const when = SITUATION[$(axis + '-when').value];
  const where = { ...(sit ? sit.where : {}), ...(when ? when.where : {}), snaps: $('snaps').value };
  const parts = [side === 'defense' ? 'Defense' : 'Offense', metric.label];
  const context = [sit && sit.id !== 'all' ? sit.label : '', when ? when.label : '']
    .filter(Boolean).join(', ');
  return {
    metric, side, where, context,
    invert: $(axis + '-invert').checked,
    label: parts.join(' · ') + (context ? ` (${context.toLowerCase()})` : ''),
    high: goodIsHigh(metric, side),
  };
}

function applySpec(axis, spec) {
  $(axis + '-metric').value = spec.metric;
  $(axis + '-side').value = spec.side || 'offense';
  $(axis + '-sit').value = spec.sit || 'all';
  $(axis + '-when').value = spec.when || '';
  $(axis + '-invert').checked = Boolean(spec.invert);
}

function usePreset(id) {
  const preset = PRESETS.find(p => p.id === id);
  if (!preset) return;
  applySpec('x', preset.x);
  applySpec('y', preset.y);
  $('title').value = preset.title;
  render();
}

// ------------------------------------------------------------------ data
function pointsFor() {
  const x = axisSpec('x'), y = axisSpec('y');
  const { ok } = BAR.filter(null);
  const minPlays = Number($('min').value) || null;
  const xs = metricColumn(scan(PLAYS, ok, x.side, x.where, [x.metric.id]), x.metric, minPlays);
  const ys = metricColumn(scan(PLAYS, ok, y.side, y.where, [y.metric.id]), y.metric, minPlays);
  const points = [];
  for (const [team, xv] of xs.values) {
    if (!ys.values.has(team)) continue;
    const info = BAR.games.teams[team];
    if (!info) continue;
    points.push({ team, name: info[0], conference: info[1], x: xv, y: ys.values.get(team),
                  n: Math.min(xs.counts.get(team), ys.counts.get(team)) });
  }
  return { x, y, points };
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// --------------------------------------------------------------- drawing
function theme() {
  const css = getComputedStyle(document.documentElement);
  const pick = name => css.getPropertyValue(name).trim();
  return { bg: pick('--bg'), text: pick('--text'), dim: pick('--dim'), line: pick('--line'),
           accent: pick('--accent') };
}

function ticks(lo, hi) {
  const span = hi - lo || 1;
  const raw = span / 5;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * power).find(s => s >= raw) || power * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step / 1000; v += step) out.push(v);
  return out;
}

/** The whole chart, at any size: the page and the download share this. */
function drawChart(ctx, W, H, S, data) {
  const { x, y, points } = data;
  const c = theme();
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);
  if (!points.length) {
    ctx.fillStyle = c.dim;
    ctx.font = `${16 * S}px Barlow, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('No teams have enough plays in that situation yet.', W / 2, H / 2);
    return [];
  }

  const pad = { l: 92 * S, r: 34 * S, t: 92 * S, b: 82 * S };
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  const spread = (values, invert) => {
    const lo = Math.min(...values), hi = Math.max(...values);
    const room = (hi - lo || Math.abs(hi) || 1) * 0.09;
    return { lo: lo - room, hi: hi + room, invert };
  };
  const xr = spread(points.map(p => p.x), x.invert);
  const yr = spread(points.map(p => p.y), y.invert);
  const px = v => pad.l + (xr.invert ? (xr.hi - v) : (v - xr.lo)) / (xr.hi - xr.lo) * plotW;
  const py = v => pad.t + (yr.invert ? (v - yr.lo) : (yr.hi - v)) / (yr.hi - yr.lo) * plotH;

  // grid and ticks
  ctx.strokeStyle = c.line;
  ctx.fillStyle = c.dim;
  ctx.lineWidth = 1 * S;
  ctx.font = `${12 * S}px Barlow, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of ticks(xr.lo, xr.hi)) {
    const at = px(t);
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(at, pad.t); ctx.lineTo(at, pad.t + plotH); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(fmtMetric(x.metric, t), at, pad.t + plotH + 12 * S);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const t of ticks(yr.lo, yr.hi)) {
    const at = py(t);
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(pad.l, at); ctx.lineTo(pad.l + plotW, at); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(fmtMetric(y.metric, t), pad.l - 12 * S, at);
  }

  // the medians, so every quadrant means something
  const mx = median(points.map(p => p.x)), my = median(points.map(p => p.y));
  ctx.save();
  ctx.setLineDash([7 * S, 6 * S]);
  ctx.strokeStyle = '#9c3b3b';
  ctx.lineWidth = 1.5 * S;
  ctx.beginPath(); ctx.moveTo(px(mx), pad.t); ctx.lineTo(px(mx), pad.t + plotH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad.l, py(my)); ctx.lineTo(pad.l + plotW, py(my)); ctx.stroke();
  ctx.restore();

  // titles
  ctx.fillStyle = c.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${22 * S}px Montserrat, sans-serif`;
  ctx.fillText(data.title, W / 2, 36 * S);
  ctx.fillStyle = c.dim;
  ctx.font = `${13 * S}px Barlow, sans-serif`;
  ctx.fillText(data.subtitle, W / 2, 60 * S);

  ctx.fillStyle = c.text;
  ctx.font = `600 ${13 * S}px Montserrat, sans-serif`;
  ctx.fillText(x.label + (x.invert ? '  ← better' : ''), pad.l + plotW / 2, H - 22 * S);
  ctx.save();
  ctx.translate(24 * S, pad.t + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(y.label + (y.invert ? '  ↓ better' : ''), 0, 0);
  ctx.restore();

  // the logos
  const size = 42 * S;
  const placed = [];
  for (const p of points) {
    const cx = px(p.x), cy = py(p.y);
    const img = IMAGES.get(p.team);
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    } else {
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(cx, cy, 6 * S, 0, Math.PI * 2); ctx.fill();
    }
    placed.push({ ...p, cx: cx / S, cy: cy / S });
  }

  ctx.fillStyle = c.dim;
  ctx.font = `${11 * S}px Barlow, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('CoachAnalytics', W - pad.r, H - 6 * S);
  return placed;
}

function subtitle() {
  const weeks = document.querySelector('#weeks .multi-btn').textContent.replace(' ▾', '');
  const opp = $('opp').options[$('opp').selectedIndex].text;
  const snaps = $('snaps').value === 'competitive' ? 'competitive snaps'
              : $('snaps').value === 'garbage' ? 'garbage time' : 'all snaps';
  return [$('season').value, weeks, $('opp').value ? opp : '', snaps].filter(Boolean).join(' · ');
}

function render() {
  if (!PLAYS) return;
  const data = pointsFor();
  data.title = $('title').value.trim() || `${data.y.label} vs ${data.x.label}`;
  data.subtitle = subtitle();
  LAST = data;
  const canvas = $('chart');
  const width = Math.max(canvas.parentElement.clientWidth, 360);
  const height = Math.round(width * 0.62);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.height = height + 'px';
  POINTS = drawChart(canvas.getContext('2d'), canvas.width, canvas.height, dpr, data);
  $('count').textContent = `${data.points.length} teams plotted`;
  fillTable(data);
  save();
}

function fillTable(data) {
  const rows = [...data.points].sort((a, b) => b.x - a.x);
  $('values').innerHTML = `<thead><tr><th class="name">Team</th><th>${data.x.metric.label}</th>
    <th>${data.y.metric.label}</th><th>Plays</th></tr></thead><tbody>` +
    rows.map(p => `<tr><th class="name">${logo(logoSrc(p.team), 18)} ${p.name}</th>
      <td>${fmtMetric(data.x.metric, p.x)}</td><td>${fmtMetric(data.y.metric, p.y)}</td>
      <td>${p.n}</td></tr>`).join('') + '</tbody>';
}

// -------------------------------------------------------------- download
async function download() {
  if (!LAST) return;
  $('png').disabled = true;
  try {
    await document.fonts.ready;
    const W = 2000, H = 1240;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    drawChart(canvas.getContext('2d'), W, H, 2, LAST);
    const blob = await new Promise(done => canvas.toBlob(done, 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `coachanalytics-${LAST.x.metric.id}-${LAST.y.metric.id}-${$('season').value}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } finally {
    $('png').disabled = false;
  }
}

// ------------------------------------------------------------- the page
function hover(e) {
  const rect = $('chart').getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let best = null, bestDist = 26 * 26;
  for (const p of POINTS) {
    const d = (p.cx - mx) ** 2 + (p.cy - my) ** 2;
    if (d < bestDist) { best = p; bestDist = d; }
  }
  const tip = $('tip');
  if (!best || !LAST) { tip.hidden = true; return; }
  tip.hidden = false;
  tip.style.left = Math.min(best.cx + 14, rect.width - 190) + 'px';
  tip.style.top = Math.max(best.cy - 46, 4) + 'px';
  tip.innerHTML = `<b>${best.name}</b><br>${LAST.x.metric.label}: ${fmtMetric(LAST.x.metric, best.x)}
    <br>${LAST.y.metric.label}: ${fmtMetric(LAST.y.metric, best.y)}`;
}

function save() {
  try {
    localStorage.setItem('ca-chart', JSON.stringify({
      season: $('season').value, title: $('title').value, min: $('min').value, snaps: $('snaps').value,
      x: read('x'), y: read('y'),
    }));
  } catch (e) {}
}

const read = axis => ({ metric: $(axis + '-metric').value, side: $(axis + '-side').value,
                        sit: $(axis + '-sit').value, when: $(axis + '-when').value,
                        invert: $(axis + '-invert').checked });

function restore() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('ca-chart') || 'null'); } catch (e) {}
  if (!saved) { usePreset('sticks'); return false; }
  if ([...$('season').options].some(o => o.value === saved.season)) $('season').value = saved.season;
  $('title').value = saved.title || '';
  if (saved.min) $('min').value = saved.min;
  if (saved.snaps !== undefined) $('snaps').value = saved.snaps;
  applySpec('x', saved.x || {});
  applySpec('y', saved.y || {});
  return true;
}

async function load() {
  const season = $('season').value;
  $('count').textContent = 'Loading…';
  let plays, games;
  try {
    [plays, games] = await Promise.all([
      memberData(`situational/${season}.json`),
      fetch(`../data/stats/games/${season}.json`).then(r => r.json())]);
  } catch (err) {
    $('count').textContent = 'That season did not finish downloading. Reload the page to try again.';
    return;
  }
  PLAYS = plays;
  BAR.use(games);
  for (const id of Object.keys(games.teams)) {
    if (IMAGES.has(Number(id))) continue;
    const img = new Image();
    img.onload = () => render();
    img.src = logoSrc(id);
    IMAGES.set(Number(id), img);
  }
  render();
}

fillMenus();
restore();
$('season').onchange = load;
$('snaps').onchange = render;
$('min').onchange = render;
$('title').oninput = render;
$('preset').onchange = () => { usePreset($('preset').value); $('preset').value = ''; };
$('png').onclick = download;
$('swap').onclick = () => {
  const x = read('x'), y = read('y');
  applySpec('x', y); applySpec('y', x);
  render();
};
['metric', 'side', 'sit', 'when', 'invert'].forEach(part =>
  ['x', 'y'].forEach(axis => { $(`${axis}-${part}`).onchange = render; }));
$('chart').onmousemove = hover;
$('chart').onmouseleave = () => { $('tip').hidden = true; };
window.addEventListener('resize', () => { clearTimeout(window._cr); window._cr = setTimeout(render, 150); });
// the logos come in a dark and a light version: redraw when the theme changes
new MutationObserver(() => { IMAGES.clear(); load(); })
  .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
load();
