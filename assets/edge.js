
const $ = id => document.getElementById(id);
const BAR = filterBar(() => draw());
let PLAYS = null, CELLS = [], BUSY = false;

const SIDES = [['offense', 'Offense'], ['defense', 'Defense']];
const TOP = 12;                 // how many strengths, and how many weaknesses
const PER_METRIC = 2;           // stop one metric filling the list
const MIN_RANKED = 40;          // a rank needs most of the 68 to be in the list

/** The metrics worth measuring in one situation.
 *
 * A situation that names a play type has nothing to add to a metric that is
 * already about that play type: "yards per carry, running the ball" is just
 * yards per carry. And a drive is only shaped by when it happened, so drive
 * metrics are left to the situations that move in that dimension. Dropping
 * both keeps the same number from being listed twice under different names. */
function wanted(situation) {
  const w = situation.where;
  const kind = w.kind;
  const shapesADrive = !w.downs && !w.dist && !w.zone && kind === undefined;
  return METRICS.filter(m => {
    if (m.drives) return shapesADrive;
    if (kind === K_RUN && m.group === 'Passing') return false;
    if (kind === K_DROPBACK && m.group === 'Rushing') return false;
    if (kind !== undefined && (m.group === 'Passing' || m.group === 'Rushing')) return false;
    return true;
  }).map(m => m.id);
}

/** Every metric, in every situation, on both sides: one row each. */
function measure(teamId) {
  const { ok } = BAR.filter(null);
  const snaps = $('snaps').value;
  const cells = [];
  for (const [side, sideLabel] of SIDES) {
    if ($('side').value && $('side').value !== side) continue;
    // filter the plays once for this side, then every situation is a cheap pass
    const rows = PLAYS.rows.filter(r =>
      ok.has(PLAYS.games[r[0]] + '-' + PLAYS.teams[side === 'defense' ? r[2] : r[1]]));
    const view = { teams: PLAYS.teams, games: PLAYS.games, rows, season: PLAYS.season };
    for (const id of WALK) {
      const situation = SITUATION[id];
      const where = { ...situation.where, snaps };
      const ids = wanted(situation);
      const teams = scan(view, null, side, where, ids);
      for (const metric of ids.map(id => METRIC[id])) {
        const { values, counts } = metricColumn(teams, metric);
        if (!values.has(teamId) || values.size < MIN_RANKED) continue;
        const high = goodIsHigh(metric, side);
        const { ranks, of } = rankTeams(values, high === null ? true : high);
        const rank = ranks.get(teamId);
        cells.push({
          metric, side, sideLabel, situation, rank, of,
          value: values.get(teamId), plays: counts.get(teamId),
          pct: high === null ? null : 1 - (rank - 1) / Math.max(of - 1, 1),
        });
      }
    }
  }
  return cells;
}

function card(cell, good) {
  const width = Math.round((cell.pct === null ? 0.5 : good ? cell.pct : 1 - cell.pct) * 100);
  return `<div class="edge-row">
    <div class="edge-head"><b>${cell.metric.label}</b>
      <span class="rank ${good ? 'good' : 'bad'}">${place(cell.rank)} of ${cell.of}</span></div>
    <div class="edge-where">${cell.sideLabel} &middot; ${cell.situation.label}
      &middot; ${cell.plays} ${cell.metric.drives ? 'drives' : 'plays'}</div>
    <div class="edge-bar"><span class="${good ? 'good' : 'bad'}" style="width:${width}%"></span>
      <em>${fmtMetric(cell.metric, cell.value)}</em></div>
  </div>`;
}

const ordinal = n => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// A tied rank comes back as the average of the places it covers, so say so.
const place = n => (Number.isInteger(n) ? '' : 'T') + ordinal(Math.round(n));

/** Pick the best (or worst) cells, without letting one metric take over. */
function pick(cells, good) {
  const ranked = cells.filter(c => c.pct !== null)
    .sort((a, b) => good ? b.pct - a.pct : a.pct - b.pct);
  const out = [], used = {};
  for (const c of ranked) {
    const key = c.metric.id;
    if ((used[key] || 0) >= PER_METRIC) continue;
    used[key] = (used[key] || 0) + 1;
    out.push(c);
    if (out.length === TOP) break;
  }
  return out;
}

function table(cells) {
  const rows = [...cells].sort((a, b) => a.rank - b.rank || a.metric.label.localeCompare(b.metric.label));
  $('all-cells').innerHTML = `<thead><tr><th class="name">Metric</th><th class="name">Situation</th>
    <th>Side</th><th>Value</th><th>Rank</th><th>Plays</th></tr></thead><tbody>` +
    rows.map(c => `<tr><th class="name">${c.metric.label}</th>
      <td class="name">${c.situation.label}</td><td>${c.sideLabel}</td>
      <td>${fmtMetric(c.metric, c.value)}</td>
      <td>${c.pct === null ? '—' : place(c.rank) + " of " + c.of}</td>
      <td>${c.plays}</td></tr>`).join('') + '</tbody>';
}

function draw() {
  if (!PLAYS || BUSY) return;
  const teamId = Number($('team').value);
  if (!teamId) return;
  BUSY = true;
  $('note').textContent = 'Reading every play…';
  // let the page paint the message before the work starts
  setTimeout(() => {
    try {
      CELLS = measure(teamId);
      const team = BAR.games.teams[teamId] || [''];
      $('head').innerHTML = `<div class="report-head">${logo(logoSrc(teamId), 46)}
        <div><div class="eyebrow">CoachAnalytics &middot; ${PLAYS.season} &middot; strengths and weaknesses</div>
        <h1>${team[0]}</h1>
        <div class="sub">Ranked among the 68 in every metric, in every situation below.</div></div></div>`;
      const strengths = pick(CELLS, true), weaknesses = pick(CELLS, false);
      $('strengths').innerHTML = strengths.map(c => card(c, true)).join('')
        || '<p class="sub">Not enough plays yet in these filters.</p>';
      $('weaknesses').innerHTML = weaknesses.map(c => card(c, false)).join('')
        || '<p class="sub">Not enough plays yet in these filters.</p>';
      table(CELLS);
      $('note').textContent = `${CELLS.length} measurements`;
    } finally {
      BUSY = false;
    }
  }, 20);
}

async function load() {
  const season = $('season').value;
  $('note').textContent = 'Loading…';
  let plays, games;
  try {
    [plays, games] = await Promise.all([
      memberData(`situational/${season}.json`),
      fetch(`../data/stats/games/${season}.json`).then(r => r.json())]);
  } catch (err) {
    $('note').textContent = 'That season did not finish downloading. Reload the page to try again.';
    return;
  }
  PLAYS = plays;
  BAR.use(games);
  const teams = Object.entries(games.teams).sort((a, b) => a[1][0].localeCompare(b[1][0]));
  const keep = $('team').value || remembered.get('team');
  $('team').innerHTML = teams.map(([id, t]) => `<option value="${id}">${t[0]}</option>`).join('');
  if (keep && games.teams[keep]) $('team').value = keep;
  remembered.set('team', $('team').value);
  draw();
}

$('season').onchange = () => { remembered.set('season', $('season').value); load(); };
$('team').onchange = () => {
  remembered.set('team', $('team').value);
  history.replaceState(null, '', `?id=${$('team').value}&season=${$('season').value}`);
  draw();
};
$('side').onchange = draw;
$('snaps').onchange = draw;
const startSeason = remembered.get('season');
if (startSeason && [...$('season').options].some(o => o.value === startSeason)) $('season').value = startSeason;
load();
