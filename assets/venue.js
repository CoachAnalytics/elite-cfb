
const $ = id => document.getElementById(id);
let DATA = null, scope = 'all';

/** A figure with where it sits, the way the rest of the site writes it. */
const ranked = (v, how, rank) => {
  const shown = fmt(v, how);
  if (v === null || v === undefined || !rank) return shown;
  return `${shown}<sup>${rank}</sup>`;
};

const fmt = (v, how) => {
  if (v === null || v === undefined) return '—';
  if (how === 'pct') return (v * 100).toFixed(1) + '%';
  if (how === 'dec3') return v.toFixed(3);
  if (how === 'dec2') return v.toFixed(2);
  return v.toFixed(1);
};
const signed = (v, how) => {
  if (v === null || v === undefined) return '—';
  const text = how === 'pct' ? (Math.abs(v) * 100).toFixed(1) + '%'
    : how === 'dec3' ? Math.abs(v).toFixed(3)
    : how === 'dec2' ? Math.abs(v).toFixed(2) : Math.abs(v).toFixed(1);
  return (v > 0 ? '+' : v < 0 ? '−' : '') + text;
};

/** A gap is good or bad depending on which way the measure runs: conceding
 *  fewer yards at home is the same kind of news as gaining more. */
function tone(gap, better) {
  if (gap === null || gap === undefined || Math.abs(gap) < 1e-9) return '';
  const good = better === 'high' ? gap > 0 : gap < 0;
  return good ? ' good' : ' bad';
}

function draw() {
  const team = $('team').value;
  const side = (DATA.rows[team] || {})[scope] || {};
  const league = (DATA.league || {})[scope] || {};
  const home = side.home || {}, away = side.away || {}, neutral = side.neutral || {};
  const hasNeutral = Boolean(neutral.games);

  const fewest = Math.min(home.games || 0, away.games || 0);
  $('counts').textContent =
    `${home.games || 0} home · ${away.games || 0} away`
    + (hasNeutral ? ` · ${neutral.games} neutral` : '')
    + (scope === 'power4' ? ', against Power 4 opponents only' : ', every opponent');
  // Four games a side is not much to split a season on, and in October it is
  // all anybody has. Say it on the page rather than hoping it is understood.
  const of = home.of || away.of || 0;
  if (of) $('counts').textContent += ` · ranked among ${of}`;
  $('thin').hidden = fewest >= 4;
  $('thin').textContent = fewest === 0
    ? 'No games on one side of this split yet, so there is nothing to compare.'
    : `Only ${fewest} game${fewest === 1 ? '' : 's'} on the thinner side of this split. `
      + 'One afternoon moves any of these numbers a long way; treat what follows as a '
      + 'description of those games rather than a property of the team.';

  let group = '';
  const body = DATA.measures.map(m => {
    const h = home[m.key], a = away[m.key], n = neutral[m.key];
    if (h === undefined && a === undefined) return '';
    const gap = (h === undefined || a === undefined) ? null : h - a;
    const lh = (league.home || {})[m.key], la = (league.away || {})[m.key];
    const leagueGap = (lh === undefined || la === undefined) ? null : lh - la;
    const versus = (gap === null || leagueGap === null) ? null : gap - leagueGap;
    const head = m.group !== group
      ? `<tr class="group"><td colspan="${hasNeutral ? 6 : 5}">${
          m.group === 'offense' ? 'Offense' : m.group === 'defense' ? 'Defense' : 'Discipline'
        }</td></tr>` : '';
    group = m.group;
    return head + `<tr>
      <td class="name">${m.label}</td>
      <td class="num">${ranked(h, m.format, (home.rank || {})[m.key])}</td>
      <td class="num">${ranked(a, m.format, (away.rank || {})[m.key])}</td>
      ${hasNeutral ? `<td class="num dim">${fmt(n, m.format)}</td>` : ''}
      <td class="num gap${tone(gap, m.better)}">${signed(gap, m.format)}</td>
      <td class="num dim">${signed(leagueGap, m.format)}</td>
      <td class="num${tone(versus, m.better)}">${signed(versus, m.format)}</td>
    </tr>`;
  }).join('');

  $('board').innerHTML = `<table class="report venue"><thead><tr>
      <th class="name">Measure</th><th class="num">Home</th><th class="num">Away</th>
      ${hasNeutral ? '<th class="num">Neutral</th>' : ''}
      <th class="num">Home &minus; away</th><th class="num">League</th>
      <th class="num">vs league</th>
    </tr></thead><tbody>${body}</tbody></table>`;
}

async function load() {
  const season = $('season').value;
  DATA = await window.memberData(`venue/${season}.json`);
  const current = $('team').value;
  $('team').innerHTML = DATA.teams.map(t =>
    `<option value="${t.team_id}">${t.school}</option>`).join('');
  if (current && DATA.rows[current]) $('team').value = current;
  draw();
}

(async () => {
  $('season').onchange = load;
  $('team').onchange = draw;
  document.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => {
    scope = b.dataset.scope;
    document.querySelectorAll('[data-scope]').forEach(x =>
      x.classList.toggle('on', x === b));
    draw();
  });
  await load();
})();
