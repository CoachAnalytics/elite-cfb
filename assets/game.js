
const id = new URLSearchParams(location.search).get('id');
const num = (v, d = 0) => v === null || v === undefined ? '' : Number(v).toFixed(d);
const pct = v => v === null || v === undefined ? '' : (Number(v) * 100).toFixed(1) + '%';
const clock = v => v === null || v === undefined ? '' :
  Math.floor(v / 60) + ':' + String(Math.round(v % 60)).padStart(2, '0');

function row(label, home, away, fmt = num) {
  return `<tr><td>${fmt(away)}</td><th class="name">${label}</th><td>${fmt(home)}</td></tr>`;
}

// "18/24" style rows, where a made-of-attempts pair belongs together
function pairRow(label, hMade, hAtt, aMade, aAtt) {
  const show = (m, a) => (m === null || m === undefined) ? '' : `${m}/${a ?? ''}`;
  return `<tr><td>${show(aMade, aAtt)}</td><th class="name">${label}</th><td>${show(hMade, hAtt)}</td></tr>`;
}

function statsTable(g) {
  const h = g.home_stats || {}, a = g.away_stats || {};
  const eff_h = g.home_efficiency || {}, eff_a = g.away_efficiency || {};
  const rows = [
    row('Points', g.home_points, g.away_points),
    row('Total yards', h.total_yards, a.total_yards),
    row('Plays', eff_h.off_plays, eff_a.off_plays),
    row('Yards per play', h.yards_per_play, a.yards_per_play, v => num(v, 2)),
    row('Rushing yards', h.rushing_yards, a.rushing_yards),
    row('Rushing attempts', h.rush_attempts, a.rush_attempts),
    row('Passing yards', h.net_passing_yards, a.net_passing_yards),
    pairRow('Comp / Att', h.completions, h.pass_attempts, a.completions, a.pass_attempts),
    row('First downs', h.first_downs, a.first_downs),
    pairRow('3rd down', h.third_down_conv, h.third_down_att, a.third_down_conv, a.third_down_att),
    pairRow('4th down', h.fourth_down_conv, h.fourth_down_att, a.fourth_down_conv, a.fourth_down_att),
    row('Turnovers', h.turnovers, a.turnovers),
    row('Penalties', h.penalties, a.penalties),
    row('Penalty yards', h.penalty_yards, a.penalty_yards),
    row('Sacks', h.sacks, a.sacks, v => num(v, 1)),
    row('Time of possession', h.possession_seconds, a.possession_seconds, clock),
    row('EPA per play', eff_h.off_epa_per_play, eff_a.off_epa_per_play, v => num(v, 3)),
    row('Success rate', eff_h.off_success_rate, eff_a.off_success_rate, pct),
    row('Explosive plays', eff_h.off_explosive_rushes + eff_h.off_explosive_passes,
        eff_a.off_explosive_rushes + eff_a.off_explosive_passes),
    row('Points per drive', eff_h.off_points_per_drive, eff_a.off_points_per_drive, v => num(v, 2)),
    pairRow('Red zone TD / trips', eff_h.off_rz_tds, eff_h.off_rz_trips, eff_a.off_rz_tds, eff_a.off_rz_trips),
  ];
  return `<table class="compare"><thead><tr><th>${g.away_school}</th><th class="name"></th>
      <th>${g.home_school}</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

function drives(g) {
  if (!g.drives || !g.drives.length) return '';
  const body = g.drives.map(d => `<tr>
      <td class="name">${d.offense}</td><td>${d.plays}</td><td>${d.yards}</td>
      <td>${clock(d.elapsed_seconds)}</td><td class="name">${d.result || ''}</td><td>${d.points || 0}</td>
    </tr>`).join('');
  return `<h2>Drives</h2><table><thead><tr><th class="name">Offense</th><th>Plays</th><th>Yards</th>
      <th>Time</th><th class="name">Result</th><th>Points</th></tr></thead><tbody>${body}</tbody></table>`;
}

function leaders(g) {
  if (!g.leaders || !g.leaders.length) return '';
  const groups = {};
  g.leaders.forEach(l => { (groups[l.category] = groups[l.category] || []).push(l); });
  return '<h2>Top performers</h2>' + Object.entries(groups).map(([cat, list]) => `
    <h3 class="minor">${cat}</h3>
    <table><tbody>${list.map(l => `<tr><td class="name">${l.name}</td>
      <td class="name">${l.school}</td><td class="name">${l.line}</td></tr>`).join('')}</tbody></table>`).join('');
}

// The line, where it is played and what the sky is doing: the three things
// asked before kickoff, under the title rather than buried in a sentence.
function odds(g) {
  const cells = [];
  const ml = v => v === null || v === undefined ? '' : (v > 0 ? '+' + v : String(v));
  if (g.spread !== null && g.spread !== undefined) {
    // the feed writes the spread from the home team's side
    const favourite = g.spread < 0 ? g.home_school : g.away_school;
    cells.push(['Line', `${favourite} ${g.spread < 0 ? '' : '-'}${g.spread < 0 ? g.spread : g.spread}`
      .replace('--', '-')]);
  }
  if (g.over_under) cells.push(['Over / under', String(g.over_under)]);
  if (g.home_moneyline || g.away_moneyline) {
    cells.push(['Moneyline', `${g.away_school} ${ml(g.away_moneyline)} &middot; ${g.home_school} ${ml(g.home_moneyline)}`]);
  }
  if (cells.length && g.book) cells.push(['Book', g.book + (g.books.length > 1 ? ` (+${g.books.length - 1})` : '')]);

  const where = [];
  if (g.venue) where.push(g.venue);
  if (g.venue_city) where.push(g.venue_city);
  if (g.neutral_site) where.push('neutral site');
  if (where.length) cells.push(['Where', where.join(', ')]);
  const ground = [];
  if (g.venue_dome !== null && g.venue_dome !== undefined) ground.push(g.venue_dome ? 'Indoors' : 'Outdoors');
  if (g.venue_grass !== null && g.venue_grass !== undefined) ground.push(g.venue_grass ? 'grass' : 'turf');
  if (g.venue_capacity) ground.push(g.venue_capacity.toLocaleString() + ' seats');
  if (ground.length) cells.push(['Stadium', ground.join(', ')]);

  const w = g.weather;
  if (w && (w.temperature_f !== null || w.condition)) {
    const bits = [];
    if (w.temperature_f !== null) bits.push(`${Math.round(w.temperature_f)}&deg;F`);
    if (w.condition) bits.push(w.condition.toLowerCase());
    if (w.wind_speed_mph) bits.push(`wind ${Math.round(w.wind_speed_mph)} mph`);
    if (w.precipitation_in) bits.push(`${w.precipitation_in}" rain`);
    if (w.indoors) bits.push('indoors');
    cells.push([g.completed ? 'Weather' : 'Forecast', bits.join(', ')]);
  }
  if (!cells.length) return '';
  return `<div class="slip">${cells.map(([k, v]) =>
    `<div class="slip-cell"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}</div>`;
}

function context(g) {
  const bits = [];
  // some venue names already carry the city ("Memorial Stadium (Bloomington, IN)")
  if (g.venue) bits.push(g.venue + (g.venue_city && !g.venue.includes(g.venue_city) ? `, ${g.venue_city}` : ''));
  if (g.attendance) bits.push(`${g.attendance.toLocaleString()} attendance`);
  if (g.weather && g.weather.temperature_f !== null)
    bits.push(`${Math.round(g.weather.temperature_f)}&deg;F${g.weather.condition ? ', ' + g.weather.condition : ''}` +
              (g.weather.wind_speed_mph ? `, wind ${Math.round(g.weather.wind_speed_mph)} mph` : '') +
              (g.weather.indoors ? ' (indoors)' : ''));
  if (g.spread !== null && g.spread !== undefined)
    bits.push(`Line ${g.spread > 0 ? g.away_school + ' -' + g.spread : g.home_school + ' -' + Math.abs(g.spread)}` +
              (g.over_under ? `, total ${g.over_under}` : ''));
  if (g.tv) bits.push(g.tv);
  return bits.join(' &middot; ');
}

function fmtKickoff(iso, tbd) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return tbd ? day + ' (time TBA)' : `${day}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}
const ord = n => n + (['th','st','nd','rd'][(n % 100 - 20) % 10] || ['th','st','nd','rd'][n % 100] || 'th');
const logoImg = (url, size) => url
  ? `<img class="logo" src="${url.includes('://') ? url : (window.CA_UP || '') + url}" alt=""
      width="${size}" height="${size}" loading="lazy">` : '';

