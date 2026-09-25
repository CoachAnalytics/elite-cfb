
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
const R = window.REPORT;
let PLAYS = null, TEAMS = null, DRIVES = null;
let SIDE = (new URLSearchParams(location.search)).get('side') === 'defense' ? 'defense' : 'offense';
const BAR = filterBar(() => draw(), (sel, options) =>
  sel.length === options.length ? 'All conferences' : listSummary('conference', 'conferences')(sel, options));

const pct = v => v === null || v === undefined ? '—' : (v * 100).toFixed(1) + '%';
const dec = (v, d) => v === null || v === undefined ? '—' : Number(v).toFixed(d);
const FMT = { int: v => v === null ? '—' : Math.round(v).toLocaleString(), pct,
              dec1: v => dec(v, 1), dec2: v => dec(v, 2), dec3: v => dec(v, 3), text: v => v ?? '—' };

// ---- one pass over the plays: the team and the rest of the field together
function blank() {
  return { plays: 0, successes: 0, yards: 0, epa: 0, explosive: 0, negative: 0, stuffed: 0,
           runs: 0, passes: 0, run_successes: 0, pass_successes: 0, tds: 0, drives: new Map() };
}

// what the previous snap on this drive was, so "after" rows can be built
function moment(prev, defence) {
  if (!prev) return null;
  const [, , , , down, dist, ytg, kind, yards, flags] = prev;
  return {
    inc1: kind === 1 && down === 1 && prev[14] === 2,
    explosive: Boolean(flags & 2),
    negative: (kind === 0 && yards <= 0) || Boolean(flags & 8),
    pen_off: kind === 2 && Boolean(flags & (defence ? 128 : 64)),
    fd_mid: kind !== 2 && yards >= dist && ytg >= 40 && ytg <= 60,
    run_short: kind === 0 && yards <= 3,
    run_big_1st: down === 1 && kind === 0 && yards >= 10,
    pass_big_1st: down === 1 && kind === 1 && yards >= 10,
    third_conv: down === 3 && kind !== 2 && yards >= dist,
    // the feed stores a penalty's yards as a distance, not as a gain or a
    // loss, so who was flagged is what says which way they went
    pen_gain: kind === 2 && Boolean(flags & 128),
    pen_loss: kind === 2 && Boolean(flags & 64),
  };
}

function both(teamId, where, ok) {
  const mine = blank(), field = blank();
  const snaps = $('snaps').value;
  const defence = SIDE === 'defense';
  const previous = new Map();                    // drive -> the snap before this one
  for (const r of PLAYS.rows) {
    const [g, off, def, drive, down, dist, ytg, kind, yards, flags, epa] = r;
    const team = PLAYS.teams[defence ? def : off];
    const acc = team === teamId ? mine : (FIELD_SET.has(team) ? field : null);
    if (!acc) continue;
    if (!ok.has(PLAYS.games[g] + '-' + team)) continue;
    const before = previous.get(drive);
    previous.set(drive, r);
    if (snaps === 'competitive' && (flags & 4)) continue;
    if (snaps === 'garbage' && !(flags & 4)) continue;
    // a drive keeps its whole story, whatever the play filters say
    const key = drive;
    let d = acc.drives.get(key);
    if (!d) acc.drives.set(key, d = { plays: 0, yards: 0, td: false, pen_off: false, pen_def: false,
                                      negative: false, sack: false, explosive: false, start: 0, deepest: 99 });
    if (kind === 2) { if (flags & 64) d.pen_off = true; if (flags & 128) d.pen_def = true; continue; }
    d.plays += 1; d.yards += yards;
    if (ytg) { d.start = Math.max(d.start, ytg); d.deepest = Math.min(d.deepest, ytg); }
    if (flags & 32) d.td = true;
    if (flags & 8) { d.sack = true; d.negative = true; }
    if (flags & 2) d.explosive = true;
    if (kind === 0 && yards <= 0) d.negative = true;

    if (where.down && !where.down.includes(down)) continue;
    if (where.dist && (dist < where.dist[0] || dist > where.dist[1])) continue;
    if (where.zone && (ytg < where.zone[0] || ytg > where.zone[1])) continue;
    if (where.kind !== undefined && kind !== where.kind) continue;
    const quarter = r[15], margin = defence ? -r[16] : r[16];
    if (where.quarters && !where.quarters.includes(quarter)) continue;
    if (where.half === 1 && quarter > 2) continue;
    if (where.half === 2 && (quarter < 3 || quarter === 0)) continue;
    if (where.state === 'lead' && margin <= 0) continue;
    if (where.state === 'behind' && margin > 0) continue;
    if (where.state === 'close' && Math.abs(margin) > 8) continue;
    if (where.state === 'big_lead' && margin <= 8) continue;
    if (where.state === 'big_deficit' && margin >= -8) continue;
    if (where.after) {
      const was = moment(before, defence);
      if (!was || !was[where.after]) continue;
    }
    if (where.explosive_only && !(flags & 2)) continue;
    acc.plays += 1;
    acc.yards += yards;
    acc.epa += epa / 100;
    if (flags & 1) { acc.successes += 1; if (kind === 0) acc.run_successes += 1; else acc.pass_successes += 1; }
    if (flags & 2) acc.explosive += 1;
    if (flags & 32) acc.tds += 1;
    if ((kind === 0 && yards <= 0) || (flags & 8)) acc.negative += 1;
    if (kind === 0 && yards <= 0) acc.stuffed += 1;
    if (kind === 0) acc.runs += 1; else acc.passes += 1;
  }
  return { mine, field };
}

