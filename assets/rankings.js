
const $ = id => document.getElementById(id);
let DATA = null;

async function load() {
  const season = $('season').value;
  DATA = await (await fetch(`../data/rankings/${season}.json`).then(r => r.json()));
  const poll = $('poll').value;
  const releases = DATA.polls[poll] || [];
  const sel = $('release');
  sel.innerHTML = releases.map(r => `<option value="${r.key}">${r.label}</option>`).join('');
  if (releases.length) sel.value = releases[releases.length - 1].key;
  draw();
}

function draw() {
  const poll = $('poll').value;
  const releases = DATA.polls[poll] || [];
  if (!releases.length) {
    $('board').innerHTML = '';
    $('empty').innerHTML = poll === 'Playoff Committee Rankings'
      ? `<p class="note">The selection committee has not released a ranking for ${DATA.season} yet. Its first
         ranking usually comes out in early November; this page fills in automatically, and the site's
         &ldquo;ranked&rdquo; filters switch to it the same day.</p>`
      : `<p class="note">No ${poll} releases for ${DATA.season} yet.</p>`;
    $('count').textContent = '';
    return;
  }
  $('empty').innerHTML = '';
  const idx = releases.findIndex(r => r.key === $('release').value);
  const release = releases[idx] || releases[releases.length - 1];
  const before = idx > 0 ? releases[idx - 1] : null;
  const was = {};
  if (before) before.rows.forEach(([rank, team]) => { was[team] = rank; });
  const move = team => {
    if (!before) return '';
    const old = was[team];
    if (old === undefined) return '<span class="up">new</span>';
    const d = old - team_rank_now[team];
    if (!d) return '<span class="flat">&ndash;</span>';
    return d > 0 ? `<span class="up">&#9650;${d}</span>` : `<span class="down">&#9660;${-d}</span>`;
  };
  const team_rank_now = {};
  release.rows.forEach(([rank, team]) => { team_rank_now[team] = rank; });
  const body = release.rows.map(([rank, team, points, fpv]) => {
    const t = DATA.teams[team] || ['?', '', null];
    return `<tr><td class="rank">${rank}</td>
      <td class="name">${logo(t[2], 20)}<a href="../teams/team.html?id=${team}&season=${DATA.season}">${t[0]}</a></td>
      <td class="name">${t[1] || ''}</td>
      <td class="name">${move(team)}</td>
      <td>${points ?? ''}</td><td>${fpv || ''}</td></tr>`;
  }).join('');
  $('board').innerHTML = `<thead><tr><th class="rank">#</th><th class="name">Team</th><th class="name">Conf</th>
      <th class="name">Move</th><th>Points</th><th>1st place</th></tr></thead><tbody>${body}</tbody>`;
  $('count').textContent = `${release.rows.length} teams · ${poll} · ${release.label}`;
}
$('season').onchange = load;
$('poll').onchange = load;
$('release').onchange = draw;
load();
