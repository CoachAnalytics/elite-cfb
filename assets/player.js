
const id = new URLSearchParams(location.search).get('id');
const n = (v, d = 0) => v === null || v === undefined ? '' : Number(v).toFixed(d);
const p1 = v => v === null || v === undefined ? '' : (Number(v) * 100).toFixed(1) + '%';
const int = v => v === null || v === undefined ? '' : Number(v).toLocaleString();

const TABLES = [
  ['Passing', 'pass_attempts', [['Comp', 'pass_completions', int], ['Att', 'pass_attempts', int],
     ['Pct', 'pass_completion_pct', p1], ['Yards', 'pass_yards', int], ['Y/A', 'pass_yards_per_att', v => n(v, 2)],
     ['TD', 'pass_tds', int], ['INT', 'pass_ints', int], ['EPA/DB', 'adv_pass_epa_per_dropback', v => n(v, 3)],
     ['Air Yds/Att', 'adv_air_yards_per_att', v => n(v, 1)], ['Sacked', 'adv_sacks_taken', int]]],
  ['Rushing', 'rush_carries', [['Car', 'rush_carries', int], ['Yards', 'rush_yards', int],
     ['YPC', 'rush_yards_per_carry', v => n(v, 2)], ['TD', 'rush_tds', int], ['Long', 'rush_long', int],
     ['EPA/Car', 'adv_rush_epa_per_carry', v => n(v, 3)], ['Success', 'adv_rush_success_rate', p1]]],
  ['Receiving', 'adv_targets', [['Targets', 'adv_targets', int], ['Rec', 'rec_receptions', int],
     ['Yards', 'rec_yards', int], ['Y/R', 'rec_yards_per_rec', v => n(v, 1)], ['TD', 'rec_tds', int],
     ['Long', 'rec_long', int], ['Share', 'adv_target_share', p1], ['ADOT', 'adv_avg_depth_of_target', v => n(v, 1)],
     ['YAC', 'adv_yards_after_catch', int], ['EPA/Tgt', 'adv_rec_epa_per_target', v => n(v, 3)]]],
  ['Defense', 'def_tackles_total', [['Tkl', 'def_tackles_total', int], ['Solo', 'def_tackles_solo', int],
     ['TFL', 'def_tackles_for_loss', v => n(v, 1)], ['Sacks', 'def_sacks', v => n(v, 1)],
     ['Hurries', 'def_qb_hurries', int], ['INT', 'def_ints', int], ['PD', 'def_passes_defended', int],
     ['FF', 'adv_fumbles_forced', int]]],
  ['Kicking', 'kick_fg_att', [['FGM', 'kick_fg_made', int], ['FGA', 'kick_fg_att', int], ['Pct', 'kick_fg_pct', p1],
     ['Long', 'kick_long', int], ['XPM', 'kick_xp_made', int], ['XPA', 'kick_xp_att', int]]],
  ['Punting', 'punt_punts', [['Punts', 'punt_punts', int], ['Avg', 'punt_average', v => n(v, 1)],
     ['Inside 20', 'punt_inside_20', int]]],
  ['Returns', 'kr_returns', [['KR', 'kr_returns', int], ['KR Yds', 'kr_yards', int], ['PR', 'pr_returns', int],
     ['PR Yds', 'pr_yards', int], ['TD', null, s => (s.kr_tds || 0) + (s.pr_tds || 0)]]],
];

// Where a player stands, not just what he did: every headline number for his
// position ranked among the Power 4 and inside his own league.
const RANK_FMT = {
  int: v => Number(v).toLocaleString(),
  dec1: v => Number(v).toFixed(1),
  dec2: v => Number(v).toFixed(2),
  dec3: v => Number(v).toFixed(3),
  pct1: v => (Number(v) * 100).toFixed(1) + '%',
  pct3: v => (Number(v) * 100).toFixed(1) + '%',
};