// Before kickoff: each team's season so far, side by side, with its rank among elite teams.
function preview(g) {
  const m = g.matchup;
  const fmtv = (v, f) => v === null || v === undefined ? '&ndash;' :
    f === 'pct' ? pct(v) : f === 'dec3' ? num(v, 3) : f === 'dec2' ? num(v, 2) : f === 'dec1' ? num(v, 1) : num(v);
  const cell = (side, i, f) => {
    const t = m[side];
    if (!t) return '<td class="dim">&ndash;</td>';
    return `<td>${fmtv(t.values[i], f)}${t.ranks[i] ? ` <span class="rk-small">${ord(t.ranks[i])}</span>` : ''}</td>`;
  };
  const rows = m.labels.map(([label, f], i) => `<tr>${cell('away', i, f)}<th class="name">${label}</th>${cell('home', i, f)}</tr>`);
  return `<div id="old-compare"><h2>Matchup</h2>
    <table class="compare"><thead><tr><th>${g.away_school}${m.away ? ' (' + m.away.record + ')' : ''}</th><th class="name"></th>
      <th>${g.home_school}${m.home ? ' (' + m.home.record + ')' : ''}</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    <p class="note">Season to date, all games. Small numbers are ranks among the ${m.of} elite teams.
      Efficiency stats leave out garbage time.</p>
    </div>`;
}

