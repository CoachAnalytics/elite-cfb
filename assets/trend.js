
const $ = id => document.getElementById(id);
let DATA = null, size = 4;

const GROUPS = {summary: 'Scoreboard', offense: 'Offense', defense: 'Defense',
                schedule: 'Who they played'};

const fmt = (v, how) => {
  if (v === null || v === undefined) return '—';
  if (how === 'pct') return (v * 100).toFixed(1) + '%';
  if (how === 'dec3') return v.toFixed(3);
  if (how === 'dec2') return v.toFixed(2);
  if (how === 'int') return Math.round(v).toLocaleString();
  return v.toFixed(1);
};
const signed = (v, how) => {
  if (v === null || v === undefined) return '—';
  const away = Math.abs(v);
  const text = how === 'pct' ? (away * 100).toFixed(1) + '%'
    : how === 'dec3' ? away.toFixed(3)
    : how === 'dec2' ? away.toFixed(2)
    : how === 'int' ? Math.round(away).toLocaleString()
    : away.toFixed(1);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + text;
};

/** Who they played is a fact about the schedule, not a verdict on the team.
 *  A softer month is neither good news nor bad, so it is never colored as
 *  either - which is also what stops the page congratulating a side for
 *  having drawn three poor opponents. */
const judged = spec => spec.group !== 'schedule';

/** A gap is good or bad depending on which way the measure runs: conceding
 *  less is the same kind of news as gaining more. */
function tone(gap, better) {
  if (!better || gap === null || gap === undefined || Math.abs(gap) < 1e-9) return '';
  return (better === 'high' ? gap > 0 : gap < 0) ? ' good' : ' bad';
}

/** A rank move, which is good upwards whichever way its measure runs. */
function move(from, to, neutral) {
  if (!from || !to) return {text: '—', cls: ''};
  const gap = from - to;                        // 31st to 12th is nineteen better
  if (gap === 0) return {text: 'same', cls: ' dim'};
  return {text: (gap > 0 ? '▲ ' : '▼ ') + Math.abs(gap),
          cls: neutral ? ' dim' : gap > 0 ? ' good' : ' bad'};
}

const team = () => DATA.rows[$('team').value] || {};
const scope = () => team()[`w${size}`] || null;
const weekSpan = win => win.first_week === win.last_week
  ? `week ${win.last_week}` : `weeks ${win.first_week}–${win.last_week}`;

function cards() {
  const win = scope(), season = team().season;
  if (!win || !season) { $('verdict').innerHTML = ''; return; }
  const card = (label, value, under) =>
    `<div class="trend-card"><div class="k">${label}</div><div class="v">${value}</div>
     <div class="s">${under}</div></div>`;

  // The direction, from how far the four core measures have moved, each
  // measured against how far apart teams are on it. Ranks are what the rest
  // of the page shows, but they cannot describe a team that is already first
  // or already last: there is nowhere for the rank to go, so it reads "no
  // change" while the football has changed a great deal.
  const spread = DATA.spread || {};
  const shifts = DATA.core.map(key => {
    const spec = DATA.measures.find(m => m.key === key);
    const now = win.values[key], was = season.values[key], apart = spread[key];
    if (now === undefined || was === undefined || !apart) return null;
    return {spec, now, was, by: (now - was) / apart * (spec.better === 'high' ? 1 : -1)};
  }).filter(Boolean);
  const mean = shifts.length
    ? shifts.reduce((total, s) => total + s.by, 0) / shifts.length : null;
  const verdict = win.games === season.games ? 'Too early to call a direction.'
    : mean === null ? 'Not enough of the core measures to call a direction yet.'
    : mean >= 0.5 ? 'Playing clearly better than their season line.'
    : mean >= 0.2 ? 'Trending up.'
    : mean > -0.2 ? 'Playing to their season form.'
    : mean > -0.5 ? 'Trending down.'
    : 'Playing clearly worse than their season line.';
  const biggest = shifts.length
    ? shifts.reduce((a, b) => Math.abs(b.by) > Math.abs(a.by) ? b : a) : null;
  // Early in a season the window is the whole season, and a figure compared
  // with itself is not a trend however it is phrased.
  const whole = win.games === season.games;
  const detail = whole
    ? `Every game this team has played is inside this window, so there is nothing behind it
       to compare against yet.`
    : !biggest ? ''
    : `The biggest move is ${biggest.spec.label}:
       ${fmt(biggest.was, biggest.spec.format)} across the season against
       ${fmt(biggest.now, biggest.spec.format)} over these ${win.games} games.`;

  const one = (key, label) => {
    const spec = DATA.measures.find(m => m.key === key);
    const wr = (win.rank || {})[key], sr = (season.rank || {})[key];
    const mv = move(sr, wr, !judged(spec));
    return card(label,
      `${fmt(win.values[key], spec.format)} <span class="rank">${wr ? '#' + wr : ''}</span>`,
      `season ${fmt(season.values[key], spec.format)}${sr ? ' (#' + sr + ')' : ''}
       · <span class="mv${mv.cls}">${mv.text}</span>`);
  };

  $('verdict').innerHTML =
    `<div class="verdict-line"><b>${verdict}</b> ${detail}</div>
     <div class="trend-cards">
       ${card(`Last ${win.games} games`, win.record,
              `season ${season.record} · ${weekSpan(win)}`)}
       ${one('margin', 'Scoring margin')}
       ${one('off_epa', 'Offense, EPA per play')}
       ${one('def_epa', 'Defense, EPA per play')}
       ${one('opp_rating', 'Average opponent')}
     </div>`;
}