function zoneDrives(acc, zone) {
  let trips = 0, tds = 0;
  for (const d of acc.drives.values()) {
    if (!d.plays || d.deepest === 99) continue;
    if (d.deepest < zone[0] || d.deepest > zone[1]) continue;
    trips += 1;
    if (d.td) tds += 1;
  }
  return { trips, tds };
}

function measure(acc, name, where) {
  const per = (a, b) => b ? a / b : null;
  switch (name) {
    case 'plays': return acc.plays;
    case 'successes': return acc.successes;
    case 'success': return per(acc.successes, acc.plays);
    case 'run_success': return per(acc.run_successes, acc.runs);
    case 'pass_success': return per(acc.pass_successes, acc.passes);
    case 'ypp': return per(acc.yards, acc.plays);
    case 'epa': return per(acc.epa, acc.plays);
    case 'explosive': return per(acc.explosive, acc.plays);
    case 'negative': return per(acc.negative, acc.plays);
    case 'stuffed': return per(acc.stuffed, acc.runs);
    case 'run_share': return per(acc.runs, acc.plays);
    case 'pass_share': return per(acc.passes, acc.plays);
    case 'mix': return acc.plays ? `${acc.runs}–${acc.passes}` : '—';
    case 'drives': {
      let n = 0; for (const d of acc.drives.values()) if (d.plays) n += 1; return n;
    }
    case 'drive_td': {
      if (where && where.zone) { const z = zoneDrives(acc, where.zone); return per(z.tds, z.trips); }
      let td = 0, n = 0;
      for (const d of acc.drives.values()) { if (!d.plays) continue; n += 1; if (d.td) td += 1; }
      return per(td, n);
    }
    case 'drive_tds': {
      if (where && where.zone) return zoneDrives(acc, where.zone).tds;
      let td = 0; for (const d of acc.drives.values()) if (d.td) td += 1; return td;
    }
    case 'drive_trips': return zoneDrives(acc, where.zone).trips;
    case 'drive_share': {
      let n = 0, hit = 0;
      for (const d of acc.drives.values()) {
        if (!d.plays) continue;
        n += 1;
        if (DRIVE_TESTS[where.flag](d)) hit += 1;
      }
      return per(hit, n);
    }
    default: return null;
  }
}

let FIELD_TEAMS = [], FIELD_SET = new Set();
let CACHE = new Map();
function cached(where, ok) {
  const key = JSON.stringify(where);
  if (!CACHE.has(key)) CACHE.set(key, both(Number($('team').value), where, ok));
  return CACHE.get(key);
}

function gapBar(value, field) {
  if (value === null || field === null || value === undefined || field === undefined) return '—';
  const d = Math.round((value - field) * 1000) / 10;
  const w = Math.min(50, Math.abs(d));
  const side = d >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
  return `<span class="gapwrap"><span class="gaptrack"><span class="gapfill ${d >= 0 ? 'up' : 'down'}"
    style="${side}"></span></span><span class="gapnum">${d > 0 ? '+' : ''}${d.toFixed(0)}</span></span>`;
}