const ordinal = n => {
  n = Math.round(n);
  const v = n % 100, s = ['th', 'st', 'nd', 'rd'];
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function rankPill(cell, of) {
  if (!cell) return '<td class="dim">&mdash;</td>';
  const [rank, pool] = cell;
  const share = pool > 1 ? 1 - (rank - 1) / (pool - 1) : 0.5;
  const band = share >= 0.85 ? 'top' : share >= 0.6 ? 'good' : share >= 0.3 ? 'mid' : 'low';
  const tie = Number.isInteger(rank) ? '' : 'T';
  return `<td class="rank-cell"><span class="pill ${band}">${tie}${ordinal(rank)}</span>
    <span class="of">of ${pool}</span></td>`;
}

function whereTheyRank(p) {
  if (!p.ranks || !RANK_STATS) return '';
  const seasons = Object.keys(p.ranks).sort((a, b) => b - a);
  if (!seasons.length) return '';
  const group = p.rank_group;
  const stats = RANK_STATS[group];
  if (!stats) return '';
  const blocks = seasons.map(season => {
    const cells = p.ranks[season];
    const rows = stats.filter(st => cells[st.key]).map(st => {
      const cell = cells[st.key];
      return `<tr><th class="name">${st.label}</th>
        <td class="v">${RANK_FMT[st.fmt](cell.value)}</td>
        ${rankPill(cell.p4)}
        ${rankPill(cell.conf)}</tr>`;
    }).join('');
    if (!rows) return '';
    const conference = Object.values(cells).map(c => c.conference).find(Boolean) || 'conference';
    return `<h3 class="minor">${season}</h3>
      <div class="table-wrap"><table class="ranks"><thead><tr><th class="name">Statistic</th>
        <th>Value</th><th>Power 4</th><th>${conference}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join('');
  if (!blocks) return '';
  return `<h2>Where they rank</h2>
    <div class="sub">Among every ${GROUP_LABEL[group] || 'player'} in the Power 4 with the volume to qualify,
      and among the same players in his own conference.</div>${blocks}`;
}

const GROUP_LABEL = { QB: 'quarterback', RB: 'running back', WR: 'receiver and tight end',
                      DEF: 'defender', K: 'kicker' };

function seasonTable([title, gate, cols], seasons) {
  const rows = seasons.filter(s => s[gate] || (title === 'Returns' && s.pr_returns));
  if (!rows.length) return '';
  const head = '<tr><th class="name">Season</th><th class="name">Team</th><th>G</th>' +
    cols.map(c => `<th>${c[0]}</th>`).join('') + '</tr>';
  const body = rows.map(s => `<tr><td class="name">${s.season}</td><td class="name">${s.school}</td>
      <td>${s.games}</td>${cols.map(c => `<td>${c[1] ? c[2](s[c[1]]) : c[2](s)}</td>`).join('')}</tr>`).join('');
  return `<h2>${title}</h2><div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

const ORDER = ['Passing', 'Rushing', 'Receiving', 'Defense', 'Kicking', 'Punting'];

function gameLog(games) {
  if (!games.length) return '';
  const seasons = [...new Set(games.map(g => g.season))].sort((a, b) => b - a);
  const blocks = seasons.map(season => {
    const rows = games.filter(g => g.season === season).map(g => `<tr>
        <td class="name">${g.season_type === 'postseason' ? 'Bowl/CFP' : 'Wk ' + g.week}</td>
        <td class="name">${g.neutral ? 'vs ' : g.home ? '' : 'at '}${g.opponent}</td>
        <td class="name">${g.us > g.them ? 'W' : 'L'} ${g.us}-${g.them}</td>
        <td class="name">${ORDER.filter(k => g.lines[k]).map(k => `<b>${k}</b> ${g.lines[k]}`).join(' &middot; ')}</td>
        <td><a href="../games/game.html?id=${g.game_id}">Game</a></td></tr>`).join('');
    return `<h3 class="minor">${season}</h3><table><tbody>${rows}</tbody></table>`;
  });
  return '<h2>Game log</h2>' + blocks.join('');
}

// The rest of the current team's schedule (data/players/upcoming.json, one list per team).
async function upcoming(p) {
  if (!p.current_team_id) return '';
  const all = await (await fetch('../data/players/upcoming.json')).json();
  const games = all.teams[p.current_team_id] || [];
  if (!games.length) return '';
  const when = g => {
    const d = g.start_date ? new Date(g.start_date) : null;
    const day = d ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBA';
    return day + (d && !g.start_time_tbd ? ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
  };
  const rows = games.map(g => `<tr>
      <td class="name">${g.week_label}</td>
      <td class="name">${g.site === 'away' ? 'at ' : g.site === 'neutral' ? 'vs ' : ''}${g.opponent}</td>
      <td class="name">${when(g)}${g.tv ? ' &middot; ' + g.tv : ''}</td>
      <td><a href="../games/game.html?id=${g.game_id}">Preview</a></td></tr>`).join('');
  return `<h2>Upcoming games</h2><div class="sub">${all.season} ${p.current_school}</div>
    <table><tbody>${rows}</tbody></table>`;
}

(async () => {
  const bucket = String(id).slice(-2).padStart(2, '0');
  const data = await (await fetch(`../data/players/bucket-${bucket}.json`)).json();
  const p = data[id];
  if (!p) { document.getElementById('player').innerHTML = '<p class="sub">Player not found.</p>'; return; }
  document.title = `${p.name} | CoachAnalytics`;
  const latest = p.seasons[0] || {};
  const bio = [p.position, p.jersey !== null ? '#' + p.jersey : '', latest.school,
    p.class_year ? ['', 'Freshman', 'Sophomore', 'Junior', 'Senior', 'Fifth year'][p.class_year] || '' : '',
    p.height ? Math.floor(p.height / 12) + "'" + (p.height % 12) + '"' : '', p.weight ? p.weight + ' lbs' : '',
    p.hometown].filter(Boolean).join(' &middot; ');
  const r = p.recruiting;
  const recruit = r ? `${'&#9733;'.repeat(r.stars || 0)} ${r.rating ? Number(r.rating).toFixed(4) : ''}` +
    `${r.ranking ? ' &middot; national #' + r.ranking : ''} &middot; class of ${r.year}` +
    `${r.school ? ' &middot; ' + r.school : ''}${r.committed_to ? ' &middot; signed with ' + r.committed_to : ''}` : '';
  // ESPN headshot by player id (CFBD ids are ESPN's); initials when there is none
  const initials = p.name.split(' ').filter(w => /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join('');
  const units = p.units.map(u => `<div class="unit"><div class="uval">&mdash;</div><div class="ulabel">${u}</div></div>`).join('');
  document.getElementById('player').innerHTML = `
    <div class="player-title">
      <div class="headshot"><span>${initials}</span>
        <img src="https://a.espncdn.com/i/headshots/college-football/players/full/${id}.png" alt=""
             onload="this.parentNode.classList.add('has-photo')" onerror="this.remove()"></div>
      <div><h1>${p.name}</h1>
      <div class="sub">${bio}</div>
      ${recruit ? `<div class="sub">Recruiting: ${recruit}</div>` : ''}</div></div>
    <h2>Ratings</h2><div class="units">${units}</div>
    <p class="note">Ratings are placeholders until the rating formula is set.</p>
    ${whereTheyRank(p)}
    ${TABLES.map(t => seasonTable(t, p.seasons)).join('')}
    ${await upcoming(p)}
    ${gameLog(p.games)}`;
})();
