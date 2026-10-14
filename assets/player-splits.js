
const $ = id => document.getElementById(id);
const q = new URLSearchParams(location.search);
let PLAYS = null;
const BAR = filterBar(() => draw());

const pct = v => v === null ? '—' : (v * 100).toFixed(1) + '%';
const dec = (v, d) => v === null ? '—' : Number(v).toFixed(d);
const per = (a, b) => b ? a / b : null;

const ROLES = {
  passing: {
    title: 'Passing', label: 'Dropbacks',
    columns: [['Dropbacks', a => a.n, v => v], ['Cmp/Att', a => a.cmp, (v, a) => `${a.cmp}/${a.att}`],
              ['Cmp%', a => per(a.cmp, a.att), pct], ['Yards', a => a.yards, v => v.toLocaleString()],
              ['Y/A', a => per(a.yards, a.att), v => dec(v, 2)],
              ['Success', a => per(a.success, a.n), pct],
              ['EPA/DB', a => per(a.epa, a.n), v => dec(v, 3)],
              ['Sacks', a => a.sacks, v => v], ['TD', a => a.td, v => v], ['INT', a => a.ints, v => v]],
  },
  rushing: {
    title: 'Rushing', label: 'Carries',
    columns: [['Carries', a => a.n, v => v], ['Yards', a => a.yards, v => v.toLocaleString()],
              ['YPC', a => per(a.yards, a.n), v => dec(v, 2)],
              ['Success', a => per(a.success, a.n), pct],
              ['Explosive', a => per(a.explosive, a.n), pct],
              ['Stuffed', a => per(a.stuffed, a.n), pct],
              ['EPA/carry', a => per(a.epa, a.n), v => dec(v, 3)], ['TD', a => a.td, v => v]],
  },
  receiving: {
    title: 'Receiving', label: 'Targets',
    columns: [['Targets', a => a.n, v => v], ['Catches', a => a.cmp, v => v],
              ['Catch%', a => per(a.cmp, a.n), pct], ['Yards', a => a.yards, v => v.toLocaleString()],
              ['Yds/target', a => per(a.yards, a.n), v => dec(v, 2)],
              ['Success', a => per(a.success, a.n), pct],
              ['Explosive', a => per(a.explosive, a.n), pct],
              ['EPA/target', a => per(a.epa, a.n), v => dec(v, 3)], ['TD', a => a.td, v => v]],
  },
};

const blank = () => ({ n: 0, yards: 0, epa: 0, success: 0, explosive: 0, stuffed: 0, td: 0, cmp: 0, att: 0,
                       ints: 0, sacks: 0 });

function keep(r, where) {
  const [, , , , down, dist, ytg, kind, yards, flags] = r;
  if ($('snaps').value === 'competitive' && (flags & 4)) return false;
  if ($('snaps').value === 'garbage' && !(flags & 4)) return false;
  if (where.down && !where.down.includes(down)) return false;
  if (where.dist && (dist < where.dist[0] || dist > where.dist[1])) return false;
  if (where.zone && (ytg < where.zone[0] || ytg > where.zone[1])) return false;
  const quarter = r[15], margin = r[16];
  if (where.quarters && !where.quarters.includes(quarter)) return false;
  if (where.half === 1 && quarter > 2) return false;
  if (where.half === 2 && (quarter < 3 || quarter === 0)) return false;
  if (where.state === 'lead' && margin <= 0) return false;
  if (where.state === 'behind' && margin > 0) return false;
  if (where.state === 'close' && Math.abs(margin) > 8) return false;
  return true;
}

// every split for one player, in a single pass per role
function gather(playerIdx, ok) {
  const out = { passing: SPLITS.map(blank), rushing: SPLITS.map(blank), receiving: SPLITS.map(blank) };
  const totals = { passing: 0, rushing: 0, receiving: 0 };
  for (const r of PLAYS.rows) {
    const [g, off, , , , , , kind, yards, flags, epa, passer, rusher, target, result] = r;
    if (kind === 2) continue;
    const team = PLAYS.teams[off];
    if (!ok.has(PLAYS.games[g] + '-' + team)) continue;
    const roles = [];
    if (passer === playerIdx) roles.push('passing');
    if (rusher === playerIdx) roles.push('rushing');
    if (target === playerIdx) roles.push('receiving');
    if (!roles.length) continue;
    SPLITS.forEach((split, i) => {
      if (!keep(r, split[1])) return;
      for (const role of roles) {
        const a = out[role][i];
        a.n += 1;
        a.yards += yards;
        a.epa += epa / 100;
        if (flags & 1) a.success += 1;
        if (flags & 2) a.explosive += 1;
        if (kind === 0 && yards <= 0) a.stuffed += 1;
        if (flags & 32) a.td += 1;
        if (result === 1) a.cmp += 1;
        if (result === 3) a.ints += 1;
        if (result === 4) a.sacks += 1;
        if (result && result !== 4) a.att += 1;
        if (i === 0) totals[role] += 1;
      }
    });
  }
  return { out, totals };
}

