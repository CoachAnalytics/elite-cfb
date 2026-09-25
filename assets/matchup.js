
// The matchup block: one team's offense against the other's defense, and back.
// Used by the Advanced tab, where you pick the teams, and by a game page,
// where the game picks them.
const MATCHUP = { data: null, season: null };

// its own logo helper, so a page that does not load the stats engine can use it
const mlogo = (path, size) => path
  ? `<img class="logo" src="${path.includes('://') ? path : (window.CA_UP || '') + path}" alt=""
      width="${size}" height="${size}" loading="lazy">` : '';

async function matchupData(season, up) {
  if (MATCHUP.season === season && MATCHUP.data) return MATCHUP.data;
  const r = await fetch(`${up}data/matchup/${season}.json`);
  if (!r.ok) throw new Error('No matchup data for that season.');
  MATCHUP.data = await r.json();
  MATCHUP.season = season;
  return MATCHUP.data;
}

const MFMT = {
  pct: v => (v * 100).toFixed(1) + '%',
  dec1: v => v.toFixed(1),
  dec2: v => v.toFixed(2),
  dec3: v => v.toFixed(3),
  int: v => Math.round(v).toLocaleString(),
};

const tier = (rank, of) => {
  if (!rank) return 'tn';
  const share = rank / of;
  return share <= 0.15 ? 't1' : share <= 0.37 ? 't2' : share <= 0.66 ? 't3' : 't4';
};

const mval = (cat, cell) => cell && cell.v !== null && cell.v !== undefined
  ? MFMT[cat.fmt](cell.v) : '—';

// ---------------------------------------------------------------- radars
// Three shapes: one team's offence against the other's defence. The spokes
// are ranks among the 68, not raw numbers, because EPA, a percentage and a
// count of sacks cannot share a scale any other way. Further out is better
// for whichever side the spoke belongs to, so a bigger shape is a better
// unit and the two are directly comparable.
const RADARS = [
  { title: 'Total', spokes: [['epa', 'EPA/play'], ['success', 'Success'], ['ypp', 'Yds/play'],
                             ['pts_drive', 'Pts/drive'], ['third_pct', '3rd down'],
                             ['rz_td_pct', 'Red zone TD'], ['turnovers', 'Turnovers'],
                             ['sack_tfl', 'Sacks+TFL']] },
  { title: 'Passing', spokes: [['pass_epa', 'EPA/DB'], ['pass_success', 'Success'],
                               ['ypa', 'Yds/att'], ['comp_pct', 'Comp %'],
                               ['pass20', '20+ passes'], ['pass_td', 'Pass TDs'],
                               ['sacks', 'Sacks'], ['ints', 'INTs']] },
  { title: 'Rushing', spokes: [['rush_epa', 'EPA/carry'], ['rush_success', 'Success'],
                               ['ypc', 'Yds/carry'], ['run20', '20+ runs'],
                               ['rush_td', 'Rush TDs'], ['tfl_clean', 'TFL no sack'],
                               ['fumbles', 'Fumbles']] },
];