function board() {
  const win = scope(), season = team().season;
  if (!win || !season) { $('board').innerHTML = ''; return; }
  let group = '';
  const body = DATA.measures.map(spec => {
    const v = win.values[spec.key], s = season.values[spec.key];
    if (v === undefined && s === undefined) return '';
    const gap = (v === undefined || s === undefined) ? null : v - s;
    const wr = (win.rank || {})[spec.key], sr = (season.rank || {})[spec.key];
    const mv = move(sr, wr, !judged(spec));
    const rests = win.counts[spec.key];
    const head = spec.group !== group
      ? `<tr class="group"><td colspan="7">${GROUPS[spec.group]}</td></tr>` : '';
    group = spec.group;
    // A rate built on very few plays should not look as solid as one that is not.
    const thin = rests !== undefined && rests < 25 ? ' thin' : '';
    const over = rests === undefined ? ''
      : ` title="over ${rests} in these ${win.games} games"`;
    return head + `<tr>
      <td class="name${thin}"${over}>${spec.label}</td>
      <td class="num key${thin}">${fmt(v, spec.format)}</td>
      <td class="num">${wr ? '#' + wr : '—'}</td>
      <td class="num dim">${fmt(s, spec.format)}</td>
      <td class="num dim">${sr ? '#' + sr : '—'}</td>
      <td class="num${judged(spec) ? tone(gap, spec.better) : ' dim'}">${signed(gap, spec.format)}</td>
      <td class="num mv${mv.cls}">${mv.text}</td></tr>`;
  }).join('');

  $('board').innerHTML = `<table class="report trend"><thead><tr>
      <th class="name">Measure</th><th class="num">Last ${win.games}</th><th class="num">Rank</th>
      <th class="num">Season</th><th class="num">Rank</th><th class="num">Difference</th>
      <th class="num">Move</th></tr></thead><tbody>${body}</tbody></table>`;
}

function log() {
  const played = team().games, win = scope();
  if (!played || !win) { $('log').innerHTML = ''; return; }
  const inWindow = new Set(played.slice(-win.games).map(g => g.week + '/' + g.label));
  const specs = DATA.log_keys.map(k => DATA.measures.find(m => m.key === k));
  const base = DATA.league.season || {};

  const body = played.map(g => {
    const here = inWindow.has(g.week + '/' + g.label);
    const logo = g.opp_logo
      ? `<img class="logo" src="${(window.CA_UP || '')}${g.opp_logo}" alt="" width="18"` +
        ' height="18" loading="lazy">'
      : '';
    const rank = g.opp_rank ? `<span class="apr">#${g.opp_rank}</span> ` : '';
    return `<tr class="${here ? 'in' : 'out'}">
      <td class="name">${g.label}</td>
      <td class="name">${g.site === 'away' ? 'at' : 'vs'} ${logo}${rank}${g.opp}${
        g.site === 'neutral' ? ' <span class="apr">neutral</span>' : ''}</td>
      <td class="num ${g.won ? 'good' : 'bad'}">${g.won ? 'W' : 'L'} ${g.pf}–${g.pa}</td>
      ${specs.map(spec => {
        const v = g.values[spec.key];
        const gap = (v === undefined || base[spec.key] === undefined) ? null : v - base[spec.key];
        return `<td class="num${tone(gap, spec.better)}">${fmt(v, spec.format)}</td>`;
      }).join('')}</tr>`;
  }).reverse().join('');

  $('log').innerHTML = `<table class="report trend log"><thead><tr>
      <th class="name">Game</th><th class="name">Opponent</th><th class="num">Result</th>
      ${specs.map(s => `<th class="num">${s.label}</th>`).join('')}
    </tr></thead><tbody>${body}</tbody></table>`;
}

