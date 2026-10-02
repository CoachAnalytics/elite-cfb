
const $ = id => document.getElementById(id);
let DATA = null, sortCol = null, sortAsc = false;
const BAR = filterBar(() => draw());
const DOWNS = multi('down', listSummary('down', 'downs'), () => { sortCol = null; draw(); });
DOWNS.fill([['1', '1st down'], ['2', '2nd down'], ['3', '3rd down'], ['4', '4th down']], null);

// what each mode measures; every column is built from the filtered plays
const num = (v, d) => v === null || v === undefined ? '' : Number(v).toFixed(d);
const rate = v => v === null ? '' : (v * 100).toFixed(1) + '%';
const per = (a, b) => b ? a / b : null;

const MODES = {
  team_offense: {
    label: 'Team offense', who: r => r[1], min: 20, minLabel: 'plays',
    columns: [
      ['Plays', a => a.n, v => v],
      ['Yards', a => a.yards, v => v.toLocaleString()],
      ['Yds/play', a => per(a.yards, a.n), v => num(v, 2)],
      ['Success', a => per(a.success, a.n), rate],
      ['EPA/play', a => per(a.epa, a.n) === null ? null : per(a.epa, a.n) / 100, v => num(v, 3)],
      ['Explosive', a => per(a.explosive, a.n), rate],
      ['Negative', a => per(a.negative, a.n), rate],
      ['Run share', a => per(a.runs, a.n), rate],
      ['TD', a => a.td, v => v],
      ['Turnovers', a => a.turnovers, v => v],
    ],
    sort: 4,
  },
  team_defense: {
    label: 'Team defense', who: r => r[2], min: 20, minLabel: 'plays', defense: true,
    columns: [
      ['Plays', a => a.n, v => v],
      ['Yards', a => a.yards, v => v.toLocaleString()],
      ['Yds/play', a => per(a.yards, a.n), v => num(v, 2)],
      ['Success', a => per(a.success, a.n), rate],
      ['EPA/play', a => per(a.epa, a.n) === null ? null : per(a.epa, a.n) / 100, v => num(v, 3)],
      ['Explosive', a => per(a.explosive, a.n), rate],
      ['Negative', a => per(a.negative, a.n), rate],
      ['Sacks', a => a.sacks, v => v],
      ['TD', a => a.td, v => v],
      ['Takeaways', a => a.turnovers, v => v],
    ],
    sort: 4, asc: true,
  },
  passing: {
    label: 'Passing', player: r => r[11], min: 15, minLabel: 'dropbacks',
    columns: [
      ['Dropbacks', a => a.n, v => v],
      ['Cmp/Att', a => a.complete, (v, a) => `${a.complete}/${a.attempts}`],
      ['Cmp%', a => per(a.complete, a.attempts), rate],
      ['Yards', a => a.yards, v => v.toLocaleString()],
      ['Y/A', a => per(a.yards, a.attempts), v => num(v, 2)],
      ['Success', a => per(a.success, a.n), rate],
      ['EPA/DB', a => per(a.epa, a.n) === null ? null : per(a.epa, a.n) / 100, v => num(v, 3)],
      ['Sack%', a => per(a.sacks, a.n), rate],
      ['INT', a => a.ints, v => v],
      ['TD', a => a.td, v => v],
    ],
    sort: 6,
  },
  rushing: {
    label: 'Rushing', player: r => r[12], min: 10, minLabel: 'carries',
    columns: [
      ['Carries', a => a.n, v => v],
      ['Yards', a => a.yards, v => v.toLocaleString()],
      ['YPC', a => per(a.yards, a.n), v => num(v, 2)],
      ['Success', a => per(a.success, a.n), rate],
      ['Explosive', a => per(a.explosive, a.n), rate],
      ['Stuffed', a => per(a.negative, a.n), rate],
      ['EPA/carry', a => per(a.epa, a.n) === null ? null : per(a.epa, a.n) / 100, v => num(v, 3)],
      ['TD', a => a.td, v => v],
    ],
    sort: 6,
  },
  receiving: {
    label: 'Receiving', player: r => r[13], min: 8, minLabel: 'targets',
    columns: [
      ['Targets', a => a.n, v => v],
      ['Catches', a => a.complete, v => v],
      ['Catch%', a => per(a.complete, a.n), rate],
      ['Yards', a => a.yards, v => v.toLocaleString()],
      ['Yds/target', a => per(a.yards, a.n), v => num(v, 2)],
      ['Success', a => per(a.success, a.n), rate],
      ['Explosive', a => per(a.explosive, a.n), rate],
      ['EPA/target', a => per(a.epa, a.n) === null ? null : per(a.epa, a.n) / 100, v => num(v, 3)],
      ['TD', a => a.td, v => v],
    ],
    sort: 7,
  },
};

async function loadSeason() {
  const season = $('season').value;
  const [data, games] = await Promise.all([
    memberData(`situational/${season}.json`),
    fetch(`${window.GAMES_ROOT}/${season}.json`).then(r => r.json())]);
  DATA = data;
  BAR.use(games);
  sortCol = null;
  draw();
}