function table(role, rows) {
  const spec = ROLES[role];
  const head = '<tr><th class="name">Situation</th>' + spec.columns.map(c => `<th>${c[0]}</th>`).join('') + '</tr>';
  const body = SPLITS.map((split, i) => {
    const a = rows[i];
    if (!a.n) return '';
    return `<tr><th class="name">${split[0]}</th>` +
      spec.columns.map(c => `<td>${c[2](c[1](a), a)}</td>`).join('') + '</tr>';
  }).join('');
  return `<h2>${spec.title}</h2><div class="table-wrap"><table class="report">
    <thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

function draw() {
  const teamId = Number($('team').value);
  const idx = Number($('player').value);
  const { ok } = BAR.filter(teamId);
  if (Number.isNaN(idx) || idx < 0) { $('blocks').innerHTML = ''; return; }
  const { out, totals } = gather(idx, ok);
  const p = PLAYS.players[idx] || ['?', ''];
  const team = BAR.games.teams[teamId] || [''];
  $('head').innerHTML = `<div class="report-head">${logo(team[2], 40)}
    <div><div class="eyebrow">CoachAnalytics &middot; ${PLAYS.season} &middot; player splits</div>
    <h1>${p[0]}</h1><div class="sub">${p[1] || ''} &middot; ${team[0]}</div></div></div>`;
  const shown = ['passing', 'rushing', 'receiving'].filter(role => totals[role] > 0);
  $('blocks').innerHTML = shown.length
    ? shown.map(role => table(role, out[role])).join('')
    : '<p class="sub">No plays for this player in the games the filters select.</p>';
  $('count').textContent = `${ok.size} team-games in filter`;
}

// players of the chosen team, most involved first
function fillPlayers() {
  const teamId = Number($('team').value);
  const counts = new Map();
  for (const r of PLAYS.rows) {
    if (PLAYS.teams[r[1]] !== teamId || r[7] === 2) continue;
    for (const idx of [r[11], r[12], r[13]]) {
      if (idx >= 0) counts.set(idx, (counts.get(idx) || 0) + 1);
    }
  }
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const keepPlayer = $('player').value;
  $('player').innerHTML = list.map(([idx, n]) => {
    const p = PLAYS.players[idx] || ['?', ''];
    return `<option value="${idx}">${p[0]}${p[1] ? ' (' + p[1] + ')' : ''} &middot; ${n} plays</option>`;
  }).join('');
  if (keepPlayer && counts.has(Number(keepPlayer))) $('player').value = keepPlayer;
}

async function load() {
  const season = $('season').value;
  const [plays, games] = await Promise.all([
    memberData(`situational/${season}.json`),
    fetch(`../data/stats/games/${season}.json`).then(r => r.json())]);
  PLAYS = plays;
  BAR.use(games);
  const teams = Object.entries(games.teams).sort((a, b) => a[1][0].localeCompare(b[1][0]));
  const keepTeam = $('team').value || remembered.get('team');
  $('team').innerHTML = teams.map(([id, t]) => `<option value="${id}">${t[0]}</option>`).join('');
  if (keepTeam && games.teams[keepTeam]) $('team').value = keepTeam;
  remembered.set('team', $('team').value);
  fillPlayers();
  draw();
}
$('season').onchange = () => { remembered.set('season', $('season').value); load(); };
$('team').onchange = () => { remembered.set('team', $('team').value); fillPlayers(); draw(); };
$('player').onchange = draw;
$('snaps').onchange = draw;
const startSeason = remembered.get('season');
if (startSeason && [...$('season').options].some(o => o.value === startSeason)) $('season').value = startSeason;
load();