// What each side has done so far. It reads as background rather than as the
// comparison, so it sits at the foot of the page.
function soFar(g) {
  const m = g.matchup;
  if (!m) return '';
  const results = side => {
    const t = m[side];
    if (!t) return `<p class="note">Not a Power 4 team, so no season stats are kept.</p>`;
    if (!t.results.length) return '<p class="note">No games played yet.</p>';
    return `<table><tbody>${t.results.map(r => `<tr><td class="name">${r.week_label}</td>
      <td class="name">${r.site === 'away' ? 'at ' : r.site === 'neutral' ? 'vs ' : ''}${r.opponent}</td>
      <td class="name">${r.result}</td><td>${r.score}</td>
      <td><a href="game.html?id=${r.game_id}">Game</a></td></tr>`).join('')}</tbody></table>`;
  };
  return `<h2>So far</h2>
    <div class="stat-grid"><div><h3 class="minor">${g.away_school}</h3>${results('away')}</div>
      <div><h3 class="minor">${g.home_school}</h3>${results('home')}</div></div>`;
}

async function load() {
  const res = await fetch(`../data/games/detail/${id}.json`);
  if (!res.ok) { document.getElementById('game').innerHTML = '<p class="sub">Game not found.</p>'; return; }
  const g = await res.json();
  document.title = `${g.away_school} at ${g.home_school} | CoachAnalytics`;
  const q = (ls) => (ls || []).map(p => `<td>${p}</td>`).join('');
  if (!g.completed) {
    document.getElementById('game').innerHTML = `
      <div class="game-title">${logoImg(g.away_logo, 56)}<h1>${g.away_school} at ${g.home_school}</h1>${logoImg(g.home_logo, 56)}</div>
      <div class="sub">${g.season} ${g.season_type === 'postseason' ? 'postseason' : 'week ' + g.week} &middot; Upcoming
        &middot; ${fmtKickoff(g.start_date, g.start_time_tbd)}${g.tv ? ' &middot; ' + g.tv : ''}</div>
      ${odds(g)}
      ${preview(g)}
      <div id="season-matchup"></div>
      ${soFar(g)}`;
    gameMatchup(document.getElementById('season-matchup'), g, '../').then(drew => {
      // the fuller block covers the same ground, so only one of them shows
      const old = document.getElementById('old-compare');
      if (drew && old) old.hidden = true;
    });
    return;
  }
  document.getElementById('game').innerHTML = `
    <div class="game-title">${logoImg(g.away_logo, 56)}<h1>${g.away_school} ${g.away_points ?? ''} at ${g.home_school} ${g.home_points ?? ''}</h1>${logoImg(g.home_logo, 56)}</div>
    <div class="sub">${g.season} ${g.season_type === 'postseason' ? 'postseason' : 'week ' + g.week}
      &middot; ${context(g)}</div>
    ${odds(g)}
    <div class="rating">Team ratings: &mdash; (formula pending)</div>
    <h2>Scoring by quarter</h2>
    <table class="quarters"><thead><tr><th class="name"></th><th>1</th><th>2</th><th>3</th><th>4</th>
      ${(g.home_line_scores || []).length > 4 ? '<th>OT</th>' : ''}<th>Final</th></tr></thead>
      <tbody>
        <tr><th class="name">${g.away_school}</th>${q(g.away_line_scores)}<td>${g.away_points ?? ''}</td></tr>
        <tr><th class="name">${g.home_school}</th>${q(g.home_line_scores)}<td>${g.home_points ?? ''}</td></tr>
      </tbody></table>
    <h2>Team stats</h2>${statsTable(g)}
    ${drives(g)}
    ${leaders(g)}
    ${g.missing_opponent_players ? '<p class="note">Individual stats are kept for elite teams only, so ' +
      'the non-Power-4 opponent shows no player lines.</p>' : ''}
    <div id="season-matchup"></div>`;
  gameMatchup(document.getElementById('season-matchup'), g, '../');
}
load();