function cell(col, where, ok) {
  const { mine, field } = cached(where, ok);
  const [label, name, fmt] = col;
  if (name.endsWith('_field')) return FMT[fmt](measure(field, name.replace('_field', ''), where));
  if (name.endsWith('_gap')) {
    const base = name.replace('_gap', '');
    return gapBar(measure(mine, base, where), measure(field, base, where));
  }
  if (name === 'share_of_down') {
    const all = cached({ ...where, dist: undefined }, ok).mine;
    return FMT[fmt](all.plays ? mine.plays / all.plays : null);
  }
  return FMT[fmt](measure(mine, name, where));
}

function table(block, ok) {
  const head = '<tr><th class="name">' + (block.rowHead || '') + '</th>' +
    block.columns.map(c => `<th>${c[0]}</th>`).join('') + '</tr>';
  const body = block.rows.map(([label, where]) => `<tr><th class="name">${label}</th>` +
    block.columns.map(c => `<td>${cell(c, where, ok)}</td>`).join('') + '</tr>').join('');
  return `<h2>${block.title}</h2>${block.note ? `<div class="sub">${block.note}</div>` : ''}
    <div class="table-wrap"><table class="report">${'<thead>' + head + '</thead>'}<tbody>${body}</tbody></table></div>`;
}

function players(block, ok) {
  const teamId = Number($('team').value);
  const defence = SIDE === 'defense';
  const who = new Map();
  for (const r of PLAYS.rows) {
    const [g, off, def, drive, down, dist, ytg, kind, yards, flags, epa, passer, rusher, target, result] = r;
    if (PLAYS.teams[defence ? def : off] !== teamId || kind === 2) continue;
    if (!ok.has(PLAYS.games[g] + '-' + teamId)) continue;
    if ($('snaps').value === 'competitive' && (flags & 4)) continue;
    const w = block.where;
    if (w.down && !w.down.includes(down)) continue;
    if (w.dist && (dist < w.dist[0] || dist > w.dist[1])) continue;
    if (w.zone && (ytg < w.zone[0] || ytg > w.zone[1])) continue;
    if (w.quarters && !w.quarters.includes(r[15])) continue;
    if (w.half === 2 && (r[15] < 3 || r[15] === 0)) continue;
    if (w.half === 1 && r[15] > 2) continue;
    const add = (idx, role) => {
      if (idx < 0) return;
      const key = idx + ':' + role;
      const rec = who.get(key) || { idx, role, n: 0, yards: 0, td: 0, success: 0, catches: 0 };
      rec.n += 1; rec.yards += yards;
      if (flags & 32) rec.td += 1;
      if (flags & 1) rec.success += 1;
      if (role === 'Target' && result === 1) rec.catches += 1;
      who.set(key, rec);
    };
    if (kind === 0) add(rusher, 'Rush');
    else { add(passer, 'Pass'); add(target, 'Target'); }
  }
  const rows = [...who.values()].sort((a, b) => b.n - a.n).map(r => {
    const p = PLAYS.players[r.idx] || ['?', ''];
    return `<tr><th class="name">${p[0]}</th><td class="name">${p[1] || ''}</td><td class="name">${r.role}</td>
      <td>${r.n}</td><td>${r.role === 'Target' ? r.catches : '—'}</td><td>${r.yards}</td>
      <td>${pct(r.success / r.n)}</td><td>${r.td}</td></tr>`;
  }).join('');
  return `<h2>${block.title}</h2>${block.note ? `<div class="sub">${block.note}</div>` : ''}
    <div class="table-wrap"><table class="report"><thead><tr><th class="name">Player</th><th class="name">Pos</th>
    <th class="name">Role</th><th>Plays</th><th>Rec</th><th>Yards</th><th>Success</th><th>TD</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8" class="name">No plays in these games.</td></tr>'}</tbody></table></div>`;
}

const DRIVE_TESTS = {
  pen_off: d => d.pen_off, pen_def: d => d.pen_def, negative: d => d.negative, sack: d => d.sack,
  explosive: d => d.explosive, clean: d => !d.pen_off && !d.negative,
  short: d => d.plays <= 3,
  start_backed: d => d.start >= 80, start_own: d => d.start >= 60 && d.start < 80,
  start_mid: d => d.start >= 41 && d.start < 60, start_plus: d => d.start < 41,
};