/** A line of the figures in week order. `invert` is for ranks, where the good
 *  direction is down - drawn the other way up so better is always higher. */
function spark(points, invert) {
  const w = 280, h = 54, pad = 5;
  const ys = points.map(p => p.y);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const range = hi - lo;
  const x = i => pad + (points.length === 1 ? (w - 2 * pad) / 2
    : i * (w - 2 * pad) / (points.length - 1));
  const y = v => {
    // A team that has not moved all season draws a flat line, and it belongs
    // down the middle. Scaling by a range of nothing would pin it to whichever
    // edge the arithmetic happened to land on - the worst team in the country
    // drawn along the top of its own chart.
    const share = range ? (v - lo) / range : 0.5;
    return pad + (h - 2 * pad) * (invert ? share : 1 - share);
  };
  const line = points.map((p, i) =>
    `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
  const dots = points.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.y).toFixed(1)}"` +
    ` r="${i === points.length - 1 ? 3.2 : 1.8}"/>`).join('');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <path d="${line}" fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}

function movement() {
  const snaps = team().ratings || [];
  const panel = (label, key, invert, digits, shape) => {
    const points = snaps.filter(s => s[key] !== null && s[key] !== undefined)
      .map(s => ({x: s.week, y: s[key]}));
    if (points.length < 2) {
      return `<div class="spark-card"><div class="k">${label}</div><div class="s">Fewer than
        two snapshots this season, so there is no movement to draw.</div></div>`;
    }
    const first = points[0], last = points[points.length - 1];
    const gap = invert ? first.y - last.y : last.y - first.y;
    const arrow = gap === 0 ? 'unchanged'
      : (gap > 0 ? '▲ ' : '▼ ') + Math.abs(gap).toFixed(digits);
    const cls = gap === 0 ? ' dim' : gap > 0 ? ' good' : ' bad';
    return `<div class="spark-card"><div class="k">${label}</div>${spark(points, invert)}
      <div class="s">${shape(first.y)} in week ${first.x} → <b>${shape(last.y)}</b> in week
        ${last.x} · <span class="mv${cls}">${arrow}</span></div></div>`;
  };
  $('movement').innerHTML =
    panel('SP+ national rank', 'sp_rank', true, 0, v => '#' + v)
    + panel('SP+ rating', 'sp', false, 1, v => (v > 0 ? '+' : '') + v.toFixed(1))
    + panel('Elo', 'elo', false, 0, v => Math.round(v).toLocaleString());
}

function draw() {
  const win = scope();
  $('counts').textContent = win
    ? `${win.games} games, ${weekSpan(win)}${win.of ? ` · ranked among ${win.of}` : ''}`
    : 'No games yet';
  // Early in a season, and for a team with a bye behind it, the window is
  // simply everything it has played. Say so rather than labelling four games
  // as four when there are three.
  $('thin').hidden = !win || win.games >= size;
  if (win && win.games < size) {
    $('thin').textContent = `This team has played only ${win.games} game`
      + `${win.games === 1 ? '' : 's'}, so "last ${size}" is every game it has played.`;
  }
  cards();
  board();
  log();
  movement();
}

async function load() {
  const season = $('season').value;
  DATA = await window.memberData(`trend/${season}.json`);
  size = DATA.windows.includes(size) ? size : DATA.default_window;
  document.querySelectorAll('[data-size]').forEach(b =>
    b.classList.toggle('on', Number(b.dataset.size) === size));
  $('asof').textContent = DATA.week ? `Through week ${DATA.week}.` : '';
  const current = $('team').value;
  $('team').innerHTML = DATA.teams.map(t =>
    `<option value="${t.team_id}">${t.school}</option>`).join('');
  if (current && DATA.rows[current]) $('team').value = current;
  draw();
}

(async () => {
  $('season').onchange = load;
  $('team').onchange = draw;
  document.querySelectorAll('[data-size]').forEach(b => b.onclick = () => {
    size = Number(b.dataset.size);
    document.querySelectorAll('[data-size]').forEach(x => x.classList.toggle('on', x === b));
    draw();
  });
  await load();
})();
