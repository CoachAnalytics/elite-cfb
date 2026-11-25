
// This page does not load the shared engine, so it resolves a logo path from
// the site root itself. Anything already absolute is left alone.
const logo = (url, size = 18) => url
  ? `<img class="logo" src="${url.includes('://') ? url : (window.CA_UP || '') + url}" alt=""
      width="${size}" height="${size}" loading="lazy">` : '';

const params = new URLSearchParams(location.search);
let WEEKS = null;

function fmtKick(iso, tbd) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return tbd ? day : `${day} &middot; ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

let GAMES_THIS_WEEK = [], POLL = 'AP';
const CONFS = multi('conf', (sel, options) => {
  if (sel.length === options.length) return 'All conferences';
  if (!sel.length) return 'No conferences';
  return sel.length <= 2 ? sel.join(', ') : `${sel.length} conferences`;
}, () => drawGames());

function team(side, g) {
  const elite = g[side + '_elite'];
  const rank = g[side + '_rank'];
  const name = (rank ? `<span class="rk">#${rank}</span> ` : '') + g[side + '_school'];
  const pts = g[side + '_points'];
  const cls = elite ? 'elite' : 'other';
  const badge = g[side + '_logo'];       // a path from the site root, or nothing
  // before kickoff the score column shows the team's current record
  const right = g.completed ? (pts === null ? '' : pts)
    : `<span class="trec">${g[side + '_record'] || ''}</span>`;
  return `<div class="side ${cls}">
      <div class="tname">${logo(badge, 20)}${name}${elite ? '' : ' <span class="tag">non-P4</span>'}</div>
      <div class="tscore">${right}</div>
    </div>`;
}

async function loadWeeks() {
  const season = document.getElementById('season').value;
  const res = await fetch(`../data/games/${season}/weeks.json`);
  const meta = await res.json();
  WEEKS = meta.weeks;
  POLL = meta.ranking_poll;
  const rk = document.getElementById('ranked');
  rk.options[1].text = `Ranked (${POLL} Top 25)`;
  rk.options[2].text = `Unranked (${POLL})`;
  const sel = document.getElementById('week');
  sel.innerHTML = WEEKS.map(w =>
    `<option value="${w.season_type}-${w.week}">${w.season_type === 'postseason' ? 'Postseason' : 'Week ' + w.week}` +
    `${w.played === 0 ? ' (upcoming)' : w.played < w.games ? ' (in progress)' : ''}</option>`).join('');
  const wanted = params.get('week');
  if (wanted && [...sel.options].some(o => o.value === wanted)) sel.value = wanted;
  else {
    // the current week: the first with a game still to play, else the last
    const current = WEEKS.find(w => w.played < w.games) || WEEKS[WEEKS.length - 1];
    if (current) sel.value = `${current.season_type}-${current.week}`;
  }
  loadGames();
}

async function loadGames() {
  const season = document.getElementById('season').value;
  const key = document.getElementById('week').value;
  const res = await fetch(`../data/games/${season}/${key}.json`);
  GAMES_THIS_WEEK = await res.json();
  const confs = [...new Set(GAMES_THIS_WEEK.flatMap(g => [g.home_conference, g.away_conference]).filter(Boolean))].sort();
  const keep = CONFS.options.length && !CONFS.all() ? CONFS.selected() : null;
  CONFS.fill(confs.map(c => [c, c]), keep);
  drawGames();
}

function drawGames() {
  const ranked = document.getElementById('ranked').value;
  const confs = CONFS.all() ? null : new Set(CONFS.selected());
  const games = GAMES_THIS_WEEK.filter(g => {
    const hasRank = Boolean(g.home_rank || g.away_rank);
    if (ranked === 'ranked' && !hasRank) return false;
    if (ranked === 'unranked' && hasRank) return false;
    if (confs && !confs.has(g.home_conference) && !confs.has(g.away_conference)) return false;
    return true;
  });
  if (ranked === 'ranked') games.sort((a, b) => Math.min(a.home_rank || 99, a.away_rank || 99) - Math.min(b.home_rank || 99, b.away_rank || 99));
  document.getElementById('cards').innerHTML = games.map(g => `
    <a class="game ${g.completed ? '' : 'upcoming'}" href="game.html?id=${g.game_id}">
      <div class="when">${fmtKick(g.start_date, g.start_time_tbd)}${g.tv ? ' &middot; ' + g.tv : ''}</div>
      ${team('away', g)}
      <div class="at">at</div>
      ${team('home', g)}
      <div class="meta">${g.completed ? 'Final' : 'Upcoming' + (g.line ? ' &middot; ' + g.line : '')}
        ${g.neutral_site ? ' &middot; neutral site' : ''}${g.conference_game ? ' &middot; conference' : ''}</div>
      <div class="rating">Rating: &mdash;</div>
    </a>`).join('') || '<p class="sub">No games match that filter this week.</p>';
  document.getElementById('count').textContent = `${games.length} games`;
}

document.getElementById('season').onchange = loadWeeks;
document.getElementById('week').onchange = loadGames;
document.getElementById('ranked').onchange = drawGames;
loadWeeks();