function driveTable(block, ok) {
  const { mine, field } = cached(block.where || {}, ok);
  const summarise = (acc, test) => {
    let n = 0, td = 0, yards = 0, plays = 0;
    for (const d of acc.drives.values()) {
      if (!d.plays) continue;
      if (test && !DRIVE_TESTS[test](d)) continue;
      n += 1; if (d.td) td += 1; yards += d.yards; plays += d.plays;
    }
    return { n, td, yards, plays };
  };
  const total = summarise(mine, null).n;
  const body = block.rows.map(([label, test]) => {
    const m = summarise(mine, test), f = summarise(field, test);
    return `<tr><th class="name">${label}</th>
      <td>${m.n}</td><td>${total ? pct(m.n / total) : '—'}</td>
      <td>${m.n ? dec(m.plays / m.n, 1) : '—'}</td><td>${m.n ? dec(m.yards / m.n, 1) : '—'}</td>
      <td>${m.n ? pct(m.td / m.n) : '—'}</td><td>${f.n ? pct(f.td / f.n) : '—'}</td>
      <td>${gapBar(m.n ? m.td / m.n : null, f.n ? f.td / f.n : null)}</td></tr>`;
  }).join('');
  return `<h2>${block.title}</h2>${block.note ? `<div class="sub">${block.note}</div>` : ''}
    <div class="table-wrap"><table class="report"><thead><tr><th class="name">Drives</th><th>Count</th>
    <th>Share</th><th>Plays</th><th>Yards</th><th>TD rate</th><th>Field</th><th>Gap</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

function driveLog(block, ok) {
  const teamId = Number($('team').value);
  const defence = SIDE === 'defense';
  const byDrive = new Map();
  for (const r of PLAYS.rows) {
    const [g, off, def, drive, down, dist, ytg, kind, yards, flags, epa, passer, rusher, target, result] = r;
    if (PLAYS.teams[defence ? def : off] !== teamId || kind === 2) continue;
    if (!ok.has(PLAYS.games[g] + '-' + teamId)) continue;
    if (!byDrive.has(drive)) byDrive.set(drive, { game: PLAYS.games[g], plays: [], td: false, deepest: 99 });
    const d = byDrive.get(drive);
    d.plays.push({ down, dist, ytg, kind, yards, flags, passer, rusher, target, result });
    if (flags & 32) d.td = true;
    if (ytg) d.deepest = Math.min(d.deepest, ytg);
  }
  const w = block.where;
  const name = i => (PLAYS.players[i] || ['?'])[0].split(' ').slice(-1)[0];
  const rows = [...byDrive.values()].filter(d => d.deepest >= w.zone[0] && d.deepest <= w.zone[1]).map(d => {
    const inZone = d.plays.filter(p => p.ytg >= w.zone[0] && p.ytg <= w.zone[1]);
    const seq = inZone.map(p => {
      const down = ['', '1st', '2nd', '3rd', '4th'][p.down] || '';
      const who = p.kind === 0 ? name(p.rusher) : (p.result === 4 ? name(p.passer) + ' sacked'
                  : p.result === 2 ? 'inc to ' + name(p.target) : name(p.passer) + ' to ' + name(p.target));
      const gain = p.yards < 0 ? `<span class="neg">${p.yards}</span>` : `+${p.yards}`;
      const td = (p.flags & 32) ? ', <b>TD</b>' : '';
      return `${down}&${p.dist} ${who} ${gain}${td}`;
    }).join(' &middot; ');
    const opp = OPPONENTS[d.game] || '';
    return `<tr><th class="name">${opp}</th><td class="name seq">${seq}</td>
      <td class="name">${d.td ? '<span class="pill td">TD</span>' : '<span class="pill fail">No TD</span>'}</td></tr>`;
  }).join('');
  return `<h2>${block.title}</h2>${block.note ? `<div class="sub">${block.note}</div>` : ''}
    <div class="table-wrap"><table class="report"><thead><tr><th class="name">Game</th>
    <th class="name">Sequence</th><th class="name">Result</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="3" class="name">No trips in these games.</td></tr>'}</tbody></table></div>`;
}