/** A team colour that can be seen on this page's background. */
function teamInk(hex, fallback) {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return fallback;
  const n = parseInt(hex.replace('#', ''), 16);
  let [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const light = document.documentElement.dataset.theme === 'light';
  // Brightness, not luminance: a deep scarlet reads perfectly well on black
  // and must keep its colour, while the nine teams whose colour is black or
  // near-black would draw nothing at all. Same in reverse on a white page.
  const strongest = Math.max(r, g, b), weakest = Math.min(r, g, b);
  const lift = (c, towards) => Math.round(c + (towards - c) * 0.5);
  if (!light && strongest < 70) [r, g, b] = [lift(r, 255), lift(g, 255), lift(b, 255)];
  if (light && weakest > 200) [r, g, b] = [lift(r, 0), lift(g, 0), lift(b, 0)];
  return `rgb(${r},${g},${b})`;
}

/** Where a value sits among the 68, as 0 to 1, best being 1. */
const spokeShare = (cell, of) =>
  cell && cell.r ? 1 - (cell.r - 1) / Math.max(of - 1, 1) : null;

function radar(data, a, b, spec) {
  const w = 360, h = 300, midX = w / 2, midY = h / 2, ring = 84;
  const spokes = spec.spokes.filter(([k]) => data.categories.some(c => c.key === k));
  const keys = spokes.map(([k]) => k);
  const label = k => (spokes.find(sp => sp[0] === k) || [k, k])[1];
  const at = (i, share) => {
    const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    return [midX + Math.cos(angle) * ring * share, midY + Math.sin(angle) * ring * share];
  };
  const shape = (team, side) => keys.map((k, i) => {
    const share = spokeShare(team[side][k], data.of);
    return at(i, share === null ? 0 : 0.12 + share * 0.88).map(n => n.toFixed(1)).join(',');
  }).join(' ');

  const webs = [0.25, 0.5, 0.75, 1].map(r =>
    `<polygon class="web" points="${keys.map((_, i) => at(i, r).map(n => n.toFixed(1)).join(',')).join(' ')}"/>`).join('');
  const rays = keys.map((_, i) =>
    `<line class="spoke" x1="${midX}" y1="${midY}" x2="${at(i, 1)[0].toFixed(1)}"
       y2="${at(i, 1)[1].toFixed(1)}"/>`).join('');
  const names = keys.map((k, i) => {
    const [x, y] = at(i, 1.2);
    const anchor = x < midX - 6 ? 'end' : x > midX + 6 ? 'start' : 'middle';
    return `<text class="spoke-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}"
      dominant-baseline="middle">${label(k)}</text>`;
  }).join('');

  const inkA = teamInk(a.color, '#9cc3ea'), inkB = teamInk(b.color, '#d4757f');
  return `<figure class="radar">
    <figcaption>${spec.title}</figcaption>
    <svg viewBox="0 0 ${w} ${h}" role="img"
         aria-label="${spec.title}: ${a.school} offense against ${b.school} defense">
      ${webs}${rays}
      <polygon class="shape defence" points="${shape(b, 'def')}" style="fill:${inkB};stroke:${inkB}"/>
      <polygon class="shape" points="${shape(a, 'off')}" style="fill:${inkA};stroke:${inkA}"/>
      ${names}
    </svg>
  </figure>`;
}

function radars(el, data, a, b) {
  const key = (team, ink) =>
    `<span class="radar-key"><i style="background:${ink}"></i>${team}</span>`;
  // two teams can wear near enough the same red, so the defence is dashed
  el.innerHTML = [
    `<div class="radar-head"><h3 class="minor">${a.school} offense vs ${b.school} defense</h3>
      <div>${key(a.school, teamInk(a.color, '#9cc3ea'))}
        <span class="radar-key dashed">${key(b.school, teamInk(b.color, '#d4757f'))}</span></div></div>`,
    `<div class="radar-row">${RADARS.map(spec => radar(data, a, b, spec)).join('')}</div>`,
  ].join('');
}

/** One half: team A's unit against team B's unit. */
function matchupBlock(data, a, b, sideA, sideB, heading) {
  const groups = [];
  let current = null;
  for (const cat of data.categories) {
    if (cat.chartOnly) continue;
    if (!current || current.name !== cat.group) {
      current = { name: cat.group, rows: [] };
      groups.push(current);
    }
    const ca = a[sideA][cat.key], cb = b[sideB][cat.key];
    if ((!ca || ca.v === null) && (!cb || cb.v === null)) continue;
    const better = ca && cb && ca.r && cb.r ? (ca.r < cb.r ? 'a' : cb.r < ca.r ? 'b' : '') : '';
    const mark = cat.allSnaps ? '<sup class="all-snaps" title="every snap: the box score cannot '
      + 'separate garbage time for this one">*</sup>' : '';
    current.rows.push(`<div class="mrow">
      <div class="mval r ${better === 'a' ? 'won' : ''}">${mval(cat, ca)}</div>
      <div class="mrank ${tier(ca && ca.r, data.of)}">${ca && ca.r ? ca.r : '—'}</div>
      <div class="mcat">${cat.label}${mark}</div>
      <div class="mrank ${tier(cb && cb.r, data.of)}">${cb && cb.r ? cb.r : '—'}</div>
      <div class="mval ${better === 'b' ? 'won' : ''}">${mval(cat, cb)}</div>
    </div>`);
  }
  const body = groups.filter(g => g.rows.length)
    .map(g => `<div class="grp">${g.name}</div>${g.rows.join('')}`).join('');
  return `<details class="block" open><summary>
    <div class="block-head">
      <div class="block-side"><i style="background:${a.color || '#888'}"></i>
        <span class="nm">${a.school}</span></div>
      <div class="spacer"></div>
      <div class="block-side r"><span class="nm">${b.school}</span>
        <i style="background:${b.color || '#888'}"></i></div>
      <div class="ph">${sideA === 'off' ? 'offense' : 'defense'}</div>
      <div class="mid">${heading}</div>
      <div class="ph r">${sideB === 'off' ? 'offense' : 'defense'}</div>
    </div></summary>${body}</details>`;
}

/** The whole comparison, both ways round. */
function drawMatchup(el, data, idA, idB) {
  const a = data.teams[idA], b = data.teams[idB];
  if (!a || !b) { el.innerHTML = '<p class="sub">Pick two teams.</p>'; return; }
  el.innerHTML = `<div class="matchup-head">
      <div class="m-team">${mlogo(a.logo, 42)}<div><div class="nm">${a.school}</div>
        <div class="sub">${a.record} &middot; ${a.conference || ''}</div></div></div>
      <div class="m-vs">vs</div>
      <div class="m-team b"><div style="text-align:right"><div class="nm">${b.school}</div>
        <div class="sub">${b.record} &middot; ${b.conference || ''}</div></div>${mlogo(b.logo, 42)}</div>
    </div>` +
    `<div class="radars" id="radars-a"></div>` +
    matchupBlock(data, a, b, 'off', 'def', 'when ' + a.school + ' has the ball') +
    `<div class="radars" id="radars-b"></div>` +
    matchupBlock(data, b, a, 'off', 'def', 'when ' + b.school + ' has the ball');
  radars(el.querySelector('#radars-a'), data, a, b);
  radars(el.querySelector('#radars-b'), data, b, a);
}

/** The block a game page shows: the two teams that are playing.
 *  Teams are matched by school, because a game file names the schools; a
 *  non-Power 4 opponent simply has no season numbers, and the block stays away. */
async function gameMatchup(el, game, up) {
  let data;
  try {
    data = await matchupData(game.season, up);
  } catch (err) {
    return false;
  }
  const find = school => Object.keys(data.teams).find(id => data.teams[id].school === school);
  const away = find(game.away_school), home = find(game.home_school);
  if (!away || !home) return false;
  el.innerHTML = '<h2>Season matchup</h2>';
  const box = document.createElement('div');
  el.appendChild(box);
  drawMatchup(box, data, away, home);
  return true;
}

/** The Advanced tab: two pickers and a swap. */
async function matchupPage(up) {
  const $ = id => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  async function load() {
    const season = $('season').value;
    let data;
    try {
      data = await matchupData(season, up);
    } catch (err) {
      $('matchup').innerHTML = '<p class="sub">That season has no matchup data yet.</p>';
      return;
    }
    const teams = Object.entries(data.teams).sort((x, y) => x[1].school.localeCompare(y[1].school));
    for (const which of ['team-a', 'team-b']) {
      const keep = $(which).value;
      $(which).innerHTML = teams.map(([id, t]) => `<option value="${id}">${t.school}</option>`).join('');
      if (keep && data.teams[keep]) $(which).value = keep;
    }
    if (!MATCHUP.picked) {                      // first draw: the address decides
      MATCHUP.picked = true;
      const first = q.get('a') || remembered.get('team') || teams[0][0];
      const second = q.get('b') || teams.find(([id]) => id !== String(first))[0];
      if (data.teams[first]) $('team-a').value = first;
      if (data.teams[second]) $('team-b').value = second;
    }
    show();
  }
  function show() {
    remembered.set('team', $('team-a').value);
    history.replaceState(null, '', `?a=${$('team-a').value}&b=${$('team-b').value}&season=${$('season').value}`);
    drawMatchup($('matchup'), MATCHUP.data, $('team-a').value, $('team-b').value);
  }
  $('season').onchange = load;
  $('team-a').onchange = show;
  $('team-b').onchange = show;
  $('swap').onclick = () => {
    const a = $('team-a').value;
    $('team-a').value = $('team-b').value;
    $('team-b').value = a;
    show();
  };
  const startSeason = q.get('season') || remembered.get('season');
  if (startSeason && [...$('season').options].some(o => o.value === startSeason)) {
    $('season').value = startSeason;
  }
  load();
}
