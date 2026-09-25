
const q = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);
const ordinal = n => n + (['th','st','nd','rd'][(n % 100 - 20) % 10] || ['th','st','nd','rd'][n % 100] || 'th');
const whole = v => Number.isInteger(v) ? v.toLocaleString() : Number(v).toFixed(1);
let T = null, STATS = null;
const allConf = listSummary('conference', 'conferences');
const BAR = filterBar(() => draw(), (sel, options) => {
  const s = allConf(sel, options);
  return 'Rank among ' + (/^(All|No) /.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
});
const SITU = situationBar(() => drawCube());


// ---- what this team does by down and field position, from the cube
const CUBE_ROWS = [['', 'Anywhere on the field'], ...CUBE_DOWNS.map(() => null)].filter(Boolean);

async function drawCube() {
  const box = $('cube-block');
  try {
    await CUBE.load(T.season, '../');
  } catch (err) {
    box.innerHTML = '<p class="sub">Could not read the situational data.</p>';
    return;
  }
  const { ok } = BAR.filter(T.team_id);
  const choice = SITU.get();
  const zones = CUBE.data.zones.filter(([key]) => !choice.zone || key === choice.zone);
  const sides = [[0, 'Offense'], [1, 'Defense']];
  const columns = CUBE_COLUMNS.filter(c => c[0] !== 'Yards' && c[0] !== 'Touchdowns'
                                        && c[0] !== 'Turnovers');

  box.innerHTML = sides.map(([side, label]) => {
    const totals = CUBE.totals({ ok, side, downs: choice.downs, zone: '', snaps: choice.snaps });
    const rows = [['', 'Anywhere on the field'], ...zones].map(([zoneKey, zoneLabel]) => {
      // one pass per row: the team's own numbers and the pool it is ranked in
      // both follow the filters above, the way the season stats do
      const perTeam = zoneKey
        ? CUBE.totals({ ok, side, downs: choice.downs, zone: zoneKey, snaps: choice.snaps })
        : totals;
      const mine = perTeam.get(T.team_id);
      if (!mine || !mine.plays) {
        return `<tr><th class="name">${zoneLabel}</th>` +
          columns.map(() => '<td>&mdash;</td>').join('') + '</tr>';
      }
      return `<tr><th class="name">${zoneLabel}</th>` + columns.map(c => {
        const value = c[1](mine);
        if (value === null) return '<td>&mdash;</td>';
        // rank this team among the 68 in the same cell
        let rank = null;
        if (c[3]) {
          const all = [...perTeam.values()].filter(a => a.plays >= 10).map(c[1])
            .filter(v => v !== null);
          const better = (side === 1) === (c[3] === 'high') ? (v => v < value) : (v => v > value);
          rank = all.length >= 20 ? 1 + all.filter(better).length : null;
        }
        return `<td>${c[2](value)}${rank ? `<span class="rankcol"> ${ordinal(rank)}</span>` : ''}</td>`;
      }).join('') + '</tr>';
    }).join('');
    return `<h3 class="minor">${label}${SITU.describe() ? ' &middot; ' + SITU.describe() : ''}</h3>
      <div class="table-wrap"><table><thead><tr><th class="name">Field position</th>` +
      columns.map(c => `<th>${c[0]}</th>`).join('') + `</tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
}

async function load() {
  const season = q.get('season'), id = q.get('id');
  const res = await fetch(`../data/teams/${season}/${id}.json`);
  if (!res.ok) { $('team-head').innerHTML = '<p class="sub">Team not found.</p>'; return; }
  let games;
  [T, STATS, games] = await Promise.all([res.json(),
    fetch(`../data/teams/${season}/stats.json`).then(r => r.json()),
    fetch(`../data/stats/games/${season}.json`).then(r => r.json())]);
  document.title = `${T.school} ${T.season} | CoachAnalytics`;
  $('season').innerHTML = T.seasons.map(s => `<option value="${s}" ${s === T.season ? 'selected' : ''}>${s}</option>`).join('');
  $('season').onchange = () => { location.search = `?id=${T.team_id}&season=${$('season').value}`; };
  const ext = T.external_ratings.map(r => `${r.system.toUpperCase()} ${r.rating === null ? '' : Number(r.rating).toFixed(1)}` +
      (r.ranking ? ` (#${r.ranking})` : '')).join(' &middot; ');
  $('team-head').innerHTML = `
    <div class="team-title">${logo(T.logo, 72)}<div><h1>${T.school} ${T.mascot || ''}</h1>
    <div class="sub">${T.season} &middot; ${T.conference || ''} &middot; ${T.record} (${T.conference_record} conf)
      &middot; ${T.points_for}&ndash;${T.points_against}${ext ? ' &middot; ' + ext : ''}
      ${T.recruiting_rank ? ' &middot; recruiting class #' + T.recruiting_rank : ''}</div></div></div>`;
  $('units').innerHTML = T.units.map(u => `<div class="unit ${u.rank && u.rank <= 10 ? 'top' : ''}">
      <div class="uval">${u.rank ? '#' + u.rank : '&mdash;'}</div>
      <div class="ulabel">${u.label}</div>
      <div class="uavg">${u.avg !== null ? 'avg stat rank ' + Number(u.avg).toFixed(1) : ''}</div></div>`).join('');
  $('unit-parts').innerHTML = T.units.map(u => `<div><h3 class="minor">${u.label} ${u.rank ? '&middot; #' + u.rank : ''}</h3>
      <table><tbody>${u.stats.map(s => `<tr><td class="name">${s.label}</td><td>${fmt[s.format](s.value)}</td>
      <td class="rankcol">${s.rank ? ordinal(s.rank) + ' of ' + u.of : ''}</td></tr>`).join('')}</tbody></table></div>`).join('');
  BAR.use(games);
  draw();
}

function draw() {
  drawCube();
  const { ok, teamGames } = BAR.filter(T.team_id);
  const { groups, ctx } = aggregate(STATS.rows, STATS.fields, ok, 2, row => row[1]);
  const mine = groups[T.team_id];
  const n = teamGames[T.team_id] || 0;
  $('in-filter').innerHTML = mine
    ? `Selected games: <b>${n}</b> &middot; record <b>${evaluate({ record: true }, mine, ctx)}</b> &middot; points
       <b>${mine.sum.points_for || 0}&ndash;${mine.sum.points_against || 0}</b>`
    : 'No games match these filters.';

  // each stat, ranked among the teams the filters keep
  const sections = {};
  STATS.stats.forEach(s => {
    const values = Object.values(groups).map(acc => evaluate(s.spec, acc, ctx)).filter(v => v !== null && v !== undefined);
    const v = mine ? evaluate(s.spec, mine, ctx) : null;
    const rank = v === null || v === undefined ? null : 1 + values.filter(x => s.better ? x > v : x < v).length;
    (sections[s.section] = sections[s.section] || []).push({ ...s, value: v, rank, of: values.length });
  });
  $('stats').innerHTML = Object.entries(sections).map(([name, list]) => `<div><h3 class="minor">${name}</h3>
      <table><tbody>${list.map(s => `<tr><td class="name">${s.label}</td><td>${fmt[s.format](s.value)}</td>
      <td class="rankcol">${s.rank ? ordinal(s.rank) + ' of ' + s.of : ''}</td></tr>`).join('')}</tbody></table></div>`).join('');

  // schedule: games outside the filter are dimmed; games to come show kickoff, TV and the opponent's record
  const kickoff = g => {
    const d = g.start_date ? new Date(g.start_date) : null;
    const day = d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBA';
    const time = d && !g.start_time_tbd ? ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
    return [day + time, g.tv, g.opponent_record ? 'opp ' + g.opponent_record : ''].filter(Boolean).join(' &middot; ');
  };
  $('schedule').innerHTML = `<thead><tr><th class="name">Week</th><th class="name">Opponent</th><th class="name">Result</th>
      <th>Score</th><th class="name"></th><th></th></tr></thead><tbody>` + T.schedule.map(g => `<tr class="${g.completed && !ok.has(g.game_id + '-' + T.team_id) ? 'out' : ''}">
      <td class="name">${g.week_label}</td>
      <td class="name">${g.site === 'away' ? 'at ' : g.site === 'neutral' ? 'vs ' : ''}${logo(g.opponent_logo)}${g.opponent_elite
        ? `<a href="team.html?id=${g.opponent_id}&season=${T.season}">${g.opponent}</a>` : g.opponent + ' <span class="tag">non-P4</span>'}</td>
      ${g.completed ? `<td class="name">${g.result || ''}</td><td>${g.score || ''}</td>`
        : `<td class="name upcoming" colspan="2">${kickoff(g)}</td>`}
      <td class="name">${g.conference_game ? 'Conf' : ''}</td>
      <td><a href="../games/game.html?id=${g.game_id}">${g.completed ? 'Game' : 'Preview'}</a></td></tr>`).join('') + '</tbody>';

  // full player charts over the selected games, three columns
  const P = T.players;
  const { groups: players, ctx: pctx } = aggregate(P.rows, P.fields, ok, 3, row => row[2]);
  const chart = t => {
    const rows = Object.entries(players)
      .filter(([, acc]) => t.need.some(f => (acc.sum[f] || 0) > 0))
      .map(([pid, acc]) => ({ pid, acc, values: t.columns.map(c => evaluate(c.spec, acc, pctx)) }));
    if (!rows.length) return '';
    sortBy(rows, r => (r.acc.sum[t.sort] ?? r.acc.max[t.sort] ?? 0), true);
    const head = '<tr><th class="name">Player</th>' + t.columns.map(c => `<th>${c.label}</th>`).join('') + '</tr>';
    const body = rows.map(r => `<tr>
        <td class="name"><a href="../players/player.html?id=${r.pid}">${P.names[r.pid] || '?'}</a></td>
        ${r.values.map((v, i) => `<td>${fmt[t.columns[i].format](v)}</td>`).join('')}</tr>`).join('');
    return `<div class="chart"><h3 class="minor">${t.title}</h3>
        <div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;
  };
  const columns = [1, 2, 3].map(n => T.tables.filter(t => t.column === n).map(chart).join(''));
  $('charts').innerHTML = columns.every(c => !c)
    ? '<p class="sub">No player stats in these games.</p>'
    : columns.map(c => `<div class="chart-col">${c}</div>`).join('');
}
load();