let OPPONENTS = {};
function buildOpponents(teamId) {
  OPPONENTS = {};
  const games = BAR.games;
  for (const [gid, tid, wk, site, confGame, tier, rank, opponent] of games.games) {
    if (tid !== teamId) continue;
    // the row carries the opponent's name, so a Group of 6 or FCS team is
    // named too even though the site keeps no stats for it
    OPPONENTS[gid] = (site === 'A' ? 'at ' : site === 'N' ? 'vs ' : '') + (opponent || 'opponent');
  }
}

function draw() {
  CACHE = new Map();
  $('side-offense').classList.toggle('on', SIDE === 'offense');
  $('side-defense').classList.toggle('on', SIDE === 'defense');
  const teamId = Number($('team').value);
  const { ok } = BAR.filter(teamId);
  buildOpponents(teamId);
  const team = BAR.games.teams[teamId] || [''];
  $('head').innerHTML = `<div class="report-head">${logo(team[2], 44)}
      <div><div class="eyebrow">CoachAnalytics &middot; ${PLAYS.season} &middot; ${R.title} &middot;
        ${SIDE === 'defense' ? 'defense (what opponents did)' : 'offense'}</div>
      <h1>${team[0]}</h1></div></div>`;
  $('strip').innerHTML = R.strip.map(([label, c]) => {
    const { mine, field } = cached(c.w, ok);
    let value, fieldValue;
    if (c.m === 'share_of') {                       // this slice as a share of the whole down
      const base = cached({ ...c.w, dist: undefined }, ok);
      value = base.mine.plays ? mine.plays / base.mine.plays : null;
      fieldValue = base.field.plays ? field.plays / base.field.plays : null;
    } else {
      value = measure(mine, c.m, c.w);
      fieldValue = measure(field, c.m, c.w);
    }
    const fmt = c.m === 'plays' || c.m === 'drives' || c.m === 'drive_tds' ? 'int'
      : c.m === 'epa' ? 'dec3' : c.m === 'ypp' ? 'dec2' : 'pct';
    const extra = c.m === 'success' || c.m === 'drive_td'
      ? `<div class="vs2">${FMT.int(measure(mine, c.m === 'success' ? 'plays' : 'drives', c.w))} ${c.m === 'success' ? 'plays' : 'drives'}</div>` : '';
    return `<div class="stat"><dt>${label}</dt><dd>${FMT[fmt](value)}</dd>
      <div class="vs">field ${FMT[fmt](fieldValue)}${extra ? ' · ' + extra.replace(/<[^>]+>/g, '') : ''}</div></div>`;
  }).join('');
  $('blocks').innerHTML = R.blocks.map(b =>
    b.type === 'drivetable' ? driveTable(b, ok)
    : b.type === 'drivelog' ? driveLog(b, ok)
    : b.kind === 'players' ? players(b, ok)
    : b.kind === 'results' ? table({ ...b, rows: RESULT_ROWS(b.where), columns: RESULT_COLUMNS }, ok)
    : table(b, ok)).join('');
  $('count').textContent = `${ok.size} team-games in filter`;
}

const RESULT_COLUMNS = [["Plays", "plays", "int"], ["Share", "share_of_down", "pct"],
                        ["Yards/play", "ypp", "dec2"], ["Success", "success", "pct"]];
const RESULT_ROWS = where => [
  ["Runs", { ...where, kind: 0 }], ["Dropbacks", { ...where, kind: 1 }],
  ["Short (1-3)", { ...where, dist: [1, 3] }], ["Medium (4-6)", { ...where, dist: [4, 6] }],
  ["Long (7-10)", { ...where, dist: [7, 10] }], ["Extra long (11+)", { ...where, dist: [11, 99] }],
];

async function load() {
  const season = $('season').value;
  const [plays, games] = await Promise.all([
    memberData(`situational/${season}.json`),
    fetch(`../data/stats/games/${season}.json`).then(r => r.json())]);
  PLAYS = plays;
  BAR.use(games);
  FIELD_TEAMS = PLAYS.teams.filter(t => games.teams[t]);
  FIELD_SET = new Set(FIELD_TEAMS);
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
$('snaps').onchange = draw;
document.querySelectorAll('[data-side]').forEach(b => b.onclick = () => {
  SIDE = b.dataset.side;
  const url = new URL(location.href);
  url.searchParams.set('side', SIDE);
  history.replaceState(null, '', url);
  draw();
});
const startSeason = remembered.get('season');
if (startSeason && [...$('season').options].some(o => o.value === startSeason)) $('season').value = startSeason;
load();