function playFilter() {
  const zone = $('zone').value, dist = $('dist').value, kind = $('kind').value, snaps = $('snaps').value;
  // rows are [game, off, def, drive, down, dist, ytg, kind, yards, flags, epa, ...]
  const z = zone ? ZONES[zone] : null, d = dist ? DISTS[dist] : null;
  const downs = DOWNS.all() ? null : new Set(DOWNS.selected().map(Number));
  return r => {
    const flags = r[9];
    if (r[7] === 2) return false;                       // an accepted penalty, not a snap
    if (snaps === 'competitive' && (flags & 4)) return false;
    if (snaps === 'garbage' && !(flags & 4)) return false;
    if (z && (r[6] < z[0] || r[6] > z[1])) return false;
    if (downs && !downs.has(r[4])) return false;
    if (d && (r[5] < d[0] || r[5] > d[1])) return false;
    if (kind === 'run' && r[7] !== 0) return false;
    if (kind === 'pass' && r[7] !== 1) return false;
    return true;
  };
}

function blank(team) {
  return { team, n: 0, yards: 0, epa: 0, success: 0, explosive: 0, negative: 0, runs: 0, td: 0,
           turnovers: 0, sacks: 0, complete: 0, attempts: 0, ints: 0 };
}

function draw() {
  const mode = MODES[$('mode').value];
  const { ok } = BAR.filter();
  const keep = playFilter();
  const groups = {};
  for (const r of DATA.rows) {
    const teamIdx = mode.defense ? r[2] : r[1];
    const teamId = DATA.teams[teamIdx];
    if (!ok.has(DATA.games[r[0]] + '-' + teamId)) continue;
    if (!keep(r)) continue;
    let who;
    if (mode.player) {
      who = mode.player(r);
      if (who < 0) continue;
      // a receiver's play is the target; a passer's is the dropback, sacks included
      if (mode === MODES.rushing && r[7] !== 0) continue;
    } else {
      who = teamIdx;
    }
    const acc = groups[who] = groups[who] || blank(teamId);
    const flags = r[9], sack = flags & 8, pass = r[7] === 1;
    acc.n += 1;
    acc.yards += r[8];
    acc.epa += r[10];
    if (flags & 1) acc.success += 1;
    if (flags & 2) acc.explosive += 1;
    if ((!pass && r[8] <= 0) || sack) acc.negative += 1;
    if (!pass) acc.runs += 1;
    if (flags & 32) acc.td += 1;
    if (flags & 16) acc.turnovers += 1;
    if (sack) acc.sacks += 1;
    if (r[14] === 1) acc.complete += 1;
    if (r[14] === 3) acc.ints += 1;
    if (r[14] && r[14] !== 4) acc.attempts += 1;
  }

  // the qualifying minimum follows how narrow the situation is: about half of
  // what a typical team or player got in it, capped by the board's own default
  const all = Object.values(groups);
  let plays = 0;
  for (const a of all) plays += a.n;
  const typical = all.length ? plays / all.length : 0;
  const minimum = Number($('min').value) || Math.max(3, Math.min(mode.min, Math.round(typical / 2)));
  let rows = Object.entries(groups)
    .filter(([, a]) => a.n >= minimum)
    .map(([who, acc]) => ({ who: Number(who), acc, values: mode.columns.map(c => c[1](acc)) }));
  const col = sortCol === null ? mode.sort : sortCol;
  const desc = sortCol === null ? !mode.asc : !sortAsc;
  sortBy(rows, r => r.values[col], desc);
  rows = rows.slice(0, 300);

  const GAMES = BAR.games;
  const nameOf = r => {
    if (!mode.player) {
      const t = GAMES.teams[r.acc.team] || [''];
      return `<td class="name">${logo(t[2], 20)}<a href="../teams/team.html?id=${r.acc.team}&season=${DATA.season}">${t[0]}</a></td>
              <td class="name">${t[1] || ''}</td>`;
    }
    const p = DATA.players[r.who] || ['?', ''];
    const t = GAMES.teams[r.acc.team] || [''];
    return `<td class="name"><a href="../players/player.html?id=${DATA.playerIds[r.who]}">${p[0]}</a></td>
            <td class="name">${p[1] || ''}</td><td class="name">${logo(t[2])}${t[0]}</td>`;
  };
  const head = '<tr><th class="rank">#</th>' +
    (mode.player ? '<th class="name">Player</th><th class="name">Pos</th><th class="name">Team</th>'
                 : '<th class="name">Team</th><th class="name">Conf</th>') +
    mode.columns.map((c, i) => `<th data-i="${i}" class="${(sortCol === i) ? 'sorted ' + (sortAsc ? 'asc' : '') : ''}">${c[0]}</th>`).join('') + '</tr>';
  const body = rows.map((r, i) => `<tr><td class="rank">${i + 1}</td>${nameOf(r)}` +
    r.values.map((v, j) => `<td>${v === null || v === undefined ? '' : mode.columns[j][2](v, r.acc)}</td>`).join('') +
    '</tr>').join('');
  $('board').innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  $('board').querySelectorAll('th[data-i]').forEach(th => th.onclick = () => {
    const i = Number(th.dataset.i);
    if (sortCol === i) sortAsc = !sortAsc; else { sortCol = i; sortAsc = false; }
    draw();
  });
  $('count').textContent = `${rows.length} ${mode.player ? 'players' : 'teams'} · ${plays.toLocaleString()} plays in filter · minimum ${minimum} ${mode.minLabel}`;
  $('min').placeholder = minimum;
}

['mode', 'zone', 'dist', 'kind', 'snaps'].forEach(id => $(id).onchange = () => { sortCol = null; draw(); });
$('min').oninput = () => draw();
$('season').onchange = loadSeason;
loadSeason();
